import React from "react";
import { Form, Input, DatePicker, Button, Space } from "antd";
import dayjs from "dayjs";
import { Notification } from "@/types";

interface NotificationFormProps {
    transactionId: string;
    initialData?: Partial<Notification>;
    onSubmit: (data: Partial<Notification> & { transactionId: string }) => void;
    onCancel?: () => void;
}

const NotificationForm: React.FC<NotificationFormProps> = ({
    transactionId,
    initialData,
    onSubmit,
    onCancel,
}) => {
    const [form] = Form.useForm();

    React.useEffect(() => {
        if (initialData) {
            form.setFieldsValue({
                message: initialData.message,
                scheduledAt: dayjs(initialData.scheduledAt),
            });
        } else {
            form.resetFields();
        }
    }, [initialData, form]);

    const handleFinish = (values: any) => {
        onSubmit({
            referenceId: transactionId,
            owner: localStorage.getItem("username"),
            type: "transaction",
            read: false,
            title: "Reminder: check your transaction out",
            message: values.message,
            scheduledAt: values.scheduledAt.toISOString(),
            _id: initialData?._id ?? "",
        });
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            initialValues={{
                message: "",
                scheduledAt: dayjs(),
                ...initialData,
            }}
        >
            <Form.Item
                label="Notification Message"
                name="message"
                rules={[{ required: true, message: "Please enter a notification message" }]}
            >
                <Input.TextArea rows={3} placeholder="Enter notification message" />
            </Form.Item>

            <Form.Item
                label="Scheduled At"
                name="scheduledAt"
                rules={[{ required: true, message: "Please select a schedule time" }]}
            >
                <DatePicker
                    showTime
                    style={{ width: "100%" }}
                    disabledDate={current => current && current < dayjs().startOf('day')}
                />
            </Form.Item>

            <Form.Item>
                <Space style={{ display: "flex", justifyContent: "flex-end" }}>
                    {onCancel && (
                        <Button onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button type="primary" htmlType="submit">
                        {initialData ? "Update" : "Add"} Notification
                    </Button>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default NotificationForm;

