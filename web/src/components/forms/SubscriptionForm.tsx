import { getLedgerConfig } from "@/config/ledger";
import { validateMoney } from "@/utils/money";
import IconPickerField from "@/components/IconPickerField";
import { Account } from "@/models/Account";
import { Category } from "@/models/Category";
import { Saving } from "@/models/Saving";
import { Subscription } from "@/models/Subscription";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredCategories } from "@/services/categoryService";
import { getStoredSavings } from "@/services/savingService";
import { addSubscription,deleteSubscriptions,updateSubscription } from "@/services/subscriptionService";
import {
Alert,
Button,
Col,
DatePicker,
Form,
Input,
InputNumber,
message,
Popconfirm,
Row,
Select,
Space,
} from "antd";
import dayjs from "dayjs";
import React,{ useEffect,useState } from "react";

interface SubscriptionFormProps {
    subscription?: Partial<Subscription>;
    onSubmit?: () => void;
    onCancel?: () => void;
}

const intervalOptions = [
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
];

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ subscription = {}, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const { precision, currency } = getLedgerConfig();
    const moneyRule = { validator: (_: unknown, value: unknown) => validateMoney(value, precision, true) ? Promise.resolve() : Promise.reject(new Error(`Enter a valid ${currency} amount (up to ${precision} decimal places).`)) };
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savings, setSavings] = useState<Saving[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

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
    }, [subscription, form]);

    const handleFinish = async (values: Omit<Subscription, 'startDate'> & { startDate: dayjs.Dayjs }) => {
        const formatted: Subscription = {
            ...subscription,
            ...values,
            creator: localStorage.getItem("username") ?? "",
            remindBefore: values.remindBefore ?? 1,
            startDate: values.startDate?.toDate() ?? subscription.startDate,
            isDeleted: false,
        };

        try {
            if (subscription?._id) {
                await updateSubscription(subscription._id, formatted);
            } else {
                await addSubscription(formatted);
            }
            onSubmit?.();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await deleteSubscriptions([subscription!._id!]);
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
            <Row gutter={16}>
                <Col span={8}>
                    <IconPickerField
                        name="icon"
                        label="Icon"
                        initialValue={subscription?.icon ?? "💸"}
                        onIconChange={(emoji: string) => {
                            form.setFieldValue("icon", emoji);
                        }}
                    />
                </Col>
                <Col span={16}>
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true, message: "Please give this subscription a name." }]}
                    >
                        <Input />
                    </Form.Item>
                </Col>
            </Row>
            <Form.Item
                name="amount"
                label="Amount"
                rules={[moneyRule, { required: true, message: "Please enter the subscription amount." }]}
            >
                <InputNumber style={{ width: "100%" }} min={10 ** -precision} max={1e12} step={10 ** -precision} />
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
                    <Select disabled={(subscription.currentInterval ?? 0) > 0} options={intervalOptions} />
                </Form.Item>
            }



            <Form.Item name="maxInterval" label="Max Intervals">
                <InputNumber style={{ width: "100%" }} placeholder="Leave empty for infinite" />
            </Form.Item>

            <Form.Item name="remindBefore" label="Remind Before (days)">
                <InputNumber style={{ width: "100%" }} />
            </Form.Item>

            {subscription?._id && (
                <Form.Item wrapperCol={{ span: 24 }}>
                    <Alert
                        message="Note"
                        description="Editing this subscription will not affect any previously generated transactions."
                        type="info"
                        showIcon
                    />
                </Form.Item>
            )}


            <Form.Item wrapperCol={{ offset: 0, span: 24 }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
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

