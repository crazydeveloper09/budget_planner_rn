import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccountType, User } from "./interfaces";
import { getDb } from "./init";

const ACTIVE_PROFILE_KEY = "bp_active_profile_id";
const CLOUD_PROFILE_KEY = "bp_cloud_profile_id";

type UserRow = {
  id: number;
  name: string;
  account_type: AccountType;
  dailySaldo: number;
  currency: string;
  wallet_balance: number | null;
  wallet_set_on: string | null;
  wallet_after_id: number | null;
  wallet_recurring_month: string | null;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
    dailySaldo: row.dailySaldo,
    currency: row.currency,
    walletBalance: row.wallet_balance == null ? null : Number(row.wallet_balance),
    walletSetOn: row.wallet_set_on,
    walletAfterId: Number(row.wallet_after_id ?? 0),
    walletRecurringMonth: row.wallet_recurring_month,
  };
}

const USER_SELECT =
  "SELECT id, name, account_type, dailySaldo, currency, wallet_balance, wallet_set_on, wallet_after_id, wallet_recurring_month FROM users";

export async function listProfiles(): Promise<User[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<UserRow>(`${USER_SELECT} ORDER BY id ASC`);
  return rows.map(mapUser);
}

export async function getProfileById(id: number): Promise<User | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<UserRow>(`${USER_SELECT} WHERE id = ?`, [Number(id)]);
  return row ? mapUser(row) : null;
}

export async function getActiveProfileId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
  const id = raw ? Number(raw) : NaN;
  return Number.isFinite(id) ? id : null;
}

export async function setActiveProfileId(id: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, String(id));
}

export async function getCloudProfileId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(CLOUD_PROFILE_KEY);
  const id = raw ? Number(raw) : NaN;
  return Number.isFinite(id) ? id : null;
}

export async function setCloudProfileId(id: number): Promise<void> {
  await AsyncStorage.setItem(CLOUD_PROFILE_KEY, String(id));
}

export async function getProfile(): Promise<User | null> {
  const profiles = await listProfiles();
  if (profiles.length === 0) return null;
  const activeId = await getActiveProfileId();
  return profiles.find((item) => item.id === activeId) ?? profiles[0];
}

export async function getCloudProfile(): Promise<User | null> {
  const cloudId = await getCloudProfileId();
  if (cloudId != null) {
    const linked = await getProfileById(cloudId);
    if (linked) return linked;
  }
  const profiles = await listProfiles();
  return profiles[0] ?? null;
}

export async function createProfile(
  input: {
    name: string;
    accountType: AccountType;
    dailySaldo?: number;
    walletBalance?: number | null;
    walletSetOn?: string | null;
    walletAfterId?: number;
    walletRecurringMonth?: string | null;
  },
  options?: { linkCloud?: boolean }
): Promise<User> {
  const database = await getDb();
  const dailySaldo = input.dailySaldo ?? 100;
  const walletBalance = input.walletBalance ?? null;
  const walletSetOn = input.walletSetOn ?? null;
  const walletAfterId = input.walletAfterId ?? 0;
  const walletRecurringMonth = input.walletRecurringMonth ?? null;
  const result = await database.runAsync(
    "INSERT INTO users (name, account_type, dailySaldo, currency, wallet_balance, wallet_set_on, wallet_after_id, wallet_recurring_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [input.name.trim(), input.accountType, dailySaldo, "PLN", walletBalance, walletSetOn, walletAfterId, walletRecurringMonth]
  );
  const id = Number(result.lastInsertRowId);
  await setActiveProfileId(id);
  if (options?.linkCloud) await setCloudProfileId(id);
  const profile = await getProfileById(id);
  return (
    profile ?? {
      id,
      name: input.name.trim(),
      accountType: input.accountType,
      dailySaldo,
      currency: "PLN",
      walletBalance,
      walletSetOn,
      walletAfterId,
      walletRecurringMonth,
    }
  );
}

export async function updateProfile(
  id: number,
  input: {
    name?: string;
    accountType?: AccountType;
    dailySaldo?: number;
    walletBalance?: number | null;
    walletSetOn?: string | null;
    walletAfterId?: number;
    walletRecurringMonth?: string | null;
  }
): Promise<User | null> {
  const current = await getProfileById(id);
  if (!current) return getProfile();
  const database = await getDb();
  const name = input.name?.trim() || current.name;
  const accountType = input.accountType ?? current.accountType;
  const dailySaldo = input.dailySaldo ?? current.dailySaldo;
  const walletBalance = input.walletBalance === undefined ? current.walletBalance : input.walletBalance;
  const walletSetOn = input.walletSetOn === undefined ? current.walletSetOn : input.walletSetOn;
  const walletAfterId = input.walletAfterId === undefined ? current.walletAfterId : input.walletAfterId;
  const walletRecurringMonth =
    input.walletRecurringMonth === undefined ? current.walletRecurringMonth : input.walletRecurringMonth;
  await database.runAsync(
    "UPDATE users SET name = ?, account_type = ?, dailySaldo = ?, wallet_balance = ?, wallet_set_on = ?, wallet_after_id = ?, wallet_recurring_month = ? WHERE id = ?",
    [name, accountType, dailySaldo, walletBalance, walletSetOn, walletAfterId, walletRecurringMonth, Number(id)]
  );
  return getProfileById(id);
}
