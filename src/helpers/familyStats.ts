import { Member, Transaction } from "../db/interfaces";
import { EXPENSE_CATEGORIES, getCategoryOption } from "./categories";
import { formatPln } from "./money";
import { SHARED_OWNER_ID } from "./owners";
import { shiftMonth } from "./monthKey";

export type StatPerson = {
  id: number;
  name: string;
};

export type RankRow = {
  name: string;
  raw: number;
  label: string;
};

export type AwardCard = {
  id: string;
  emoji: string;
  title: string;
  punch: string;
  winner: string | null;
  detail: string;
  ranking: RankRow[];
};

export type CategorySpend = {
  label: string;
  amount: number;
  icon: string;
  tint: string;
};

export type FamilyMonthStats = {
  awards: AwardCard[];
  categories: CategorySpend[];
  totalExpenses: number;
  totalIncome: number;
};

function inMonth(entry: Transaction, monthKey: string): boolean {
  const entryMonth = entry.date.slice(0, 7);
  if (entry.regular) return entryMonth <= monthKey;
  return entryMonth === monthKey;
}

function ownerId(entry: Transaction): number {
  return entry.memberId ?? SHARED_OWNER_ID;
}

function peopleFrom(members: Member[]): StatPerson[] {
  const named = members.map((member) => ({ id: member.id, name: member.name }));
  return [{ id: SHARED_OWNER_ID, name: "Wspólny" }, ...named];
}

function sortDesc(rows: RankRow[]): RankRow[] {
  return [...rows].sort((a, b) => b.raw - a.raw);
}

function awardFrom(
  id: string,
  emoji: string,
  title: string,
  punch: string,
  ranking: RankRow[],
  empty: string,
  keep: (row: RankRow) => boolean = (row) => row.raw > 0
): AwardCard {
  const ranked = sortDesc(ranking).filter(keep);
  const top = ranked[0];
  return {
    id,
    emoji,
    title,
    punch,
    winner: top?.name ?? null,
    detail: top ? `${top.name} · ${top.label}` : empty,
    ranking: ranked.slice(0, 3),
  };
}

function personTotals(entries: Transaction[], people: StatPerson[]) {
  return people.map((person) => {
    const mine = entries.filter((entry) => ownerId(entry) === person.id);
    const expenses = mine.filter((entry) => entry.type === "expense");
    const income = mine.filter((entry) => entry.type === "income");
    const spent = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    const earned = income.reduce((sum, entry) => sum + entry.amount, 0);
    return {
      person,
      spent,
      earned,
      expenseCount: expenses.length,
      pleasures: expenses
        .filter((entry) => entry.category === "Rozrywka")
        .reduce((sum, entry) => sum + entry.amount, 0),
      food: expenses
        .filter((entry) => entry.category === "Jedzenie")
        .reduce((sum, entry) => sum + entry.amount, 0),
    };
  });
}

export function buildFamilyMonthStats(
  entries: Transaction[],
  members: Member[],
  monthKey: string
): FamilyMonthStats {
  const people = peopleFrom(members);
  const monthEntries = entries.filter((entry) => inMonth(entry, monthKey));
  const prevEntries = entries.filter((entry) => inMonth(entry, shiftMonth(monthKey, -1)));
  const now = personTotals(monthEntries, people);
  const prev = personTotals(prevEntries, people);
  const prevById = Object.fromEntries(prev.map((row) => [row.person.id, row]));

  const totalExpenses = now.reduce((sum, row) => sum + row.spent, 0);
  const totalIncome = now.reduce((sum, row) => sum + row.earned, 0);

  const awards: AwardCard[] = [
    awardFrom(
      "wallet",
      "💸",
      "Portfel bez dna",
      "Karta płacze, ale klimat jest.",
      now.map((row) => ({
        name: row.person.name,
        raw: row.spent,
        label: formatPln(row.spent),
      })),
      "Nikt jeszcze nie dziurawił portfela."
    ),
    awardFrom(
      "pleasures",
      "☕",
      "Małe przyjemności, wielkie koszty",
      "„Tylko kawa” i inne jakże „potrzebne” rzeczy.",
      now.map((row) => ({
        name: row.person.name,
        raw: row.pleasures,
        label: formatPln(row.pleasures),
      })),
      "Zero rozrywki. Mnisi w tym domu."
    ),
    awardFrom(
      "shop",
      "🛒",
      "Król zakupów",
      "Paragonów starczy na tapetę.",
      now.map((row) => ({
        name: row.person.name,
        raw: row.expenseCount,
        label: row.expenseCount === 1 ? "1 transakcja" : `${row.expenseCount} transakcji`,
      })),
      "Kasowa cisza. Podejrzane."
    ),
    awardFrom(
      "food",
      "🍕",
      "Głodny sukcesu",
      "Jedzenie na mieście wzywa po imieniu.",
      now.map((row) => ({
        name: row.person.name,
        raw: row.food,
        label: formatPln(row.food),
      })),
      "Nikt nie fundował sobie menu dnia."
    ),
    awardFrom(
      "save",
      "🐷",
      "Mistrz oszczędzania",
      "Skarbonka bije brawo. Reszta — mniej.",
      now
        .filter((row) => row.earned > 0)
        .map((row) => {
          const rate = (row.earned - row.spent) / row.earned;
          return {
            name: row.person.name,
            raw: rate,
            label: `${Math.round(rate * 100)}% przychodu zostaje`,
          };
        }),
      "Najpierw wpływy, potem laury.",
      () => true
    ),
    awardFrom(
      "inflation",
      "📈",
      "Inflacja osobista",
      "Ceny w sklepie? Nie. To ktoś z domu.",
      now.map((row) => {
        const before = prevById[row.person.id]?.spent ?? 0;
        const delta = row.spent - before;
        const pct = before > 0 ? delta / before : row.spent > 0 ? 1 : 0;
        return {
          name: row.person.name,
          raw: pct,
          label:
            before > 0
              ? `${delta >= 0 ? "+" : ""}${Math.round(pct * 100)}% vs poprzedni miesiąc`
              : row.spent > 0
                ? "z zera na orbitę"
                : "bez zmian",
        };
      }),
      "Wydatki stoją w miejscu. Nuda, ale tania."
    ),
  ];

  const expenseEntries = monthEntries.filter((entry) => entry.type === "expense");
  const byCategory = new Map<string, number>();
  for (const entry of expenseEntries) {
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
  }
  const known = EXPENSE_CATEGORIES.map((item) => item.label);
  const labels = [...new Set([...known, ...byCategory.keys()])];
  const categories = labels
    .map((label) => {
      const option = getCategoryOption(label, "expense");
      return {
        label,
        amount: byCategory.get(label) ?? 0,
        icon: option?.icon ?? "tag-outline",
        tint: option?.tint ?? "#8A7A88",
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return { awards, categories, totalExpenses, totalIncome };
}
