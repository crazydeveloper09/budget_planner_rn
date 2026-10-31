import { api } from "../api/client";
import { CloudEntry, CloudFamilyPerson, E2eEnvelope } from "../api/types";
import { BudgetPlaintext, decryptBudget, encryptBudget } from "../crypto/e2e";
import { loadDek, requireDek } from "../crypto/keystore";
import { Member, Transaction, User } from "../db/interfaces";
import { listChatMessages, listChatTopics, replaceChat } from "../db/chat";
import { listGoals, replaceGoals } from "../db/goals";
import { listMembers, replaceMembers } from "../db/members";
import { createProfile, getProfile, setCloudProfileId, updateProfile } from "../db/profile";
import { listTransactions, replaceAllTransactions } from "../db/transactions";
import { ownerLabel } from "../helpers/owners";
import { downloadRemoteReceipts, migrateEmbeddedReceipts, uploadLocalReceipts } from "./receipts";

type SnapshotResponse = {
  household: {
    name: string;
    accountType: User["accountType"];
    dailySaldo?: number;
    encrypted?: boolean;
    walletBalance?: number | null;
    walletSetOn?: string | null;
    walletAfterId?: number;
    walletRecurringMonth?: string | null;
  };
  people: CloudFamilyPerson[];
  entries: CloudEntry[];
  e2e?: E2eEnvelope | null;
};

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
      ownerName: label === "Wspólny" ? null : label,
    };
  });
}

export async function pushSqliteBudget(): Promise<SnapshotResponse | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const people = await listMembers(profile.id);
  const entries = await listTransactions(profile.id);
  const topics = await listChatTopics(profile.id);
  const messages = await listChatMessages(profile.id);
  const goals = await listGoals(profile.id);
  const dek = await requireDek();
  const e2e = encryptBudget(dek, {
    profile: {
      name: profile.name,
      accountType: profile.accountType,
      dailySaldo: profile.dailySaldo,
      walletBalance: profile.walletBalance,
      walletSetOn: profile.walletSetOn,
      walletAfterId: profile.walletAfterId,
      walletRecurringMonth: profile.walletRecurringMonth,
    },
    people: people.map((person) => ({
      name: person.name,
      role: person.role,
      dailySaldo: person.dailySaldo,
      salary: person.salary,
    })),
    entries: toCloudEntries(entries, people),
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
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
  return data;
}

export async function pullCloudBudgetIntoSqlite(): Promise<User | null> {
  const { data } = await api.get<SnapshotResponse>("/households/snapshot");
  let snapshot: {
    household: SnapshotResponse["household"];
    people: CloudFamilyPerson[];
    entries: CloudEntry[];
    chat?: BudgetPlaintext["chat"];
    receipts?: BudgetPlaintext["receipts"];
    goals?: BudgetPlaintext["goals"];
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
        walletRecurringMonth: plain.profile.walletRecurringMonth,
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
    };
  }

  let profile = await getProfile();
  if (!profile) {
    profile = await createProfile(
      {
        name: snapshot.household.name,
        accountType: snapshot.household.accountType,
        walletBalance: snapshot.household.walletBalance,
        walletSetOn: snapshot.household.walletSetOn,
        walletAfterId: snapshot.household.walletAfterId,
        walletRecurringMonth: snapshot.household.walletRecurringMonth,
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
    memberId: item.ownerName ? idsByName[item.ownerName] ?? null : null,
  }));
  await replaceAllTransactions(profile.id, nextEntries);
  const storedEntries = await listTransactions(profile.id);
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
  if (snapshot.goals) {
    await replaceGoals(
      profile.id,
      snapshot.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount,
        deadline: goal.deadline ?? null,
        createdAt: goal.createdAt,
      }))
    );
  }
  if (snapshot.chat) {
    await replaceChat(
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
  return getProfile();
}
