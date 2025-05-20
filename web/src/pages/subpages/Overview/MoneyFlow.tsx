import React, { useEffect, useState } from "react";
import RoundedBox from "@/components/RoundedBox";
import { getStoredTransactions } from "@/services/transactionService";
import { usePollingContext } from "@/context/PollingProvider";
import { useRefresh } from "@/context/RefreshProvider";
import { Typography, Select, Space, Row, Col } from "antd";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import dayjs from "dayjs";
import { colors } from "../../../theme/color";

const { Title } = Typography;
const { Option } = Select;

type ChartType = "bar" | "line" | "area";

interface MoneyFlowProps {
    account?: string;
}

const formatYAxis = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
};

const getDaysInMonth = () => {
    const start = dayjs().startOf("month");
    const today = dayjs();
    const days: string[] = [];

    for (let date = start; date.isBefore(today) || date.isSame(today, "day"); date = date.add(1, "day")) {
        days.push(date.format("YYYY-MM-DD"));
    }

    return days;
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const fullDate = dayjs().startOf("month").add(Number(label) - 1, "day").format("MMM D, YYYY");
        return (
            <div style={{ background: "#fff", padding: 10, border: "1px solid #ccc" }}>
                <strong>{fullDate}</strong>
                <br />
                <span style={{ color: colors.primary[600] }}>Income:</span>{" "}
                ${payload[0]?.payload.income.toLocaleString()}
                <br />
                <span style={{ color: colors.primary[400] }}>Expense:</span>{" "}
                ${payload[0]?.payload.expense.toLocaleString()}
            </div>
        );
    }

    return null;
};

const MoneyFlow: React.FC<MoneyFlowProps> = ({ account }) => {
    const [chartType, setChartType] = useState<ChartType>("bar");
    const [data, setData] = useState<any[]>([]);
    const { refreshCount } = useRefresh();
    const { transactions: lastSync } = usePollingContext();

    const processData = async () => {
        const transactions = await getStoredTransactions();
        const days = getDaysInMonth();

        const dailyTotals = days.map((day, index) => {
            const incomeExpense = transactions
                .filter((t) => {
                    const dateMatch = dayjs(t.dateTime).format("YYYY-MM-DD") === day;
                    if (!dateMatch) return false;

                    if (account) {
                        if (t.type === "transfer") {
                            return t.sourceAccount === account || t.destinationAccount === account;
                        }
                        return t.sourceAccount === account || t.destinationAccount === account;
                    }

                    return true;
                })
                .reduce(
                    (acc, t) => {
                        if (t.type === "income") {
                            acc.income += t.amount || 0;
                        } else if (t.type === "expense") {
                            acc.expense += t.amount || 0;
                        } else if (t.type === "transfer" && account) {
                            if (t.sourceAccount === account) {
                                acc.expense += t.amount || 0;
                            } else if (t.destinationAccount === account) {
                                acc.income += t.amount || 0;
                            }
                        }
                        return acc;
                    },
                    { income: 0, expense: 0 }
                );

            return {
                day: dayjs(day).format("D"),
                ...incomeExpense,
            };
        });

        setData(dailyTotals);
    };

    useEffect(() => {
        processData();
    }, [refreshCount, lastSync, account]);

    const renderChart = () => {
        switch (chartType) {
            case "bar":
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" interval={1} />
                        <YAxis tickFormatter={formatYAxis} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar radius={[8, 8, 0, 0]} dataKey="income" fill={colors.primary[600]} />
                        <Bar radius={[8, 8, 0, 0]} dataKey="expense" fill={colors.primary[400]} />
                    </BarChart>
                );
            case "line":
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis tickFormatter={formatYAxis} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="income"
                            strokeWidth={2}
                            stroke={colors.primary[600]}
                        />
                        <Line
                            type="monotone"
                            dataKey="expense"
                            strokeWidth={2}
                            stroke={colors.primary[400]}
                        />
                    </LineChart>
                );
            case "area":
                return (
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis tickFormatter={formatYAxis} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="income"
                            stroke={colors.primary[600]}
                            strokeWidth={2}
                            fill={colors.primary[600]}
                        />
                        <Area
                            type="monotone"
                            dataKey="expense"
                            stroke={colors.primary[300]}
                            strokeWidth={2}
                            fill={colors.primary[300]}
                        />
                    </AreaChart>
                );
            default:
                return null;
        }
    };

    return (
        <RoundedBox style={{ height: 330 }}>
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Col>
                    <Title level={5} style={{ margin: 0 }}>Money flow</Title>
                </Col>
                <Col>
                    <Space>
                        <span style={{ marginRight: "10px" }}>
                            <span style={{ color: colors.primary[600] }}>●</span> Income
                            <span style={{ margin: "0 8px" }} />
                            <span style={{ color: colors.primary[300] }}>●</span> Expense
                        </span>
                        <Select
                            value={chartType}
                            onChange={(value) => setChartType(value)}
                            dropdownStyle={{ borderRadius: 8 }}
                            className="chart-select"
                        >
                            <Option value="bar">Bar chart</Option>
                            <Option value="line">Line chart</Option>
                            <Option value="area">Area chart</Option>
                        </Select>

                    </Space>
                </Col>
            </Row>
            <ResponsiveContainer width="100%" height="90%">
                {renderChart()}
            </ResponsiveContainer>
        </RoundedBox>
    );
};

export default MoneyFlow;

