import React from "react";
import RoundedBox from "@/components/RoundedBox";
import { Typography } from "antd";
import TransactionTable from "@/components/TransactionTable";

const { Title } = Typography;

const RecentTransactions: React.FC = () => {
  return (
    <RoundedBox style={{ height: 290 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: "10px" }}>Recent Transactions</Title>
      </div>
      <TransactionTable simpleForm />
    </RoundedBox>
  );
};

export default RecentTransactions;

