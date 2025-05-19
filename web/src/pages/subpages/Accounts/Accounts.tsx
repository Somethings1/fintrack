import React, { useEffect, useState } from "react";
import { getStoredAccounts, addAccount } from "@/services/accountService";
import { Account } from "@/models/Account";
import AccountBox from "./AccountBox";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { Button, Modal, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import AccountForm from "@/components/forms/AccountForm";
import Title from "../../../components/Title";


const Accounts = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { triggerRefresh } = useRefresh();
    const refreshToken = useRefresh();
    const lastSync = usePollingContext();

    useEffect(() => {
        const fetchAccounts = async () => {
            const data = await getStoredAccounts();
            setAccounts(data);
        };

        fetchAccounts();
    }, [refreshToken, lastSync]);

    const handleNewAccount = async (account: Account) => {
        await addAccount(account);
        setIsModalOpen(false);
        triggerRefresh(); // Trigger global refresh
    };

    return (
        <>
            <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
            <Title>Accounts</Title>
                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Account
                </Button>
            </Space>

            {accounts.map((acc) => (
                <AccountBox key={acc._id} account={acc}/>
            ))}

            <Modal
                title="New Account"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <AccountForm onSubmit={handleNewAccount} onCancel={() => setIsModalOpen(false)}/>
            </Modal>
        </>
    );
};

export default Accounts;

