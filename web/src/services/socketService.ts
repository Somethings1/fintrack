import { websocketURL } from '@/config/api';
import { apiFetch,requireSuccess } from './apiClient';
type Event = { collection: string; action: string; detail?: unknown };
type Listener = (payload: Event) => void;
const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let active = false;
let connecting = false;
let attempt = 0;
let generation = 0;
function notify(payload: Event) { for (const listener of listeners) listener(payload); }
function retry() {
    if (!active || reconnectTimer) return;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt++, 5)) + Math.random() * 500;
    reconnectTimer = setTimeout(() => { reconnectTimer = undefined; void connect(); }, delay);
}
async function connect() {
    if (!active || connecting || socket) return;
    connecting = true;
    const current = generation;
    try {
        // Mint a path-scoped HttpOnly cookie; do not put tokens into a WebSocket URL.
        await requireSuccess(await apiFetch('/api/session', { method: 'POST' }));
        if (!active || generation !== current) return;
        const connection = new WebSocket(websocketURL());
        socket = connection;
        connection.onopen = () => {
            attempt = 0;
            heartbeatTimer = setInterval(() => { if (connection.readyState === WebSocket.OPEN) connection.send('{"type":"ping"}'); }, 30_000);
            notify({ collection: '', action: 'reconnect' });
        };
        connection.onmessage = event => {
            try {
                const data: unknown = JSON.parse(String(event.data));
                if (!data || typeof data !== 'object') return;
                if ('type' in data && data.type === 'init' && 'clientId' in data && typeof data.clientId === 'string') localStorage.setItem('clientId', data.clientId);
                else if ('collection' in data && typeof data.collection === 'string' && 'action' in data && typeof data.action === 'string') notify({ collection: data.collection, action: data.action });
            } catch { /* Untrusted messages are discarded without logging their payload. */ }
        };
        connection.onclose = () => {
            if (socket === connection) socket = null;
            clearInterval(heartbeatTimer); heartbeatTimer = undefined;
            retry();
        };
        connection.onerror = () => connection.close();
    } catch { retry(); }
    finally { connecting = false; if (active && current !== generation && !socket) retry(); }
}
export const socketService = {
    start() { if (!active) { active = true; void connect(); } },
    stop() {
        active = false; generation++;
        clearTimeout(reconnectTimer); reconnectTimer = undefined;
        clearInterval(heartbeatTimer); heartbeatTimer = undefined;
        if (socket) { socket.onclose = null; socket.close(); socket = null; }
        localStorage.removeItem('clientId');
    },
    restart() { this.stop(); this.start(); },
    subscribe(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
