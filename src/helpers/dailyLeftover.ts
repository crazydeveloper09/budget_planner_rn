import { Member, Transaction, User } from "../db/interfaces";
import { toIsoDate } from "./dates";

export function dailyLimitAmount(profile: User | null, members: Member[]): number {
  if (!profile) return 0;
  if (profile.accountType === "family") {
    return members.reduce((sum, member) => sum + (member.dailySaldo ?? 0), 0);
  }
  return profile.dailySaldo ?? 100;
}

export function leftoverOnDay(dayEntries: Transaction[], dailyLimit: number): number {
  let spent = 0;
  let incoming = 0;
  for (const entry of dayEntries) {
    if (entry.regular) continue;
    if (entry.type === "expense") spent += entry.amount;
    else if (entry.type === "income") incoming += entry.amount;
  }
  return dailyLimit - spent + incoming;
}

export function goalStartDate(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  return createdAt.slice(0, 10);
}

export function sumDailyLeftovers(
  entries: Transaction[],
  dailyLimit: number,
  fromIso: string,
  toIso: string
): number {
  if (!fromIso || !toIso || fromIso > toIso || dailyLimit <= 0) return 0;

  const byDate = new Map<string, Transaction[]>();
  for (const entry of entries) {
    if (entry.regular) continue;
    if (entry.date < fromIso || entry.date > toIso) continue;
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
    else byDate.set(entry.date, [entry]);
  }

  const [year, month, day] = fromIso.split("-").map(Number);
  const [endYear, endMonth, endDay] = toIso.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  const end = new Date(endYear, endMonth - 1, endDay);
  let total = 0;
  while (cursor.getTime() <= end.getTime()) {
    const iso = toIsoDate(cursor);
    const leftover = leftoverOnDay(byDate.get(iso) ?? [], dailyLimit);
    if (leftover > 0) total += leftover;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.round(total * 100) / 100;
}
