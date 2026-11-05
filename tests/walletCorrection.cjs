const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { randomBytes } = require('node:crypto');
const sqlite = new DatabaseSync(':memory:');
const db = {
 execAsync: async sql => sqlite.exec(sql),
 getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
 getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params),
 runAsync: async (sql, params = []) => sqlite.prepare(sql).run(...params),
 withTransactionAsync: async task => {
  sqlite.exec('BEGIN');
  try { await task(); sqlite.exec('COMMIT'); }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
 }
};
function load(file, mocks) {
 const mod = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
 new Function('require', 'module', 'exports', code)(name => {
  if (!(name in mocks)) throw Error('Unexpected import: ' + name);
  return mocks[name];
 }, mod, mod.exports);
 return mod.exports;
}
(async () => {
 const init = load('src/db/init.ts', { 'expo-sqlite': { openDatabaseAsync: async () => db } });
 await init.initDb();
 const wallet = load('src/helpers/wallet.ts', {});
 const dates = load('src/helpers/dates.ts', {});
 const transactions = load('src/db/transactions.ts', {
  './init': init, '../helpers/owners': { SHARED_OWNER_ID: 0 },
  'expo-crypto': { getRandomBytes: size => randomBytes(size) },
  '../crypto/bytes': { bytesToHex: bytes => Buffer.from(bytes).toString('hex') },
  '../helpers/dates': dates, '../helpers/wallet': wallet
 });
 const store = new Map();
 const profileDb = load('src/db/profile.ts', {
  './init': init, './transactions': transactions, '../helpers/wallet': wallet, '../helpers/dates': dates,
  '../crypto/bytes': { bytesToHex: bytes => Buffer.from(bytes).toString('hex') },
  'expo-crypto': {
   getRandomBytes: size => randomBytes(size),
   randomUUID: () => { throw Error('Native randomUUID is unavailable'); }
  },
  '@react-native-async-storage/async-storage': {
   getItem: async key => store.get(key) ?? null,
   setItem: async (key, value) => store.set(key, value)
  }
 });
 // Existing wallet, before adjustment history was introduced.
 sqlite.exec("INSERT INTO users (name, account_type, dailySaldo, currency, wallet_balance, wallet_set_on, wallet_after_id) VALUES ('Test', 'personal', 100, 'PLN', 1000, '2026-11-01', 0)");
 sqlite.exec("INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount) VALUES (1, '2026-11-05', 'expense', 'Zakupy', 'Inne', 50)");
 const entries = await transactions.listTransactions(1);
 assert.equal(wallet.currentWallet(await profileDb.getProfileById(1), entries), 950);
 const correction = await profileDb.updateProfile(1, { walletBalance: 800.25, walletSetOn: '2026-11-06', walletAfterId: entries[0].id, recordWalletChange: true });
 assert.equal(wallet.currentWallet(correction, entries), 800.25);
 assert.equal(correction.walletHistory.length, 2);
 assert.equal(correction.walletHistory[0].after, 1000, 'Legacy baseline must be preserved');
 assert.equal(correction.walletHistory[1].before, 950);
 assert.equal(correction.walletHistory[1].after, 800.25);
 const next = await profileDb.updateProfile(1, { walletBalance: 900, recordWalletChange: true });
 assert.equal(next.walletHistory.length, 3);
 assert.equal(next.walletHistory[2].before, 800.25);
 assert.equal(new Set(next.walletHistory.map(item => item.id)).size, 3);
 const created = await profileDb.createProfile({ name: 'Nowy', accountType: 'family', walletBalance: 123.45 });
 assert.equal(created.walletHistory.length, 1);
 assert.equal(created.walletHistory[0].after, 123.45);
 // A historical expense already included in the manually set baseline still refunds.
 await transactions.removeTransaction(entries[0].id, 1);
 let restored = await profileDb.getProfileById(1);
 assert.equal(wallet.currentWallet(restored, await transactions.listTransactions(1)), 950);
 let deletion = restored.walletHistory.at(-1);
 assert.equal(deletion.reason, 'transaction_deleted');
 assert.equal(deletion.before, 900);
 assert.equal(deletion.after, 950);
 assert.equal(deletion.deletedTransaction.name, 'Zakupy');
 assert.equal(deletion.deletedTransaction.amount, 50);
 const count = restored.walletHistory.length;
 await transactions.removeTransaction(entries[0].id, 1);
 assert.equal((await profileDb.getProfileById(1)).walletHistory.length, count, 'Deleting twice must not refund twice');
 // A new expense refunds through its removal, without incrementing the baseline twice.
 sqlite.exec("INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount) VALUES (1, '2026-11-06', 'expense', 'Nowy', 'Inne', 25)");
 const newEntry = (await transactions.listTransactions(1))[0];
 assert.equal(wallet.currentWallet(restored, [newEntry]), 925);
 await transactions.removeTransaction(newEntry.id, 1);
 restored = await profileDb.getProfileById(1);
 assert.equal(wallet.currentWallet(restored, []), 950);
 assert.equal(restored.walletHistory.at(-1).before, 925);
 assert.equal(restored.walletHistory.at(-1).after, 950);
 // Recurring templates do not represent money already spent.
 sqlite.exec("INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount, is_regular) VALUES (1, '2026-11-06', 'expense', 'Szablon', 'Inne', 100, 1)");
 const recurring = (await transactions.listTransactions(1))[0];
 const beforeTemplate = JSON.stringify(restored.walletHistory);
 await transactions.removeTransaction(recurring.id, 1);
 assert.equal(JSON.stringify((await profileDb.getProfileById(1)).walletHistory), beforeTemplate);
 // A failure deleting the row must roll back the wallet/history change too.
 sqlite.exec("INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount) VALUES (1, '2026-11-06', 'expense', 'Rollback', 'Inne', 10)");
 const rollbackEntry = (await transactions.listTransactions(1))[0];
 const originalRun = db.runAsync;
 db.runAsync = async (sql, params) => {
  if (sql.startsWith('DELETE FROM entries')) throw Error('simulated deletion failure');
  return originalRun(sql, params);
 };
 await assert.rejects(transactions.removeTransaction(rollbackEntry.id, 1), /simulated deletion failure/);
 db.runAsync = originalRun;
 assert.equal(JSON.stringify((await profileDb.getProfileById(1)).walletHistory), beforeTemplate);
 assert.equal((await transactions.listTransactions(1)).length, 1);
 // An ID from another profile must not modify the wallet or history.
 await transactions.removeTransaction(rollbackEntry.id, created.id);
 assert.equal((await transactions.listTransactions(1)).length, 1);
 // Editing a new expense changes the wallet by the difference only.
 let edited = await transactions.updateTransaction(rollbackEntry.id, { ...rollbackEntry, amount: 30 }, 1);
 let editedProfile = await profileDb.getProfileById(1);
 assert.equal(wallet.currentWallet(editedProfile, await transactions.listTransactions(1)), 920);
 assert.equal(editedProfile.walletHistory.at(-1).reason, 'transaction_updated');
 assert.equal(editedProfile.walletHistory.at(-1).before, 940);
 assert.equal(editedProfile.walletHistory.at(-1).after, 920);
 assert.equal(editedProfile.walletHistory.at(-1).editedTransaction.before.amount, 10);
 assert.equal(editedProfile.walletHistory.at(-1).editedTransaction.after.amount, 30);
 edited = await transactions.updateTransaction(edited.id, { ...edited, amount: 5 }, 1);
 editedProfile = await profileDb.getProfileById(1);
 assert.equal(wallet.currentWallet(editedProfile, await transactions.listTransactions(1)), 945);
 const historyCount = editedProfile.walletHistory.length;
 edited = await transactions.updateTransaction(edited.id, { ...edited, name: 'Nowa nazwa' }, 1);
 assert.equal((await profileDb.getProfileById(1)).walletHistory.length, historyCount, 'Metadata edits must not create money movements');
 // Editing an expense absorbed by a manual/cloud baseline adjusts that baseline.
 await profileDb.updateProfile(1, { walletBalance: 1000, walletAfterId: edited.id });
 edited = await transactions.updateTransaction(edited.id, { ...edited, amount: 20 }, 1);
 editedProfile = await profileDb.getProfileById(1);
 assert.equal(wallet.currentWallet(editedProfile, await transactions.listTransactions(1)), 985);
 assert.equal(editedProfile.walletHistory.at(-1).before, 1000);
 assert.equal(editedProfile.walletHistory.at(-1).after, 985);
 const stableHistory = JSON.stringify(editedProfile.walletHistory);
 await transactions.updateTransaction(edited.id, edited, 1);
 assert.equal(JSON.stringify((await profileDb.getProfileById(1)).walletHistory), stableHistory, 'Repeated save must not apply a delta twice');
 db.runAsync = async (sql, params) => {
  if (sql.startsWith('UPDATE entries')) throw Error('simulated edit failure');
  return originalRun(sql, params);
 };
 await assert.rejects(transactions.updateTransaction(edited.id, { ...edited, amount: 99 }, 1), /simulated edit failure/);
 db.runAsync = originalRun;
 assert.equal((await transactions.listTransactions(1))[0].amount, 20);
 assert.equal(JSON.stringify((await profileDb.getProfileById(1)).walletHistory), stableHistory, 'Failed edit must roll back wallet history');
 await assert.rejects(transactions.updateTransaction(edited.id, edited, created.id), /Nie znaleziono/);
 console.log('Wallet corrections, deletion and edit deltas, audit history and rollback checks passed');
 sqlite.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
