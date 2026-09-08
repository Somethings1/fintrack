// Portable contracts: no DOM, native storage, auth SDK, or floating-point money.
export const collections = ['accounts', 'savings', 'categories', 'transactions', 'subscriptions'] as const;
export type Collection = typeof collections[number];
export interface LedgerConfig { currency: string; precision: number; moneyVersion: number }
export interface LedgerRow {
  _id: string; lastUpdate: string; isDeleted?: boolean; currency: string;
  name?: string; icon?: string; type?: string; balance?: string; openingBalance?: string;
  amount?: string; budget?: string; goal?: string; goalDate?: string; createdDate?: string;
  dateTime?: string; sourceAccount?: string; destinationAccount?: string; category?: string;
  note?: string; nextActive?: string; interval?: string; startDate?: string;
  isActive?: boolean; maxInterval?: number; remindBefore?: number;
}
export type Values = Record<string, string | number>;
export interface Proposal {
  id: string; entity: 'transaction' | 'account' | 'saving' | 'category' | 'subscription';
  operation: 'create' | 'update' | 'delete'; recordId?: string; recordVersion?: string;
  currency: string; values: Values; before?: Values; references: Record<string, string>; warnings: string[];
}
export interface Permissions { allowChanges: boolean; allowDeletes: boolean; includeNotes: boolean }
export interface Message { role: 'user' | 'assistant'; content: string }
export interface Answer { answer: string; toolsUsed: string[]; proposal?: Proposal; runId?: string }
export const noPermissions: Permissions = { allowChanges: false, allowDeletes: false, includeNotes: false };
export const entityCollection = { transaction: 'transactions', account: 'accounts', saving: 'savings', category: 'categories', subscription: 'subscriptions' } as const;
export const idPattern = /^[0-9a-f]{24}$/;
const moneyFields = ['balance', 'openingBalance', 'amount', 'budget', 'goal'];
const fields: Record<Proposal['entity'], readonly string[]> = {
  transaction: ['currency', 'amount', 'type', 'sourceAccount', 'destinationAccount', 'category', 'note', 'dateTime'],
  account: ['currency', 'name', 'icon', 'balance'],
  saving: ['currency', 'name', 'icon', 'balance', 'goal', 'createdDate', 'goalDate'],
  category: ['currency', 'name', 'icon', 'type', 'budget'],
  subscription: ['currency', 'name', 'icon', 'amount', 'sourceAccount', 'category', 'startDate', 'interval', 'maxInterval', 'remindBefore'],
};
export function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function parseConfig(v: unknown): LedgerConfig {
  if (!object(v) || typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency)
      || !Number.isInteger(v.precision) || Number(v.precision) < 0 || Number(v.precision) > 6 || v.moneyVersion !== 1) throw new Error('Unsupported ledger configuration.');
  return { currency: v.currency, precision: v.precision as number, moneyVersion: 1 };
}
export function amountMicros(text: string, precision = 6): bigint {
  if (typeof text !== 'string' || text.length > 30 || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) throw new Error('Enter an exact decimal amount.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  if (!Number.isInteger(precision) || precision < 0 || precision > 6 || /[1-9]/.test(fraction.slice(precision))) throw new Error('Too many decimal places for this currency.');
  const value = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (value > 1000000000000000000n) throw new Error('Amount exceeds the ledger limit.');
  return negative ? -value : value;
}
export function fromMicros(value: bigint): string {
  const negative = value < 0n; const v = negative ? -value : value;
  const fraction = (v % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${v / 1000000n}${fraction ? '.' + fraction : ''}`;
}
export function normalizeAmount(text: string, config: LedgerConfig): string { return fromMicros(amountMicros(text.trim(), config.precision)); }
export function sumAmounts(values: string[]): string { return fromMicros(values.reduce((total, v) => total + amountMicros(v), 0n)); }
export function moneyText(value: string, config: LedgerConfig): string {
  // Display the exact decimal; never round-trip through Number/parseFloat.
  const [whole, fraction = ''] = value.split('.');
  return `${config.currency} ${whole}${config.precision ? '.' + fraction.padEnd(config.precision, '0') : fraction ? '.' + fraction : ''}`;
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateAtNoon(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Use YYYY-MM-DD for the date.');
  const [y, m, d] = day.split('-').map(Number);
  const value = new Date(y, m - 1, d, 12, 0, 0);
  if (y < 100 || y > 9999 || value.getFullYear() !== y || value.getMonth() !== m - 1 || value.getDate() !== d) throw new Error('Invalid calendar date.');
  return value.toISOString();
}
export function validTimestamp(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
}
export function parseRow(value: unknown, config: LedgerConfig): LedgerRow {
  if (!object(value) || !idPattern.test(String(value._id)) || !validTimestamp(value.lastUpdate)
      || value.currency !== config.currency || (value.isDeleted !== undefined && typeof value.isDeleted !== 'boolean')) throw new Error('Invalid synchronized record.');
  for (const key of moneyFields) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string') throw new Error('Server must support exact-money mobile sync.');
      amountMicros(value[key] as string, config.precision);
    }
  }
  for (const key of ['name', 'icon', 'type', 'note', 'sourceAccount', 'destinationAccount', 'category', 'interval']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new Error('Invalid synchronized text.');
  }
  return value as unknown as LedgerRow;
}
export function parseSyncPage(text: string, config: LedgerConfig): { rows: LedgerRow[]; nextCursor: string } {
  if (text.length > 2 * 1024 * 1024) throw new Error('Sync page is too large.');
  const lines = text.trim().split('\n'); const trailer: unknown = JSON.parse(lines.pop() || 'null');
  if (!object(trailer) || trailer._syncComplete !== true || typeof trailer.nextCursor !== 'string' || trailer.nextCursor.length > 256) throw new Error('Incomplete synchronization. Cached data was not replaced.');
  const rows = lines.filter(Boolean).map(line => parseRow(JSON.parse(line), config));
  if (rows.length > 500 || (trailer.nextCursor && rows.length === 0)) throw new Error('Invalid sync page.');
  return { rows, nextCursor: trailer.nextCursor };
}
export function checkedProposal(raw: unknown, config: LedgerConfig, permissions: Permissions): Proposal {
  if (!object(raw) || !permissions.allowChanges || typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(raw.id)
      || typeof raw.entity !== 'string' || !Object.prototype.hasOwnProperty.call(fields, raw.entity)
      || !['create', 'update', 'delete'].includes(String(raw.operation)) || raw.currency !== config.currency) throw new Error('Invalid or out-of-scope proposal.');
  if (raw.operation === 'delete' && !permissions.allowDeletes) throw new Error('Delete permission is required.');
  if (raw.operation !== 'create' && (!idPattern.test(String(raw.recordId)) || !validTimestamp(raw.recordVersion))) throw new Error('A fresh record version is required. Ask for a new preview.');
  if (raw.operation === 'create' && raw.recordId) throw new Error('Invalid create target.');
  const allowed = fields[raw.entity as Proposal['entity']];
  for (const values of [raw.values, raw.before ?? {}]) {
    if (!object(values)) throw new Error('Invalid change fields.');
    for (const [key, value] of Object.entries(values)) {
      if (!allowed.includes(key) || !(typeof value === 'string' || (['maxInterval', 'remindBefore'].includes(key) && Number.isSafeInteger(value)))) throw new Error('Invalid change fields.');
      if (moneyFields.includes(key)) amountMicros(String(value), config.precision);
    }
  }
  if (!object(raw.references) || !Object.values(raw.references).every(v => typeof v === 'string') || !Array.isArray(raw.warnings) || !raw.warnings.every(v => typeof v === 'string')) throw new Error('Invalid proposal details.');
  return raw as unknown as Proposal;
}
export function proposalWrite(proposal: Proposal): { path: string; method: string; headers: Record<string, string>; body?: string } {
  const collection = entityCollection[proposal.entity];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (proposal.operation === 'create' && proposal.entity === 'transaction') headers['Idempotency-Key'] = proposal.id;
  if (proposal.operation !== 'create') {
    if (!validTimestamp(proposal.recordVersion)) throw new Error('Missing version.');
    headers['If-Match'] = `"${proposal.recordVersion}"`;
  }
  return {
    path: `/api/${collection}/${proposal.operation === 'create' ? 'add' : proposal.operation + '/' + proposal.recordId}`,
    method: proposal.operation === 'create' ? 'POST' : proposal.operation === 'update' ? 'PUT' : 'DELETE', headers,
    body: proposal.operation === 'delete' ? undefined : JSON.stringify(proposal.values),
  };
}
export function historyFor(messages: Message[]): Message[] {
  let out = messages.slice(-8);
  if (out.length % 2) out = out.slice(1);
  while (out.length && out.reduce((n, m) => n + new TextEncoder().encode(m.content).length, 0) > 24000) out = out.slice(2);
  return out;
}
export function apiOrigin(raw: string, development = false): string {
  const u = new URL(raw);
  const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(u.hostname) || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(u.hostname) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(u.hostname);
  if ((u.protocol !== 'https:' && !(development && local && u.protocol === 'http:')) || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Configure an HTTPS API origin (private HTTP is development-only).');
  return u.origin;
}
export class APIError extends Error {
  status: number; uncertain: boolean;
  constructor(status: number, uncertain = false) {
    super(status === 412 ? 'This record changed on another device. Refresh and review again.' : status === 401 ? 'Please sign in again.' : status === 429 ? 'Too many requests. Try again shortly.' : uncertain ? 'Save outcome is unknown. Check Activity before making another change.' : `Request rejected (${status}). Refresh and review the record.`);
    this.status = status; this.uncertain = uncertain;
  }
}
export interface AuthToken { owner: string; token: string }
export class FinTrackClient {
  origin: string; owner: string; token: () => Promise<AuthToken>; current: () => boolean; fetcher: typeof fetch;
  private controllers = new Set<AbortController>();
  constructor(origin: string, owner: string, token: () => Promise<AuthToken>, current: () => boolean, fetcher: typeof fetch = fetch) {
    this.origin = origin; this.owner = owner; this.token = token; this.current = current; this.fetcher = fetcher;
  }
  cancel() { for (const c of this.controllers) c.abort(); }
  async request(path: string, init: RequestInit = {}): Promise<{ text: string; runId: string }> {
    if (!path.startsWith('/api/') || path.includes('..') || !this.current()) throw new Error('Invalid request or changed session.');
    const controller = new AbortController(); this.controllers.add(controller);
    const abort = () => controller.abort(); init.signal?.addEventListener('abort', abort, { once: true });
    if (init.signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 25000);
    let dispatched = false; const write = init.method !== undefined && !['GET', 'HEAD'].includes(init.method) && !path.startsWith('/api/agent/');
    try {
      const auth = await this.token();
      if (!this.current() || auth.owner !== this.owner || controller.signal.aborted) throw new Error('Session changed or request canceled.');
      const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${auth.token}`);
      dispatched = true;
      const response = await this.fetcher(this.origin + path, { ...init, headers, credentials: 'omit', redirect: 'error', signal: controller.signal });
      // Consume the entire response before clearing the deadline or reporting a save.
      if (Number(response.headers.get('content-length') ?? 0) > 2 * 1024 * 1024) throw new Error('Oversize response.');
      const text = await response.text();
      if (!this.current() || controller.signal.aborted || text.length > 2 * 1024 * 1024) throw new Error('Incomplete response.');
      if (!response.ok) throw new APIError(response.status, write && response.status >= 500);
      const reference = response.headers.get('X-Agent-Run-ID') ?? '';
      return { text, runId: /^[0-9a-f-]{36}$/.test(reference) ? reference : '' };
    } catch (error) {
      if (error instanceof APIError) throw error;
      if (write && dispatched) throw new APIError(0, true);
      throw new Error(controller.signal.aborted ? 'Request canceled or timed out.' : 'Connection unavailable. Cached records and local drafts remain on this device.');
    } finally {
      clearTimeout(timer); init.signal?.removeEventListener('abort', abort); this.controllers.delete(controller);
    }
  }
  async config() { return parseConfig(JSON.parse((await this.request('/api/config')).text)); }
  async sync(collection: Collection, config: LedgerConfig, since: string, save: (rows: LedgerRow[], watermark: string) => Promise<void>) {
    let cursor = ''; const seen = new Set<string>();
    for (let page = 0; page < 200; page++) {
      const result = parseSyncPage((await this.request(`/api/${collection}/get-since/${encodeURIComponent(since)}${cursor ? '?cursor=' + encodeURIComponent(cursor) : ''}`, { headers: { Accept: 'application/vnd.fintrack.exact-v1+ndjson' } })).text, config);
      if (result.rows.length) await save(result.rows, result.rows[result.rows.length - 1].lastUpdate);
      cursor = result.nextCursor;
      if (!cursor) return;
      if (seen.has(cursor)) throw new Error('Repeated sync cursor.');
      seen.add(cursor);
    }
    throw new Error('Account exceeds the mobile synchronization limit.');
  }
  async ask(input: string, history: Message[], config: LedgerConfig, permissions: Permissions, signal?: AbortSignal): Promise<Answer> {
    const response = await this.request('/api/agent/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, history: historyFor(history), consent: true, ...permissions }), signal });
    const value: unknown = JSON.parse(response.text);
    if (!object(value) || typeof value.answer !== 'string' || value.answer.length > 12000 || !Array.isArray(value.toolsUsed) || !value.toolsUsed.every(v => typeof v === 'string')) throw new Error('Invalid assistant response.');
    return { answer: value.answer, toolsUsed: value.toolsUsed as string[], runId: response.runId, proposal: value.proposal ? checkedProposal(value.proposal, config, permissions) : undefined };
  }
  async confirm(proposal: Proposal, config: LedgerConfig, permissions: Permissions): Promise<string> {
    checkedProposal(proposal, config, permissions);
    const write = proposalWrite(proposal); const { text } = await this.request(write.path, write);
    const response: unknown = JSON.parse(text);
    if (!object(response) || (proposal.operation === 'create' && !idPattern.test(String(response.id)))) throw new APIError(0, true);
    return proposal.operation === 'create' ? String(response.id) : proposal.recordId!;
  }
}
