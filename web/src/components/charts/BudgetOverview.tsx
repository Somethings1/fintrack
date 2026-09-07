import { addMoney } from "@/utils/money";
import { LinkOutlined } from "@ant-design/icons";
import { Button,Empty,Spin,Tabs,Typography } from "antd";
import React,{ useEffect,useState } from "react";
import type { TooltipProps } from "recharts";
import { Cell,Pie,PieChart,ResponsiveContainer,Tooltip } from "recharts";
type BudgetSlice = { name: string; icon: string; value: number; color: string };

import Balance from "@/components/Balance";
import RoundedBox from "@/components/RoundedBox";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { colors } from "@/theme/color";

const { Title } = Typography;

const PIE_COLORS = [
    colors.primary[900],
    colors.primary[200],
    colors.primary[800],
    colors.primary[300],
    colors.primary[700],
    colors.primary[400],
    colors.primary[600],
    colors.primary[500],
    colors.neutral[800],
    colors.neutral[300],
    colors.neutral[700],
    colors.neutral[400],
    colors.neutral[600],
    colors.neutral[500],
];

interface BudgetOverviewProps {
    linkToBudget: () => void;
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ linkToBudget }) => {
    const [data, setData] = useState<{ income: BudgetSlice[]; expense: BudgetSlice[] }>({ income: [], expense: [] });
    const [loading, setLoading] = useState(true);
    const categories = useCategories();
    const { transactions } = useTransactions();

    useEffect(() => {
        if (!categories.length || !transactions.length) {
            setData({ income: [], expense: [] });
            setLoading(false);
            return;
        }

        const fetchData = () => {
            setLoading(true);
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const filteredTxs = transactions.filter((tx) => {
                const date = new Date(tx.dateTime);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            });

            const groupByCategory = (type: "income" | "expense") => {
                const relevantCategories = categories.filter((cat) => cat.type === type && !cat.isDeleted);

                return relevantCategories
                    .map((cat, index) => {
                        const catTxs = filteredTxs.filter((tx) => tx.category === cat._id);
                        const total = catTxs.reduce((acc, tx) => addMoney(acc, tx.amount), 0);
                        return {
                            name: cat.name,
                            icon: cat.icon,
                            value: total,
                            color: PIE_COLORS[index % PIE_COLORS.length],
                        };
                    })
                    .filter((entry) => entry.value > 0)
                    .sort((a, b) => b.value - a.value);
            };

            const newData = {
                income: groupByCategory("income"),
                expense: groupByCategory("expense"),
            };

            setData(newData);
            setLoading(false);
        };

        fetchData();
    }, [transactions, categories]);

    const renderCustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
        if (!active || !payload || !payload.length) return null;
        const { name, value, icon } = payload[0].payload;

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
                    <Balance amount={value} type="" size="s" />
                </div>
            </div>
        );
    };

    const renderChart = (chartData: BudgetSlice[], type: "income" | "expense") => {
        const totalValue = chartData.reduce((acc, item) => addMoney(acc, item.value), 0);

        if (chartData.length === 0) {
            return <Empty description="No data for this month" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        }

        return (
            <div style={{ position: "relative", width: "100%", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Tooltip content={renderCustomTooltip} />
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={80}
                            paddingAngle={5}
                            cornerRadius={5}
                            startAngle={90}
                            endAngle={-270}
                            isAnimationActive={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                        textAlign: "center",
                        color: "#333",
                    }}
                >
                    <div style={{ marginBottom: "5px" }}>Total {type === "income" ? "Gained" : "Spent"}</div>
                    <Balance amount={totalValue} type="" align="center" size="l" />
                </div>
            </div>
        );
    };

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
            <Title level={5} style={{ margin: 0, paddingBottom: 8 }}>Budget Overview</Title>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
                    <Spin tip="Loading Overview..." />
                </div>
            ) : (
                <Tabs defaultActiveKey="expense" centered>
                    <Tabs.TabPane tab="Expense" key="expense">
                        {renderChart(data.expense, "expense")}
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Income" key="income">
                        {renderChart(data.income, "income")}
                    </Tabs.TabPane>
                </Tabs>
            )}
        </RoundedBox>
    );
};

export default BudgetOverview;
