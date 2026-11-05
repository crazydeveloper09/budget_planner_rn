const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file, mocks = {}) {
  const full = path.resolve(file);
  if (cache.has(full) && !Object.keys(mocks).length) return cache.get(full);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const req = name => name in mocks ? mocks[name] : name === 'react-native' ? { Alert: {} } : name.startsWith('.') ? load(path.resolve(path.dirname(full), name + '.ts')) : require(name);
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  if (!Object.keys(mocks).length) cache.set(full, module.exports);
  return module.exports;
}
const { spendingPlan, recurringDate, assessDailyGoal } = load('src/helpers/spendingPlan.ts');
const profile = { id: 1, walletBalance: 2800, walletAfterId: 0, walletSetOn: '2026-11-01' };
const entry = (overrides = {}) => ({ id: 1, userId: 1, date: '2000-01-10', type: 'income', amount: 5000, name: 'Pensja', category: 'Wypłata', memberId: null, regular: true, ...overrides });
assert.equal(recurringDate(entry({ date: '2000-01-31' }), new Date(2027, 1, 1)).getDate(), 28);
assert.equal(recurringDate(entry({ date: '2000-01-31' }), new Date(2028, 1, 1)).getDate(), 29);
assert.equal(spendingPlan(null, [], new Date(2026, 10, 3)), null);
let plan = spendingPlan(profile, [entry()], new Date(2026, 10, 3));
assert.equal(plan.month.daily, 100);
assert.equal(plan.next.days, 7);
assert.equal(plan.next.daily, 400);
assert.equal(plan.nextIncome, '2026-11-10');
plan = spendingPlan(profile, [entry({ type: 'expense', amount: 700 }), entry()], new Date(2026, 10, 3));
assert.equal(plan.month.daily, 75);
assert.equal(plan.next.daily, 400); // Expense is due on payday, outside the interval.
assert.equal(spendingPlan(profile, [], new Date(2026, 10, 30)).month.daily, 2800);
assert.equal(spendingPlan(profile, [], new Date(2026, 10, 3)).next, null);
assert.equal(spendingPlan({ ...profile, walletBalance: -1 }, [], new Date(2026, 10, 3)).month.daily, 0);
plan = spendingPlan(profile, [entry({ id: 2, regular: false, date: '2026-11-08', type: 'expense', amount: 700 })], new Date(2026, 10, 3));
assert.equal(plan.month.daily, 75);
assert.equal(spendingPlan(profile, [entry()], new Date(2026, 11, 31)).nextIncome, '2027-01-10');
assert.equal(assessDailyGoal({ available: 2800, days: 28 }, 80, 0).savings, 560);
assert.equal(assessDailyGoal({ available: 2800, days: 28 }, 100, 0).savings, 0);
assert.equal(assessDailyGoal({ available: 2800, days: 28 }, 120, 0).savings, -560);
assert.equal(assessDailyGoal({ available: 2740, days: 28 }, 80, 60).savings, 560, 'Today spending is not charged twice');
assert.equal(assessDailyGoal({ available: 2680, days: 28 }, 80, 120).savings, 520, 'Overspending today reduces savings');
assert.equal(assessDailyGoal({ available: 50, days: 1 }, 80, 60).savings, 30);
assert.equal(assessDailyGoal({ available: -10, days: 1 }, 0, 0).savings, -10);
assert.equal(spendingPlan(profile, [entry({ regular: false, type: 'expense', date: '2026-11-03', amount: 60 })], new Date(2026, 10, 3)).spentToday, 60);
assert.equal(spendingPlan(profile, [entry({ type: 'expense' }), entry({ id: 2, regular: false, type: 'expense', date: '2026-11-10' })], new Date(2026, 10, 10)).spentToday, 0, 'Posted recurring expenses are separate from the daily goal');
const { dailyLimitAmount } = load('src/helpers/dailyLeftover.ts');
const familyGoal = dailyLimitAmount({ ...profile, accountType: 'family' }, [{ dailySaldo: 30 }, { dailySaldo: 50 }, { dailySaldo: null }]);
assert.equal(familyGoal, 80, 'Family goal aggregates all member limits');
const familyPlan = spendingPlan({ ...profile, accountType: 'family' }, [entry()], new Date(2026, 10, 3));
assert.equal(assessDailyGoal(familyPlan.month, familyGoal, familyPlan.spentToday).savings, 560);
assert.equal(assessDailyGoal(familyPlan.next, familyGoal, familyPlan.spentToday).savings, 2240);
const { walletHistoryDays } = load('src/helpers/walletHistory.ts');
const adjustments = [
  { id: 'a', date: '2026-11-03', createdAt: '2026-11-03T10:00:00Z', before: 2800, after: 3000 },
  { id: 'b', date: '2026-11-03', createdAt: '2026-11-03T11:00:00Z', before: 3000, after: 3000 },
];
const history = walletHistoryDays({ ...profile, walletHistory: adjustments }, [entry(), entry({ id: 2, regular: false, type: 'expense', amount: 50, date: '2026-11-03' }), entry({ id: 3, regular: false, amount: 100, date: '2026-11-02' }), entry({ id: 4, regular: false, amount: 100, date: '2026-12-02' })], '2026-11-04');
assert.deepEqual(history.map(day => day.date), ['2026-11-03', '2026-11-02']);
assert.equal(history[0].adjustments.length, 2);
assert.equal(history[0].adjustments[0].id, 'b');
assert.equal(history[0].correction, 200);
assert.equal(history[0].expense, 50);
assert.equal(history[1].income, 100);
assert.equal(walletHistoryDays(profile, [], '2026-11-04')[0].adjustments[0].after, 2800);
assert.deepEqual(walletHistoryDays(null, [], '2026-11-04'), []);
const { expenseOutlook, goalPlan, goalLimitScenario, daysBetween } = load('src/helpers/goalPlan.ts');
const { allocateGoalSavings, orderedGoals } = load('src/helpers/goalAllocation.ts');
const firstGoal = { id: 'first', userId: 1, title: 'Pierwszy', targetAmount: 200, savedAmount: 0, deadline: null, createdAt: '2026-11-01T10:00:00Z' };
const secondGoal = { ...firstGoal, id: 'second', title: 'Drugi', createdAt: '2026-11-02T10:00:00Z' };
let allocation = allocateGoalSavings([secondGoal, firstGoal], [], 100, '2026-11-03');
assert.equal(allocation.get('first'), 200);
assert.equal(allocation.get('second'), 100, 'Daily surplus must never be counted for both goals');
assert.equal(allocateGoalSavings([firstGoal, secondGoal], [], 100, '2026-11-20').get('second'), 200, 'Stop allocating once targets are met');
allocation = allocateGoalSavings([firstGoal, { ...secondGoal, priority: 3 }], [], 100, '2026-11-03');
assert.equal(allocation.get('first'), 100);
assert.equal(allocation.get('second'), 200, 'Higher priority wins only from its creation day onward');
assert.equal(allocateGoalSavings([secondGoal], [], 100, '2026-11-01').get('second'), 0, 'No savings before creation');
assert.equal(allocateGoalSavings([firstGoal], [entry({ regular: false, date: '2026-11-01', amount: 5000 })], 100, '2026-11-01').get('first'), 100, 'Income is not an automatic goal deposit');
assert.equal(orderedGoals([{ ...firstGoal, id: 'z' }, { ...firstGoal, id: 'a' }])[0].id, 'a', 'Tied timestamps have deterministic order across devices');
allocation = allocateGoalSavings([{ ...firstGoal, savedAmount: 175 }, secondGoal], [], 100, '2026-11-02');
assert.equal(allocation.get('first'), 25, 'Manual savings reduce the amount needed before moving to the next goal');
assert.equal(allocation.get('second'), 100, 'Unused days before a new goal existed are not backfilled into it');
const queueEntries = [entry({ regular: false, type: 'expense', amount: 50, date: '2026-11-03' })];
const queuePlan = goalPlan(secondGoal, { ...profile, dailySaldo: 100 }, [], queueEntries, '2026-11-03', [{ ...firstGoal, targetAmount: 1000 }, secondGoal]);
assert.equal(queuePlan.autoSaved, 0);
assert.equal(queuePlan.aheadAmount, 750);
assert.equal(queuePlan.fundingNeeded, 950);
assert.equal(queuePlan.days, 19, 'Later goals must wait for preceding funding in forecasts');
const queuedDeadline = goalPlan({ ...secondGoal, deadline: '2026-11-12' }, { ...profile, dailySaldo: 100 }, [], queueEntries, '2026-11-03', [{ ...firstGoal, targetAmount: 1000 }, { ...secondGoal, deadline: '2026-11-12' }]);
assert.equal(queuedDeadline.requiredDaily, 95, 'Deadline requirement includes the queue ahead');
assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
assert.equal(expenseOutlook(null, [], [], 100, '2026-11-03').date, null);
const outlookProfile = { ...profile, accountType: 'personal', dailySaldo: 10, walletBalance: 100 };
const temporaryFunds = expenseOutlook(outlookProfile, [], [entry({ regular: false, date: '2026-11-04', amount: 300 })], 200, '2026-11-03');
assert.equal(temporaryFunds.date, null, 'One-off income cannot fund a purchase at the expense of later living costs');
assert.equal(temporaryFunds.cashDate, '2026-11-04');
assert.ok(temporaryFunds.riskDate);
assert.equal(expenseOutlook(outlookProfile, [], [], 200, '2026-11-03').date, null);
assert.equal(expenseOutlook(outlookProfile, [], [entry({ amount: 1000 })], 500, '2026-11-03').date, '2026-11-10');
const riskyPurchase = expenseOutlook({ ...outlookProfile, walletBalance: 2505 }, [], [entry({ amount: 3000 }), entry({ id: 2, type: 'expense', amount: 2800, name: 'Rachunki' }), entry({ id: 3, regular: false, amount: 1000, date: '2026-11-10' })], 3000, '2026-11-05');
assert.equal(riskyPurchase.cashDate, '2026-11-10');
assert.equal(riskyPurchase.date, null, 'Payday in five days is not a sustainable purchase date');
assert.ok(riskyPurchase.shortfall > 0);
const laterBill = expenseOutlook({ ...outlookProfile, walletBalance: 4000, dailySaldo: 0 }, [], [entry({ regular: false, type: 'expense', amount: 2000, date: '2027-06-01' })], 3000, '2026-11-05');
assert.equal(laterBill.cashDate, '2026-11-05');
assert.equal(laterBill.riskDate, '2027-06-01');
assert.equal(laterBill.shortfall, 1000);
assert.equal(laterBill.date, null);
const sustainable = expenseOutlook(outlookProfile, [], [entry({ amount: 1000 })], 500, '2026-11-03', '2026-12-10');
assert.equal(sustainable.date, '2026-12-10', 'Never suggest a date before the selected expense date');
assert.equal(sustainable.checkedThrough, '2027-12-10');
assert.equal(expenseOutlook({ ...outlookProfile, walletBalance: 3000, dailySaldo: 0 }, [], [], 3000, '2026-11-05').date, '2026-11-05', 'An exact balance is sufficient if no later costs are projected');
const testGoal = { id: 'test', userId: 1, title: 'Laptop', targetAmount: 1000, savedAmount: 100, deadline: '2026-11-13', createdAt: '2026-11-04T00:00:00Z' };
const records = [entry({ regular: false, type: 'expense', category: 'Zakupy', amount: 600, date: '2026-10-06' }), entry({ id: 2, regular: false, type: 'expense', category: 'Zakupy', amount: 600, date: '2026-11-04' })];
const advice = goalPlan(testGoal, { ...profile, dailySaldo: 100 }, [], records, '2026-11-04');
assert.equal(advice.remaining, 900);
assert.equal(advice.dailySaving, 60);
assert.equal(advice.days, 15);
assert.equal(advice.estimatedDate, '2026-11-19');
assert.equal(advice.requiredDaily, 90);
assert.equal(advice.suggestions[0].dailyCut, 8);
assert.equal(advice.suggestions[0].potential, 240);
assert.equal(goalPlan(testGoal, { ...profile, dailySaldo: 100 }, [], [], '2026-11-04').dailySaving, null);
assert.equal(goalPlan({ ...testGoal, savedAmount: 2000 }, profile, [], records, '2026-11-04').days, 0);
assert.equal(goalPlan(testGoal, { ...profile, dailySaldo: 100 }, [], records.map(e => ({ ...e, category: 'Zdrowie' })), '2026-11-04').suggestions.length, 0);
assert.equal(goalPlan(testGoal, { ...profile, accountType: 'family' }, [{ dailySaldo: 40 }, { dailySaldo: 60 }], records, '2026-11-04').dailySaving, 60);
const limited = goalLimitScenario(100, 80, 1000, 60, 40, '2026-11-04');
assert.equal(limited.dailySaving, 40);
assert.equal(limited.suggestedLimit, 60);
assert.equal(limited.meetsDeadline, true);
assert.equal(limited.days, 25);
assert.equal(goalLimitScenario(100, 40, 1000, 80, null, '2026-11-04').dailySaving, 60, 'A cap above actual spending does not create extra savings');
assert.equal(goalLimitScenario(100, 80, 1000, 0, 120, '2026-11-04').impossible, true);
assert.equal(goalLimitScenario(100, 80, 1000, 0, 120, '2026-11-04').shortfall, 20);
assert.equal(goalLimitScenario(0, null, 1000, 0, null, '2026-11-04').date, null);
(async () => {
  let row = { id: 1, name: 'Test', account_type: 'personal', dailySaldo: 100, currency: 'PLN', wallet_balance: 1000, wallet_set_on: '2026-11-01', wallet_after_id: 0, wallet_recurring_month: null, wallet_history: '[]' };
  let sequence = 0;
  const profileDb = { getFirstAsync: async () => row, runAsync: async (sql, args) => {
    assert.match(sql, /wallet_history = \?/);
    row = { ...row, name: args[0], wallet_balance: args[3], wallet_set_on: args[4], wallet_after_id: args[5], wallet_history: args[7] };
  } };
  const { updateProfile } = load('src/db/profile.ts', {
    '@react-native-async-storage/async-storage': { default: {} },
    'expo-crypto': { getRandomBytes: size => new Uint8Array(size).fill(++sequence) },
    './init': { getDb: async () => profileDb },
    './transactions': { listTransactions: async () => [entry({ id: 1, regular: false, type: 'expense', amount: 100, date: '2026-11-02' })] },
  });
  let updated = await updateProfile(1, { walletBalance: 1200, walletAfterId: 1, recordWalletChange: true });
  assert.equal(updated.walletHistory.length, 2, 'Legacy baseline and manual correction are persisted together');
  assert.equal(updated.walletHistory[1].before, 900);
  assert.equal(updated.walletHistory[1].after, 1200);
  updated = await updateProfile(1, { walletBalance: 1200, recordWalletChange: true });
  assert.equal(updated.walletHistory.length, 3, 'Saving the same balance is retained');
  assert.equal(updated.walletHistory[2].before, 1200);
  updated = await updateProfile(1, { name: 'New name' });
  assert.equal(updated.walletHistory.length, 3, 'Unrelated updates do not add wallet records');
  updated = await updateProfile(1, { walletHistory: adjustments });
  assert.deepEqual(updated.walletHistory, adjustments, 'Cloud history restores without creating a manual correction');
  const writes = [];
  const { updateMemberDailySaldo } = load('src/db/members.ts', {
    './init': { getDb: async () => ({ runAsync: async (sql, args) => writes.push({ sql, args }) }) },
  });
  await updateMemberDailySaldo(1, 7, 82.125);
  assert.deepEqual(writes[0].args, [82.13, 7, 1]);
  assert.match(writes[0].sql, /id = \? AND user_id = \? AND role = 'family'/);
  await assert.rejects(updateMemberDailySaldo(1, 7, -1));
  await assert.rejects(updateMemberDailySaldo(1, 7, NaN));
  assert.equal(writes.length, 1, 'Invalid limits are never written');
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
  const rows = [entry({ date: '2000-01-01' })];
  const dbProfile = { ...profile, walletSetOn: `${month}-01`, walletRecurringMonth: month };
  const { applyMonthlyRecurringIfDue } = load('src/helpers/monthlyRecurring.ts', {
    '../db/profile': { getProfile: async () => dbProfile, updateProfile: async (_, update) => Object.assign(dbProfile, update) },
    '../db/transactions': { listTransactions: async () => rows, addTransaction: async (_, input) => rows.push({ ...input, id: rows.length + 1 }) },
  });
  await applyMonthlyRecurringIfDue();
  assert.equal(rows.length, 1, 'Wallet snapshot prevents posting an already included income');
  dbProfile.walletSetOn = `${now.getFullYear()-1}-01-01`;
  await applyMonthlyRecurringIfDue();
  assert.equal(rows.length, 2, 'Due income is posted on its configured day');
  await applyMonthlyRecurringIfDue();
  assert.equal(rows.length, 2, 'Repeated refresh does not duplicate income');
  console.log('Spending plan and recurring posting checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
