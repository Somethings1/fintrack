import React from "react";
import RoundedBox from "@/components/RoundedBox";
import { Button, Typography } from "antd";
import SimpleTransactionTable from "@/components/TransactionTable/SimpleTransactionTable";
import { LinkOutlined } from "@ant-design/icons";

const { Title } = Typography;

interface RecentTransactionsProps {
    linkToTransactions: () => void;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({
    linkToTransactions,
}) => {
    return (
        <RoundedBox style={{ height: 290, position: "relative" }}>
            <Button
                shape="circle"
                icon={<LinkOutlined />}
                size="large"
                onClick={linkToTransactions}
                style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    zIndex: 10,
                }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Title level={5} style={{ marginTop: 0, marginBottom: "10px" }}>Recent Transactions</Title>
            </div>
            <SimpleTransactionTable />
        </RoundedBox>
    );
};

export default RecentTransactions;

