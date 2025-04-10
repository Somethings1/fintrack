import React, { useEffect, useState } from "react";
import {
    Form,
    Input,
    Button,
    InputNumber,
    Radio,
    Space,
    Popover,
    Modal,
    message,
} from "antd";
import Picker from '@emoji-mart/react';
import data from "@emoji-mart/data";
import { Category } from "@/models/Category";
import { deleteCategories, addCategory, updateCategory } from "@/services/categoryService";

interface CategoryFormProps {
    category?: Partial<Category>;
    onSubmit: () => void;
    onCancel?: () => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({
    category,
    onSubmit,
    onCancel,
}) => {
    const [form] = Form.useForm();
    const [selectedIcon, setSelectedIcon] = useState<string>("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [iconPickerOpen, setIconPickerOpen] = useState(false);

    useEffect(() => {
        if (category) {
            form.setFieldsValue({ ...category });
            setSelectedIcon(category.icon || "");
        }
    }, [category]);

    const handleFinish = async (values: any) => {
        const updated: Category = {
            _id: category?._id,
            owner: localStorage.getItem("username") ?? "",
            name: values.name,
            type: values.type,
            icon: selectedIcon || "💰",
            budget: values.budget,
            lastUpdate: new Date(),
            isDeleted: false,
        };

        try {
            if (category?._id) {
                await updateCategory(category._id, updated); // existing category → update
            } else {
                await addCategory(updated);    // new category → add
            }

            onSubmit?.(); // notify parent (refresh + close modal, etc.)
        } catch (err) {
            console.error("Failed to submit category:", err);
        }
    };

    const confirmDelete = () => {
        Modal.confirm({
            title: "Are you sure you want to delete this category?",
            content:
                "All transactions linked to this category will also be deleted or invalidated. This action cannot be undone.",
            okText: "Yes, Delete",
            okType: "danger",
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    setIsDeleting(true);
                    await deleteCategories([category!._id]);
                    message.success("Category deleted successfully");
                    onCancel?.();
                } catch (err) {
                    console.error(err);
                    message.error("Failed to delete category");
                } finally {
                    setIsDeleting(false);
                }
            },
        });
    };

    return (
        <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 18 }}
            labelAlign="left"
            requiredMark={false}
            onFinish={handleFinish}
        >
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Radio.Group>
                    <Radio.Button value="income">Income</Radio.Button>
                    <Radio.Button value="expense">Expense</Radio.Button>
                </Radio.Group>
            </Form.Item>

            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
            </Form.Item>

            <Form.Item
                name="icon"
                label="Icon"
                rules={[{ required: true, message: "Please select an icon" }]}
            >
                <Popover
                    trigger="click"
                    open={iconPickerOpen}
                    content={
                        <Picker
                            data={data}
                            onEmojiSelect={(emoji: any) => {
                                setSelectedIcon(emoji.native);
                                form.setFieldsValue({ icon: emoji.native });
                                setIconPickerOpen(false);
                            }}
                            theme="light"
                            previewPosition="none"
                            maxFrequentRows={1}
                        />
                    }
                >
                    <Button
                        onClick={ () => setIconPickerOpen(true) }
                    >{selectedIcon || "Pick an emoji"}</Button>
                </Popover>
            </Form.Item>

            <Form.Item
                name="budget"
                label="Budget"
                rules={[{ required: true, message: "Please enter a budget amount" }]}
            >
                <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                <Space style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div>
                        {category && (
                            <Button danger loading={isDeleting} onClick={confirmDelete}>
                                Delete
                            </Button>
                        )}
                    </div>
                    <div>
                        <Button onClick={onCancel}>Cancel</Button>
                        <Button type="primary" htmlType="submit">
                            {category ? "Update" : "Create"}
                        </Button>
                    </div>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default CategoryForm;

