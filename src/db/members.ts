import { Member, MemberRole, NewMember } from "./interfaces";
import { getDb } from "./init";

type MemberRow = {
  id: number;
  user_id: number;
  name: string;
  role: MemberRole;
  daily_saldo: number | null;
  salary: number | null;
};

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    dailySaldo: row.daily_saldo,
    salary: row.salary,
  };
}

export async function listMembers(userId: number): Promise<Member[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<MemberRow>(
    `SELECT id, user_id, name, role, daily_saldo, salary
     FROM members WHERE user_id = ? ORDER BY id ASC`,
    [Number(userId)]
  );

  return rows.map(mapMember);
}

export async function addMember(userId: number, member: NewMember): Promise<Member> {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO members (user_id, name, role, monthly_income, daily_saldo, salary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number(userId),
      member.name.trim(),
      member.role,
      null,
      member.dailySaldo,
      member.salary,
    ]
  );

  return {
    id: Number(result.lastInsertRowId),
    userId: Number(userId),
    ...member,
    name: member.name.trim(),
  };
}

export async function addMembers(userId: number, members: NewMember[]): Promise<Member[]> {
  const created: Member[] = [];
  for (const person of members) {
    created.push(await addMember(userId, person));
  }
  return created;
}

export async function removeMember(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM members WHERE id = ?", [Number(id)]);
}

export async function replaceMembers(userId: number, people: NewMember[]): Promise<Member[]> {
  const database = await getDb();
  await database.runAsync("DELETE FROM members WHERE user_id = ?", [Number(userId)]);
  return addMembers(userId, people);
}
