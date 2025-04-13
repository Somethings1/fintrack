import React, { useEffect, useState } from "react";
import { getStoredSavings, addSaving } from "@/services/savingService";
import { Saving } from "@/models/Saving";
import SavingBox from "./SavingBox";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { Button, Modal, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import SavingForm from "@/components/forms/SavingForm";

const { Title } = Typography;

const Savings = () => {
    const [savings, setSavings] = useState<Saving[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { triggerRefresh } = useRefresh();
    const refreshToken = useRefresh();
    const lastSync = usePollingContext();

    useEffect(() => {
        const fetchSavings = async () => {
            const data = await getStoredSavings();
            setSavings(data);
        };

        fetchSavings();
    }, [refreshToken, lastSync]);

    const handleNewSaving = async (saving: Saving) => {
        await addSaving(saving);
        setIsModalOpen(false);
        triggerRefresh(); // Trigger global refresh
    };

    return (
        <>
            <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>Savings</Title>
                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Saving
                </Button>
            </Space>

            {savings.map((saving) => (
                <SavingBox key={saving._id} saving={saving} />
            ))}

            <Modal
                title="New Saving"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <SavingForm onSubmit={handleNewSaving} onCancel={() => setIsModalOpen(false)} />
            </Modal>
        </>
    );
};

export default Savings;

