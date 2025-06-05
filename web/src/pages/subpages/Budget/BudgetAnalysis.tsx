import React, { useMemo } from "react";
import { Label, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Tag, Typography, Space, Divider } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { colors } from "@/theme/color";
import RoundedBox from "../../../components/RoundedBox";
import Balance from "../../../components/Balance";

const PIE_COLORS = [
    colors.primary[900],
    colors.primary[200],
    colors.neutral[900],
    colors.neutral[200],
    colors.primary[800],
    colors.primary[300],
    colors.neutral[800],
    colors.neutral[300],
    colors.primary[700],
    colors.primary[400],
    colors.neutral[700],
    colors.neutral[400],
    colors.primary[600],
    colors.primary[500],
    colors.neutral[600],
    colors.neutral[500],
];

const BudgetAnalysis = ({ month, type, categories, spentMap, transactions }) => {
    const previousMonth = dayjs(month).subtract(1, "month");

    const previousMonthSpent = useMemo(() => {
        const prevSpentMap = {};
        transactions.forEach((tx) => {
            const d = new Date(tx.dateTime);
            const cat = categories.find((c) => c._id === tx.category);
            if (
                cat &&
                cat.type === type &&
                d.getMonth() === previousMonth.month() &&
                d.getFullYear() === previousMonth.year()
            ) {
                prevSpentMap[tx.category] = (prevSpentMap[tx.category] || 0) + tx.amount;
            }
        });
        return prevSpentMap;
    }, [transactions, type, previousMonth, categories]);

    const rawData = categories.map((cat) => {
        const spent = spentMap[cat._id] ?? 0;
        const prev = previousMonthSpent[cat._id] ?? 0;
        const diff = prev === 0 ? 100 : ((spent - prev) / prev) * 100;

        return {
            id: cat._id,
            name: cat.name,
            icon: cat.icon,
            spent,
            diff,
        };
    });

    const totalSpent = rawData.reduce((acc, item) => acc + item.spent, 0);

    const data = rawData
        .map((item, i) => ({
            ...item,
            color: PIE_COLORS[i % PIE_COLORS.length],
            percent: totalSpent === 0 ? 0 : (item.spent / totalSpent) * 100,
        }))
        .sort((a, b) => b.spent - a.spent);

    const renderTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;

        const { name, spent, percent, icon } = payload[0].payload;

        return (
            <div
                style={{
                    background: "white",
                    padding: "8px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                }}
            >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                    <div>
                        <strong>{name}</strong>
                    </div>
                    <div>
                        {percent.toFixed(1)}%
                    </div>
                </div>
            </div>
        );
    };


    return (
        <RoundedBox>
            <Typography.Title level={5} style={{ marginBottom: 16 }}>
                {type === "income" ? "Gained Overview" : "Spent Overview"}
            </Typography.Title>

            <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <PieChart width={320} height={240}>
                    <Tooltip content={renderTooltip} />
                    <Pie
                        dataKey="spent"
                        data={data}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={80}
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={5}
                        paddingAngle={5}
                    >
                        {data.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                        ))}
                    </Pie>
                </PieChart>
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none', // So clicks go through
                        textAlign: 'center',
                        color: '#333',
                        zIndex: 0,
                    }}
                >
                    <div style={{ marginBottom: "5px" }}>{type == 'income' ? "Gained" : "Spent"}</div>
                    <Balance amount={totalSpent} type="" align="left" size="l" />
                    <div style={{ borderBottom: "0.5px solid grey", width: "100%", margin: "5px 0" }}></div>
                    <Balance amount={categories.reduce((sum, cat) => sum + cat.budget, 0)} type="" align="left" size="l" />
                    <div style={{ marginTop: "5px" }}>{type == 'income' ? "Expected" : "Allowed"}</div>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.map((cat) => {
                    const isPositive = cat.diff >= 0;
                    const isIncome = type === "income";

                    const color = isPositive
                        ? isIncome
                            ? colors.success[800]
                            : colors.danger[500]
                        : isIncome
                            ? colors.danger[500]
                            : colors.success[800];

                    const bg = isPositive
                        ? isIncome
                            ? colors.success[200]
                            : colors.danger[200]
                        : isIncome
                            ? colors.danger[200]
                            : colors.success[200];

                    return (
                        <Space
                            key={cat.id}
                            style={{
                                justifyContent: "space-between",
                                alignItems: "center",
                                display: "flex",
                                padding: "4px 8px",
                                borderRadius: 4,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: "50%",
                                        backgroundColor: cat.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <span>{cat.icon}</span>
                                <span>{cat.name}</span>
                            </div>
                            <Tag
                                icon={isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                style={{
                                    color,
                                    backgroundColor: bg,
                                    fontWeight: 500,
                                    padding: "3px 10px",
                                    borderRadius: "100px",
                                    border: "none",
                                }}
                            >
                                {Math.abs(cat.diff).toFixed(0)}%
                            </Tag>
                        </Space>
                    );
                })}
            </div>
        </RoundedBox>
    );
};

export default BudgetAnalysis;
