import { api } from "../api/client";
import { CloudEntry, CloudFamilyPerson, E2eEnvelope } from "../api/types";
import { decryptBudget, encryptBudget } from "../crypto/e2e";
import { loadDek, requireDek } from "../crypto/keystore";
import { Member, Transaction, User } from "../db/interfaces";
import { listMembers, replaceMembers } from "../db/members";
import { createProfile, getProfile, updateProfile } from "../db/profile";
import { listTransactions, replaceAllTransactions } from "../db/transactions";
import { ownerLabel } from "../helpers/owners";

type SnapshotResponse = {
  household: {
    name: string;
    accountType: User["accountType"];
    dailySaldo?: number;
    encrypted?: boolean;
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
  const dek = await requireDek();
  const e2e = encryptBudget(dek, {
    profile: {
      name: profile.name,
      accountType: profile.accountType,
      dailySaldo: profile.dailySaldo,
    },
    people: people.map((person) => ({
      name: person.name,
      role: person.role,
      dailySaldo: person.dailySaldo,
      salary: person.salary,
    })),
    entries: toCloudEntries(entries, people),
  });
  const { data } = await api.put("/households/snapshot", {
    people: people.map((person) => ({
      name: person.name,
      role: person.role,
    })),
    e2e,
  });
  return data;
}

export async function pullCloudBudgetIntoSqlite(): Promise<User | null> {
  const { data } = await api.get<SnapshotResponse>("/households/snapshot");
  let snapshot = {
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
    };
  }

  let profile = await getProfile();
  if (!profile) {
    profile = await createProfile({
      name: snapshot.household.name,
      accountType: snapshot.household.accountType,
    });
  } else {
    profile =
      (await updateProfile(profile.id, {
        name: snapshot.household.name,
        accountType: snapshot.household.accountType,
        dailySaldo: snapshot.household.dailySaldo,
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
  await replaceAllTransactions(
    profile.id,
    snapshot.entries.map((item) => ({
      date: item.date,
      type: item.type,
      name: item.name,
      category: item.category,
      amount: item.amount,
      regular: item.regular,
      memberId: item.ownerName ? idsByName[item.ownerName] ?? null : null,
    }))
  );
  return getProfile();
}
