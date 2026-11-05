const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('src/db/init.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('require', 'module', 'exports', code)(() => ({}), mod, mod.exports);
const { serializeDatabase } = mod.exports;
(async () => {
 const events = [];
 let release;
 const finalized = new Promise(resolve => { release = resolve; });
 const raw = {
  async runAsync(sql, params) {
   assert.equal(this, raw, 'Native methods require the original receiver');
   events.push(sql + ':execute');
   if (sql === 'correction') await finalized;
   events.push(sql + ':finalize');
   if (sql === 'failed') throw Error('NativeStatement.finalizeAsync: database is locked');
   return params;
  },
  async getAllAsync(sql) { events.push(sql); return []; },
  async getFirstAsync(sql) { events.push(sql); return null; },
  async execAsync(sql) { events.push(sql); }
 };
 const db = serializeDatabase(raw);
 const correction = db.runAsync('correction', [800]);
 const cloud = db.runAsync('cloud', [1000]);
 const read = db.getAllAsync('read');
 await Promise.resolve();
 assert.deepEqual(events, ['correction:execute'], 'No query may overlap native statement finalization');
 release();
 assert.deepEqual(await correction, [800]);
 await Promise.all([cloud, read]);
 assert.deepEqual(events, ['correction:execute', 'correction:finalize', 'cloud:execute', 'cloud:finalize', 'read']);
 const failed = db.runAsync('failed', []);
 const next = db.execAsync('after failure');
 await assert.rejects(failed, /database is locked/);
 await next;
 assert.equal(events.filter(event => event === 'failed:execute').length, 1, 'A finalize failure must never replay a potentially committed write');
 assert.equal(events.at(-1), 'after failure', 'A failed query must not poison the queue');
 const operations = Array.from({ length: 100 }, (_, index) => db.runAsync('write-' + index, [index]));
 await Promise.all(operations);
 assert.equal(events.filter(event => event.endsWith(':execute')).length, 103);
 console.log('Database finalization ordering, failure recovery and concurrent-write checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
