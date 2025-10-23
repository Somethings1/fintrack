import React, { useMemo } from "react";
import {
    AreaChart,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Area,
    ResponsiveContainer,
} from "recharts";
import { Transaction } from "@/models/Transaction";
import { Account } from "@/models/Account";
import dayjs from "dayjs";
import Subtitle from "../../Subtitle";

interface ChartSectionProps {
    account: Account;
    transactions: Transaction[];
    mode: "month" | "year";
    lastBalance: number;
}

const formatYAxis = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
};

const ChartSection: React.FC<ChartSectionProps> = ({ account, transactions, mode, lastBalance }) => {
    const labels = useMemo(() => {
        const now = dayjs();
        const result: string[] = [];

        if (mode === "month") {
            const firstTx = transactions[0];
            const dateToUse = firstTx ? dayjs(firstTx.dateTime) : now;
            const isCurrentMonth = dateToUse.isSame(now, "month");
            const daysInMonth = dateToUse.daysInMonth();
            const lastDay = isCurrentMonth ? now.date() : daysInMonth;

            for (let d = 1; d <= lastDay; d++) {
                result.push(String(d).padStart(2, "0"));
            }
        } else {
            const firstTx = transactions[0];
            const dateToUse = firstTx ? dayjs(firstTx.dateTime) : now;
            const isCurrentYear = dateToUse.isSame(now, "year");
            const lastMonth = isCurrentYear ? now.month() + 1 : 12;

            for (let m = 1; m <= lastMonth; m++) {
                result.push(String(m).padStart(2, "0"));
            }
        }

        return result;
    }, [mode, transactions]);

    const chartData = useMemo(() => {
        const buckets: Record<string, { income: number; expense: number }> = {};

        for (const label of labels) {
            buckets[label] = { income: 0, expense: 0 };
        }

        transactions.forEach((tx) => {
            const date = dayjs(tx.dateTime);
            const key = mode === "month" ? date.format("DD") : date.format("MM");

            if (!buckets[key]) return;

            if (tx.destinationAccount === account._id) {
                buckets[key].income += tx.amount;
            }
            if (tx.sourceAccount === account._id) {
                buckets[key].expense += tx.amount;
            }
        });

        return labels.map((label) => ({
            label,
            ...buckets[label],
        }));
    }, [transactions, labels, mode, account._id]);

    const balanceData = useMemo(() => {
        let current = lastBalance;
        const reversed = [...chartData].sort((a, b) => parseInt(b.label) - parseInt(a.label));

        const backtracked = reversed.map((entry) => {
            const computedBalance = current;
            current -= entry.income;
            current += entry.expense;
            return { ...entry, computedBalance };
        });

        return backtracked.reverse();
    }, [chartData, lastBalance]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;

        const data = payload[0].payload;

        return (
            <div style={{ background: "#fff", padding: 10, border: "1px solid #ccc" }}>
                <strong>{mode === "month" ? `Day ${label}` : `Month ${label}`}</strong>
                {payload.some((p: any) => p.dataKey === "income") && (
                    <div>Income: ${data.income.toLocaleString()}</div>
                )}
                {payload.some((p: any) => p.dataKey === "expense") && (
                    <div>Expense: ${data.expense.toLocaleString()}</div>
                )}
                {payload.some((p: any) => p.dataKey === "computedBalance") && (
                    <div>Balance: ${data.computedBalance.toLocaleString()}</div>
                )}
            </div>
        );
    };

    const renderAreaChart = (dataKey: string, data: any[]) => (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
                <XAxis dataKey="label" />
                <YAxis tickFormatter={formatYAxis} />
                <Tooltip content={<CustomTooltip />} />
                <CartesianGrid strokeDasharray="3 3" />
                <Area type="monotone" dataKey={dataKey} stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
        </ResponsiveContainer>
    );

    return (
        <div>
            <Subtitle>Money In</Subtitle>
            {renderAreaChart("income", chartData)}
            <Subtitle>Money Out</Subtitle>
            {renderAreaChart("expense", chartData)}
            <Subtitle>Balance</Subtitle>
            {renderAreaChart("computedBalance", balanceData)}
        </div>
    );
};

export default ChartSection;

