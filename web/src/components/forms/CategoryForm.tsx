import { getLedgerConfig } from "@/config/ledger";
import { validateMoney } from "@/utils/money";
import IconPickerField from "@/components/IconPickerField";
import { Category } from "@/models/Category";
import {
addCategory,
deleteCategories,
updateCategory,
} from "@/services/categoryService";
import {
Button,
Form,
Input,
InputNumber,
Popconfirm,
Radio,
Space,
message,
} from "antd";
import React,{ useEffect,useState } from "react";

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
    const { precision, currency } = getLedgerConfig();
    const moneyRule = { validator: (_: unknown, value: unknown) => validateMoney(value, precision, false) ? Promise.resolve() : Promise.reject(new Error(`Enter a valid ${currency} amount (up to ${precision} decimal places).`)) };
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (category) {
            form.setFieldsValue({ ...category });
        }
        else {
            form.setFieldValue("type", "expense" );
        }
    }, [category, form]);

    const handleFinish = async (values: Category) => {
        const updated: Partial<Category> = {
            _id: category?._id,
            owner: localStorage.getItem("username") ?? "",
            name: values.name,
            type: values.type,
            icon: values.icon || "💰",
            budget: values.budget,
            lastUpdate: new Date(),
            isDeleted: false,
        };

        try {
            if (category?._id) {
                await updateCategory(category._id, updated);
            } else {
                await addCategory(updated);
            }
            onSubmit?.();
        } catch (err) {
            console.error("Failed to submit category:", err);
            message.error("Failed to save category");
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await deleteCategories([category!._id!]);
            message.success("Category deleted successfully");
            onCancel?.();
        } catch (err) {
            console.error(err);
            message.error("Failed to delete category");
        } finally {
            setIsDeleting(false);
        }
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
                <Radio.Group disabled={!!category?._id}>
                    <Radio.Button value="income">Income</Radio.Button>
                    <Radio.Button value="expense">Expense</Radio.Button>
                </Radio.Group>
            </Form.Item>

            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
            </Form.Item>

            <IconPickerField
                name="icon"
                label="Icon"
                initialValue={category?.icon}
                onIconChange={(emoji: string) => {
                    form.setFieldValue("icon", emoji); // <- Sync with Antd Form
                }}
            />
            <Form.Item
                name="budget"
                label="Budget"
                rules={[moneyRule, { required: true, message: "Please enter a budget amount" }]}
            >
                <InputNumber style={{ width: "100%" }} min={0} max={1e12} step={10 ** -precision} />
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                <Space style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div>
                        {category && (
                            <Popconfirm
                                title="Are you sure you want to delete this category?"
                                description="Referenced categories cannot be archived. Historical transactions are never deleted by this action."
                                okText="Yes, Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                                onConfirm={handleDelete}
                            >
                                <Button danger type="primary" loading={isDeleting}>Delete</Button>
                            </Popconfirm>
                        )}
                    </div>
                    <div>
                        <Button onClick={onCancel} style={{ marginRight: "20px" }}>Cancel</Button>
                        <Button type="primary" htmlType="submit">
                            {category?._id ? "Update" : "Create"}
                        </Button>
                    </div>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default CategoryForm;

