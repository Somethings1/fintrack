import test from 'node:test';
import assert from 'node:assert/strict';
import { amountMicros, fromMicros, sumAmounts, parseSyncPage, checkedProposal, noPermissions, proposalWrite, apiOrigin, FinTrackClient, APIError } from '../../packages/fintrack-client/index.ts';
import { chunkedStorage } from '../src/secureStorage.ts';
import { DraftSender } from '../src/drafts.ts';
const config = { currency: 'USD', precision: 2, moneyVersion: 1 };
const id = '111111111111111111111111';
const timestamp = '2026-09-08T00:00:00.123456Z';
const row = { _id: id, lastUpdate: timestamp, currency: 'USD', amount: '999999999999.99' };
test('money never passes through floating point', () => {
  assert.equal(sumAmounts(['0.1', '0.2']), '0.3');
  assert.equal(fromMicros(amountMicros('999999999999.99', 2)), '999999999999.99');
  assert.equal(sumAmounts(['1000000000000', '1000000000000']), '2000000000000');
  for (const v of ['1e3', 'NaN', '0.001', '1000000000001']) assert.throws(() => amountMicros(v, 2));
});
test('sync requires a complete page and decimal strings', () => {
  const page = JSON.stringify(row) + '\n' + JSON.stringify({ _syncComplete: true, nextCursor: '' });
  assert.equal(parseSyncPage(page, config).rows[0].amount, '999999999999.99');
  assert.throws(() => parseSyncPage(JSON.stringify(row), config));
  assert.throws(() => parseSyncPage(page.replace('"999999999999.99"', '999999999999.99'), config));
});
test('proposals require scope and fresh versions', () => {
  const p = { id: 'stable', entity: 'account', operation: 'delete', recordId: id, recordVersion: timestamp, currency: 'USD', values: {}, references: {}, warnings: [] };
  assert.throws(() => checkedProposal(p, config, noPermissions));
  assert.throws(() => checkedProposal(p, config, { ...noPermissions, allowChanges: true }));
  assert.throws(() => checkedProposal({ ...p, recordVersion: undefined }, config, { allowChanges: true, allowDeletes: true, includeNotes: false }));
  assert.equal(proposalWrite(p).headers['If-Match'], '"' + timestamp + '"');
  assert.equal(proposalWrite({ ...p, entity: 'transaction', operation: 'create' }).headers['Idempotency-Key'], 'stable');
});
test('production API origins reject insecure URLs and embedded credentials', () => {
  for (const v of ['http://api.example.com', 'https://user:password@api.example.com', 'https://api.example.com/path', 'https://api.example.com/?x=y']) assert.throws(() => apiOrigin(v));
  assert.equal(apiOrigin('http://10.0.2.2:8080', true), 'http://10.0.2.2:8080');
  assert.throws(() => apiOrigin('http://example.com', true));
});
test('native transport verifies bearer identity and consumes response bodies', async () => {
  let read = false;
  const api = new FinTrackClient('https://api.example.test', 'owner', async () => ({ owner: 'owner', token: 'synthetic' }), () => true, async (_url, init) => {
    assert.equal(init.headers.get('Authorization'), 'Bearer synthetic'); assert.equal(init.credentials, 'omit');
    return { ok: true, headers: new Headers(), text: async () => { await Promise.resolve(); read = true; return '{"ok":true}'; } };
  });
  await api.request('/api/config'); assert.equal(read, true);
  api.token = async () => ({ owner: 'other', token: 'wrong' }); await assert.rejects(api.request('/api/config'));
});
test('lost mutation responses are uncertain and never retried automatically', async () => {
  let calls = 0;
  const api = new FinTrackClient('https://api.example.test', 'owner', async () => ({ owner: 'owner', token: 'synthetic' }), () => true, async () => { calls++; throw new Error('private network details'); });
  await assert.rejects(api.request('/api/transactions/add', { method: 'POST' }), e => e instanceof APIError && e.uncertain && !e.message.includes('private'));
  assert.equal(calls, 1);
});
test('truncated sync never commits a cache page', async () => {
  let saves = 0;
  const api = new FinTrackClient('https://api.example.test', 'owner', async () => ({ owner: 'owner', token: 'synthetic' }), () => true, async () => new Response(JSON.stringify(row)));
  await assert.rejects(api.sync('transactions', config, timestamp, async () => { saves++; })); assert.equal(saves, 0);
});
test('chunked secure storage publishes atomically', async () => {
  const data = new Map(); let fail = false; let generation = 0;
  const storage = chunkedStorage({ getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { if (fail && k.endsWith('.1')) throw new Error('full'); data.set(k, v); }, removeItem: async k => { data.delete(k); } }, () => `gen-${++generation}`);
  await storage.setItem('session', 'old'); fail = true; await assert.rejects(storage.setItem('session', 'x'.repeat(1500)));
  assert.equal(await storage.getItem('session'), 'old'); fail = false;
  await storage.setItem('session', 'y'.repeat(2000)); assert.equal((await storage.getItem('session')).length, 2000);
  await storage.removeItem('session'); assert.equal(await storage.getItem('session'), null); assert.equal(data.size, 0);
});
test('drafts persist uncertainty before dispatch and retain their original key', async () => {
  const states = []; const vault = { saveDraft: async d => states.push(structuredClone(d)) }; let sends = 0; let finish;
  const draft = { id: 'original-key', state: 'local', createdAt: timestamp, values: { amount: '0.3', type: 'expense', sourceAccount: id, category: id, dateTime: timestamp, currency: 'USD' } };
  const sender = new DraftSender();
  const api = { request: async (_path, init) => { sends++; assert.equal(states.at(-1).state, 'uncertain'); assert.equal(init.headers['Idempotency-Key'], draft.id); await new Promise(resolve => { finish = resolve; }); return { text: JSON.stringify({ id }) }; } };
  const first = sender.send(draft, vault, api, config); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(sender.send(draft, vault, api, config)); finish();
  const result = await first; assert.equal(result.state, 'posted'); assert.equal(sends, 1);
  await sender.send(result, vault, api, config); assert.equal(sends, 1);
});
