import React, { useEffect, useState } from "react";
import {
    Form,
    InputNumber,
    Button,
    DatePicker,
    Select,
    Space,
    Input,
    message,
    Popconfirm
} from "antd";
import dayjs from "dayjs";
import { Subscription } from "@/models/Subscription";
import IconPickerField from "@/components/IconPickerField";
import { Account } from "@/models/Account";
import { Category } from "@/models/Category";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredSavings } from "@/services/savingService";
import { getStoredCategories } from "@/services/categoryService";
import { addSubscription, updateSubscription, deleteSubscriptions } from "@/services/subscriptionService";
import { useRefresh } from "@/context/RefreshProvider";

interface SubscriptionFormProps {
    subscription?: Partial<Subscription>;
    onSubmit?: () => void;
    onCancel?: () => void;
}

const intervalOptions = [
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
];

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ subscription = {}, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savings, setSavings] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const { triggerRefresh } = useRefresh();

    const combinedAccounts = [
        ...accounts.map(a => ({ ...a, type: "account" })),
        ...savings.map(s => ({ ...s, type: "saving" }))
    ];

    useEffect(() => {
        const fetchAll = async () => {
            const [accs, savs, cats] = await Promise.all([
                getStoredAccounts(),
                getStoredSavings(),
                getStoredCategories()
            ]);
            setAccounts(accs);
            setSavings(savs);
            setCategories(cats);
        };
        fetchAll();
    }, []);

    useEffect(() => {
        const { sourceAccount, category, ...rest } = subscription;

        form.setFieldsValue({
            ...rest,
            sourceAccount: sourceAccount === "000000000000000000000000" ? undefined : sourceAccount,
            category: category === "000000000000000000000000" ? undefined : category,
            startDate: subscription.startDate ? dayjs(subscription.startDate) : undefined,
            nextActive: subscription.nextActive ? dayjs(subscription.nextActive) : undefined,
        });
    }, [subscription]);

    const handleFinish = async (values: any) => {
        const formatted: Subscription = {
            ...subscription,
            ...values,
            creator: localStorage.getItem("username") ?? "",
            remindBefore: values.remindBefore ?? 1,
            startDate: values.startDate?.toISOString() ?? subscription.startDate,
            isDeleted: false,
        };

        try {
            if (subscription?._id) {
                await updateSubscription(subscription._id, formatted);
                message.success("Subscription updated successfully");
            } else {
                await addSubscription(formatted);
                message.success("Subscription created successfully");
            }
            triggerRefresh();
            onSubmit?.();
        } catch (err) {
            console.error(err);
            message.error("Failed to save subscription");
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await deleteSubscriptions([subscription!._id]);
            message.success("Subscription deleted");
            triggerRefresh();
            onCancel?.();
        } catch (err) {
            console.error(err);
            message.error("Failed to delete subscription");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            labelAlign="left"
            requiredMark={false}
            onFinish={handleFinish}
        >
            <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please give this subscription a name." }]}
            >
                <Input />
            </Form.Item>

            <IconPickerField
                name="icon"
                label="Icon"
                initialValue={subscription?.icon}
                onIconChange={(emoji: string) => {
                    form.setFieldValue("icon", emoji); // yes, you're syncing like a champ
                }}
            />
            <Form.Item
                name="amount"
                label="Amount"
                rules={[{ required: true, message: "Please enter the subscription amount." }]}
            >
                <InputNumber style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
                name="sourceAccount"
                label="Source Account"
                rules={[{ required: true, message: "Please select a source account for this subscription." }]}
            >
                <Select>
                    {combinedAccounts.map(acc => (
                        <Select.Option key={acc._id} value={acc._id}>
                            [{acc.type === "account" ? "A" : "S"}] {acc.name}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>

            <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: "Please choose a category for this subscription." }]}
            >
                <Select>
                    {categories
                        .filter(cat => cat.type === "expense")
                        .map(cat => (
                            <Select.Option key={cat._id} value={cat._id}>
                                {cat.name}
                            </Select.Option>
                        ))}
                </Select>
            </Form.Item>

            {!subscription._id &&
                <Form.Item
                    name="startDate"
                    label="Start Date"
                    rules={[{ required: true, message: "Please select a start date." }]}
                >
                    <DatePicker style={{ width: "100%" }} />
                </Form.Item>

            }
            {!subscription._id &&
                <Form.Item
                    name="interval"
                    label="Interval"
                    rules={[{ required: true, message: "Please select how often this subscription occurs." }]}
                >
                    <Select options={intervalOptions} />
                </Form.Item>
            }



            <Form.Item name="maxInterval" label="Max Intervals">
                <InputNumber style={{ width: "100%" }} placeholder="Leave empty for infinite" />
            </Form.Item>

            <Form.Item name="remindBefore" label="Remind Before (days)">
                <InputNumber style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item>
                <Space style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div>
                        {subscription?._id && (
                            <Popconfirm
                                title="Are you sure you want to delete this subscription?"
                                onConfirm={handleDelete}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button type="primary" danger loading={isDeleting}>
                                    Delete
                                </Button>
                            </Popconfirm>
                        )}
                    </div>
                    <div>
                        <Button onClick={onCancel} style={{ marginRight: "20px" }}>
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit">
                            {subscription?._id ? "Update" : "Create"}
                        </Button>
                    </div>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default SubscriptionForm;

