import React, { useState } from "react";
import { Category } from "@/models/Category";
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
import Balance from "@/components/Balance";
import dayjs from "dayjs";

const { Text, Title } = Typography;

interface Props {
    category: Category;
    spent: number;
    month: dayjs.Dayjs;
}

const CategoryBox: React.FC<Props> = ({ category, spent, month }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (!category) return null;

    const total = spent;
    const isIncome = category.type === "income";
    const budget = category.budget ?? 0;
    const percent = budget > 0 ? Math.min((total / budget) * 100, 999) : 0;
    const remaining = budget - total;

    const now = dayjs();
    const isPastMonth = month.isBefore(now, "month");
    const daysInMonth = month.daysInMonth();
    const daysPassed = isPastMonth ? daysInMonth : (month.isSame(now, "month") ? now.date() : 1);
    const expected = (budget / daysInMonth) * daysPassed;

    const isAttention = isPastMonth
        ? isIncome
            ? total < budget
            : total > budget
        : isIncome
            ? total < expected
            : total > expected;

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
                    }}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </>
    );
};

export default CategoryBox;

