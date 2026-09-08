import { serialVault } from './vaultLifecycle';
import { writeCachePage } from './cachePage';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { type Collection, type LedgerConfig, type LedgerRow, type Values } from '@fintrack/client';

export interface Draft { id: string; values: Values; state: 'local' | 'uncertain' | 'posted'; createdAt: string; recordId?: string }
export interface Vault {
  config(): Promise<LedgerConfig | null>; setConfig(config: LedgerConfig): Promise<void>;
  rows(collection: Collection): Promise<LedgerRow[]>; watermark(collection: Collection): Promise<string>;
  savePage(collection: Collection, rows: LedgerRow[], watermark: string): Promise<void>;
  drafts(): Promise<Draft[]>; saveDraft(draft: Draft): Promise<void>; removeDraft(id: string): Promise<void>;
  clear(): Promise<void>; close(): Promise<void>;
}
let opening: Promise<void> = Promise.resolve();
export function openVault(origin: string, owner: string): Promise<Vault> {
  const result = opening.then(() => open(origin, owner));
  opening = result.then(() => undefined, () => undefined); return result;
}
async function open(origin: string, owner: string): Promise<Vault> {
  const scope = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${origin}\n${owner}`);
  const keyName = `fintrack.db.${scope}`;
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(keyName, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Invalid device database key.');
  const name = `fintrack-${scope}.db`; const db = await SQLite.openDatabaseAsync(name);
  try {
    // Key is device-generated hex, not user input. Do not interpolate any other SQL values.
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await db.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version');
    if (!cipher || !Object.values(cipher).some(value => typeof value === 'string' && value.length > 0)) throw new Error('SQLCipher is required. Install a native development build, not Expo Go.');
    await db.execAsync("PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS records(collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(collection,id)); CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,data TEXT NOT NULL); PRAGMA user_version=1;");
  } catch (error) { await db.closeAsync(); throw error; }
  let closed = false;
  const ensure = () => { if (closed) throw new Error('Device store is closed.'); };
  const getMeta = async (key: string) => { ensure(); return (await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key=?', key))?.value ?? null; };
  return serialVault({
    config: async () => { const raw = await getMeta('config'); return raw ? JSON.parse(raw) as LedgerConfig : null; },
    setConfig: async value => { ensure(); await db.runAsync('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)', 'config', JSON.stringify(value)); },
    rows: async collection => { ensure(); return (await db.getAllAsync<{ data: string }>('SELECT data FROM records WHERE collection=?', collection)).map(row => JSON.parse(row.data) as LedgerRow).filter(row => !row.isDeleted); },
    watermark: async collection => await getMeta(`since:${collection}`) ?? '1970-01-01T00:00:00Z',
    savePage: async (collection, rows, watermark) => {
      ensure();
      // serialVault prevents interleaving. Reuse this keyed connection: Expo's
      // exclusive helper opens another connection without our SQLCipher key.
      await writeCachePage(db, collection, rows, watermark);
    },
    drafts: async () => { ensure(); return (await db.getAllAsync<{ data: string }>('SELECT data FROM drafts ORDER BY id')).map(row => JSON.parse(row.data) as Draft); },
    saveDraft: async draft => { ensure(); await db.runAsync('INSERT OR REPLACE INTO drafts(id,data) VALUES (?,?)', draft.id, JSON.stringify(draft)); },
    removeDraft: async id => { ensure(); await db.runAsync('DELETE FROM drafts WHERE id=?', id); },
    clear: async () => { ensure(); await db.execAsync('DELETE FROM records; DELETE FROM drafts; DELETE FROM meta; PRAGMA wal_checkpoint(TRUNCATE);'); },
    close: async () => { if (!closed) { closed = true; await db.closeAsync(); } },
  });
}
