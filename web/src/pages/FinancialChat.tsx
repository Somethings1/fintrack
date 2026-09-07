import { askAgent, type AgentMessage } from '@/services/agentService';
import type { AgentProposal } from '@/services/agentProposal';
import { Alert, Button, Checkbox, Input, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import AgentProposalCard, { type ProposalOutcome } from './AgentProposalCard';

const toolLabels: Record<string, string> = {
    get_financial_snapshot: 'Account balances', get_spending_summary: 'Spending and budgets',
    get_savings_goals: 'Savings goals', get_upcoming_subscriptions: 'Upcoming subscriptions',
    find_records: 'Record lookup', propose_transaction: 'Transaction proposal', propose_account: 'Account proposal',
    propose_saving: 'Savings proposal', propose_category: 'Category proposal', propose_budget: 'Budget proposal',
    propose_subscription: 'Subscription proposal',
};
interface Turn { question: string; answer: string; toolsUsed: string[]; proposal?: AgentProposal; outcome?: ProposalOutcome }
interface Props { onSavingChange?: (value: boolean) => void }
function turnContext(turn: Turn): string {
    if (!turn.proposal) return turn.answer;
    return `${turn.answer}\nChange preview: ${JSON.stringify({ entity: turn.proposal.entity, operation: turn.proposal.operation, recordId: turn.proposal.recordId, values: turn.proposal.values })}\nApplication status: ${turn.outcome?.status ?? 'pending'}; ${turn.outcome?.detail ?? 'Not saved.'}`;
}

/** Chat/proposals are ephemeral. Writes occur only through the confirmation card. */
export default function FinancialChat({ onSavingChange }: Props) {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState('');
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<AbortController | null>(null);
    const writing = useRef(false);
    useEffect(() => () => pending.current?.abort(), []);
    const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
    const clear = () => { if (writing.current) return; cancel(); setTurns([]); setInput(''); setError(''); };
    const sendingChange = (value: boolean) => { writing.current = value; setSaving(value); onSavingChange?.(value); };
    const send = async () => {
        const question = input.trim();
        if (!consent || !question || pending.current || writing.current) return;
        const request = new AbortController(); pending.current = request;
        setBusy(true); setError('');
        // Follow-ups may change intent. Older unconfirmed cards must no longer be actionable,
        // even if the new model request fails.
        const prior = turns.map(turn => turn.proposal && turn.outcome?.status === 'pending'
            ? { ...turn, outcome: { status: 'superseded' as const } } : turn);
        setTurns(prior);
        const history: AgentMessage[] = prior.flatMap(turn => [
            { role: 'user' as const, content: turn.question },
            { role: 'assistant' as const, content: turnContext(turn) },
        ]);
        try {
            const response = await askAgent(question, consent, history, request.signal);
            if (!request.signal.aborted) {
                setTurns(previous => [...previous, { question, ...response, outcome: response.proposal ? { status: 'pending' as const } : undefined }].slice(-8));
                setInput('');
            }
        } catch (cause) {
            if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'The assistant could not answer.');
        } finally {
            if (pending.current === request) { pending.current = null; setBusy(false); }
        }
    };
    return <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="Ask questions or manage transactions, accounts, savings, budgets, and subscriptions. Every change needs your confirmation below. FinTrack cannot move money at your bank." />
        <Checkbox checked={consent} disabled={saving} onChange={event => { setConsent(event.target.checked); if (!event.target.checked) cancel(); }}>
            Send my question, recent chat, and relevant transaction details, account/category names, balances, budgets, savings goals, and subscription details to Google Gemini. Do not include passwords or bank credentials.
        </Checkbox>
        <Typography.Text type="secondary">Chat is not saved by FinTrack. Closing this panel clears it. Follow-ups use up to four recent turns. Figures use your ledger currency and UTC dates, and answers may be wrong.</Typography.Text>
        <Space wrap>
            {['Where did my money go this month?', 'Record an expense', 'Change my monthly food budget', 'Create a savings goal'].map(question =>
                <Button key={question} size="small" disabled={busy || saving} onClick={() => setInput(question)}>{question}</Button>)}
        </Space>
        <div role="log" aria-label="Financial conversation" aria-live="polite" style={{ maxHeight: 420, overflowY: 'auto', width: '100%' }}>
            {turns.map((turn, index) => <section key={turn.proposal?.id ?? index} style={{ marginBottom: 16 }}>
                <Typography.Paragraph strong>You: {turn.question}</Typography.Paragraph>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{turn.answer}</Typography.Paragraph>
                {turn.toolsUsed.length > 0 && <Typography.Text type="secondary">Looked up: {turn.toolsUsed.map(tool => toolLabels[tool] ?? tool).join(', ')}</Typography.Text>}
                {turn.proposal && <AgentProposalCard proposal={turn.proposal} outcome={turn.outcome ?? { status: 'pending' }} disabled={!consent || busy || saving}
                    onSaving={sendingChange} onOutcome={outcome => setTurns(previous => previous.map(item => item.proposal?.id === turn.proposal?.id ? { ...item, outcome } : item))} />}
            </section>)}
        </div>
        {error && <Alert type="error" role="alert" message={error} />}
        <Input.TextArea aria-label="Ask about your finances" value={input} onChange={event => setInput(event.target.value)} rows={3} maxLength={1000} showCount disabled={busy || saving} placeholder="I spent 20 on lunch from Wallet, in Food. Or: change my Food budget to 300." />
        <Space>
            <Button type="primary" aria-label="Ask assistant" aria-busy={busy} onClick={() => void send()} disabled={!consent || !input.trim() || busy || saving} loading={busy}>Ask assistant</Button>
            {busy && <Button onClick={cancel}>Stop</Button>}
            <Button onClick={clear} disabled={saving || (!turns.length && !input && !busy && !error)}>Clear chat</Button>
        </Space>
    </Space>;
}
