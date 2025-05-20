import React, { useState } from "react";
import { Saving } from "@/types/Saving";
import { Card, Typography, Space, Progress, Button, Modal } from "antd";
import { EditOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";
import SavingForm from "@/components/forms/SavingForm";
import RoundedBox from "@/components/RoundedBox"; // Adjust path as needed
import Balance from "../../../components/Balance";
import ProgressBar from "../../../components/charts/ProgressBar";

const { Text, Title } = Typography;

interface SavingBoxProps {
    saving: Saving;
}

const formatDate = (dateStr: Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

const SavingBox: React.FC<SavingBoxProps> = ({ saving }) => {
    const [expanded, setExpanded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const percentage = Math.min(100, (saving.balance / saving.goal) * 100);
    const remaining = Math.max(0, saving.goal - saving.balance);

    return (
        <RoundedBox style={{ position: "relative", padding: 16 }}>
            {/* Floating Edit Button */}
            <Button
                icon={<EditOutlined />}
                shape="circle"
                size="small"
                style={{ position: "absolute", top: 5, right: 5 }}
                onClick={() => setIsModalOpen(true)}
            />

            {/* Title Line: Icon + Name */}
            <Space>
                <span style={{ fontSize: 20 }}>{saving.icon}</span>
                <Title level={5} style={{ margin: 0 }}>{saving.name}</Title>
            </Space>

            {/* Due Date + Expand Toggle */}
            <div style={{marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Due date: {formatDate(saving.goalDate)}
                </Text>
                <span
                    style={{
                        display: "inline-block",
                        fontSize: "10px",
                        lineHeight: "20px",
                        marginLeft: "5px",
                    }}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? <UpOutlined /> : <DownOutlined />}
                </span>
            </div>

            {/* Created Date (Collapsible) */}
            {expanded && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Created: {formatDate(saving.createdDate)}
                </Text>
            )}

            {/* Balance / Goal */}
            <div style={{ marginTop: 18, marginBottom: 28 }}>
            <Balance amount={saving.balance} type="" align="left" size="xl" /> / <Balance amount={saving.goal} type="" align="left" size="xs"/>
            </div>

            <ProgressBar percent={parseFloat(percentage.toFixed(2))}/>

            {/* Remaining Line */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Left to complete the goal
                </Text>
                <Balance amount={remaining} type="" size="s" align="left"/>
            </div>

            {/* Modal for Editing */}
            <Modal
                title="Edit Saving"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <SavingForm
                    saving={saving}
                    onSubmit={() => setIsModalOpen(false)}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </RoundedBox>
    );
};

export default SavingBox;

