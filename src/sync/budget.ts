import { api } from "../api/client";
import { CloudEntry, CloudFamilyPerson, E2eEnvelope } from "../api/types";
import { BudgetPlaintext, decryptBudget, encryptBudget } from "../crypto/e2e";
import { loadDek, requireDek } from "../crypto/keystore";
import { Member, Transaction, User, WalletAdjustment } from "../db/interfaces";
import { listChatMessages, listChatTopics, mergeChat } from "../db/chat";
import { listGoals, mergeGoals } from "../db/goals";
import { listMembers, replaceMembers } from "../db/members";
import { createProfile, getProfile, setCloudProfileId, updateProfile } from "../db/profile";
import { listTransactions, replaceAllTransactions } from "../db/transactions";
import { readLoanLedger, replaceLoans } from "../db/loans";
import { currentWallet } from "../helpers/wallet";
import { ownerLabel } from "../helpers/owners";
import { downloadRemoteReceipts, migrateEmbeddedReceipts, uploadLocalReceipts } from "./receipts";
import { hasInternet } from "./connectivity";
import { clearPendingBudget, hasPendingBudget, markBudgetPending } from "./pendingBudget";

type SnapshotResponse = {
  household: {
    name: string;
    accountType: User["accountType"];
    dailySaldo?: number;
    encrypted?: boolean;
    walletBalance?: number | null;
    walletSetOn?: string | null;
    walletAfterId?: number;
    walletBaselineCount?: number;
    walletRecurringMonth?: string | null;
    walletHistory?: WalletAdjustment[];
  };
  people: CloudFamilyPerson[];
  entries: CloudEntry[];
  e2e?: E2eEnvelope | null;
};

let lastApplied: { profileId: number; auth: unknown; snapshot: string } | null = null;

function toCloudEntries(entries: Transaction[], people: Member[]): CloudEntry[] {
  return entries.map((entry) => {
    const label = ownerLabel(entry.memberId, people);
    return {
      date: entry.date,
      type: entry.type,
      name: entry.name,
      category: entry.category,
      amount: entry.amount,
      regular: entry.regular,
      loanPaymentKey: entry.loanPaymentKey,
      ownerName: label === "Wspólny" ? null : label,
    };
  });
}

export async function pushSqliteBudget(): Promise<SnapshotResponse | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const revision = await markBudgetPending(profile.id);
  if (!(await hasInternet())) return null;
  const people = await listMembers(profile.id);
  const { entries, loans } = await readLoanLedger(profile.id);
  const topics = await listChatTopics(profile.id);
  const messages = await listChatMessages(profile.id);
  const goals = await listGoals(profile.id);
  const dek = await requireDek();
  const e2e = encryptBudget(dek, {
    profile: {
      name: profile.name,
      accountType: profile.accountType,
      dailySaldo: profile.dailySaldo,
      walletBalance: currentWallet(profile, entries),
      walletSetOn: profile.walletSetOn,
      walletAfterId: 0,
      walletBaselineCount: entries.length,
      walletRecurringMonth: profile.walletRecurringMonth,
      walletHistory: profile.walletHistory ?? [],
    },
    people: people.map((person) => ({
      name: person.name,
      role: person.role,
      dailySaldo: person.dailySaldo,
      salary: person.salary,
    })),
    entries: toCloudEntries(entries, people),
    loans,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      category: goal.category ?? "Inne",
      priority: goal.priority ?? 2,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      createdAt: goal.createdAt,
    })),
    chat: {
      topics: topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        createdAt: topic.createdAt,
      })),
      messages: messages.map((message) => ({
        id: message.id,
        topicId: message.topicId,
        authorName: message.authorName,
        body: message.body,
        createdAt: message.createdAt,
        plan: message.plan
          ? {
              ...message.plan,
              ownerName: ownerLabel(message.plan.memberId, people) === "Wspólny" ? null : ownerLabel(message.plan.memberId, people),
              memberId: null,
            }
          : null,
      })),
    },
  });
  const { data } = await api.put("/households/snapshot", {
    people: people.map((person) => ({
      name: person.name,
      role: person.role,
    })),
    e2e,
  });
  try {
    await uploadLocalReceipts(profile.id);
  } catch {
    // budżet już w chmurze; zdjęcia dociągną się przy następnym syncu
  }
  await clearPendingBudget(profile.id, revision);
  return data;
}

