import React, { useState, useMemo } from 'react';
import { Modal, Radio, Button, Row, Col, Typography, Divider } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Account } from '@/models/Account';
import { useTransactions } from '@/hooks/useTransactions';
import ChartSection from './ChartSection';
import Balance from '../../Balance';
import Subtitle from '../../Subtitle';

const { Text } = Typography;

interface AccountInfoModalProps {
    isOpen: boolean;
    account: Account;
    onClose: () => void;
}

const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ isOpen, account, onClose }) => {
    const [mode, setMode] = useState<'month' | 'year'>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const { transactions } = useTransactions();

    const periodLabel = useMemo(() => {
        return mode === 'month'
            ? currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
            : currentDate.getFullYear().toString();
    }, [currentDate, mode]);

    const [startDate, endDate] = useMemo(() => {
        const start = new Date(currentDate);
        const end = new Date(currentDate);
        if (mode === 'month') {
            start.setDate(1);
            end.setMonth(start.getMonth() + 1, 0); // last day of current month
        } else {
            start.setMonth(0, 1); // Jan 1
            end.setMonth(11, 31); // Dec 31
        }
        end.setHours(23, 59, 59, 999); // be extra safe
        return [start, end];
    }, [currentDate, mode]);

    const handlePrev = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            mode === 'month'
                ? newDate.setMonth(prev.getMonth() - 1)
                : newDate.setFullYear(prev.getFullYear() - 1);
            return newDate;
        });
    };

    const handleNext = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            mode === 'month'
                ? newDate.setMonth(prev.getMonth() + 1)
                : newDate.setFullYear(prev.getFullYear() + 1);
            return newDate;
        });
    };

    const txsInPeriod = useMemo(() => {
        return transactions.filter(tx =>
            new Date(tx.dateTime) >= startDate &&
            new Date(tx.dateTime) <= endDate &&
            (tx.sourceAccount === account._id || tx.destinationAccount === account._id)
        );
    }, [transactions, startDate, endDate, account._id]);

    const txsAfterPeriod = useMemo(() => {
        return transactions.filter(tx =>
            new Date(tx.dateTime) > endDate &&
            (tx.sourceAccount === account._id || tx.destinationAccount === account._id)
        );
    }, [transactions, endDate, account._id]);

    const income = txsInPeriod
        .filter(tx => tx.destinationAccount === account._id)
        .reduce((sum, tx) => sum + tx.amount, 0);

    const expense = txsInPeriod
        .filter(tx => tx.sourceAccount === account._id)
        .reduce((sum, tx) => sum + tx.amount, 0);

    const futureIncome = txsAfterPeriod
        .filter(tx => tx.destinationAccount === account._id)
        .reduce((sum, tx) => sum + tx.amount, 0);

    const futureExpense = txsAfterPeriod
        .filter(tx => tx.sourceAccount === account._id)
        .reduce((sum, tx) => sum + tx.amount, 0);

    const balanceAtEndOfPeriod = account.balance - futureIncome + futureExpense;

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            width={1200}
            footer={null}
            style={{ top: 30 }}
            title={
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0 30px 0 0',
                }}>
                    <span>{`Your [${account.name}] analysis on ${periodLabel}`}</span>
                    <Radio.Group value={mode} onChange={e => setMode(e.target.value)} size="small">
                        <Radio.Button value="month">Month</Radio.Button>
                        <Radio.Button value="year">Year</Radio.Button>
                    </Radio.Group>
                </div>
            }
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                }}
            >
                <Button shape="circle" icon={<LeftOutlined />} onClick={handlePrev} />
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 40,
                    textAlign: 'center',
                }}>
                    <div>
                        <Subtitle>Income</Subtitle>
                        <div>
                            <Balance amount={income} type="income" align="left" />
                        </div>
                    </div>
                    <div>
                        <Subtitle>Expense</Subtitle>
                        <div>
                            <Balance amount={expense} type="expense" align="left"/>
                        </div>
                    </div>
                    <div>
                        <Subtitle>Balance</Subtitle>
                        <div>
                            <Balance amount={balanceAtEndOfPeriod} type="" align="left"/>
                        </div>
                    </div>
                </div>
                <Button shape="circle" icon={<RightOutlined />} onClick={handleNext} />
            </div>

            <ChartSection
                account={account}
                transactions={txsInPeriod}
                mode={mode}
                lastBalance={balanceAtEndOfPeriod}
            />
        </Modal>
    );
};

export default AccountInfoModal;

