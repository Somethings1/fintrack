import React, { useEffect, useState } from "react";
import { Typography, Spin, Progress, Empty, Space } from "antd";
import RoundedBox from "@/components/RoundedBox";
import { getStoredSavings } from "@/services/savingService";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { Saving } from "@/types/Saving";
import ProgressBar from "../../../components/charts/ProgressBar";
import Balance from "../../../components/Balance";

const { Title, Text } = Typography;

const SavingOverview: React.FC = () => {
    const [savings, setSavings] = useState<Saving[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshToken = useRefresh();
    const lastSync = usePollingContext();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const allSavings = await getStoredSavings();
            const top3 = allSavings
                .filter(s => !s.isDeleted && s.goal > 0)
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 3);
            setSavings(top3);
            setLoading(false);
        };

        fetchData();
    }, [refreshToken, lastSync]);

    return (
        <RoundedBox style={{ padding: 16, height: 290 }}>
            <Title level={5} style={{ marginBottom: 16, marginTop: 0 }}>Savings Goals</Title>
            {loading ? (
                <Spin tip="Crunching numbers... slowly.">
                    <div style={{ height: 200 }} />
                </Spin>
            ) : savings.length === 0 ? (
                <Empty description="No savings found" />
            ) : (
                <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    {savings.map((saving) => {
                        const percentage = Math.min(100, (saving.balance / saving.goal) * 100);
                        return (
                            <div key={saving._id}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <Text strong style={{ marginBottom: 7 }}>{saving.name}</Text>
                                    <Text style={{ width: '80%', textAlign: "right" }}>
                                        <Balance amount={saving.balance} type="" align="left" /> / <Balance align="left" amount={saving.goal} type="" />
                                    </Text>
                                </div>
                                <ProgressBar percent={parseFloat(percentage.toFixed(2))} />
                            </div>
                        );
                    })}
                </Space>
            )}
        </RoundedBox>
    );
};

export default SavingOverview;

