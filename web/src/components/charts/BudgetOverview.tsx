import React, { useEffect, useState } from "react";
import { Tabs, Typography, Spin, Empty } from "antd";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import RoundedBox from "@/components/RoundedBox";
import { getStoredCategories } from "@/services/categoryService";
import { getStoredTransactions } from "@/services/transactionService";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";

const { Title } = Typography;
const COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#8E44AD", "#1ABC9C", "#E67E22", "#2ECC71"];

const formatMoney = (n: number) => "$" + n.toLocaleString();

const BudgetOverview: React.FC = () => {
    const [data, setData] = useState<{ income: any[], expense: any[] }>({ income: [], expense: [] });
    const [loading, setLoading] = useState(true);
    const refreshToken = useRefresh();
    const lastSync = usePollingContext();

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
                <ResponsiveContainer width="100%" height={300}>
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
                            cornerRadius={5}
                            startAngle={90}
                            endAngle={-270}
                            isAnimationActive={false}
                            label={false}
                            labelLine={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <g>
                            <text
                                x="50%"
                                y="46%"
                                style={{
                                    fontSize: "12px",
                                    fill: "#888",
                                }}
                            >
                                Total
                            </text>
                            <text
                                x="50%"
                                y="53%"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{
                                    fontSize: "20px",
                                    fontWeight: "bold",
                                    fill: "#333",
                                }}
                            >
                                ${chartData.reduce((acc, cur) => acc + cur.value, 0).toLocaleString()}
                            </text>
                        </g>
                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                        <Legend
                            layout="vertical"
                            align="left"
                            verticalAlign="middle"
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </>
    );

    return (
        <RoundedBox>
            <Title level={5} style={{ margin: 0 }}>Money flow</Title>
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

