import React, { useEffect, useState } from "react";
import { Category } from "@/models/Category";
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
import { Transaction } from "@/models/Transaction";
import Balance from "@/components/Balance";

const { Text, Title } = Typography;

const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const daysUntilToday = new Date().getDate();

const CategoryBox: React.FC<{ category: Category, spent: number }> = ({ category, spent }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { triggerRefresh } = useRefresh();

    if (!category) return null;

    const total = spent;
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
                        top: 5,
                        right: 5,
                        zIndex: 10,
                    }}
                />

                <Space direction="vertical" style={{ width: "100%" }}>
                    <Space style={{ margin: "0px 5px 10px 5px" }}>
                        <span style={{ fontSize: "20px" }}>{category.icon}</span>
                        <Title level={5} style={{ margin: 0 }}>
                            {category.name}
                        </Title>
                    </Space>
                    <Row gutter={16}>
                        <Col span={12}>
                            <div style={{ textAlign: "center" }}>
                                <Progress
                                    type="circle"
                                    percent={parseFloat(percent.toFixed(0))}
                                    width={150}
                                    format={() => (
                                        <div style={{ marginTop: "-13px", lineHeight: "10px" }}>
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: "11px", marginLeft: "5px", marginBottom: "-10px" }}
                                            >
                                                {percent.toFixed(0)}% {isIncome ? "gained" : "spent"}
                                            </Text>
                                            <br />
                                            <Balance amount={total} type="" size="m" align="center" />
                                        </div>
                                    )}
                                />
                            </div>
                        </Col>
                        <Col span={11}>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    height: 150,
                                }}
                            >
                                <Text type="secondary" style={{ fontSize: "11px", marginBottom: "15px" }}>
                                    Left
                                </Text>
                                <br />
                                <div style={{ display: "inline-block", width: "100%", marginBottom: "15px" }}>
                                    <Balance amount={remaining} type="" size="l" align="left" /> / <Balance align="left" amount={budget} type="" size="xs" />
                                </div>
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
                getContainer={false}
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

