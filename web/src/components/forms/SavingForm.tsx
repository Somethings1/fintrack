import React, { useEffect, useState } from "react";
import {
    Form,
    Input,
    InputNumber,
    Button,
    Space,
    Popconfirm,
    DatePicker,
    message,
} from "antd";
import dayjs from "dayjs";
import { Saving } from "@/models/Saving";
import {
    addSaving,
    updateSaving,
    deleteSavings,
} from "@/services/savingService";
import IconPickerField from "@/components/IconPickerField";
import { useRefresh } from "@/context/RefreshProvider";

interface SavingFormProps {
    saving?: Partial<Saving>;
    onSubmit: () => void;
    onCancel?: () => void;
}

const SavingForm: React.FC<SavingFormProps> = ({
    saving,
    onSubmit,
    onCancel,
}) => {
    const [form] = Form.useForm();
    const [isDeleting, setIsDeleting] = useState(false);
    const { triggerRefresh } = useRefresh();

    useEffect(() => {
        if (saving) {
            form.setFieldsValue({
                ...saving,
                goalDate: saving.goalDate ? dayjs(saving.goalDate) : undefined,
                createdDate: saving.createdDate
                    ? dayjs(saving.createdDate)
                    : dayjs(),
            });
        } else {
            form.setFieldsValue({
                icon: "💸",
                createdDate: dayjs(),
                goalDate: dayjs().add(1, "month"),
            });
        }
    }, [saving]);

    const handleFinish = async (values: any) => {
        const updated: Saving = {
            _id: saving?._id ?? "",
            owner: localStorage.getItem("username") ?? "",
            name: values.name,
            icon: values.icon || "💸",
            balance: values.balance,
            goal: values.goal,
            createdDate: values.createdDate.toDate(),
            goalDate: values.goalDate.toDate(),
            lastUpdate: new Date(),
            isDeleted: false,
        };

        try {
            if (saving?._id) {
                await updateSaving(saving._id, updated);
            } else {
                await addSaving(updated);
            }
            onSubmit?.();
            triggerRefresh();
        } catch (err) {
            console.error("Failed to save saving:", err);
            message.error("Failed to save saving");
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await deleteSavings([saving!._id]);
            message.success("Saving deleted successfully");
            onCancel?.();
            triggerRefresh();
        } catch (err) {
            console.error(err);
            message.error("Failed to delete saving");
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
            onFinish={handleFinish}
        >
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
            </Form.Item>

            <IconPickerField
                name="icon"
                label="Icon"
                initialValue={saving?.icon}
                onIconChange={(emoji: string) => {
                    form.setFieldValue("icon", emoji); // <- Sync with Antd Form
                }}
            />

            <Form.Item name="balance" label="Balance" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>

            <Form.Item name="goal" label="Goal" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>

            <Form.Item
                name="goalDate"
                label="Goal Date"
                rules={[{ required: true, message: "Please select goal date" }]}
            >
                <DatePicker style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
                name="createdDate"
                label="Starting Date"
                rules={[{ required: true }]}
            >
                <DatePicker style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <div>
                        {saving && saving._id && (
                            <Popconfirm
                                title="Are you sure you want to delete this saving?"
                                okText="Yes"
                                cancelText="No"
                                onConfirm={handleDelete}
                            >
                                <Button danger loading={isDeleting}>
                                    Delete
                                </Button>
                            </Popconfirm>
                        )}
                    </div>
                    <div>
                        <Button onClick={onCancel}>Cancel</Button>
                        <Button type="primary" htmlType="submit">
                            {saving?._id ? "Update" : "Create"}
                        </Button>
                    </div>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default SavingForm;

