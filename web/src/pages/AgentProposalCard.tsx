import { confirmAgentProposal, type AgentProposal } from '@/services/agentProposal';
import { Alert, Button, Descriptions, Space, Typography } from 'antd';
import { useRef } from 'react';

export type ProposalStatus = 'pending' | 'saving' | 'saved' | 'discarded' | 'superseded' | 'failed';
export interface ProposalOutcome { status: ProposalStatus; detail?: string }
interface Props {
    proposal: AgentProposal;
    outcome: ProposalOutcome;
    disabled: boolean;
    onOutcome: (outcome: ProposalOutcome) => void;
    onSaving: (value: boolean) => void;
}
const labels: Record<string, string> = {
    name: 'Name', icon: 'Icon', amount: 'Amount', balance: 'Balance', goal: 'Savings target',
    goalDate: 'Target date', createdDate: 'Created date', budget: 'Monthly budget', type: 'Type',
    sourceAccount: 'From account', destinationAccount: 'To account', category: 'Category', note: 'Note',
    dateTime: 'Date / time (UTC)', startDate: 'Starts (UTC)', interval: 'Repeat', maxInterval: 'Number of occurrences (0 = unlimited)', remindBefore: 'Reminder days before',
};
export default function AgentProposalCard({ proposal, outcome, disabled, onOutcome, onSaving }: Props) {
    const submitted = useRef(false);
    const displayed = proposal.operation === 'delete' ? proposal.before ?? {} : proposal.values;
    const show = (key: string, value: string | number | undefined) => {
        if (value === undefined || value === '') return 'None';
        if (String(value).startsWith('0001-01-01')) return 'No date';
        if (['amount', 'balance', 'goal', 'budget'].includes(key)) return `${value} ${proposal.currency}`;
        return proposal.references[String(value)] ? `${proposal.references[String(value)]} (${value})` : String(value);
    };
    const confirm = async () => {
        if (disabled || submitted.current || outcome.status !== 'pending') return;
        submitted.current = true; onSaving(true); onOutcome({ status: 'saving' });
        try {
            const id = await confirmAgentProposal(proposal);
            onOutcome({ status: 'saved', detail: `Saved in FinTrack. Record ID: ${id}` });
        } catch (error) {
            onOutcome({ status: 'failed', detail: error instanceof Error ? error.message : 'Unable to confirm this change. Check your records.' });
        } finally { onSaving(false); }
    };
    return <section aria-label="Proposed record change" style={{ border: '1px solid', padding: 12, marginTop: 12 }}>
        <Typography.Title level={5}>{proposal.operation === 'delete' ? 'Delete / archive' : proposal.operation === 'create' ? 'Create' : 'Update'} {proposal.entity}</Typography.Title>
        {proposal.recordId && <Typography.Text type="secondary">Record: {proposal.recordId}</Typography.Text>}
        <Descriptions bordered column={1} size="small">
            {Object.entries(displayed).filter(([key]) => key !== 'currency').map(([key, value]) => <Descriptions.Item key={key} label={key === 'balance' && proposal.operation === 'create' ? 'Opening balance' : labels[key] ?? key}>
                {proposal.operation === 'update' && proposal.before?.[key] !== undefined && String(proposal.before[key]) !== String(value)
                    ? `${show(key, proposal.before[key])} -> ${show(key, value)}` : show(key, value)}
            </Descriptions.Item>)}
        </Descriptions>
        {proposal.warnings.map((warning, i) => <Typography.Paragraph key={i}>{warning}</Typography.Paragraph>)}
        {outcome.status === 'pending' && <Space>
            <Button danger={proposal.operation === 'delete'} type="primary" aria-label="Confirm change" disabled={disabled} onClick={() => void confirm()}>Confirm change</Button>
            <Button disabled={disabled} onClick={() => onOutcome({ status: 'discarded' })}>Discard change</Button>
        </Space>}
        {outcome.status !== 'pending' && <Alert role="status" type={outcome.status === 'failed' ? 'warning' : 'info'} message={outcome.detail ?? {
            saving: 'Saving change...', saved: 'Saved in FinTrack.', discarded: 'Discarded. No change was submitted.',
            superseded: 'Replaced by a newer message. This proposal was not submitted.', failed: 'Save failed. Check your records.',
        }[outcome.status]} />}
    </section>;
}
