// Public keys are bundled. Reject privileged keys rather than relying only on
// variable names. JWT decoding here inspects the PUBLIC key role, not a session
// identity; all actual session authentication remains with Supabase and Go.
export function publicSupabaseKey(key: string): string {
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) return key;
  try {
    const parts = key.split('.');
    if (parts.length !== 3 || parts[1].length > 4096 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) throw new Error();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0; let count = 0; let decoded = '';
    for (const ch of parts[1].replace(/-/g, '+').replace(/_/g, '/')) {
      const value = alphabet.indexOf(ch); if (value < 0) throw new Error();
      bits = (bits << 6) | value; count += 6;
      if (count >= 8) { count -= 8; decoded += String.fromCharCode((bits >> count) & 255); bits &= (1 << count) - 1; }
    }
    const payload: unknown = JSON.parse(decoded);
    if (payload && typeof payload === 'object' && 'role' in payload && payload.role === 'anon') return key;
  } catch { /* Never include a supplied key in an error. */ }
  throw new Error('Use only a Supabase public anon or publishable key.');
}
