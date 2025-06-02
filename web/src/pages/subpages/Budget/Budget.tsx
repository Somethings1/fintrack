import React, { useEffect, useState } from "react";
import { addCategory } from "@/services/categoryService";
import CategoryBox from "./CategoryBox";
import { Category } from "@/types/Category";
import {
    Button,
    Modal,
    Space,
    Typography,
    Row,
    Col,
    Radio,
    Select
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import CategoryForm from "@/components/forms/CategoryForm";
import Title from "@/components/Title";
import Subtitle from "@/components/Subtitle";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";

const { Option } = Select;

const Budget = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<"expense" | "income">("expense");
    const [sortOption, setSortOption] = useState("name-asc");
    const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
    const categories = useCategories();
    const { txs } = useTransactions();

    useEffect(() => {
        const calculate = async () => {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const filteredTxs = txs.filter(tx => {
                const d = new Date(tx.dateTime);
                return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            });

            const spentMap: Record<string, number> = {};
            filteredTxs.forEach(tx => {
                spentMap[tx.category] = (spentMap[tx.category] || 0) + tx.amount;
            });

            setSpentByCategory(spentMap);
        };

        if (txs)
            calculate();
    }, [categories, txs]);

    const handleNewCategory = async (category: Category) => {
        await addCategory(category);
        setIsModalOpen(false);
    };

    const sortCategories = (list: Category[]) => {
        return [...list].sort((a, b) => {
            switch (sortOption) {
                case "name-asc":
                    return a.name.localeCompare(b.name);
                case "name-desc":
                    return b.name.localeCompare(a.name);
                case "budget-asc":
                    return (a.budget ?? 0) - (b.budget ?? 0);
                case "budget-desc":
                    return (b.budget ?? 0) - (a.budget ?? 0);
                case "spent-asc":
                    return (spentByCategory[a._id] ?? 0) - (spentByCategory[b._id] ?? 0);
                case "spent-desc":
                    return (spentByCategory[b._id] ?? 0) - (spentByCategory[a._id] ?? 0);
                default:
                    return 0;
            }
        });
    };

    const filteredCategories = sortCategories(
        categories.filter(cat => cat.type === typeFilter && !cat.isDeleted)
    );

    return (
        <>

            <Row gutter={[16, 16]} style={{ margin: 0, marginBottom: 20 }}>
                <Title>Budget</Title>
                <Subtitle>Where you keep track and manage your budgets</Subtitle>
            </Row>

            <Space
                style={{
                    width: "100%",
                    justifyContent: "space-between",
                    marginBottom: 16
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Radio.Group
                        optionType="button"
                        buttonStyle="solid"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        size="middle"
                    >
                        <Radio.Button value="expense">Expense</Radio.Button>
                        <Radio.Button value="income">Income</Radio.Button>
                    </Radio.Group>

                    <Select
                        value={sortOption}
                        onChange={(value) => setSortOption(value)}
                        style={{ width: "180px" }}
                    >
                        <Option value="name-asc">Sort by: Name ↑</Option>
                        <Option value="name-desc">Sort by: Name ↓</Option>
                        <Option value="budget-asc">Sort by: Budget ↑</Option>
                        <Option value="budget-desc">Sort by: Budget ↓</Option>
                        <Option value="spent-asc">Sort by: Spent ↑</Option>
                        <Option value="spent-desc">Sort by: Spent ↓</Option>
                    </Select>


                </div>
                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    Add new category
                </Button>

            </Space>

            <Row gutter={[16, 16]}>
                {filteredCategories.length === 0 ? (
                    <Col span={24}>
                        <Typography.Text type="secondary">
                            No {typeFilter} categories yet.
                        </Typography.Text>
                    </Col>
                ) : (
                    filteredCategories.map((cat) => (
                        <Col key={cat._id} xs={24} sm={22} md={12} lg={12} xl={8}>
                            <CategoryBox category={cat} spent={spentByCategory[cat._id] ?? 0} />
                        </Col>
                    ))
                )}
            </Row>

            <Modal
                title="New Category"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <CategoryForm
                    onSubmit={handleNewCategory}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </>
    );
};

export default Budget;

