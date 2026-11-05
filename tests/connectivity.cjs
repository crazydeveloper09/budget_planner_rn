const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps) {
 const mod = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
 new Function('require', 'module', 'exports', code)(name => deps[name], mod, mod.exports);
 return mod.exports;
}
let notify, removed = false;
const connectivity = load('src/sync/connectivity.ts', { '@react-native-community/netinfo': {
 fetch: async () => ({ isConnected: false, isInternetReachable: false }),
 addEventListener: callback => { notify = callback; return () => { removed = true; }; }
} });
const transitions = [];
const stop = connectivity.watchInternet(online => transitions.push(online));
notify({ isConnected: null, isInternetReachable: null });
notify({ isConnected: false, isInternetReachable: false });
notify({ isConnected: false, isInternetReachable: false });
notify({ isConnected: true, isInternetReachable: true });
notify({ isConnected: true, isInternetReachable: true });
notify({ isConnected: true, isInternetReachable: false });
notify({ isConnected: true, isInternetReachable: true });
assert.deepEqual(transitions, [false, true, false, true], 'Only real online/offline transitions should trigger synchronization');
stop(); assert.equal(removed, true);
const sockets = [];
const live = load('src/sync/liveSocket.ts', {
 '../api/config': { getApiBaseUrl: () => 'https://example.test' },
 'socket.io-client': { io: (_, options) => {
  const socket = { options, handlers: {}, on(event, fn) { this.handlers[event] = fn; }, removeAllListeners() { this.handlers = {}; }, disconnect() { this.closed = true; } };
  sockets.push(socket); return socket;
 } }
});
let pulls = 0;
live.connectLiveSync('one', () => pulls++);
live.connectLiveSync('one', () => pulls++);
assert.equal(sockets.length, 1, 'Duplicate online notifications must not recreate the socket');
assert.equal(sockets[0].options.transports[0], 'websocket');
sockets[0].handlers.connect();
sockets[0].handlers['budget:updated']();
sockets[0].handlers.connect();
assert.equal(pulls, 3, 'Startup, budget event and transport reconnection must each catch up');
live.disconnectLiveSync();
assert.equal(sockets[0].closed, true);
assert.deepEqual(sockets[0].handlers, {});
live.connectLiveSync('two', () => pulls++);
assert.equal(sockets.length, 2);
live.disconnectLiveSync();
connectivity.hasInternet().then(online => {
 assert.equal(online, false);
 console.log('Connectivity transition and socket lifecycle checks passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
