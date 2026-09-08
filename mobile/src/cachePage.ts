import type { Collection, LedgerRow } from '@fintrack/client';

export interface CacheConnection {
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  runAsync(query: string, ...params: string[]): Promise<unknown>;
}

// Caller serializes all access to this handle. Use the already-keyed SQLCipher
// connection and commit its rows and watermark together, never another handle.
export async function writeCachePage(db: CacheConnection, collection: Collection, rows: LedgerRow[], watermark: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) await db.runAsync('INSERT OR REPLACE INTO records(collection,id,data) VALUES (?,?,?)', collection, row._id, JSON.stringify(row));
    await db.runAsync('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)', `since:${collection}`, watermark);
  });
}
