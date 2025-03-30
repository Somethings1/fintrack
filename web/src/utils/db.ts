import { openDB } from 'idb';

const DB_NAME = 'FinanceTracker';
const DB_VERSION = 1;
const TRANSACTION_STORE = 'transactions';
const ACCOUNT_STORE = 'accounts';
const SAVING_STORE = 'savings';
const CATEGORY_STORE = 'categories';

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
        }
    });
}

