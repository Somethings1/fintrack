import React, { useEffect, useState } from "react";
import { Category } from "@/types/Category";
import { getStoredCategories } from "@/services/categoryService";
import { getStoredTransactions } from "@/services/transactionService";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import {
    Progress,
    Typography,
    Space,
    Row,
    Col,
    Tag,
    Modal,
    Button,
} from "antd";
import {
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    EditOutlined,
} from "@ant-design/icons";
import RoundedBox from "@/components/RoundedBox";
import CategoryForm from "@/components/forms/CategoryForm";

const { Text, Title } = Typography;

const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const daysUntilToday = new Date().getDate();
const formatMoney = (n: number) => "$" + n.toLocaleString();

const CategoryBox: React.FC<{ categoryId: string }> = ({ categoryId }) => {
    const [category, setCategory] = useState<Category | null>(null);
    const [total, setTotal] = useState<number>(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { refreshCount, triggerRefresh } = useRefresh();
    const { transactions: lastSync } = usePollingContext();

    useEffect(() => {
        const fetchData = async () => {
            const cats = await getStoredCategories();
            const target = cats.find((c) => c._id === categoryId);
            setCategory(target || null);

            const txs = await getStoredTransactions();
            const filtered = txs.filter((tx) => {
                const d = new Date(tx.dateTime);
                return (
                    tx.category === categoryId &&
                    d.getFullYear() === new Date().getFullYear() &&
                    d.getMonth() === new Date().getMonth()
                );
            });

            const sum = filtered.reduce((acc, tx) => acc + tx.amount, 0);
            setTotal(sum);
        };

        fetchData();
    }, [categoryId, refreshCount, lastSync]);

    if (!category) return null;

    const isIncome = category.type === "income";
    const budget = category.budget ?? 0;
    const percent = budget > 0 ? Math.min((total / budget) * 100, 999) : 0;
    const remaining = budget - total;
    const expected = (budget / daysInMonth) * daysUntilToday;
    const isAttention = isIncome ? total < expected : total > expected;

    return (
        <>
            <RoundedBox style={{ position: "relative" }}>
                {/* Pen Button */}
                <Button
                    shape="circle"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 10,
                        backgroundColor: "#f0f0f0",
                        border: "none",
                    }}
                />

                <Space direction="vertical" style={{ width: "100%" }}>
                    <Space>
                        <span>{category.icon}</span>
                        <Title level={5} style={{ margin: 0 }}>
                            {category.name}
                        </Title>
                    </Space>
                    <Row gutter={16}>
                        <Col span={8}>
                            <div style={{ textAlign: "center" }}>
                                <Progress
                                    type="circle"
                                    percent={parseFloat(percent.toFixed(0))}
                                    width={150}
                                    format={() => (
                                        <div>
                                            <Text strong>{percent.toFixed(0)}%</Text>
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: "11px", marginLeft: "5px" }}
                                            >
                                                {isIncome ? "gained" : "spent"}
                                            </Text>
                                            <br />
                                            <Text style={{ fontSize: "14px", fontWeight: "bold" }}>
                                                {formatMoney(total)}
                                            </Text>
                                        </div>
                                    )}
                                />
                            </div>
                        </Col>
                        <Col span={16}>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    height: 150,
                                }}
                            >
                                <Text type="secondary" style={{ fontSize: "11px" }}>
                                    Left
                                </Text>
                                <br />
                                <Text style={{ fontSize: "18px", fontWeight: "bold" }}>
                                    {formatMoney(remaining)} / {formatMoney(budget)}
                                </Text>
                                <br />
                                <Tag
                                    icon={
                                        isAttention ? (
                                            <ExclamationCircleOutlined />
                                        ) : (
                                            <CheckCircleOutlined />
                                        )
                                    }
                                    color={isAttention ? "orange" : "green"}
                                    style={{
                                        borderRadius: 999,
                                        paddingInline: 12,
                                        paddingBlock: 2,
                                        marginTop: 6,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        fontSize: "13px",
                                    }}
                                >
                                    {isAttention ? "Need attention" : "On track"}
                                </Tag>
                            </div>
                        </Col>
                    </Row>
                </Space>
            </RoundedBox>

            {/* Modal for Edit */}
            <Modal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                title="Edit Category"
                destroyOnClose
            >
                <CategoryForm
                    category={category}
                    onSubmit={() => {
                        setIsModalOpen(false);
                        triggerRefresh();
                    }}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </>
    );
};

export default CategoryBox;

