// Supabase sessions can exceed native secure-store item limits. Write chunks
// first and publish a manifest last, so a failed write never replaces a session.
export interface KeyStore { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
interface Manifest { tag: string; count: number }
function manifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  const v = JSON.parse(raw) as Manifest;
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(v.tag) || !Number.isSafeInteger(v.count) || v.count < 1 || v.count > 160) throw new Error('Invalid secure session manifest.');
  return v;
}
export function chunkedStorage(store: KeyStore, newID: () => string): KeyStore {
  let chain = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = chain.then(fn); chain = result.then(() => undefined, () => undefined); return result;
  };
  const removeChunks = async (key: string, m: Manifest | null) => { if (m) for (let i = 0; i < m.count; i++) await store.removeItem(`${key}.${m.tag}.${i}`); };
  return {
    getItem: key => serial(async () => {
      const m = manifest(await store.getItem(key)); if (!m) return null;
      let value = '';
      for (let i = 0; i < m.count; i++) { const chunk = await store.getItem(`${key}.${m.tag}.${i}`); if (chunk === null) throw new Error('Incomplete secure session. Sign in again.'); value += chunk; }
      return value;
    }),
    setItem: (key, value) => serial(async () => {
      if (!value || value.length > 64000) throw new Error('Session is too large for secure storage.');
      const old = manifest(await store.getItem(key)); const m = { tag: newID(), count: Math.ceil(value.length / 400) };
      let written = 0;
      try {
        for (let i = 0; i < m.count; i++) { await store.setItem(`${key}.${m.tag}.${i}`, value.slice(i * 400, (i + 1) * 400)); written++; }
        await store.setItem(key, JSON.stringify(m));
      } catch (error) {
        await removeChunks(key, { ...m, count: written }).catch(() => undefined); throw error;
      }
      // A stale encrypted generation cannot be read after the manifest switch.
      await removeChunks(key, old).catch(() => undefined);
    }),
    removeItem: key => serial(async () => {
      const old = manifest(await store.getItem(key));
      await store.removeItem(key); await removeChunks(key, old);
    }),
  };
}
