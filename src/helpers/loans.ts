import { Transaction, User } from "../db/interfaces";
import { Loan, LoanInstallment } from "../db/loanTypes";
import { parsePickedDate, toIsoDate } from "./dates";
import { entriesInMonth } from "./familyStats";
import { monthKeyFromDate, shiftMonth } from "./monthKey";
import { recurringDate, recurringPostingKey } from "./spendingPlan";
import { currentWallet } from "./wallet";

export const roundMoney = (value: number) => Math.round(value * 100) / 100;
const MAX_MONTHS = 600;

export function dueDate(first: string, offset: number) {
  const anchor = parsePickedDate(first);
  const month = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  month.setDate(Math.min(last, anchor.getDate()));
  return toIsoDate(month);
}

export function remainingPrincipal(loan: Loan) {
  return Math.max(0, roundMoney(loan.principal + loan.financedFee - loan.payments.reduce((sum, payment) => sum + payment.principal, 0)));
}

export function loanSchedule(loan: Loan): LoanInstallment[] {
  let balance = roundMoney(loan.principal + loan.financedFee);
  let deferredInterest = 0;
  let deferredFees = 0;
  let rate = loan.annualRate;
  let calculated = 0;
  const rows: LoanInstallment[] = [];
  const paid = new Map(loan.payments.flatMap((payment) => payment.installment === null ? [] : [[payment.installment, payment] as const]));
  const extras = loan.payments.filter((payment) => payment.installment === null).sort((a, b) => a.date.localeCompare(b.date));
  let extraIndex = 0;
  let recordedPrincipal = loan.payments.reduce((sum, payment) => sum + payment.principal, 0);
  const lastRecorded = Math.max(0, ...loan.skipped, ...paid.keys());
  for (let number = 1; number <= MAX_MONTHS; number++) {
    const date = dueDate(loan.firstDue, number - 1);
    const periodStart = Date.parse(number === 1 ? loan.disbursedOn : rows[number - 2].date);
    const periodEnd = Date.parse(date);
    let interestBalance = balance;
    while (extraIndex < extras.length && extras[extraIndex].date <= date) {
      const extra = extras[extraIndex++];
      const reduction = Math.min(balance, extra.principal);
      const remainingFraction = (periodEnd - Math.max(periodStart, Date.parse(extra.date))) / (periodEnd - periodStart);
      interestBalance -= reduction * remainingFraction;
      balance = roundMoney(balance - reduction);
      recordedPrincipal = roundMoney(recordedPrincipal - extra.principal);
    }
    const change = loan.rateChanges[number];
    if (change !== undefined) rate = change;
    const monthlyRate = rate / 1200;
    if (balance <= 0 && roundMoney(interestBalance * monthlyRate) <= 0 && deferredInterest <= 0 && deferredFees <= 0 && number > lastRecorded) break;
    const periods = Math.max(1, loan.months - number + 1);
    if (number === 1 || (change !== undefined && number <= loan.months)) {
      calculated = monthlyRate > 0
        ? balance * monthlyRate / (1 - (1 + monthlyRate) ** -periods)
        : balance / periods;
    }
    const interestDue = roundMoney(Math.max(0, interestBalance) * monthlyRate + deferredInterest);
    const feesDue = roundMoney(loan.monthlyFee + deferredFees);
    const payment = paid.get(number);
    const skipped = loan.skipped.includes(number);
    const contract = loan.installmentOverrides[number] ?? loan.installment;
    const expected = roundMoney(calculated + loan.monthlyFee);
    const finalPayment = number === loan.months && Math.abs(balance + interestDue + feesDue - expected) <= number * 0.02;
    const available = contract ?? (finalPayment ? roundMoney(balance + interestDue + feesDue) : expected);
    const fees = skipped ? feesDue : Math.min(available, feesDue);
    const interest = skipped ? interestDue : Math.min(roundMoney(available - fees), interestDue);
    const principal = Math.min(Math.max(0, roundMoney(balance - recordedPrincipal)), Math.max(0, roundMoney(available - interest - fees)));
    const amount = roundMoney(principal + interest + fees);
    rows.push(payment
      ? { number, date, amount: payment.amount, principal: payment.principal, interest: payment.interest, fees: payment.fees, payment, skipped: false }
      : { number, date, amount, principal, interest, fees, skipped });
    if (skipped) {
      deferredInterest = interestDue;
      deferredFees = feesDue;
    } else {
      balance = Math.max(0, roundMoney(balance - (payment?.principal ?? principal)));
      if (payment) recordedPrincipal = roundMoney(recordedPrincipal - payment.principal);
      deferredInterest = roundMoney(Math.max(0, interestDue - (payment?.interest ?? interest)));
      deferredFees = roundMoney(Math.max(0, feesDue - (payment?.fees ?? fees)));
    }
  }
  return rows;
}

