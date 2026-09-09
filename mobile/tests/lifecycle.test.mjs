import test from 'node:test';
import assert from 'node:assert/strict';
import { serialVault } from '../src/vaultLifecycle.ts';

test('sign-out drains in-flight cache work and rejects late writes', async () => {
  let release; const events = [];
  const store = serialVault({ saveDraft: async () => { events.push('writing'); await new Promise(resolve => { release = resolve; }); events.push('written'); }, clear: async () => { events.push('cleared'); } });
  const pending = store.saveDraft({}); await new Promise(resolve => setImmediate(resolve));
  const cleared = store.clear(); const late = assert.rejects(store.saveDraft({}));
  release(); await pending; await cleared; await late;
  assert.deepEqual(events, ['writing', 'written', 'cleared']);
});
