type Callback = () => void;
const listeners: Map<string, Set<Callback>> = new Map();

export function registerRefreshCallback(topic: string, cb: Callback) {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)!.add(cb);
}

export function unregisterRefreshCallback(topic: string, cb: Callback) {
    listeners.get(topic)?.delete(cb);
}

export function triggerRefresh(topic: string) {
    if (!listeners.has(topic)) return;
    listeners.get(topic)!.forEach(cb => cb());
}

