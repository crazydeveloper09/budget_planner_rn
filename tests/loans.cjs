const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { randomBytes } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

const sqlite = new DatabaseSync(":memory:");
const connection = {
  execAsync: async (sql) => sqlite.exec(sql),
  getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
  getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params),
  runAsync: async (sql, params = []) => sqlite.prepare(sql).run(...params),
  withTransactionAsync: async (task) => {
    sqlite.exec("BEGIN");
    try {
      await task();
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
const nativeLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === "expo-sqlite") return { openDatabaseAsync: async () => connection };
  if (name === "expo-crypto") return { getRandomBytes: randomBytes };
  if (name === "react-native") return {};
  return nativeLoad.call(this, name, ...args);
};
require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  module._compile(outputText, file);
};

const { initDb } = require("../src/db/init");
const { addLoan, applyLoanAction, readLoanLedger, replaceLoans } = require("../src/db/loans");
const { replaceAllTransactions, removeTransaction } = require("../src/db/transactions");
const { assessLoanBudget, dueDate, estimatedApr, loanSchedule, remainingPrincipal, suggestInstallment } = require("../src/helpers/loans");
const { confirmRecurringExpense } = require("../src/db/recurringExpenses");
const { addTransaction, listTransactions } = require("../src/db/transactions");
const { loanReminderPlan, recurringExpenseReminderPlan } = require("../src/notifications/loanReminders");

const loan = {
  id: "test", name: "Loan", kind: "private", principal: 6000,
  disbursedOn: "2024-12-31", firstDue: "2025-01-31", months: 10, annualRate: 0,
  rateChanges: {}, installment: 600, installmentOverrides: {}, financedFee: 0,
  upfrontFee: 0, monthlyFee: 0, payments: [], skipped: [],
};

async function checkRecurringExpenses() {
  const userId = 1;
  const month = new Date(2025, 1, 1);
  await addTransaction(userId, {
    date: "2000-01-31", type: "expense", name: "Rent", category: "Bills",
    amount: 500, regular: true, memberId: null,
  });
  const [template] = await listTransactions(userId);
  const february = item => item.date.getMonth() === 1;
  assert.deepEqual(
    recurringExpenseReminderPlan([template], month).filter(february)
      .map(item => [item.days, item.date.getDate(), item.date.getHours()]),
    [[7, 21, 9], [3, 25, 9], [1, 27, 9]]
  );
  await Promise.all([
    confirmRecurringExpense(userId, template.id, month),
    confirmRecurringExpense(userId, template.id, month),
  ]);
  const entries = await listTransactions(userId);
  assert.equal(entries.filter(item => !item.regular && item.name === "Rent").length, 1);
  assert.equal(recurringExpenseReminderPlan(entries, month).some(february), false);
  await removeTransaction(template.id, userId);
  await removeTransaction(entries.find(item => !item.regular && item.name === "Rent").id, userId);
}

