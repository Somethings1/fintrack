import { fetchStreamedEntities } from '@/services/entityService';
import { socketService } from '@/services/socketService';
import { useEffect,type ReactNode } from 'react';
import { registerRefreshCallback,triggerRefresh,unregisterRefreshCallback } from './RefreshBus';

const COLLECTIONS = ['transactions', 'accounts', 'savings', 'categories', 'subscriptions', 'notifications'];
/** Coalesce invalidations, retain incomplete requests for retry, and release everything on unmount. */
export function PollingProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const controller = new AbortController();
        const inFlight = new Set<string>();
        const dirty = new Set<string>();
        const user = localStorage.getItem('username');
        const sync = async (collection: string) => {
            if (controller.signal.aborted || !user) return;
            if (inFlight.has(collection)) { dirty.add(collection); return; }
            inFlight.add(collection);
            const key = `lastSync:money-v1:${user}:${collection}`;
            try {
                const since = localStorage.getItem(key) ?? new Date(0).toISOString();
                const latest = await fetchStreamedEntities(`/api/${collection}/get-since/${encodeURIComponent(since)}`, collection, controller.signal);
                if (!controller.signal.aborted) {
                    if (latest) localStorage.setItem(key, latest);
                    triggerRefresh(collection);
                }
            } catch {
                // Periodic or reconnect invalidation retries without advancing the checkpoint.
            } finally {
                inFlight.delete(collection);
                if (dirty.delete(collection) && !controller.signal.aborted) void sync(collection);
            }
        };
        const all = () => { for (const collection of COLLECTIONS) void sync(collection); };
        registerRefreshCallback('sync', all);
        const unsubscribe = socketService.subscribe(({ collection, action }) => {
            if (action === 'reconnect') all();
            else if (COLLECTIONS.includes(collection)) void sync(collection);
        });
        all(); socketService.start();
        const timer = setInterval(() => { if (document.visibilityState === 'visible') all(); }, 60_000);
        const visible = () => { if (document.visibilityState === 'visible') all(); };
        document.addEventListener('visibilitychange', visible);
        return () => {
            controller.abort(); clearInterval(timer); unsubscribe(); socketService.stop();
            unregisterRefreshCallback('sync', all);
            document.removeEventListener('visibilitychange', visible);
        };
    }, []);
    return children;
}
