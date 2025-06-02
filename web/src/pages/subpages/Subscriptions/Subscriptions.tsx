import React, { useEffect, useState } from "react";
import {
    getStoredSubscriptions,
    addSubscription
} from "@/services/subscriptionService";
import { Subscription } from "@/types/Subscription";
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
import SubscriptionForm from "@/components/forms/SubscriptionForm";
import SubscriptionBox from "./SubscriptionBox";
import Title from "@/components/Title";
import Subtitle from "@/components/Subtitle";

const { Option } = Select;

const Subscriptions = () => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOption, setSortOption] = useState("startDate-desc");

    const { triggerRefresh } = useRefresh();
    const refreshToken = useRefresh();

    useEffect(() => {
        const fetchData = async () => {
            const subs = await getStoredSubscriptions();
            setSubscriptions(subs);
        };

        fetchData();
    }, [refreshToken]);

    const handleNewSubscription = async (subscription: Subscription) => {
        await addSubscription(subscription);
        setIsModalOpen(false);
        triggerRefresh();
    };

    const sortSubscriptions = (list: Subscription[]) => {
        return [...list].sort((a, b) => {
            switch (sortOption) {
                case "startDate-asc":
                    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                case "startDate-desc":
                    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                case "amount-asc":
                    return a.amount - b.amount;
                case "amount-desc":
                    return b.amount - a.amount;
                default:
                    return 0;
            }
        });
    };

    const filteredSubscriptions = sortSubscriptions(
        subscriptions.filter(sub => !sub.isDeleted)
    );

    return (
        <>
            <Row gutter={[16, 16]} style={{ margin: 0, marginBottom: 20 }}>
                <Title>Subscriptions</Title>
                <Subtitle>Track your recurring expenses</Subtitle>
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
                    style={{ width: "220px" }}
                >
                    <Option value="startDate-desc">Sort by: Start Date ↓</Option>
                    <Option value="startDate-asc">Sort by: Start Date ↑</Option>
                    <Option value="amount-desc">Sort by: Amount ↓</Option>
                    <Option value="amount-asc">Sort by: Amount ↑</Option>
                </Select>

                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Subscription
                </Button>
            </Space>

            <Row gutter={[16, 16]}>
                {filteredSubscriptions.length === 0 ? (
                    <Col span={24}>
                        <Typography.Text type="secondary">
                            No subscriptions yet. Shocking.
                        </Typography.Text>
                    </Col>
                ) : (
                    filteredSubscriptions.map((sub) => (
                        <Col key={sub._id} xs={24} sm={12} md={12} lg={8} xl={6}>
                            <SubscriptionBox subscription={sub} />
                        </Col>
                    ))
                )}
            </Row>

            <Modal
                title="New Subscription"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <SubscriptionForm
                    onSubmit={handleNewSubscription}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </>
    );
};

export default Subscriptions;

