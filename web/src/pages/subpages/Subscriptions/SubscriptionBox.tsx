import React, { useState } from "react";
import { Typography, Button, Modal } from "antd";
import { EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import RoundedBox from "@/components/RoundedBox";
import Balance from "@/components/Balance";
import SubscriptionForm from "@/components/forms/SubscriptionForm";
import { Subscription } from "@/models/Subscription";

const { Title, Text } = Typography;

interface SubscriptionBoxProps {
    subscription: Subscription;
}

const SubscriptionBox: React.FC<SubscriptionBoxProps> = ({ subscription }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const formatRenewal = () => {
        const date = dayjs(subscription.startDate);
        const weekday = date.format("dddd"); // e.g. Monday
        const dayOfMonth = date.format("D"); // e.g. 20

        switch (subscription.interval) {
            case "week":
                return `Renews every week on ${weekday}`;
            case "month":
                return `Renews every month on the ${dayOfMonth}${getOrdinal(dayOfMonth)}`;
            case "year":
                return `Renews every year on ${date.format("MMMM D")}`;
            default:
                return "Unknown interval";
        }
    };

    const getOrdinal = (day: string | number) => {
        const d = parseInt(day as string, 10);
        if (d > 3 && d < 21) return "th";
        switch (d % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    };

    return (
        <>
            <RoundedBox style={{ position: "relative" }}>
                <Button
                    shape="circle"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        zIndex: 10,
                    }}
                />

                <div style={{ fontSize: 24 }}>{subscription.icon}</div>
                <Title level={5} style={{ marginBottom: 6 }}>{subscription.name}</Title>
                <Text type="secondary">{formatRenewal()}</Text>

                <div style={{ marginTop: 10 }}>
                    <Balance amount={subscription.amount} type="" size="xl" align="left" />
                </div>
                <div style={{ marginTop: 6 }}>
                    <Text type="secondary">
                        {subscription.currentInterval > 1
                            ? `Renewed ${subscription.currentInterval - 1}${subscription.maxInterval > 0 ? "/" + subscription.maxInterval : ""} ${subscription.currentInterval > 2 ? "times" : "time"}`
                            : "Not renewed yet"}
                    </Text>
                </div>

            </RoundedBox>

            <Modal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                title="Edit Subscription"
                destroyOnClose
                getContainer={false}
            >
                <SubscriptionForm
                    subscription={subscription}
                    onSubmit={() => setIsModalOpen(false)}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </>
    );
};

export default SubscriptionBox;

