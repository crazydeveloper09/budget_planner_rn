const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const sqlite = new DatabaseSync(':memory:');
const db = {
  execAsync: async sql => sqlite.exec(sql),
  getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
  getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params),
  runAsync: async (sql, params = []) => sqlite.prepare(sql).run(...params),
};
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in mocks)) {
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'), {});
      throw Error('Unexpected import: ' + name);
    }
    return mocks[name];
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  // Upgrade an existing installation, including a goal saved before categories existed.
  sqlite.exec(`CREATE TABLE goals (id TEXT PRIMARY KEY, user_id INTEGER, title TEXT, target_amount REAL, saved_amount REAL, deadline TEXT, created_at TEXT);
    INSERT INTO goals VALUES ('old', 1, 'Rezerwa', 1000, 50, NULL, '2026-11-01');`);
  const init = load('src/db/init.ts', { 'expo-sqlite': { openDatabaseAsync: async () => db } });
  await init.initDb();
  const goals = load('src/db/goals.ts', { './init': init, 'expo-crypto': { getRandomBytes: () => Buffer.alloc(8) }, '../crypto/bytes': { bytesToHex: bytes => Buffer.from(bytes).toString('hex') } });
  assert.equal((await goals.listGoals(1))[0].category, 'Inne');
  assert.equal((await goals.listGoals(1))[0].priority, 2);
  await goals.addGoal(1, { id: 'trip', title: 'Wakacje', category: 'Wakacje', targetAmount: 6000, savedAmount: 1800, deadline: '2027-07-01' });
  await goals.updateGoal('trip', { savedAmount: 1900 });
  let trip = (await goals.listGoals(1)).find(g => g.id === 'trip');
  assert.equal(trip.category, 'Wakacje', 'Partial edits must retain category');
  await goals.updateGoal('trip', { category: 'Elektronika', priority: 3, deadline: null });
  trip = (await goals.listGoals(1)).find(g => g.id === 'trip');
  assert.equal(trip.category, 'Elektronika');
  assert.equal(trip.deadline, null);
  assert.equal(trip.priority, 3);
  const createdAt = trip.createdAt;
  await goals.updateGoal('trip', { title: 'Laptop' });
  assert.equal((await goals.listGoals(1)).find(g => g.id === 'trip').createdAt, createdAt, 'Edits must never reset creation time');
  await goals.mergeGoals(1, [{ id: 'remote', title: 'Dom', category: 'Dom', targetAmount: 20000, savedAmount: 0, deadline: null, createdAt: '2026-11-05' }]);
  const merged = await goals.listGoals(1);
  assert.equal(merged.find(g => g.id === 'remote').category, 'Dom');
  assert.equal(merged.find(g => g.id === 'trip').category, 'Elektronika', 'Merging another goal must preserve local categories');
  assert.equal(merged.length, 3);
  await goals.mergeGoals(1, [{ ...trip, userId: undefined, category: undefined, priority: undefined }]);
  assert.equal((await goals.listGoals(1)).find(g => g.id === 'trip').category, 'Elektronika', 'Snapshots from older clients must not erase an existing category');
  assert.equal((await goals.listGoals(1)).find(g => g.id === 'trip').priority, 3, 'Older snapshots must preserve priority');
  console.log('Goal migration, category persistence and merge checks passed');
  sqlite.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
