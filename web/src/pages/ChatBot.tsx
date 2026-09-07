import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useSavings } from '@/hooks/useSavings';
import type { Transaction } from '@/models/Transaction';
import { addTransaction } from '@/services/transactionService';
import { requestTransactionDraft } from '@/utils/chatbotUtils';
import { RobotOutlined } from '@ant-design/icons';
import { Alert,Button,Checkbox,Descriptions,Input,Modal,Space,Tabs,Typography } from 'antd';
import { useEffect,useRef,useState } from 'react';
import FinancialChat from './FinancialChat';
import './ChatBot.css';

/** Propose -> inspect -> explicitly confirm. The model never receives a mutation tool. */
export default function ChatBot() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [consent, setConsent] = useState(false);
    const [draft, setDraft] = useState<Partial<Transaction> | null>(null);
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [chatWriting, setChatWriting] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const saving = useRef(false);
    const chatSaving = useRef(false);
    const accounts = useAccounts(); const savings = useSavings(); const categories = useCategories();
    const names = new Map([...accounts, ...savings, ...categories].map(item => [item._id, item.name]));
    useEffect(() => () => controller.current?.abort(), []);
    const propose = async () => {
        if (!consent || !input.trim() || busy) return;
        controller.current?.abort(); controller.current = new AbortController();
        const request = controller.current;
        setBusy(true); setDraft(null); setStatus('');
        try {
            const result = await requestTransactionDraft(input.trim(), consent, request.signal);
            if (!request.signal.aborted) {
                setDraft(result.transaction ? { ...result.transaction, dateTime: new Date(), isDeleted: false } : null);
                setStatus(result.clarification);
            }
        } catch (error) { if (!request.signal.aborted) setStatus(error instanceof Error ? error.message : 'Draft failed'); }
        finally { if (!request.signal.aborted) setBusy(false); }
    };
    const accept = async () => {
        if (!draft || saving.current) return;
        saving.current = true; setBusy(true);
        try { await addTransaction(draft); setDraft(null); setInput(''); setStatus('Transaction saved.'); }
        catch (error) { setStatus(error instanceof Error ? error.message : 'Saving failed. Check your transaction list before retrying.'); }
        finally { saving.current = false; setBusy(false); }
    };
    const close = () => { if (saving.current || chatSaving.current) return; controller.current?.abort(); setBusy(false); setOpen(false); };
    const draftPanel = <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="Drafts only. Nothing is saved until you confirm. This is not financial advice." />
        <Checkbox checked={consent} onChange={event => setConsent(event.target.checked)}>
            Send this description and my account/category names to Google Gemini to prepare a draft. Do not include passwords or bank credentials.
        </Checkbox>
        <Input.TextArea aria-label="Describe a transaction" value={input} maxLength={1500} showCount rows={3} onChange={event => { setInput(event.target.value); setDraft(null); }} placeholder="I spent 20 on lunch from Wallet, in Food." disabled={busy} />
        <Button type="primary" loading={busy && !saving.current} disabled={!consent || !input.trim() || busy} onClick={() => void propose()}>Prepare draft</Button>
        {status && <Typography.Paragraph role="status">{status}</Typography.Paragraph>}
        {draft && <>
            <Descriptions bordered column={1} size="small" title="Review every field">
                <Descriptions.Item label="Type">{draft.type}</Descriptions.Item>
                <Descriptions.Item label="Amount">{draft.amount} (your configured currency)</Descriptions.Item>
                <Descriptions.Item label="From">{names.get(draft.sourceAccount ?? '') ?? 'External'}</Descriptions.Item>
                <Descriptions.Item label="To">{names.get(draft.destinationAccount ?? '') ?? 'External'}</Descriptions.Item>
                <Descriptions.Item label="Category">{names.get(draft.category ?? '') ?? 'Transfer'}</Descriptions.Item>
                <Descriptions.Item label="Note">{draft.note}</Descriptions.Item>
            </Descriptions>
            <Space><Button onClick={() => setDraft(null)} disabled={busy}>Discard</Button><Button type="primary" onClick={() => void accept()} disabled={busy || !consent} loading={saving.current}>Confirm and save transaction</Button></Space>
        </>}
    </Space>;
    return <>
        <Button className="chatbot-toggle" icon={<RobotOutlined />} onClick={() => setOpen(true)} aria-label="Open transaction assistant">Assistant</Button>
        {/* Unmount on close: chat history, consent and requests must not survive a hidden modal. */}
        {open && <Modal title="FinTrack assistant" open onCancel={close} footer={null} width={680}>
            <Tabs defaultActiveKey="chat" items={[
                { key: 'chat', label: 'Chat', disabled: busy, children: <FinancialChat onSavingChange={value => { chatSaving.current = value; setChatWriting(value); }} /> },
                { key: 'draft', label: 'Draft transaction', disabled: chatWriting, children: draftPanel },
            ]} />
        </Modal>}
    </>;
}