export async function pullCloudBudgetIntoSqlite(onApplied?: () => Promise<unknown>): Promise<User | null> {
  const localProfile = await getProfile();
  if (!(await hasInternet())) return localProfile;
  // Never replace unsent local changes with a remote snapshot.
  if (localProfile && await hasPendingBudget(localProfile.id)) return localProfile;
  const { data } = await api.get<SnapshotResponse>("/households/snapshot");
  const activeProfile = await getProfile();
  if (activeProfile && await hasPendingBudget(activeProfile.id)) return activeProfile;
  const signature = JSON.stringify(data);
  const auth = api.defaults.headers.common.Authorization;
  if (activeProfile && lastApplied?.profileId === activeProfile.id && lastApplied.auth === auth && lastApplied.snapshot === signature) {
    // Keep local edits and IDs intact when the server has no new snapshot.
    try { await downloadRemoteReceipts(activeProfile.id, await listTransactions(activeProfile.id)); } catch {}
    return activeProfile;
  }
  let snapshot: {
    household: SnapshotResponse["household"];
    people: CloudFamilyPerson[];
    entries: CloudEntry[];
    chat?: BudgetPlaintext["chat"];
    receipts?: BudgetPlaintext["receipts"];
    goals?: BudgetPlaintext["goals"];
    loans?: BudgetPlaintext["loans"];
  } = {
    household: data.household,
    people: data.people ?? [],
    entries: data.entries ?? [],
  };

  if (data.e2e?.ciphertext && data.e2e.nonce) {
    const dek = await loadDek();
    if (!dek) {
      throw new Error("Brak klucza szyfrowania. Zaloguj się ponownie.");
    }
    const plain = decryptBudget(dek, data.e2e);
    snapshot = {
      household: {
        name: plain.profile.name,
        accountType: plain.profile.accountType,
        dailySaldo: plain.profile.dailySaldo,
        encrypted: true,
        walletBalance: plain.profile.walletBalance,
        walletSetOn: plain.profile.walletSetOn,
        walletAfterId: plain.profile.walletAfterId,
        walletBaselineCount: plain.profile.walletBaselineCount,
        walletRecurringMonth: plain.profile.walletRecurringMonth,
        walletHistory: plain.profile.walletHistory,
      },
      people: (plain.people ?? []).map((person) => {
        const cloud = (data.people ?? []).find((item) => item.name === person.name);
        return {
          name: person.name,
          role: person.role,
          dailySaldo: person.dailySaldo,
          salary: person.salary,
          inviteCode: cloud?.inviteCode ?? null,
          linked: Boolean(cloud?.linked),
        };
      }),
      entries: plain.entries ?? [],
      chat: plain.chat,
      receipts: plain.receipts,
      goals: plain.goals,
      loans: plain.loans,
    };
  }

  let profile = await getProfile();
  // Upgrade legacy snapshots using the local replica when it still contains the same ledger.
  if (profile && snapshot.household.walletBaselineCount == null) {
    const localEntries = await listTransactions(profile.id);
    const localPeople = await listMembers(profile.id);
    const canonical = (items: CloudEntry[]) => JSON.stringify(items.map(item => JSON.stringify([item.date, item.type, item.name, item.category, item.amount, Boolean(item.regular), item.ownerName ?? null])).sort());
    if (localEntries.length && canonical(toCloudEntries(localEntries, localPeople)) === canonical(snapshot.entries)
      && profile.walletBalance === snapshot.household.walletBalance
      && profile.walletAfterId === snapshot.household.walletAfterId) {
      snapshot.household = { ...snapshot.household,
        walletBalance: currentWallet(profile, localEntries), walletBaselineCount: snapshot.entries.length };
    }
  }
  if (!profile) {
    profile = await createProfile(
      {
        name: snapshot.household.name,
        accountType: snapshot.household.accountType,
        walletBalance: snapshot.household.walletBalance,
        walletSetOn: snapshot.household.walletSetOn,
        walletAfterId: snapshot.household.walletAfterId,
        walletRecurringMonth: snapshot.household.walletRecurringMonth,
        walletHistory: snapshot.household.walletHistory,
      },
      { linkCloud: true }
    );
  } else {
    await setCloudProfileId(profile.id);
    profile =
      (await updateProfile(profile.id, {
        name: snapshot.household.name,
        accountType: snapshot.household.accountType,
        dailySaldo: snapshot.household.dailySaldo,
        walletBalance: snapshot.household.walletBalance,
        walletSetOn: snapshot.household.walletSetOn,
        walletAfterId: snapshot.household.walletAfterId,
        walletRecurringMonth: snapshot.household.walletRecurringMonth,
        walletHistory: snapshot.household.walletHistory,
      })) ?? profile;
  }

  const members = await replaceMembers(
    profile.id,
    snapshot.people.map((person) => ({
      name: person.name,
      role: person.role,
      dailySaldo: person.dailySaldo,
      salary: person.salary,
    }))
  );
  const idsByName = Object.fromEntries(members.map((person) => [person.name, person.id]));
  const nextEntries = snapshot.entries.map((item) => ({
    date: item.date,
    type: item.type,
    name: item.name,
    category: item.category,
    amount: item.amount,
    regular: item.regular,
    loanPaymentKey: item.loanPaymentKey,
    memberId: item.ownerName ? idsByName[item.ownerName] ?? null : null,
  }));
  const profileId = profile.id;
  const loans = snapshot.loans;
  await replaceAllTransactions(profileId, nextEntries, loans
    ? (db) => replaceLoans(profileId, loans, db)
    : undefined);
  const storedEntries = await listTransactions(profile.id);
  // Imported transactions receive new SQLite IDs; re-anchor the cloud wallet locally.
  if (snapshot.household.walletBaselineCount != null) {
    const included = storedEntries.slice().sort((a, b) => a.id - b.id).slice(0, snapshot.household.walletBaselineCount);
    profile = (await updateProfile(profile.id, {
      walletAfterId: included.reduce((max, entry) => Math.max(max, entry.id), 0),
    })) ?? profile;
  }
  if (snapshot.goals) {
    await mergeGoals(
      profile.id,
      snapshot.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        category: goal.category,
        priority: goal.priority,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount,
        deadline: goal.deadline ?? null,
        createdAt: goal.createdAt,
      }))
    );
  }
  if (snapshot.chat) {
    await mergeChat(
      profile.id,
      snapshot.chat.topics ?? [],
      (snapshot.chat.messages ?? []).map((message) => ({
        ...message,
        plan: message.plan
          ? {
              ...message.plan,
              memberId: message.plan.ownerName ? idsByName[message.plan.ownerName] ?? null : null,
            }
          : null,
      }))
    );
  }
  // Update visible data before downloading receipt images.
  await onApplied?.();
  if (snapshot.receipts?.some((item) => item.image)) {
    await migrateEmbeddedReceipts(
      profile.id,
      snapshot.receipts.filter((item): item is typeof item & { image: string } => Boolean(item.image))
    );
  }
  try {
    await downloadRemoteReceipts(profile.id, storedEntries);
  } catch {
    // stare API albo brak sieci: zostają lokalne / zmigrowane paragony
  }
  lastApplied = { profileId: profile.id, auth, snapshot: signature };
  return getProfile();
}
