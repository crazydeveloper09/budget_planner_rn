import { getRandomBytes } from "expo-crypto";
import { bytesToHex } from "../crypto/bytes";
import { goalPriority } from "../helpers/goalAllocation";
import { Goal, NewGoal } from "./interfaces";
import { getDb } from "./init";

type GoalRow = {
  id: string;
  user_id: number;
  title: string;
  category: string;
  priority: number;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
  created_at: string;
};

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category ?? "Inne",
    priority: goalPriority(row.priority),
    targetAmount: Number(row.target_amount),
    savedAmount: Number(row.saved_amount),
    deadline: row.deadline,
    createdAt: row.created_at,
  };
}

export function newGoalId() {
  return `g_${bytesToHex(getRandomBytes(8))}`;
}

export async function listGoals(userId: number): Promise<Goal[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<GoalRow>(
    `SELECT id, user_id, title, category, priority, target_amount, saved_amount, deadline, created_at
     FROM goals WHERE user_id = ? ORDER BY created_at DESC`,
    [Number(userId)]
  );
  return rows.map(mapGoal);
}

export async function addGoal(userId: number, input: Omit<NewGoal, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<Goal> {
  const database = await getDb();
  const goal: Goal = {
    id: input.id ?? newGoalId(),
    userId: Number(userId),
    title: input.title.trim(),
    category: input.category ?? "Inne",
    priority: goalPriority(input.priority),
    targetAmount: Number(input.targetAmount),
    savedAmount: Number(input.savedAmount ?? 0),
    deadline: input.deadline ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  await database.runAsync(
    `INSERT INTO goals (id, user_id, title, category, priority, target_amount, saved_amount, deadline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [goal.id, goal.userId, goal.title, goal.category ?? "Inne", goalPriority(goal.priority), goal.targetAmount, goal.savedAmount, goal.deadline, goal.createdAt]
  );
  return goal;
}

export async function updateGoal(
  id: string,
  input: { priority?: number; category?: string; title?: string; targetAmount?: number; savedAmount?: number; deadline?: string | null }
): Promise<void> {
  const database = await getDb();
  const current = await database.getFirstAsync<GoalRow>(
    "SELECT id, user_id, title, category, priority, target_amount, saved_amount, deadline, created_at FROM goals WHERE id = ?",
    [id]
  );
  if (!current) return;
  await database.runAsync(
    `UPDATE goals SET title = ?, category = ?, priority = ?, target_amount = ?, saved_amount = ?, deadline = ? WHERE id = ?`,
    [
      input.title?.trim() || current.title,
      input.category ?? current.category ?? "Inne",
      goalPriority(input.priority ?? current.priority),
      input.targetAmount ?? current.target_amount,
      input.savedAmount ?? current.saved_amount,
      input.deadline === undefined ? current.deadline : input.deadline,
      id,
    ]
  );
}

export async function removeGoal(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM goals WHERE id = ?", [id]);
}

export async function replaceGoals(userId: number, items: NewGoal[]): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM goals WHERE user_id = ?", [Number(userId)]);
  for (const item of items) {
    await addGoal(userId, item);
  }
}

export async function mergeGoals(userId: number, items: NewGoal[]): Promise<void> {
  const existing = await listGoals(userId);
  const byId = new Map<string, NewGoal>();
  existing.forEach((goal) => {
    byId.set(goal.id, {
      id: goal.id,
      title: goal.title,
      category: goal.category ?? "Inne",
      priority: goalPriority(goal.priority),
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      createdAt: goal.createdAt,
    });
  });
  items.forEach((goal) => {
    byId.set(goal.id, { ...goal, category: goal.category ?? byId.get(goal.id)?.category ?? "Inne", priority: goalPriority(goal.priority ?? byId.get(goal.id)?.priority) });
  });
  await replaceGoals(userId, Array.from(byId.values()));
}
