/** Same-origin API in production; Vite and Nginx proxy this prefix. Never bake credentials into URLs. */
export const API_BASE = '/api';
export function websocketURL(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
    return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${API_BASE}/ws`;
}