export function estimatedApr(loan: Loan, rows: LoanInstallment[]): number | null {
  const received = loan.principal - loan.upfrontFee;
  if (received <= 0 || !rows.length || rows.length >= MAX_MONTHS) return null;
  const cashflows = [
    ...rows.filter((row) => !row.skipped).map((row) => row.payment ?? row),
    ...loan.payments.filter((payment) => payment.installment === null),
  ].map(({ amount, date }) => ({ amount, years: (Date.parse(date) - Date.parse(loan.disbursedOn)) / (365 * 86400000) }));
  if (cashflows.some((flow) => flow.years < 0)) return null;
  const value = (rate: number) => cashflows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** flow.years, -received);
  if (value(0) <= 0.005) return 0;
  let low = 0;
  let high = 1;
  while (value(high) > 0 && high < 1024) high *= 2;
  if (value(high) > 0) return null;
  for (let i = 0; i < 70; i++) {
    const mid = (low + high) / 2;
    if (value(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) * 50;
}

function budgetTimeline(profile: User | null, entries: Transaction[], loans: Loan[], today: string, horizon: string) {
  const initial = currentWallet(profile, entries);
  if (initial === null) return null;
  const events = new Map<string, number>();
  const add = (date: string, amount: number) => {
    if (date > today && date <= horizon) events.set(date, (events.get(date) ?? 0) + amount);
  };
  for (let month = monthKeyFromDate(parsePickedDate(today)); month <= horizon.slice(0, 7); month = shiftMonth(month, 1)) {
    for (const entry of entriesInMonth(entries, month)) {
      const date = entry.regular ? toIsoDate(recurringDate(entry, parsePickedDate(month + "-01"))) : entry.date;
      if (!entry.regular && entry.id > (profile?.walletAfterId ?? 0)) {
        // The wallet already includes future entries. Move their effect to the event date.
        add(date, entry.type === "income" ? entry.amount : -entry.amount);
      } else if (entry.regular) add(date, entry.type === "income" ? entry.amount : -entry.amount);
    }
  }
  let overdue = 0;
  for (const loan of loans) {
    for (const row of loanSchedule(loan)) {
      if (row.payment || row.skipped) continue;
      if (row.date <= today) overdue += row.amount;
      else add(row.date, -row.amount);
    }
  }
  const balance = initial - overdue - entries.reduce((sum, entry) => {
    if (entry.regular || entry.date <= today || entry.id <= (profile?.walletAfterId ?? 0)) return sum;
    return sum + (entry.type === "income" ? entry.amount : -entry.amount);
  }, 0);
  return { balance, events };
}

export function suggestInstallment(
  profile: User | null,
  entries: Transaction[],
  loans: Loan[],
  firstDue: string,
  reserve: number,
  fastest: boolean,
  today = toIsoDate(new Date()),
): number | null {
  if (firstDue <= today) return null;
  const forecast = budgetTimeline(profile, entries, loans, today, dueDate(firstDue, 11));
  if (!forecast) return null;
  const { events } = forecast;
  const dates = Array.from({ length: 12 }, (_, index) => dueDate(firstDue, index));
  const candidates = new Set(dates);
  const timeline = [...new Set([...events.keys(), ...dates])].sort();
  let balance = forecast.balance;
  let payments = 0;
  let maximum = Infinity;
  for (const date of timeline) {
    balance += events.get(date) ?? 0;
    if (candidates.has(date)) payments++;
    if (payments > 0) maximum = Math.min(maximum, (balance - reserve) / payments);
    else if (balance < reserve) return 0;
  }
  return Math.max(0, Math.floor(maximum * (fastest ? 1 : 0.6) * 100) / 100);
}

export function upcomingLoanExpenses(loans: Loan[], today: string, userId: number): Transaction[] {
  return loans.flatMap((loan) => loanSchedule(loan).filter((row) => !row.skipped && !row.payment).map((row) => ({
    date: row.date < today ? today : row.date,
    userId, type: "expense" as const, name: loan.name, category: "Kredyty i pożyczki",
    amount: row.amount, regular: false, memberId: null,
  }))).map((entry, index) => ({ ...entry, id: Number.MAX_SAFE_INTEGER - index }));
}

const REVIEW_CATEGORIES = new Set(["Rozrywka", "Zakupy", "Ubrania"]);

type BudgetPayment = Pick<LoanInstallment, "date" | "amount">;

export function assessLoanBudget(
  profile: User | null,
  entries: Transaction[],
  loans: Loan[],
  payments: BudgetPayment[],
  reserve: number,
  today = toIsoDate(new Date()),
) {
  const horizon = dueDate(today, 12);
  const forecast = budgetTimeline(profile, entries, loans, today, horizon);
  if (!forecast) return null;
  const plannedPayments = payments.filter((row) => row.date <= horizon && row.amount > 0);
  if (!plannedPayments.length) return null;
  const currentMonth = today.slice(0, 7);
  const history = new Map<string, number>();
  let trackedMonths = 0;
  for (let offset = 1; offset <= 3; offset++) {
    const month = shiftMonth(currentMonth, -offset);
    const monthStart = parsePickedDate(month + "-01");
    const recurring = new Set(entries.filter((entry) => entry.regular && entry.date.slice(0, 7) <= month)
      .map((entry) => recurringPostingKey(entry, toIsoDate(recurringDate(entry, monthStart)))));
    const actual = entries.filter((entry) => !entry.regular && entry.type === "expense" && !entry.loanPaymentKey &&
      entry.date.startsWith(month) && !recurring.has(recurringPostingKey(entry)));
    if (!actual.length) continue;
    trackedMonths++;
    for (const entry of actual) history.set(entry.category, (history.get(entry.category) ?? 0) + entry.amount);
  }
  const averages = [...history].map(([category, amount]) => ({ category, amount: roundMoney(amount / trackedMonths) }));
  const suggestions = averages.filter((item) => REVIEW_CATEGORIES.has(item.category))
    .map((item) => ({ ...item, reduction: roundMoney(item.amount * 0.2) }))
    .filter((item) => item.reduction > 0)
    .sort((a, b) => b.reduction - a.reduction);
  const reductions = new Map(suggestions.map((item) => [item.category, item.reduction]));
  const estimated = new Map<string, { amount: number; savings: number }>();
  for (let month = currentMonth; month <= horizon.slice(0, 7); month = shiftMonth(month, 1)) {
    const [year, index] = month.split("-").map(Number);
    const days = new Date(year, index, 0).getDate();
    const scheduled = new Map<string, number>();
    const recurring = new Set(entries.filter((entry) => entry.regular && entry.date.slice(0, 7) <= month)
      .map((entry) => recurringPostingKey(entry, toIsoDate(recurringDate(entry, new Date(year, index - 1, 1))))));
    for (const entry of entries) {
      if (entry.regular || entry.type !== "expense" || entry.loanPaymentKey || !entry.date.startsWith(month) ||
          recurring.has(recurringPostingKey(entry))) continue;
      scheduled.set(entry.category, (scheduled.get(entry.category) ?? 0) + entry.amount);
    }
    let amount = 0;
    let savings = 0;
    for (const item of averages) {
      const unplanned = Math.max(0, item.amount - (scheduled.get(item.category) ?? 0));
      amount += unplanned / days;
      savings += Math.min(unplanned, reductions.get(item.category) ?? 0) / days;
    }
    for (let day = 1; day <= days; day++) {
      const date = month + "-" + String(day).padStart(2, "0");
      if (date > today && date <= horizon) estimated.set(date, { amount, savings });
    }
  }
  const due = new Map<string, number>();
  for (const payment of plannedPayments) {
    const date = payment.date < today ? today : payment.date;
    due.set(date, (due.get(date) ?? 0) + payment.amount);
  }
  const timeline = [...new Set([today, ...forecast.events.keys(), ...estimated.keys(), ...due.keys()])].sort();
  let balance = forecast.balance;
  let savings = 0;
  let lowest = Infinity;
  let lowestWithCuts = Infinity;
  let firstShortfall: string | null = null;
  for (const date of timeline) {
    const projected = estimated.get(date);
    balance += (forecast.events.get(date) ?? 0) - (due.get(date) ?? 0) - (projected?.amount ?? 0);
    savings += projected?.savings ?? 0;
    lowest = Math.min(lowest, balance);
    lowestWithCuts = Math.min(lowestWithCuts, balance + savings);
    if (!firstShortfall && roundMoney(balance) < reserve) firstShortfall = date;
  }
  return {
    trackedMonths, firstShortfall, suggestions, horizon,
    gap: Math.max(0, roundMoney(reserve - lowest)),
    gapWithCuts: Math.max(0, roundMoney(reserve - lowestWithCuts)),
    minimum: roundMoney(lowest),
  };
}

