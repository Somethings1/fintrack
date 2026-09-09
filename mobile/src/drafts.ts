import type { Draft, Vault } from './vault';
import { type FinTrackClient, type LedgerConfig, checkedProposal, object, idPattern, APIError } from '@fintrack/client';

// Serialize saves and persist uncertainty BEFORE dispatch. A killed app can only
// offer an explicit retry with the same immutable transaction and idempotency key.
export class DraftSender {
  private busy = false;
  async send(draft: Draft, vault: Vault, api: FinTrackClient, config: LedgerConfig): Promise<Draft> {
    if (this.busy) throw new Error('A draft is already being submitted.');
    if (draft.state === 'posted') return draft;
    this.busy = true;
    try {
      checkedProposal({ id: draft.id, entity: 'transaction', operation: 'create', currency: config.currency, values: draft.values, references: {}, warnings: [] }, config, { allowChanges: true, allowDeletes: false, includeNotes: false });
      const pending: Draft = { ...draft, state: 'uncertain' }; await vault.saveDraft(pending);
      const result = await api.request('/api/transactions/add', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': draft.id }, body: JSON.stringify(draft.values) });
      let response: unknown;
      try { response = JSON.parse(result.text); } catch { throw new APIError(0, true); }
      if (!object(response) || !idPattern.test(String(response.id))) throw new APIError(0, true);
      const posted: Draft = { ...draft, state: 'posted', recordId: String(response.id) };
      await vault.saveDraft(posted); return posted;
    } finally { this.busy = false; }
  }
}
