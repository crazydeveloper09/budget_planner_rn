import { Household } from "../models/Household.js";
import { User } from "../models/User.js";

export function publicUser(user: InstanceType<typeof User>) {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.familyMemberName || user.displayName,
    role: user.role,
    totpEnabled: user.totpEnabled,
    householdId: user.householdId ? String(user.householdId) : null,
    familyMemberName: user.familyMemberName,
  };
}

export function isEncrypted(household: InstanceType<typeof Household>) {
  return Boolean(household.e2e?.ciphertext);
}

export function publicPeople(
  household: InstanceType<typeof Household>,
  options: { includeInvite: boolean }
) {
  const encrypted = isEncrypted(household);
  return (household.people ?? []).map((person) => ({
    name: person.name,
    role: person.role,
    dailySaldo: encrypted ? null : person.dailySaldo,
    salary: encrypted ? null : person.salary,
    inviteCode: options.includeInvite ? person.inviteCode : null,
    linked: Boolean(person.linkedUserId),
  }));
}

export function publicE2e(household: InstanceType<typeof Household>, user: InstanceType<typeof User>) {
  if (!isEncrypted(household)) return null;
  const wraps = (household.e2e?.wraps ?? [])
    .filter((wrap) => {
      if (wrap.kind === "user" && wrap.userId && String(wrap.userId) === String(user._id)) {
        return true;
      }
      if (wrap.kind === "invite" && user.role === "member") {
        const person = household.people.find((item) => String(item.linkedUserId) === String(user._id));
        return Boolean(person?.inviteCode && wrap.inviteCode === person.inviteCode);
      }
      return false;
    })
    .map((wrap) => ({
      kind: wrap.kind,
      salt: wrap.salt,
      wrappedDek: wrap.wrappedDek,
    }));
  return {
    version: household.e2e?.version ?? 1,
    nonce: household.e2e?.nonce ?? "",
    ciphertext: household.e2e?.ciphertext ?? "",
    wraps,
  };
}

export function publicRecurring(household: InstanceType<typeof Household>) {
  if (isEncrypted(household)) return [];
  const fromEntries = (household.entries ?? [])
    .filter((item) => item.isRegular)
    .map((item) => ({
      type: item.entryKind,
      name: item.title,
      category: item.category,
      amount: item.amount,
      ownerName: item.ownerName,
    }));
  if (fromEntries.length > 0) return fromEntries;
  return (household.recurring ?? []).map((item) => ({
    type: item.entryKind,
    name: item.title,
    category: item.category,
    amount: item.amount,
    ownerName: item.ownerName,
  }));
}

export function publicEntries(household: InstanceType<typeof Household>) {
  if (isEncrypted(household)) return [];
  const stored = household.entries ?? [];
  if (stored.length > 0) {
    return stored.map((item) => ({
      date: item.entryDate,
      type: item.entryKind,
      name: item.title,
      category: item.category,
      amount: item.amount,
      regular: Boolean(item.isRegular),
      ownerName: item.ownerName,
    }));
  }
  return publicRecurring(household).map((item) => ({
    date: new Date().toISOString().slice(0, 10),
    ...item,
    regular: true,
  }));
}

export function publicHousehold(
  household: InstanceType<typeof Household>,
  options: { includeInvite: boolean }
) {
  return {
    id: String(household._id),
    name: household.name,
    accountType: household.accountType,
    inviteCode: options.includeInvite ? household.inviteCode : null,
    dailySaldo: household.dailySaldo ?? 100,
    encrypted: isEncrypted(household),
  };
}
