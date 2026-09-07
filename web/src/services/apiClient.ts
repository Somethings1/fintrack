import { supabase } from './authService';

/** Authenticated, cancellable requests. No automatic mutation retries. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!path.startsWith('/api/')) throw new Error('API requests must remain same-origin');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Please sign in again');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
    headers.set('clientId', localStorage.getItem('clientId') ?? '');
    const timeout = AbortSignal.timeout(25_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(path, { ...init, headers, signal, credentials: 'same-origin' });
}

export async function requireSuccess(response: Response): Promise<void> {
    if (!response.ok) {
        if (response.status === 401) throw new Error('Your session expired. Please sign in again.');
        if (response.status === 429) throw new Error('Too many requests. Please try again shortly.');
        throw new Error(`The request failed (${response.status}). No local changes were applied.`);
    }
}
