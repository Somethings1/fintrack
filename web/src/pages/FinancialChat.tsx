import { askAgent, readOnlyPermissions, type AgentMessage, type AgentPermissions } from '@/services/agentService';
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
interface Turn { question: string; answer: string; toolsUsed: string[]; proposal?: AgentProposal; outcome?: ProposalOutcome; runId?: string }
interface Props { onSavingChange?: (value: boolean) => void }
function turnContext(turn: Turn, includeNotes: boolean): string {
    if (!turn.proposal) return turn.answer;
    const values = { ...turn.proposal.values };
    if (!includeNotes) delete values.note;
    return `${turn.answer}\nChange preview: ${JSON.stringify({ entity: turn.proposal.entity, operation: turn.proposal.operation, recordId: turn.proposal.recordId, values })}\nApplication status: ${turn.outcome?.status ?? 'pending'}; ${turn.outcome?.detail ?? 'Not saved.'}`;
}

/** Scope changes clear history so previously shared notes cannot leak back through context. */
export default function FinancialChat({ onSavingChange }: Props) {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState('');
    const [consent, setConsent] = useState(false);
    const [permissions, setPermissions] = useState<AgentPermissions>({ ...readOnlyPermissions });
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<AbortController | null>(null);
    const writing = useRef(false);
    useEffect(() => () => pending.current?.abort(), []);
    const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
    const clear = () => { if (writing.current) return; cancel(); setTurns([]); setInput(''); setError(''); };
    const changeScope = (next: AgentPermissions) => {
        if (writing.current) return;
        cancel(); setTurns([]); setError(''); setPermissions(next);
    };
    const sendingChange = (value: boolean) => { writing.current = value; setSaving(value); onSavingChange?.(value); };
    const send = async () => {
        const question = input.trim();
        if (!consent || !question || pending.current || writing.current) return;
        const request = new AbortController(); pending.current = request;
        setBusy(true); setError('');
        const prior = turns.map(turn => turn.proposal && turn.outcome?.status === 'pending'
            ? { ...turn, outcome: { status: 'superseded' as const } } : turn);
        setTurns(prior);
        const history: AgentMessage[] = prior.flatMap(turn => [
            { role: 'user' as const, content: turn.question },
            { role: 'assistant' as const, content: turnContext(turn, permissions.includeNotes) },
        ]);
        try {
            const response = await askAgent(question, consent, history, request.signal, permissions);
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
        <Alert type="info" showIcon message="Read-only by default. Enable change proposals to manage records; every change still needs a separate confirmation. FinTrack cannot move money at your bank." />
        <Checkbox checked={consent} disabled={saving} onChange={event => {
            setConsent(event.target.checked);
            if (!event.target.checked) { clear(); setPermissions({ ...readOnlyPermissions }); }
        }}>
            Send my question, recent chat, and relevant financial records and summaries to Google Gemini. Stored transaction notes are excluded unless enabled below. Do not include passwords or bank credentials.
        </Checkbox>
        <Space direction="vertical">
            <Checkbox checked={permissions.allowChanges} disabled={saving} onChange={event => changeScope({ ...permissions, allowChanges: event.target.checked, allowDeletes: event.target.checked && permissions.allowDeletes })}>Allow change proposals</Checkbox>
            <Checkbox checked={permissions.allowDeletes} disabled={saving || !permissions.allowChanges} onChange={event => changeScope({ ...permissions, allowDeletes: event.target.checked })}>Allow delete/archive proposals</Checkbox>
            <Checkbox checked={permissions.includeNotes} disabled={saving} onChange={event => changeScope({ ...permissions, includeNotes: event.target.checked })}>Include stored transaction notes</Checkbox>
        </Space>
        <Typography.Text type="secondary">Changing permissions starts a new chat. Messages are not stored by FinTrack; account-linked token and cost counters are retained for operations. Closing this panel clears its conversation. Follow-ups use four recent turns. Figures use your ledger currency and UTC dates. Answers may be wrong.</Typography.Text>
        <Space wrap>
            {['Where did my money go this month?', 'Record an expense', 'Change my monthly food budget', 'Create a savings goal'].map(question =>
                <Button key={question} size="small" disabled={busy || saving} onClick={() => setInput(question)}>{question}</Button>)}
        </Space>
        <div role="log" aria-label="Financial conversation" aria-live="polite" style={{ maxHeight: 420, overflowY: 'auto', width: '100%' }}>
            {turns.map((turn, index) => <section key={turn.proposal?.id ?? index} style={{ marginBottom: 16 }}>
                <Typography.Paragraph strong>You: {turn.question}</Typography.Paragraph>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{turn.answer}</Typography.Paragraph>
                {turn.toolsUsed.length > 0 && <Typography.Text type="secondary">Looked up: {turn.toolsUsed.map(tool => toolLabels[tool] ?? tool).join(', ')}</Typography.Text>}
                {turn.runId && <Typography.Paragraph type="secondary">Reference: {turn.runId}</Typography.Paragraph>}
                {turn.proposal && <AgentProposalCard proposal={turn.proposal} outcome={turn.outcome ?? { status: 'pending' }} disabled={!consent || !permissions.allowChanges || (turn.proposal.operation === 'delete' && !permissions.allowDeletes) || busy || saving}
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
