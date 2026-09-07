import { triggerRefresh } from '@/context/RefreshBus';
import { deleteFromDB,getDB,saveToDB } from '@/utils/db';
import { transactionRequest } from "@/utils/idempotency";
import { readSyncPage } from '@/utils/ndjson';
import { apiFetch,requireSuccess } from './apiClient';

export async function fetchStreamedEntities(url: string, store: string, signal?: AbortSignal) {
    const syncUser = localStorage.getItem('username');
    if (!syncUser) throw new Error('Authentication is required');
    let nextCursor = '';
    let newest: string | null = null;
    for (let page = 0; page < 200; page++) {
        const response = await apiFetch(`${url}${nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : ''}`, { signal });
        await requireSuccess(response);
        if (!response.body) throw new Error('Missing synchronization stream');
        const result = await readSyncPage(response.body, records => saveToDB(store, records, syncUser));
        if (result.latestTimestamp && (!newest || result.latestTimestamp > newest)) newest = result.latestTimestamp;
        nextCursor = result.nextCursor;
        if (!nextCursor) return newest;
    }
    throw new Error('Synchronization exceeded 100,000 records; contact support for a bounded export');
}
export async function getStoredEntities<T extends { isDeleted?: boolean }>(store: string): Promise<T[]> {
    const db = await getDB();
    const all: T[] = await db.getAll(store);
    return all.filter(item => !item.isDeleted);
}
export async function getEntity<T>(store: string, id: string): Promise<T | null> {
    const db = await getDB();
    return (await db.get(store, id) as T | undefined) ?? null;
}
function syncChanged(store: string) { triggerRefresh(store); triggerRefresh('sync'); }
export async function addEntity<T extends object>(url: string, store: string, entity: T): Promise<string> {
    const body = JSON.stringify(entity);
    const send = async (key?: string) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (key) headers['Idempotency-Key'] = key;
        const response = await apiFetch(`${url}/add`, { method: 'POST', headers, body });
        await requireSuccess(response);
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string') throw new Error('Invalid create response');
        syncChanged(store); // Canonical balances are reloaded; never adjust them optimistically.
        return result.id;
    };
    return store === 'transactions' ? transactionRequest(body, localStorage.getItem('username') ?? '', send) : send();
}
export async function updateEntity<T>(url: string, store: string, id: string, updated: T) {
    const response = await apiFetch(`${url}/update/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    await requireSuccess(response);
    syncChanged(store);
}
export async function deleteEntities(url: string, store: string, ids: string[]) {
    // Sequential mutation requests bound pressure and surface partial failure accurately.
    try {
        for (const id of ids) {
            const response = await apiFetch(`${url}/delete/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await requireSuccess(response);
            await deleteFromDB(store, id); // Never delete locally after an unsuccessful server response.
        }
    } finally { syncChanged(store); }
}
