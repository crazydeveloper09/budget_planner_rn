import { Goal, Transaction } from "../db/interfaces";
import { goalStartDate } from "./dailyLeftover";
import { toIsoDate } from "./dates";

export function goalPriority(value?: number) {
  return value === 1 || value === 3 ? value : 2;
}
export function orderedGoals(goals: Goal[]) {
  return [...goals].sort((a, b) => goalPriority(b.priority) - goalPriority(a.priority) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Allocate each day's unused limit once, only to goals that existed on that day. */
export function allocateGoalSavings(goals: Goal[], entries: Transaction[], dailyLimit: number, today = toIsoDate(new Date())) {
  const ordered = orderedGoals(goals);
  const cents = (value: number) => Math.max(0, Math.round(value * 100));
  const allocated = new Map(ordered.map(goal => [goal.id, 0]));
  const starts = new Map(ordered.map(goal => [goal.id, goalStartDate(goal.createdAt)]));
  const first = [...starts.values()].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today).sort()[0];
  if (!first || dailyLimit <= 0) return allocated;
  const spent = new Map<string, number>();
  for (const entry of entries) {
    // Income is a cash flow, not automatically a contribution to a savings goal.
    if (entry.regular || entry.type !== "expense" || entry.date < first || entry.date > today) continue;
    spent.set(entry.date, (spent.get(entry.date) ?? 0) + cents(entry.amount));
  }
  const [y, m, d] = first.split("-").map(Number);
  const cursor = new Date(y, m - 1, d);
  while (toIsoDate(cursor) <= today) {
    const date = toIsoDate(cursor);
    let pool = Math.max(0, cents(dailyLimit) - (spent.get(date) ?? 0));
    for (const goal of ordered) {
      if ((starts.get(goal.id) ?? "") > date) continue;
      const current = allocated.get(goal.id) ?? 0;
      const room = Math.max(0, cents(goal.targetAmount) - cents(goal.savedAmount) - current);
      const contribution = Math.min(pool, room);
      allocated.set(goal.id, current + contribution);
      pool -= contribution;
      if (pool === 0) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return new Map([...allocated].map(([id, value]) => [id, value / 100]));
}
