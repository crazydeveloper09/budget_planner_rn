const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { if (!(name in deps)) throw Error(name); return deps[name]; }, mod, mod.exports);
  return mod.exports;
}
const { currentWallet } = load('src/helpers/wallet.ts', {});
let profile = { id: 1, name: 'Test', accountType: 'personal', walletBalance: 1000, walletAfterId: 40, walletHistory: [{ id: 'initial', before: null, after: 1000 }] };
let entries = [{ id: 40, date: '2026-11-01', type: 'expense', name: 'Old', category: 'Other', amount: 200, regular: false, memberId: null }, { id: 41, date: '2026-11-02', type: 'expense', name: 'New', category: 'Other', amount: 50, regular: false, memberId: null }];
let remote, imports = 0, nextId = 100, online = true, requests = 0;
const storage = new Map();
const pending = load('src/sync/pendingBudget.ts', {
  '@react-native-async-storage/async-storage': { __esModule: true, default: {
    getItem: async key => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    removeItem: async key => storage.delete(key)
  } }
});
const deps = {
  './connectivity': { hasInternet: async () => online },
  './pendingBudget': pending,
  '../api/client': { api: { defaults: { headers: { common: { Authorization: 'test' } } }, put: async (url, body) => { requests++; remote = { household: {}, people: [], e2e: body.e2e }; return { data: remote }; }, get: async () => { requests++; return { data: remote }; } } },
  '../crypto/e2e': { encryptBudget: (_, plain) => ({ ciphertext: 'test', nonce: 'test', plain }), decryptBudget: (_, envelope) => envelope.plain },
  '../crypto/keystore': { requireDek: async () => [], loadDek: async () => [] },
  '../db/profile': { getProfile: async () => profile, updateProfile: async (_, input) => (profile = { ...profile, ...input }), setCloudProfileId: async () => {} },
  '../db/transactions': { listTransactions: async () => entries, replaceAllTransactions: async (_, items) => { imports++; entries = items.map(item => ({ ...item, id: nextId++ })); } },
  '../db/members': { listMembers: async () => [], replaceMembers: async () => [] },
  '../db/goals': { listGoals: async () => [], mergeGoals: async () => {} },
  '../db/chat': { listChatTopics: async () => [], listChatMessages: async () => [], mergeChat: async () => {} },
  '../helpers/wallet': { currentWallet }, '../helpers/owners': { ownerLabel: () => 'Wspólny' },
  './receipts': { uploadLocalReceipts: async () => {}, downloadRemoteReceipts: async () => {} }
};
(async () => {
 const sync = load('src/sync/budget.ts', deps);
 const history = JSON.stringify(profile.walletHistory);
 assert.equal(currentWallet(profile, entries), 950);
 await sync.pushSqliteBudget();
 await sync.pullCloudBudgetIntoSqlite();
 assert.equal(currentWallet(profile, entries), 950, 'Import must preserve balance despite new SQLite IDs');
 assert.equal(JSON.stringify(profile.walletHistory), history, 'Sync must preserve wallet history');
 await sync.pullCloudBudgetIntoSqlite();
 assert.equal(imports, 1, 'Unchanged snapshot must not recreate transactions');
 entries.push({ ...entries[0], id: nextId++, amount: 25, type: 'expense' });
 assert.equal(currentWallet(profile, entries), 925, 'New expenses must still reduce the wallet');
 await sync.pushSqliteBudget();
 await sync.pullCloudBudgetIntoSqlite();
 assert.equal(currentWallet(profile, entries), 925, 'Repeated round trips must not subtract expenses twice');
 online = false;
 entries.push({ ...entries[0], id: nextId++, amount: 10 });
 const requestsBeforeOffline = requests;
 await sync.pushSqliteBudget();
 assert.equal(await pending.hasPendingBudget(profile.id), true, 'Offline changes must be persisted as pending');
 await sync.pullCloudBudgetIntoSqlite();
 assert.equal(requests, requestsBeforeOffline, 'Offline synchronization must not call the API');
 online = true;
 await sync.pullCloudBudgetIntoSqlite();
 assert.equal(requests, requestsBeforeOffline, 'Pending changes must block cloud overwrite');
 await sync.pushSqliteBudget();
 assert.equal(await pending.hasPendingBudget(profile.id), false, 'Successful upload clears pending changes');
 await sync.pullCloudBudgetIntoSqlite();
 assert.equal(currentWallet(profile, entries), 915, 'Offline edits survive reconnect and import');
 const older = await pending.markBudgetPending(1);
 const newer = await pending.markBudgetPending(1);
 await pending.clearPendingBudget(1, older);
 assert.equal(await pending.hasPendingBudget(1), true, 'Older upload must not clear a newer edit');
 assert.equal(await pending.hasPendingBudget(2), false, 'Pending changes belong to one profile');
 await pending.clearPendingBudget(1, newer);
 console.log('Cloud wallet, offline queue and unchanged-snapshot checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
