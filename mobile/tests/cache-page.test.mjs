import test from 'node:test';
import assert from 'node:assert/strict';
import { writeCachePage } from '../src/cachePage.ts';

test('cache pages share the keyed connection and roll back rows with their watermark', async () => {
  let rows = []; let watermark = 'old'; let fail = true; let inTransaction = false;
  const db = {
    withTransactionAsync: async task => {
      const previous = { rows: [...rows], watermark }; inTransaction = true;
      try { await task(); } catch (error) { rows = previous.rows; watermark = previous.watermark; throw error; }
      finally { inTransaction = false; }
    },
    runAsync: async (query, ...values) => {
      assert.equal(inTransaction, true);
      if (query.includes('records')) rows.push(values[1]);
      else { if (fail) throw new Error('full'); watermark = values[1]; }
    },
  };
  const page = [{ _id: 'new-row', amount: '0.3' }];
  await assert.rejects(writeCachePage(db, 'transactions', page, 'new'));
  assert.deepEqual(rows, []); assert.equal(watermark, 'old');
  fail = false; await writeCachePage(db, 'transactions', page, 'new');
  assert.deepEqual(rows, ['new-row']); assert.equal(watermark, 'new');
});
