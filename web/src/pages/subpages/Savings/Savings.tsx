import React, { useEffect, useState } from "react";
import { getStoredSavings, addSaving } from "@/services/savingService";
import { Saving } from "@/models/Saving";
import SavingBox from "./SavingBox";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { Button, Modal, Select, Space, Typography, Row, Col, Badge } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import SavingForm from "@/components/forms/SavingForm";
import Title from "../../../components/Title";
import Subtitle from "../../../components/Subtitle";
import dayjs from "dayjs";

const { Option } = Select;

const STATUS_KEYS = {
    not_started: "Not Started",
    in_progress: "In Progress",
    finished: "Finished",
    canceled: "Canceled",
};

const sortOptions = [
    { value: "balance_asc", label: "Balance ↑" },
    { value: "balance_desc", label: "Balance ↓" },
    { value: "goal_asc", label: "Goal ↑" },
    { value: "goal_desc", label: "Goal ↓" },
    { value: "createdDate_asc", label: "Created Date ↑" },
    { value: "createdDate_desc", label: "Created Date ↓" },
    { value: "goalDate_asc", label: "Goal Date ↑" },
    { value: "goalDate_desc", label: "Goal Date ↓" },
];

const Savings = () => {
    const [savings, setSavings] = useState<Saving[]>([]);
    const [filteredSavings, setFilteredSavings] = useState<Saving[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortField, setSortField] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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

    useEffect(() => {
        const today = dayjs();

        // Calculate counts for status categories
        const counts: Record<string, number> = {
            not_started: 0,
            in_progress: 0,
            finished: 0,
            canceled: 0,
        };

        savings.forEach((saving) => {
            const createdDate = dayjs(saving.createdDate);
            const goalDate = dayjs(saving.goalDate);
            const { balance, goal } = saving;

            if (createdDate.isAfter(today)) {
                counts.not_started++;
            } else if (createdDate.isBefore(today) && goalDate.isAfter(today) && balance < goal) {
                counts.in_progress++;
            } else if (balance >= goal) {
                counts.finished++;
            } else if (goalDate.isBefore(today) && balance < goal) {
                counts.canceled++;
            }
        });

        setStatusCounts(counts);
    }, [savings]);

    useEffect(() => {
        let updated = [...savings];
        const today = dayjs();

        // Filtering
        if (statusFilter !== "all") {
            updated = updated.filter((saving) => {
                const createdDate = dayjs(saving.createdDate);
                const goalDate = dayjs(saving.goalDate);
                const { balance, goal } = saving;

                switch (statusFilter) {
                    case "not_started":
                        return createdDate.isAfter(today);
                    case "in_progress":
                        return createdDate.isBefore(today) &&
                            goalDate.isAfter(today) &&
                            balance < goal;
                    case "finished":
                        return balance >= goal;
                    case "canceled":
                        return goalDate.isBefore(today) && balance < goal;
                    default:
                        return true;
                }
            });
        }

        // Sorting
        if (sortField) {
            const [field, direction] = sortField.split("_");
            updated.sort((a, b) => {
                let aVal = a[field];
                let bVal = b[field];

                // Date sorting
                if (field.includes("Date")) {
                    aVal = new Date(aVal).getTime();
                    bVal = new Date(bVal).getTime();
                }

                return direction === "asc" ? aVal - bVal : bVal - aVal;
            });
        }

        setFilteredSavings(updated);
    }, [savings, sortField, statusFilter]);

    const handleNewSaving = async (saving: Saving) => {
        await addSaving(saving);
        setIsModalOpen(false);
        triggerRefresh();
    };

    return (
        <>
            <Row gutter={[16, 16]} style={{ margin: 0, marginBottom: 20 }}>
            <Title>Saving Goals</Title>
            <Subtitle>Track your goals effortlessly</Subtitle>
            </Row>
            <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
                <Space>
                    <Select
                        placeholder="Sort by"
                        onChange={(value) => setSortField(value)}
                        allowClear
                        style={{ minWidth: 180 }}
                    >
                        {sortOptions.map(({ value, label }) => (
                            <Option key={value} value={value}>
                                {label}
                            </Option>
                        ))}
                    </Select>

                    <Space>
                        <Select
                            placeholder="Filter by Status"
                            onChange={(value) => setStatusFilter(value)}
                            defaultValue="all"
                            style={{ minWidth: 180 }}
                        >
                            <Option value="all">All</Option>
                            {Object.entries(STATUS_KEYS).map(([key, label]) => (
                                <Option key={key} value={key}>
                                    {label}
                                </Option>
                            ))}
                        </Select>
                        <Subtitle>Saving count: {statusCounts[statusFilter] || (statusFilter === "all" ? savings.length : 0)}</Subtitle>
                    </Space>

                </Space>
                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Saving
                </Button>
            </Space>

            <Row gutter={[16, 16]}>
                {filteredSavings.map((saving) => (
                    <Col key={saving._id} xs={24} sm={12} md={8} lg={8}>
                        <SavingBox saving={saving} />
                    </Col>
                ))}
            </Row>

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

