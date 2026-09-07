import { apiFetch } from './apiClient';

export interface AgentMessage { role: 'user' | 'assistant'; content: string }
export interface AgentAnswer { answer: string; toolsUsed: string[] }

/** Send complete prior pairs only, bounded by the same UTF-8 budget as Go. */
export function agentHistory(messages: AgentMessage[]): AgentMessage[] {
    const encoder = new TextEncoder();
    const result: AgentMessage[] = [];
    let bytes = 0;
    for (let i = messages.length - 2; i >= 0 && result.length < 8; i -= 2) {
        const pair = messages.slice(i, i + 2);
        const size = pair.reduce((total, message) => total + encoder.encode(message.content).length, 0);
        if (bytes + size > 24_000) break;
        result.unshift(...pair);
        bytes += size;
    }
    return result;
}

export async function askAgent(input: string, consent: boolean, history: AgentMessage[], signal?: AbortSignal): Promise<AgentAnswer> {
    const response = await apiFetch('/api/agent/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, consent, history: agentHistory(history) }), signal,
    });
    if (!response.ok) {
        if (response.status === 401) throw new Error('Your session expired. Please sign in again.');
        if (response.status === 429) throw new Error('Too many questions. Please try again shortly.');
        if (response.status === 504) throw new Error('The assistant timed out. Try a narrower question.');
        if (response.status === 422) throw new Error('This question needs too many steps. Try a narrower question.');
        if (response.status === 503) {
            const detail: unknown = await response.json().catch(() => null);
            if (detail && typeof detail === 'object' && 'error' in detail && detail.error === 'AI assistant is disabled') {
                throw new Error('AI assistant is disabled by the administrator. Manual tracking remains available.');
            }
            throw new Error('Financial data is temporarily unavailable.');
        }
        throw new Error('The assistant could not answer. No records were changed.');
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('answer' in result) || typeof result.answer !== 'string' || !result.answer.trim()
        || !('toolsUsed' in result) || !Array.isArray(result.toolsUsed) || !result.toolsUsed.every(tool => typeof tool === 'string')) {
        throw new Error('Invalid assistant response.');
    }
    return result as AgentAnswer;
}