async function run() {
  assert.equal(dueDate(loan.firstDue, 1), "2025-02-28");
  assert.equal(dueDate(loan.firstDue, 2), "2025-03-31");
  const privateRows = loanSchedule(loan);
  assert.equal(privateRows.length, 10);
  assert.equal(estimatedApr(loan, privateRows), 0);
  const bank = { ...loan, kind: "credit", installment: null, annualRate: 8, upfrontFee: 200, monthlyFee: 10 };
  const bankRows = loanSchedule(bank);
  assert.equal(bankRows.length, 10);
  assert.ok(estimatedApr(bank, bankRows) > bank.annualRate);
  assert.ok(loanSchedule({ ...bank, rateChanges: { 3: 12 } })[2].amount > bankRows[2].amount);
  assert.equal(loanSchedule({ ...bank, installmentOverrides: { 1: 300 } })[0].amount, 300);
  assert.equal(loanSchedule({ ...loan, skipped: [1] }).length, 11);
  const beforeDue = new Date(2025, 0, 23);
  const firstReminders = loanReminderPlan([loan], beforeDue).filter((item) => item.number === 1);
  assert.deepEqual(firstReminders.map((item) => [item.days, item.date.getDate(), item.date.getHours()]), [[7, 24, 9], [3, 28, 9], [1, 30, 9]]);
  assert.equal(loanReminderPlan([{ ...loan, skipped: [1] }], beforeDue).some((item) => item.number === 1), false);
  assert.deepEqual(loanReminderPlan([loan], new Date(2025, 0, 28, 10)).filter((item) => item.number === 1).map((item) => item.days), [1]);
  const budgetProfile = { id: 1, walletBalance: 0, walletAfterId: 0 };
  const budgetEntries = [
    { id: 1, date: "2000-01-01", type: "income", name: "Salary", category: "Wypłata", amount: 5000, regular: true, memberId: null },
    { id: 2, date: "2024-12-01", type: "expense", name: "Bills", category: "Rachunki", amount: 3500, regular: true, memberId: null },
  ];
  assert.equal(suggestInstallment(budgetProfile, budgetEntries, [], loan.firstDue, 500, false, "2024-12-31"), 600);
  assert.equal(suggestInstallment(budgetProfile, budgetEntries, [], loan.firstDue, 500, true, "2024-12-31"), 1000);
  assert.equal(suggestInstallment(budgetProfile, [...budgetEntries, {
    ...budgetEntries[1], id: 3, date: "2025-02-12", amount: 1500, regular: false,
  }], [], loan.firstDue, 500, true, "2024-12-31"), 500);
  const forecastEntries = [...budgetEntries,
    { ...budgetEntries[1], id: 4, date: "2024-11-15", category: "Rozrywka", amount: 500, regular: false },
    { ...budgetEntries[1], id: 5, date: "2024-11-15", category: "Zdrowie", amount: 300, regular: false },
  ];
  const assessment = assessLoanBudget({ ...budgetProfile, walletAfterId: 5, walletBalance: 1000 }, forecastEntries, [],
    [{ date: "2025-01-31", amount: 1500 }], 500, "2024-12-31");
  assert.ok(assessment.gap > 0);
  assert.ok(assessment.gapWithCuts < assessment.gap);
  assert.deepEqual(assessment.suggestions.map((item) => [item.category, item.reduction]), [["Rozrywka", 100]]);
  assert.equal(assessLoanBudget(null, forecastEntries, [], [{ date: "2025-01-31", amount: 1500 }], 500, "2024-12-31"), null);

  await initDb();
  await checkRecurringExpenses();
  await addLoan(1, loan);
  await applyLoanAction(1, loan.id, { type: "edit", name: "Renamed loan", terms: { ...loan, installment: 600 } });
  const pay = { type: "pay", number: 1, date: "2025-01-31" };
  await Promise.all([applyLoanAction(1, loan.id, pay), applyLoanAction(1, loan.id, pay)]);
  let ledger = await readLoanLedger(1);
  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.entries[0].amount, 600);
  assert.match(ledger.entries[0].name, /Renamed loan/);
  await assert.rejects(applyLoanAction(1, loan.id, { type: "edit", name: "Changed terms", terms: { ...loan, principal: 3000 } }));
  await applyLoanAction(1, loan.id, { type: "edit", name: "Updated name" });
  ledger = await readLoanLedger(1);
  assert.equal(ledger.loans[0].name, "Updated name");
  assert.equal(ledger.loans[0].payments.length, 1);
  assert.equal(remainingPrincipal(ledger.loans[0]), 5400);
  assert.equal(loanReminderPlan(ledger.loans, beforeDue).some((item) => item.number === 1), false);
  await assert.rejects(removeTransaction(ledger.entries[0].id, 1));

  // A cloud import assigns new SQLite IDs. The persistent payment key still
  // identifies the same expense and duplicate keys cannot create a second row.
  await replaceAllTransactions(1, [ledger.entries[0], ledger.entries[0]], (db) => replaceLoans(1, ledger.loans, db));
  const imported = await readLoanLedger(1);
  assert.equal(imported.entries.length, 1);
  assert.notEqual(imported.entries[0].id, ledger.entries[0].id);
  assert.equal(imported.entries[0].loanPaymentKey, ledger.entries[0].loanPaymentKey);

  sqlite.prepare("INSERT INTO users (id, name, dailySaldo, currency, wallet_balance, wallet_after_id) VALUES (1, 'Test', 100, 'PLN', 4400, ?)").run(imported.entries[0].id);
  const undo = { type: "undo", key: imported.entries[0].loanPaymentKey };
  await Promise.all([applyLoanAction(1, loan.id, undo), applyLoanAction(1, loan.id, undo)]);
  ledger = await readLoanLedger(1);
  assert.equal(ledger.entries.length, 0);
  assert.equal(remainingPrincipal(ledger.loans[0]), 6000);
  assert.equal(sqlite.prepare("SELECT wallet_balance FROM users WHERE id = 1").get().wallet_balance, 5000);

  const extra = { type: "overpay", key: "test:extra:1", amount: 1200, date: "2025-02-01" };
  await Promise.all([applyLoanAction(1, loan.id, extra), applyLoanAction(1, loan.id, extra)]);
  ledger = await readLoanLedger(1);
  assert.equal(ledger.entries.length, 1);
  assert.equal(remainingPrincipal(ledger.loans[0]), 4800);
  assert.equal(loanSchedule(ledger.loans[0]).length, 8);
  await applyLoanAction(1, loan.id, { type: "skip", number: 1, date: "2025-01-31" });
  ledger = await readLoanLedger(1);
  assert.equal(loanSchedule(ledger.loans[0])[0].skipped, true);
  assert.equal(ledger.entries.length, 1);

  sqlite.exec("CREATE TRIGGER fail_loan_update BEFORE UPDATE ON loans BEGIN SELECT RAISE(ABORT, 'write failed'); END");
  await assert.rejects(applyLoanAction(1, loan.id, { type: "pay", number: 2, date: "2025-02-28" }));
  ledger = await readLoanLedger(1);
  assert.equal(ledger.entries.length, 1, "A failed loan update must roll back the new expense");
  assert.equal(ledger.loans[0].payments.length, 1);
  console.log("Loan schedules, budget estimates, concurrent payment/undo, import and rollback passed");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
