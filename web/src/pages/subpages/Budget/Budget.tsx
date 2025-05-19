import React, { useEffect, useState } from "react";
import { getStoredCategories, addCategory } from "@/services/categoryService";
import CategoryBox from "./CategoryBox";
import { Category } from "@/types/Category";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { Button, Modal, Space, Typography, Row, Col } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import CategoryForm from "@/components/forms/CategoryForm";
import Title from "../../../components/Title";


const Budget = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { triggerRefresh } = useRefresh();
    const refreshToken = useRefresh();
    const lastSync = usePollingContext();


    useEffect(() => {
        const fetchCategories = async () => {
            const data = await getStoredCategories();
            setCategories(data);
        };

        fetchCategories();
    }, [refreshToken, lastSync]);

    const handleNewCategory = async (category: Category) => {
        await addCategory(category);
        setIsModalOpen(false);
        triggerRefresh(); // Trigger global refresh
    };

    return (
        <>
            <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
            <Title>Budget</Title>
                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Category
                </Button>
            </Space>

            <Row gutter={[16, 16]}>
                {categories.map((cat) => (
                    <Col key={cat._id} xs={24} sm={22} md={12} lg={12} xl={8}>
                        <CategoryBox categoryId={cat._id} />
                    </Col>
                ))}
            </Row>
            <Modal
                title="New Category"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <CategoryForm onSubmit={handleNewCategory} onCancel={() => setIsModalOpen(false)} />
            </Modal>
        </>
    );
};

export default Budget;

