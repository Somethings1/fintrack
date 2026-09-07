import { askAgent, type AgentMessage } from '@/services/agentService';
import { Alert, Button, Checkbox, Input, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

const toolLabels: Record<string, string> = {
    get_financial_snapshot: 'Account balances',
    get_spending_summary: 'Spending and budgets',
    get_savings_goals: 'Savings goals',
    get_upcoming_subscriptions: 'Upcoming subscriptions',
};
interface Turn { question: string; answer: string; toolsUsed: string[] }

/** Ephemeral conversation. Closing the modal unmounts this component. */
export default function FinancialChat() {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState('');
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);

    const cancel = () => {
        pending.current?.abort(); pending.current = null; setBusy(false);
    };
    const clear = () => { cancel(); setTurns([]); setInput(''); setError(''); };
    const send = async () => {
        const question = input.trim();
        if (!consent || !question || pending.current) return;
        const request = new AbortController(); pending.current = request;
        setBusy(true); setError('');
        const history: AgentMessage[] = turns.flatMap(turn => [
            { role: 'user' as const, content: turn.question },
            { role: 'assistant' as const, content: turn.answer },
        ]);
        try {
            const response = await askAgent(question, consent, history, request.signal);
            if (!request.signal.aborted) {
                setTurns(previous => [...previous, { question, ...response }].slice(-8));
                setInput('');
            }
        } catch (cause) {
            if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'The assistant could not answer.');
        } finally {
            if (pending.current === request) { pending.current = null; setBusy(false); }
        }
    };
    return <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="Read-only: ask about your recorded finances. This assistant cannot change records or move money." />
        <Checkbox checked={consent} onChange={event => { setConsent(event.target.checked); if (!event.target.checked) cancel(); }}>
            Send my question, recent chat, and relevant account balances, spending summaries, budgets, savings goals, and subscription details to Google Gemini. Do not include passwords or bank credentials.
        </Checkbox>
        <Typography.Text type="secondary">Chat is not saved by FinTrack. Closing this panel clears it. Follow-ups use up to four recent turns. Figures use your ledger currency and UTC dates, and answers may be wrong.</Typography.Text>
        <Space wrap>
            {['Where did my money go this month?', 'How are my savings goals doing?', 'Which subscriptions are due soon?'].map(question =>
                <Button key={question} size="small" disabled={busy} onClick={() => setInput(question)}>{question}</Button>)}
        </Space>
        <div role="log" aria-label="Financial conversation" aria-live="polite" style={{ maxHeight: 320, overflowY: 'auto', width: '100%' }}>
            {turns.map((turn, index) => <section key={index} style={{ marginBottom: 16 }}>
                <Typography.Paragraph strong>You: {turn.question}</Typography.Paragraph>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{turn.answer}</Typography.Paragraph>
                {turn.toolsUsed.length > 0 && <Typography.Text type="secondary">Looked up: {turn.toolsUsed.map(tool => toolLabels[tool] ?? tool).join(', ')}</Typography.Text>}
            </section>)}
        </div>
        {error && <Alert type="error" role="alert" message={error} />}
        <Input.TextArea aria-label="Ask about your finances" value={input} onChange={event => setInput(event.target.value)} rows={3} maxLength={1000} showCount disabled={busy} placeholder="Compare this month's spending with last month." />
        <Space>
            <Button type="primary" aria-label="Ask assistant" aria-busy={busy} onClick={() => void send()} disabled={!consent || !input.trim() || busy} loading={busy}>Ask assistant</Button>
            {busy && <Button onClick={cancel}>Stop</Button>}
            <Button onClick={clear} disabled={!turns.length && !input && !busy && !error}>Clear chat</Button>
        </Space>
    </Space>;
}
