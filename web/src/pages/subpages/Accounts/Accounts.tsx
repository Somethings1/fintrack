import React, { useEffect, useState } from "react";
import {
    getStoredAccounts,
    addAccount
} from "@/services/accountService";
import { Account } from "@/types/Account";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import {
    Button,
    Modal,
    Space,
    Typography,
    Row,
    Col,
    Select
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import AccountForm from "@/components/forms/AccountForm";
import AccountBox from "./AccountBox";
import Title from "@/components/Title";
import Subtitle from "@/components/Subtitle";

const { Option } = Select;

const Accounts = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOption, setSortOption] = useState("name-asc");

    const { triggerRefresh } = useRefresh();
    const refreshToken = useRefresh();
    const lastSync = usePollingContext();

    useEffect(() => {
        const fetchData = async () => {
            const accs = await getStoredAccounts();
            setAccounts(accs);
        };

        fetchData();
    }, [refreshToken, lastSync]);

    const handleNewAccount = async (account: Account) => {
        await addAccount(account);
        setIsModalOpen(false);
        triggerRefresh();
    };

    const sortAccounts = (list: Account[]) => {
        return [...list].sort((a, b) => {
            switch (sortOption) {
                case "name-asc":
                    return a.name.localeCompare(b.name);
                case "name-desc":
                    return b.name.localeCompare(a.name);
                case "balance-asc":
                    return (a.balance ?? 0) - (b.balance ?? 0);
                case "balance-desc":
                    return (b.balance ?? 0) - (a.balance ?? 0);
                default:
                    return 0;
            }
        });
    };

    const filteredAccounts = sortAccounts(
        accounts.filter(acc => !acc.isDeleted)
    );

    return (
        <>

            <Row gutter={[16, 16]} style={{ margin: 0, marginBottom: 20 }}>
            <Title>Accounts</Title>
            <Subtitle>All your money containers in one place</Subtitle>
            </Row>

            <Space
                style={{
                    width: "100%",
                    justifyContent: "space-between",
                    marginBottom: 16
                }}
            >
                <Select
                    value={sortOption}
                    onChange={(value) => setSortOption(value)}
                    style={{ width: "200px" }}
                >
                    <Option value="name-asc">Sort by: Name ↑</Option>
                    <Option value="name-desc">Sort by: Name ↓</Option>
                    <Option value="balance-asc">Sort by: Balance ↑</Option>
                    <Option value="balance-desc">Sort by: Balance ↓</Option>
                </Select>

                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Account
                </Button>
            </Space>

            <Row gutter={[16, 16]}>
                {filteredAccounts.length === 0 ? (
                    <Col span={24}>
                        <Typography.Text type="secondary">
                            No accounts yet.
                        </Typography.Text>
                    </Col>
                ) : (
                    filteredAccounts.map((acc) => (
                        <Col key={acc._id} xs={24} sm={12} md={12} lg={8} xl={6}>
                            <AccountBox account={acc} />
                        </Col>
                    ))
                )}
            </Row>

            <Modal
                title="New Account"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <AccountForm
                    onSubmit={handleNewAccount}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </>
    );
};

export default Accounts;

