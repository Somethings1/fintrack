import React, { useEffect, useState } from "react";
import { Typography, Button, Modal } from "antd";
import {
    ArrowUpOutlined,
    ArrowDownOutlined,
    EditOutlined,
    InfoOutlined,
    LineChartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import RoundedBox from "@/components/RoundedBox";
import AccountForm from "@/components/forms/AccountForm";
import { getStoredTransactions } from "@/services/transactionService";
import { Account } from "@/models/Account";
import Balance from "@/components/Balance";
import AccountInfoModal from "@/components/modals/AccountInfoModal";

const { Title, Text } = Typography;

interface AccountBoxProps {
    account: Account;
}

const AccountBox: React.FC<AccountBoxProps> = ({ account }) => {
    const [percentChange, setPercentChange] = useState<number | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    useEffect(() => {
        const calculateChange = async () => {
            const transactions = await getStoredTransactions();
            const now = dayjs();

            const txThisMonth = transactions.filter(tx =>
                dayjs(tx.dateTime).isSame(now, "month") &&
                (tx.sourceAccount === account._id || tx.destinationAccount === account._id)
            );

            const adjustment = txThisMonth.reduce((sum, tx) => {
                if (tx.sourceAccount === account._id) return sum + tx.amount;
                if (tx.destinationAccount === account._id) return sum - tx.amount;
                return sum;
            }, 0);

            const previousBalance = (account.balance || 0) + adjustment;

            if (previousBalance === 0) {
                setPercentChange(null);
            } else {
                const change = ((account.balance || 0) - previousBalance) / previousBalance * 100;
                setPercentChange(change);
            }
        };

        calculateChange();
    }, [account]);

    const renderChange = () => {
        if (percentChange === null) return <Text type="secondary">No data</Text>;

        const isPositive = percentChange >= 0;
        const color = isPositive ? "green" : "red";
        const Arrow = isPositive ? ArrowUpOutlined : ArrowDownOutlined;

        return (
            <Text style={{ color }}>
                <Arrow /> {Math.abs(percentChange).toFixed(1)}%
            </Text>
        );
    };

    return (
        <>
            <RoundedBox
                style={{ position: "relative" }}
            >
                <Button
                    shape="circle"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditModalOpen(true)
                    }}
                    style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        zIndex: 10,
                    }}
                />
                <Button
                    shape="circle"
                    icon={<LineChartOutlined style={{fontSize: "16px"}} />}
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsInfoModalOpen(true)
                    }}
                    style={{
                        position: "absolute",
                        top: 5,
                        right: 55,
                        zIndex: 10,
                    }}
                />

                <div style={{ fontSize: 24 }}>{account.icon}</div>
                <Title level={5} style={{ marginBottom: 10 }}>{account.name}</Title>
                <Balance amount={account.balance} type="" size="l" align="left" />
                <div style={{ marginTop: 10 }}>{renderChange()}</div>
            </RoundedBox>

            <Modal
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                footer={null}
                title="Edit Account"
                destroyOnClose
                getContainer={false}
            >
                <AccountForm
                    account={account}
                    onSubmit={() => setIsEditModalOpen(false)}
                    onCancel={() => setIsEditModalOpen(false)}
                />
            </Modal>

            <AccountInfoModal
                account={account}
                onClose={() => setIsInfoModalOpen(false)}
                isOpen={isInfoModalOpen}
            />
        </>
    );
};

export default AccountBox;

