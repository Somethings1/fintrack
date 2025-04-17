import React, { useEffect, useState } from "react";
import { getStoredCategories, addCategory } from "@/services/categoryService";
import CategoryBox from "./CategoryBox";
import { Category } from "@/types/Category";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { Button, Modal, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import CategoryForm from "@/components/forms/CategoryForm";

const { Title } = Typography;

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
                <Title level={4} style={{ margin: 0 }}>Categories</Title>
                <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    shape="round"
                    onClick={() => setIsModalOpen(true)}
                >
                    New Category
                </Button>
            </Space>

            {categories.map((cat) => (
                <CategoryBox key={cat._id} categoryId={cat._id} />
            ))}

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

