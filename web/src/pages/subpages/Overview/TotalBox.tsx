import React, { useEffect, useState } from "react";
import RoundedBox from "@/components/RoundedBox";
import { Typography } from "antd";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { colors } from "@/theme/color";
import Balance from "@/components/Balance";

const { Title, Text } = Typography;

type Props = {
    title: string;
    calculateCurrent: () => Promise<number>;
    calculatePrevious: () => Promise<number>;
    highlightDirection?: "increase" | "decrease"; // default: "increase"
    type: string;
};

const TotalBox: React.FC<Props> = ({
    title,
    calculateCurrent,
    calculatePrevious,
    highlightDirection = "increase",
    type,
}) => {
    const [current, setCurrent] = useState(0);
    const [previous, setPrevious] = useState(0);
    const { refreshCount } = useRefresh();
    const { transactions, accounts, savings } = usePollingContext();

    useEffect(() => {
        const fetch = async () => {
            const cur = await calculateCurrent();
            const prev = await calculatePrevious();
            setCurrent(cur);
            setPrevious(prev);
        };
        fetch();
    }, [refreshCount, transactions, accounts, savings]);

    const diff = current - previous;
    const isHighlight =
        highlightDirection === "increase" ? diff >= 0 : diff <= 0;

    const percent =
        previous === 0 ? 100 : Math.round((Math.abs(diff) / previous) * 100);

    return (
        <RoundedBox>
            <Title level={5} style={{ marginTop: 0, marginBottom: "10px" }}>{title}</Title>
            <Balance amount={current} type="" size="xl" align="left"/>
            <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
                <span
                    style={{
                        color: isHighlight ? colors.success[800] : colors.danger[500],
                        backgroundColor: isHighlight ? colors.success[200] : colors.danger[200],
                        padding: "2px 8px",
                        borderRadius: "16px",
                        fontWeight: 500,
                        marginRight: 8,
                    }}
                >
                    {diff === 0 ? "—" : diff > 0 ? "▲" : "▼"} {percent}%
                </span>
                <span style={{ color: "#999" }}>vs last month</span>
            </div>
        </RoundedBox>
    );
};

export default TotalBox;

