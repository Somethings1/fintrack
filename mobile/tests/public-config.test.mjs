import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSupabaseKey } from '../src/publicConfig.ts';
import { FinTrackClient, APIError } from '../../packages/fintrack-client/index.ts';

test('bundle configuration rejects privileged keys including legacy JWT roles', () => {
  const token = role => ['header', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'signature'].join('.');
  assert.equal(publicSupabaseKey(token('anon')), token('anon'));
  assert.throws(() => publicSupabaseKey(token('service_role')));
  assert.throws(() => publicSupabaseKey('sb_' + 'secret_' + 'x'.repeat(30)));
  assert.throws(() => publicSupabaseKey('not-a-public-key'));
  assert.equal(publicSupabaseKey('sb_publishable_' + 'x'.repeat(30)), 'sb_publishable_' + 'x'.repeat(30));
});
test('invalid success bodies remain uncertain and do not trigger a second save', async () => {
  let calls = 0;
  const api = new FinTrackClient('https://api.example.test', 'owner', async () => ({ owner: 'owner', token: 'synthetic' }), () => true, async () => { calls++; return new Response('{'); });
  const proposal = { id: 'once', entity: 'account', operation: 'create', currency: 'USD', values: { name: 'Cash', balance: '0' }, references: {}, warnings: [] };
  await assert.rejects(api.confirm(proposal, { currency: 'USD', precision: 2, moneyVersion: 1 }, { allowChanges: true }), e => e instanceof APIError && e.uncertain);
  assert.equal(calls, 1);
});
