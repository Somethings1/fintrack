import { openDB,type IDBPDatabase } from 'idb';

const STORES = ['transactions', 'accounts', 'savings', 'categories', 'subscriptions', 'notifications'];
let connection: Promise<IDBPDatabase> | undefined;
let connectionName = '';

export async function getDB() {
    const user = localStorage.getItem('username');
    if (!user) throw new Error('A signed-in user is required for the local cache');
    const name = `FinanceTracker:money-v1:${user}`;
    if (!connection || connectionName !== name) {
        const previous = connection;
        connectionName = name;
        const opening = openDB(name, 1, {
            upgrade(db) { for (const store of STORES) db.createObjectStore(store, { keyPath: '_id' }); },
            blocking() { void opening.then(db => db.close()); if (connection === opening) connection = undefined; },
            terminated() { if (connection === opening) connection = undefined; },
        });
        connection = opening;
        void previous?.then(db => db.close());
    }
    const db = await connection;
    if (localStorage.getItem('username') !== user) throw new Error('Session changed during cache access');
    return db;
}

export async function clearUserCache(user = localStorage.getItem('username')) {
    if (connection) (await connection).close();
    connection = undefined;
    for (const name of ['FinanceTracker', ...(user ? [`FinanceTracker:${user}`, `FinanceTracker:money-v1:${user}`] : [])]) {
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('Close other FinTrack tabs to clear the cache'));
        });
    }
    connectionName = '';
}

export async function saveToDB(storeName: string, data: unknown[], expectedUser = localStorage.getItem('username')) {
    if (!STORES.includes(storeName)) throw new Error('Unknown cache store');
    if (!expectedUser || localStorage.getItem('username') !== expectedUser) throw new Error('Session changed during sync');
    const db = await getDB();
    if (localStorage.getItem('username') !== expectedUser) throw new Error('Session changed during sync');
    const tx = db.transaction(storeName, 'readwrite');
    try {
        for (const record of data) {
            if (!record || typeof record !== 'object' || !('_id' in record) || typeof record._id !== 'string') {
                throw new Error('Invalid cache record');
            }
            await tx.store.put(record);
        }
        await tx.done;
    } catch (error) {
        try { tx.abort(); } catch { /* transaction may already have aborted */ }
        await tx.done.catch(() => undefined);
        throw error;
    }
}
export async function getFromDB<T>(storeName: string): Promise<T[]> {
    const db = await getDB();
    return db.getAll(storeName) as Promise<T[]>;
}
export async function updateDB(storeName: string, data: unknown) { await saveToDB(storeName, [data]); }
export async function deleteFromDB(storeName: string, id: string) {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const existing = await tx.store.get(id);
    if (existing) await tx.store.put({ ...existing, isDeleted: true });
    await tx.done;
}
