import { getRandomBytes } from "expo-crypto";
import { bytesToHex } from "../crypto/bytes";
import { toIsoDate } from "../helpers/dates";
import { loanSchedule, remainingPrincipal, roundMoney } from "../helpers/loans";
import { Database, getDb, withDatabaseTransaction } from "./init";
import { Loan, LoanPayment } from "./loanTypes";
import { insertLoanExpense, listTransactions, removeTransactionRow } from "./transactions";

export type LoanAction =
  | { type: "pay" | "skip"; number: number; date: string }
  | { type: "overpay"; amount: number; date: string; key: string }
  | { type: "undo"; key: string }
  | { type: "unskip"; number: number }
  | { type: "rate"; number: number; rate: number }
  | { type: "edit"; name: string; category?: string; terms?: Pick<Loan, "kind" | "contractTotalOnly" | "principal" | "disbursedOn" | "firstDue" | "months" | "annualRate" | "installment" | "financedFee" | "upfrontFee" | "monthlyFee"> }
  | { type: "override"; number: number; amount: number };

export function newLoanId() {
  return bytesToHex(getRandomBytes(16));
}

export async function listLoans(userId: number, connection?: Database): Promise<Loan[]> {
  const db = connection ?? await getDb();
  const rows = await db.getAllAsync<{ data: string }>("SELECT data FROM loans WHERE user_id = ? ORDER BY rowid", [userId]);
  return rows.map(({ data }) => JSON.parse(data) as Loan);
}

export async function readLoanLedger(userId: number) {
  return withDatabaseTransaction(async (db) => ({
    entries: await listTransactions(userId, db),
    loans: await listLoans(userId, db),
  }));
}

async function writeLoan(db: Database, userId: number, loan: Loan) {
  await db.runAsync(
    "INSERT INTO loans (user_id, id, data) VALUES (?, ?, ?) ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data",
    [userId, loan.id, JSON.stringify(loan)]
  );
}

export async function replaceLoans(userId: number, loans: Loan[], db: Database) {
  await db.runAsync("DELETE FROM loans WHERE user_id = ?", [userId]);
  for (const loan of loans) await writeLoan(db, userId, loan);
}

export async function addLoan(userId: number, loan: Loan) {
  const db = await getDb();
  await db.runAsync("INSERT INTO loans (user_id, id, data) VALUES (?, ?, ?)", [userId, loan.id, JSON.stringify(loan)]);
}

export async function applyLoanAction(userId: number, id: string, action: LoanAction) {
  await withDatabaseTransaction(async (db) => {
    const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM loans WHERE user_id = ? AND id = ?", [userId, id]);
    if (!row) throw new Error("Zobowiązanie nie jest już dostępne.");
    const loan = JSON.parse(row.data) as Loan;
    let payment: LoanPayment | undefined;
    if (action.type === "edit") {
      const name = action.name.trim();
      if (!name) throw new Error("Wpisz nazwę zobowiązania.");
      if (action.terms) {
        if (loan.payments.length || loan.skipped.length) throw new Error("Harmonogram ma już rozliczone raty. Otwórz ponownie edycję.");
        const terms = action.terms;
        if (terms.kind !== loan.kind || Boolean(terms.contractTotalOnly) !== Boolean(loan.contractTotalOnly)) {
          loan.rateChanges = {};
          loan.installmentOverrides = {};
        }
        Object.assign(loan, terms);
      }
      loan.name = name;
      if (action.category !== undefined) loan.category = action.category;
    } else if (action.type === "undo") {
      const entry = await db.getFirstAsync<{ id: number }>("SELECT id FROM entries WHERE user_id = ? AND loan_payment_key = ?", [userId, action.key]);
      if (!loan.payments.some((item) => item.key === action.key)) return;
      if (entry) {
        await db.runAsync("UPDATE receipts SET entry_id = NULL, standalone = 1, sync_version = ? WHERE user_id = ? AND entry_id = ?",
          [`pending:${newLoanId()}`, userId, entry.id]);
        await removeTransactionRow(db, entry.id, userId, true);
      }
      loan.payments = loan.payments.filter((item) => item.key !== action.key);
    } else if (action.type === "unskip") {
      if (loan.payments.some((item) => (item.installment ?? 0) > action.number)) {
        throw new Error("Najpierw cofnij późniejsze raty, aby przeliczyć pominięcie.");
      }
      loan.skipped = loan.skipped.filter((number) => number !== action.number);
    } else if (action.type === "rate" || action.type === "override") {
      if (loan.kind !== "credit" || (action.type === "rate" && loan.contractTotalOnly) ||
          !Number.isInteger(action.number) || action.number < 1 || action.number > 600 ||
          (action.type === "rate"
            ? !Number.isFinite(action.rate) || action.rate < 0 || action.rate > 100
            : !Number.isFinite(action.amount) || action.amount <= 0 || action.amount > 1e9) ||
          loan.payments.some((item) => (item.installment ?? 0) >= action.number)) {
        throw new Error("Wybierz numer przyszłej, niezapłaconej raty i wpisz poprawną wartość.");
      }
      if (action.type === "rate") loan.rateChanges[action.number] = action.rate;
      else loan.installmentOverrides[action.number] = roundMoney(action.amount);
    } else {
      const today = toIsoDate(new Date());
      if (action.date > today || action.date < loan.disbursedOn) throw new Error("Wybierz datę między wypłatą środków a dzisiaj.");
      if (action.type === "overpay") {
        if (loan.payments.some((item) => item.key === action.key)) return;
        const amount = roundMoney(action.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > remainingPrincipal(loan)) {
          throw new Error("Nadpłata musi być dodatnia i mieścić się w pozostałym kapitale.");
        }
        payment = { key: action.key, installment: null, date: action.date, amount, principal: amount, interest: 0, fees: 0 };
      } else {
        const key = `${id}:installment:${action.number}`;
        if (loan.payments.some((item) => item.key === key) || loan.skipped.includes(action.number)) return;
        const next = loanSchedule(loan).find((item) => !item.payment && !item.skipped);
        if (!next || next.number !== action.number) throw new Error("Harmonogram się zmienił. Wybierz aktualną ratę.");
        if (action.type === "skip") {
          if (next.date > today) throw new Error("Rata może zostać pominięta po nadejściu jej terminu.");
          loan.skipped.push(next.number);
        } else {
          payment = { key, installment: next.number, date: action.date, amount: next.amount, principal: next.principal, interest: next.interest, fees: next.fees };
        }
      }
    }
    if (payment) {
      await insertLoanExpense(db, userId, {
        date: payment.date, type: "expense",
        name: payment.installment === null ? `${loan.name} · Nadpłata` : `${loan.name} · Rata ${payment.installment}`,
        category: "Kredyty i pożyczki", amount: payment.amount, regular: false, memberId: null,
      }, payment.key);
      loan.payments.push(payment);
    }
    await writeLoan(db, userId, loan);
  });
}
