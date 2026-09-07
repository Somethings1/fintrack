import { isAgentProposal, type AgentProposal } from './agentProposal';
import { apiFetch } from './apiClient';

export interface AgentMessage { role: 'user' | 'assistant'; content: string }
export interface AgentPermissions { allowChanges: boolean; allowDeletes: boolean; includeNotes: boolean }
export interface AgentAnswer { answer: string; toolsUsed: string[]; proposal?: AgentProposal; runId?: string }
export const readOnlyPermissions: AgentPermissions = { allowChanges: false, allowDeletes: false, includeNotes: false };
const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const guardMessages: Record<string, string> = {
    sensitive_input: 'Remove credentials, passwords, or API keys before using the assistant.',
    invalid_text: 'Remove invisible control or direction-override characters from the request.',
    changes_not_enabled: 'Change proposals are disabled. Enable them in chat, or contact the administrator.',
    deletes_not_enabled: 'Enable delete/archive proposals before requesting deletion.',
    unverified_record: 'The assistant must look up the affected record first. Name the record and requested change explicitly.',
    sensitive_output: 'The assistant response was withheld because it may contain credentials. No change was submitted.',
    provider_safety: 'The provider withheld this response. Try rephrasing the request.',
};

/** Send complete prior pairs only, bounded by the same UTF-8 budget as Go. */
export function agentHistory(messages: AgentMessage[]): AgentMessage[] {
    const encoder = new TextEncoder();
    const result: AgentMessage[] = [];
    let bytes = 0;
    for (let i = messages.length - 2; i >= 0 && result.length < 8; i -= 2) {
        const pair = messages.slice(i, i + 2);
        const size = pair.reduce((total, message) => total + encoder.encode(message.content).length, 0);
        if (bytes + size > 24_000) break;
        result.unshift(...pair); bytes += size;
    }
    return result;
}

export async function askAgent(input: string, consent: boolean, history: AgentMessage[], signal?: AbortSignal, permissions: AgentPermissions = readOnlyPermissions): Promise<AgentAnswer> {
    const response = await apiFetch('/api/agent/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, consent, history: agentHistory(history), ...permissions }), signal,
    });
    const runId = response.headers.get('X-Agent-Run-ID') ?? '';
    const reference = runIdPattern.test(runId) ? ` Reference: ${runId}` : '';
    if (!response.ok) {
        const detail: unknown = await response.json().catch(() => null);
        const data = detail && typeof detail === 'object' ? detail as Record<string, unknown> : {};
        const code = typeof data.code === 'string' ? data.code : '';
        if (Object.prototype.hasOwnProperty.call(guardMessages, code)) throw new Error(guardMessages[code] + reference);
        if (response.status === 401) throw new Error('Your session expired. Please sign in again.' + reference);
        if (response.status === 429) throw new Error('An assistant request is running or the rate limit was reached. Try again shortly.' + reference);
        if (response.status === 504) throw new Error('The assistant timed out. Try a narrower question.' + reference);
        if (response.status === 422) throw new Error('The assistant stopped at an execution limit. Try a narrower question.' + reference);
        if (response.status === 503) {
            if (data.error === 'AI assistant is disabled') throw new Error('AI assistant is disabled by the administrator. Manual tracking remains available.' + reference);
            throw new Error('Financial data is temporarily unavailable.' + reference);
        }
        throw new Error('The assistant could not answer. No records were changed.' + reference);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('answer' in result) || typeof result.answer !== 'string' || !result.answer.trim()
        || !('toolsUsed' in result) || !Array.isArray(result.toolsUsed) || !result.toolsUsed.every(tool => typeof tool === 'string')) throw new Error('Invalid assistant response.' + reference);
    if ('proposal' in result && result.proposal !== undefined && result.proposal !== null) {
        if (!isAgentProposal(result.proposal)) throw new Error('Invalid assistant proposal.' + reference);
        if (!permissions.allowChanges || (result.proposal.operation === 'delete' && !permissions.allowDeletes)) throw new Error('The assistant returned a proposal outside the enabled permissions.' + reference);
    }
    return { ...result, runId: runIdPattern.test(runId) ? runId : undefined } as AgentAnswer;
}
