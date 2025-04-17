import React, { useEffect, useState } from "react";
import RoundedBox from "@/components/RoundedBox";
import { Typography } from "antd";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";

const { Title, Text } = Typography;

type Props = {
  title: string;
  calculateCurrent: () => Promise<number>;
  calculatePrevious: () => Promise<number>;
  highlightDirection?: "increase" | "decrease"; // default: "increase"
};

const TotalBox: React.FC<Props> = ({
  title,
  calculateCurrent,
  calculatePrevious,
  highlightDirection = "increase",
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
      <Text strong style={{ fontSize: "24px" }}>
        ${current.toLocaleString()}
      </Text>
      <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
        <span
          style={{
            color: isHighlight ? "#3f8600" : "#cf1322",
            backgroundColor: isHighlight ? "#f6ffed" : "#fff1f0",
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

