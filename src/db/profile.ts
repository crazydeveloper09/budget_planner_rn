import { AccountType, User } from "./interfaces";
import { getDb } from "./init";

type UserRow = {
  id: number;
  name: string;
  account_type: AccountType;
  dailySaldo: number;
  currency: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
    dailySaldo: row.dailySaldo,
    currency: row.currency,
  };
}

export async function getProfile(): Promise<User | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<UserRow>(
    "SELECT id, name, account_type, dailySaldo, currency FROM users ORDER BY id ASC LIMIT 1"
  );

  return row ? mapUser(row) : null;
}

export async function createProfile(input: {
  name: string;
  accountType: AccountType;
}): Promise<User> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO users (name, account_type, dailySaldo, currency) VALUES (?, ?, ?, ?)",
    [input.name.trim(), input.accountType, 100, "PLN"]
  );

  const profile = await getProfile();
  if (!profile || profile.id !== Number(result.lastInsertRowId)) {
    return {
      id: Number(result.lastInsertRowId),
      name: input.name.trim(),
      accountType: input.accountType,
      dailySaldo: 100,
      currency: "PLN",
    };
  }

  return profile;
}

export async function updateProfile(
  id: number,
  input: { name?: string; accountType?: AccountType; dailySaldo?: number }
): Promise<User | null> {
  const current = await getProfile();
  if (!current || current.id !== id) return current;
  const database = await getDb();
  const name = input.name?.trim() || current.name;
  const accountType = input.accountType ?? current.accountType;
  const dailySaldo = input.dailySaldo ?? current.dailySaldo;
  await database.runAsync(
    "UPDATE users SET name = ?, account_type = ?, dailySaldo = ? WHERE id = ?",
    [name, accountType, dailySaldo, Number(id)]
  );
  return getProfile();
}
