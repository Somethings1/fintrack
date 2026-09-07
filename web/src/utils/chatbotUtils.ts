import type { Transaction } from '@/models/Transaction';
import { apiFetch } from '@/services/apiClient';
export type TransactionDraft = Pick<Transaction, 'amount' | 'type' | 'sourceAccount' | 'destinationAccount' | 'category' | 'note'>;
export interface AgentResult { transaction: TransactionDraft | null; clarification: string }
export async function requestTransactionDraft(input: string, consent: boolean, signal?: AbortSignal): Promise<AgentResult> {
    const response = await apiFetch('/api/agent/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, consent }), signal,
    });
    if (!response.ok) throw new Error(response.status === 503 ? 'AI drafts are disabled by the administrator. Manual entry remains available.' : 'Unable to generate a draft. Try again or enter the transaction manually.');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('transaction' in result) || !('clarification' in result) || typeof result.clarification !== 'string') throw new Error('Invalid agent response');
    const tx = result.transaction;
    if (tx !== null && (!tx || typeof tx !== 'object' || !('amount' in tx) || typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || tx.amount <= 0 || !('type' in tx) || !['income', 'expense', 'transfer'].includes(String(tx.type)))) throw new Error('Invalid agent proposal');
    return result as AgentResult;
}
