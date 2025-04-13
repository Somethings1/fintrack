import React, { useState } from "react";
import { Saving } from "@/types/Saving";
import { Card, Typography, Space, Progress, Button, Modal } from "antd";
import { EditOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";
import SavingForm from "@/components/forms/SavingForm";
import RoundedBox from "@/components/RoundedBox"; // Adjust path as needed

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
                type="text"
                style={{ position: "absolute", top: 8, right: 8 }}
                onClick={() => setIsModalOpen(true)}
            />

            {/* Title Line: Icon + Name */}
            <Space>
                <span style={{ fontSize: 20 }}>{saving.icon}</span>
                <Title level={5} style={{ margin: 0 }}>{saving.name}</Title>
            </Space>

            {/* Due Date + Expand Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Due date: {formatDate(saving.goalDate)}
                </Text>
                <Button
                    icon={expanded ? <UpOutlined /> : <DownOutlined />}
                    type="text"
                    size="small"
                    onClick={() => setExpanded(!expanded)}
                />
            </div>

            {/* Created Date (Collapsible) */}
            {expanded && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Created: {formatDate(saving.createdDate)}
                </Text>
            )}

            {/* Balance / Goal */}
            <div style={{ marginTop: 8 }}>
                <Title level={4} style={{ margin: 0 }}>
                    {saving.balance.toLocaleString()}
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        {" "} / {saving.goal.toLocaleString()}
                    </Text>
                </Title>
            </div>

            {/* Progress Bar */}
            <Progress
                percent={parseFloat(percentage.toFixed(2))}
                showInfo
                strokeColor="#1890ff"
                style={{ marginTop: 8 }}
            />

            {/* Remaining Line */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Left to complete the goal
                </Text>
                <Text strong style={{ fontSize: 16 }}>
                    {remaining.toLocaleString()}
                </Text>
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

