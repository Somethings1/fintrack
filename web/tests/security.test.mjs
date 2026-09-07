import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightMatches, escapeHTML } from '../src/utils/highlight.ts';
import { readSyncPage } from '../src/utils/ndjson.ts';
import { websocketURL } from '../src/config/api.ts';

const row = { _id: '0123456789abcdef01234567', note: 'Lunch \u{1f35c}', lastUpdate: '2026-09-07T01:00:00.123456Z' };
const marker = { _syncComplete: true, nextCursor: '' };
const encode = (...items) => new TextEncoder().encode(items.map(item => JSON.stringify(item)).join('\n') + '\n');
function stream(chunks) { return new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); } }); }

test('notes cannot inject HTML even within search highlights', () => {
  const text = '<img src=x onerror=alert(1)> & "test"';
  assert.equal(highlightMatches(text, [[0, 3]]), '<mark>&lt;img</mark> src=x onerror=alert(1)&gt; &amp; &quot;test&quot;');
  assert.equal(highlightMatches(text), escapeHTML(text));
  assert.ok(!highlightMatches(text, [[-1,100], [0,3], [0,4]]).includes('<img'));
});
test('websocket transport follows page security and host', () => {
  assert.equal(websocketURL({ protocol: 'https:', host: 'finance.example' }), 'wss://finance.example/api/ws');
  assert.equal(websocketURL({ protocol: 'http:', host: 'localhost:5173' }), 'ws://localhost:5173/api/ws');
});
test('sync handles every byte boundary and preserves non-ASCII data', async () => {
  const bytes = encode(row, marker);
  for (let split=1; split<bytes.length; split++) {
    const saved=[];
    const result=await readSyncPage(stream([bytes.slice(0,split),bytes.slice(split)]), async rows=>saved.push(...rows));
    assert.deepEqual(saved,[row]);
    assert.equal(result.latestTimestamp,'2026-09-07T01:00:00.123Z');
    assert.equal(result.nextCursor,'');
  }
});
test('a byte-at-a-time UTF-8 stream is supported', async () => {
  const saved=[];await readSyncPage(stream([...encode(row,marker)].map(b=>Uint8Array.of(b))),async rows=>saved.push(...rows));
  assert.equal(saved[0].note,row.note);
});
test('truncated, malformed, unbounded and trailing streams fail closed', async () => {
  for (const bytes of [encode(row),new TextEncoder().encode('bad-json\n'),encode({...row,_id:'bad'},marker),encode({...row,lastUpdate:'bad'},marker),encode(marker,row),new TextEncoder().encode('x'.repeat(131073))]) {
    await assert.rejects(readSyncPage(stream([bytes]),async()=>{}));
  }
});
test('failed local writes reject the page and must not checkpoint', async () => {
  await assert.rejects(readSyncPage(stream([encode(row,marker)]),async()=>{throw new Error('disk full');}),/disk full/);
});
test('pagination markers are returned without inventing a timestamp', async () => {
  const result=await readSyncPage(stream([encode({_syncComplete:true,nextCursor:'opaque'})]),async()=>{});
  assert.equal(result.nextCursor,'opaque');assert.equal(result.latestTimestamp,null);
});

test('ambiguous requests retain their idempotency key and simultaneous submits coalesce', async () => {
  const { transactionRequest } = await import('../src/utils/idempotency.ts');
  const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  let original;
  await assert.rejects(transactionRequest('expense','user',async key=>{original=key;throw new Error('timeout');},storage),/timeout/);
  assert.equal(data.size,1);
  let calls=0;
  const send=async key=>{calls++;assert.equal(key,original);await new Promise(resolve=>setTimeout(resolve,20));return 'id';};
  assert.deepEqual(await Promise.all([transactionRequest('expense','user',send,storage),transactionRequest('expense','user',send,storage)]),['id','id']);
  assert.equal(calls,1);assert.equal(data.size,0);
});
