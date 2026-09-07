import { getLedgerConfig } from '@/config/ledger';
import { triggerRefresh } from '@/context/RefreshBus';
import { apiFetch } from './apiClient';

const collections = {
    transaction: 'transactions', account: 'accounts', saving: 'savings',
    category: 'categories', subscription: 'subscriptions',
} as const;
export type ProposalEntity = keyof typeof collections;
export type ProposalValues = Record<string, string | number>;
export interface AgentProposal {
    id: string;
    entity: ProposalEntity;
    operation: 'create' | 'update' | 'delete';
    recordId?: string;
    currency: string;
    values: ProposalValues;
    before?: ProposalValues;
    references: Record<string, string>;
    warnings: string[];
}
const allowedFields: Record<ProposalEntity, readonly string[]> = {
    transaction: ['currency', 'amount', 'type', 'sourceAccount', 'destinationAccount', 'category', 'note', 'dateTime'],
    account: ['currency', 'name', 'icon', 'balance'],
    saving: ['currency', 'name', 'icon', 'balance', 'goal', 'createdDate', 'goalDate'],
    category: ['currency', 'name', 'icon', 'type', 'budget'],
    subscription: ['currency', 'name', 'icon', 'amount', 'sourceAccount', 'category', 'startDate', 'interval', 'maxInterval', 'remindBefore'],
};
function object(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function isAgentProposal(value: unknown): value is AgentProposal {
    if (!object(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(value.id)
        || typeof value.entity !== 'string' || !Object.prototype.hasOwnProperty.call(collections, value.entity)
        || !['create', 'update', 'delete'].includes(String(value.operation))
        || typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) return false;
    const fields = allowedFields[value.entity as ProposalEntity];
    const validValues = (data: unknown) => object(data) && Object.entries(data).every(([key, field]) => fields.includes(key)
        && (typeof field === 'string' || (['maxInterval', 'remindBefore'].includes(key) && typeof field === 'number' && Number.isSafeInteger(field))));
    if (!validValues(value.values) || (value.before !== undefined && !validValues(value.before))) return false;
    if (value.operation !== 'create' && (typeof value.recordId !== 'string' || !/^[0-9a-f]{24}$/.test(value.recordId))) return false;
    if (value.operation === 'create' && value.recordId) return false;
    return object(value.references) && Object.values(value.references).every(name => typeof name === 'string')
        && Array.isArray(value.warnings) && value.warnings.every(warning => typeof warning === 'string');
}

/** Called only by the confirmation button, never by model text or tool execution.
 * Keep the exact prepared payload and key for the whole card; no automatic retry.
 * The ordinary backend endpoints revalidate ownership, references and money.
 */
export async function confirmAgentProposal(proposal: AgentProposal): Promise<string> {
    if (!isAgentProposal(proposal) || proposal.currency !== getLedgerConfig().currency) throw new Error('Invalid change or ledger currency. Ask for a new proposal.');
    const collection = collections[proposal.entity];
    const operation = proposal.operation;
    const path = operation === 'create' ? `/api/${collection}/add` : `/api/${collection}/${operation}/${proposal.recordId}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (operation === 'create' && proposal.entity === 'transaction') headers['Idempotency-Key'] = proposal.id;
    let response: Response;
    try {
        response = await apiFetch(path, { method: operation === 'create' ? 'POST' : operation === 'update' ? 'PUT' : 'DELETE', headers,
            body: operation === 'delete' ? undefined : JSON.stringify(proposal.values) });
    } catch {
        throw new Error('Save outcome is unknown. Check your records before requesting another change; this card will not automatically retry.');
    } finally {
        // A dropped response may still have committed. Reload canonical records.
        triggerRefresh(collection); triggerRefresh('sync');
    }
    if (!response.ok) {
        if (response.status === 409) throw new Error('Change was rejected: a referenced record, idempotency conflict, or schedule rule prevents it. Refresh the records and ask again.');
        if ([400, 401, 403, 404, 422, 429].includes(response.status)) throw new Error(`Change was rejected (${response.status}). Refresh the records or sign in again before requesting a new proposal.`);
        throw new Error('Save outcome is uncertain. Check your records before making another change.');
    }
    if (operation === 'create') {
        const result: unknown = await response.json().catch(() => null);
        if (!object(result) || typeof result.id !== 'string') throw new Error('The save returned an unexpected response. Check your records; do not submit it again.');
        return result.id;
    }
    return proposal.recordId!;
}
