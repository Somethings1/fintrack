import { openDB } from 'idb';

const DB_NAME = 'FinanceTracker';
const DB_VERSION = 4;
const TRANSACTION_STORE = 'transactions';
const ACCOUNT_STORE = 'accounts';
const SAVING_STORE = 'savings';
const CATEGORY_STORE = 'categories';
const SUBSCRIPTION_STORE = 'subscriptions';
const NOTIFICATION_STORE = 'notifications';

export async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(TRANSACTION_STORE)) {
                db.createObjectStore(TRANSACTION_STORE, { keyPath: '_id' });
            }
            if (!db.objectStoreNames.contains(ACCOUNT_STORE)) {
                db.createObjectStore(ACCOUNT_STORE, { keyPath: '_id' });
            }
            if (!db.objectStoreNames.contains(SAVING_STORE)) {
                db.createObjectStore(SAVING_STORE, { keyPath: '_id' });
            }
            if (!db.objectStoreNames.contains(CATEGORY_STORE)) {
                db.createObjectStore(CATEGORY_STORE, { keyPath: '_id' });
            }
            if (!db.objectStoreNames.contains(SUBSCRIPTION_STORE)) {
                db.createObjectStore(SUBSCRIPTION_STORE, { keyPath: '_id' });
            }
            if (!db.objectStoreNames.contains(NOTIFICATION_STORE)) {
                db.createObjectStore(NOTIFICATION_STORE, { keyPath: '_id' });
            }
        }
    });
}

export async function saveToDB(storeName: string, data: any[]) {
    try {
        const db = await getDB();
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        data.forEach(item => {
            store.put(item);
        });

        await tx.done;
    } catch (error) {
        console.error(`Error storing data in IndexedDB (${storeName}):`, error);
        throw new Error("Error caching data. Contact our customer service for help");
    }
}

export async function getFromDB(storeName: string): Promise<any[]> {
    try {
        const db = await getDB();
        if (!db.objectStoreNames.contains(storeName)) {
            console.error(`Object store ${storeName} does not exist.`);
            return [];
        }
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        return await store.getAll();
    } catch (error) {
        console.error(`Error fetching data from IndexedDB (${storeName}):`, error);
        throw new Error("Error caching data. Contact our customer service for help");
    }
}

export async function updateDB(storeName: string, data: any) {
    try {
        const db = await getDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(data);
        await tx.done;
    } catch (error) {
        console.error(`[updateDB] Failed to update ${storeName}:`, error, data);
        throw new Error("Error caching data. Contact our customer service for help");
    }
}

export async function deleteFromDB(storeName: string, id: string) {
    try {
        const db = await getDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        const existing = await store.get(id);
        if (!existing) {
            console.warn(`[deleteFromDB] No record found in ${storeName} with id ${id}`);
            return;
        }

        existing.isDeleted = true;
        existing.lastUpdate = new Date().toISOString();

        await updateDB(storeName, existing);
    } catch (error) {
        console.error(`[deleteFromDB] Failed to soft delete from ${storeName}:`, error);
        throw new Error("Error caching data. Contact our customer service for help");
    }
}
