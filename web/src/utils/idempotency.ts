const pending = new Map<string, Promise<string>>();

/** Coalesce simultaneous submits and retain a request key after an ambiguous
 * network failure. Storage contains hashes and random keys, not descriptions. */
export async function transactionRequest(body: string, user: string, send: (key: string) => Promise<string>, storage: Storage = sessionStorage): Promise<string> {
    if (!user) throw new Error('Authentication is required');
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
    const hash = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    const storageKey = `fintrack:request:${user}:${hash}`;
    const existing = pending.get(storageKey);
    if (existing) return existing;
    const requestKey = storage.getItem(storageKey) ?? crypto.randomUUID();
    storage.setItem(storageKey, requestKey);
    const task = send(requestKey).then(id => { storage.removeItem(storageKey); return id; }).finally(() => pending.delete(storageKey));
    pending.set(storageKey, task);
    return task;
}
