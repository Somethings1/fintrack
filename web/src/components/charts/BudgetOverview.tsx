import React, { useEffect, useState } from "react";
import { Tabs, Typography, Spin, Empty, Button } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { Label, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import RoundedBox from "@/components/RoundedBox";
import { getStoredCategories } from "@/services/categoryService";
import { getStoredTransactions } from "@/services/transactionService";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { colors } from "@/theme/color";

const { Title } = Typography;
const COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#8E44AD", "#1ABC9C", "#E67E22", "#2ECC71"];

const formatMoney = (n: number) => "$" + n.toLocaleString();

interface BudgetOverviewProps {
    linkToBudget: () => void;
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({
    linkToBudget,
}) => {
    const [data, setData] = useState<{ income: any[], expense: any[] }>({ income: [], expense: [] });
    const [loading, setLoading] = useState(true);
    const refreshToken = useRefresh();
    const lastSync = usePollingContext();
    const primaryColors = [...Object.values(colors.primary), ...(Object.values(colors.neutral))];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [categories, transactions] = await Promise.all([
                getStoredCategories(),
                getStoredTransactions(),
            ]);

            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const filteredTxs = transactions.filter(tx => {
                const date = new Date(tx.dateTime);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            });

            const groupByCategory = (type: "income" | "expense") => {
                return categories
                    .filter(cat => cat.type === type && !cat.isDeleted)
                    .map(cat => {
                        const catTxs = filteredTxs.filter(tx => tx.category === cat._id);
                        const total = catTxs.reduce((acc, tx) => acc + tx.amount, 0);
                        return {
                            name: `${cat.icon} ${cat.name}`,
                            value: total,
                        };
                    }).filter(entry => entry.value > 0);
            };

            const newData = {
                income: groupByCategory("income"),
                expense: groupByCategory("expense"),
            };

            // 💡 Only update if changed
            const isSame = JSON.stringify(newData) === JSON.stringify(data);
            if (!isSame) {
                setData(newData);
            }

            setLoading(false);
        };

        fetchData();
    }, [refreshToken, lastSync]);


    const renderChart = (chartData: any[]) => (
        <>
            {chartData.length === 0 ? (
                <Empty description="No data available" />
            ) : (
                <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={80}
                            paddingAngle={3}
                            cornerRadius={15}
                            startAngle={90}
                            endAngle={-270}
                            isAnimationActive={false}
                            label={false}
                            labelLine={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={
                                    primaryColors[index * 4 % primaryColors.length]
                                } />
                            ))}
                            <Label
                                position="center"
                                content={({ viewBox }) => {
                                    const { cx, cy } = viewBox;
                                    return (
                                        <g>
                                            <text
                                                x={cx}
                                                y={cy - 10}
                                                textAnchor="middle"
                                                style={{ fontSize: 12, fill: "#888" }}
                                            >
                                                Total
                                            </text>
                                            <text
                                                x={cx}
                                                y={cy + 10}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                style={{ fontSize: 20, fontWeight: "bold", fill: "#333" }}
                                            >
                                                {chartData
                                                    .reduce((acc, cur) => acc + cur.value, 0)
                                                    .toLocaleString("en-US", {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 2,
                                                    })} đ
                                            </text>
                                        </g>
                                    );
                                }}
                            />
                        </Pie>
                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                        <Legend
                            layout="vertical"
                            align="left"
                            verticalAlign="middle"
                            content={({ payload }) => (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {payload?.map((entry, index) => (
                                        <li
                                            key={`item-${index}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    backgroundColor: entry.color,
                                                    marginRight: 8,
                                                }}
                                            />
                                            <span style={{ color: '#000' }}>{entry.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        />

                    </PieChart>
                </ResponsiveContainer>
            )}
        </>
    );

    return (
        <RoundedBox style={{ height: 330, position: "relative" }}>
            <Button
                shape="circle"
                icon={<LinkOutlined />}
                size="large"
                onClick={linkToBudget}
                style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    zIndex: 10,
                }}
            />
            <Title level={5} style={{ margin: 0 }}>Budget</Title>
            {loading ? (
                <Spin tip="Loading... Just like your finances.">
                    <div style={{ height: 300 }} />
                </Spin>
            ) : (
                <Tabs defaultActiveKey="expense" centered>
                    <Tabs.TabPane tab="Expense" key="expense">
                        {renderChart(data.expense)}
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Income" key="income">
                        {renderChart(data.income)}
                    </Tabs.TabPane>
                </Tabs>
            )}
        </RoundedBox>
    );
};

export default BudgetOverview;

