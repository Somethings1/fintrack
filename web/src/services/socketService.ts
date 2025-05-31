type Listener = (payload: { collection: string; action: string; detail?: any }) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined = undefined;
let heartbeatTimer: ReturnType<typeof setTimeout> | undefined = undefined;

const WS_URL = "ws://localhost:8080/api/ws";
const RECONNECT_INTERVAL = 60_000;
const HEARTBEAT_INTERVAL = 30_000;

function notifyAll(payload: { collection: string; action: string; detail?: any }) {
    listeners.forEach(listener => {
        try {
            listener(payload);
        } catch (err) {
            console.error("Socket listener failed", err);
        }
    });
}

function setupHeartbeat() {
    if (!socket) return;
    clearTimeout(heartbeatTimer);

    heartbeatTimer = setTimeout(() => {
        try {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "ping" }));
                setupHeartbeat();
            }
        } catch (err) {
            console.warn("Heartbeat failed", err);

        }
    }, HEARTBEAT_INTERVAL);
}

function connect() {
    if (socket) return;

    console.info("[socketService] Connecting...");
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.info("[socketService] Connected!");
        reconnectTimer && clearTimeout(reconnectTimer);
        setupHeartbeat();
        notifyAll({ collection: "__RECONNECT__", action: "reconnect" });
    };

    socket.onmessage = event => {
        try {
            const data = JSON.parse(event.data);
            const { collection, action, detail: clientId } = data;

            if (action == "init") {
                localStorage.setItem("clientId", clientId);
            }
            else if (collection && action) {
                notifyAll(data);
            } else {
                console.warn("Unexpected message format", data);
            }
        } catch (err) {
            console.error("Invalid JSON from socket:", event.data);
        }
    };

    socket.onerror = err => {
        console.error("[socketService] Error:", err);
    };

    socket.onclose = (event) => {
        console.warn("[socketService] Disconnected:", event.code, event.reason);
        socket = null;
        reconnectTimer = setTimeout(() => {
            connect();
        }, RECONNECT_INTERVAL);
    };
}

export const socketService = {
    start: () => connect(),

    stop: () => {
        if (socket) {
            console.info("[socketService] Stopping...");
            socket.close();
            socket = null;
        }
        reconnectTimer && clearTimeout(reconnectTimer);
        heartbeatTimer && clearTimeout(heartbeatTimer);
    },

    restart: () => {
        console.info("[socketService] Restarting...");
        socketService.stop();
        socketService.start();
    },

    subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

