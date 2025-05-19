import React, { useEffect, useState } from "react";
import { Form, Input, InputNumber, Button, Space, Popconfirm, message } from "antd";
import { Account } from "@/models/Account";
import { addAccount, updateAccount, deleteAccounts } from "@/services/accountService";
import IconPickerField from "@/components/IconPickerField";
import { useRefresh } from "@/context/RefreshProvider";

interface AccountFormProps {
    account?: Partial<Account>;
    onSubmit: () => void;
    onCancel?: () => void;
}

const AccountForm: React.FC<AccountFormProps> = ({ account, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const [isDeleting, setIsDeleting] = useState(false);
    const { triggerRefresh } = useRefresh();

    useEffect(() => {
        if (account) {
            form.setFieldsValue(account);
        }
    }, [account]);

    const handleFinish = async (values: any) => {
        const updated: Account = {
            _id: account?._id,
            owner: localStorage.getItem("username") ?? "",
            name: values.name,
            icon: values.icon || "🏦",
            balance: values.balance,
            lastUpdate: new Date(),
            isDeleted: false,
        };

        try {
            if (account?._id) {
                await updateAccount(account._id, updated);
            } else {
                await addAccount(updated);
            }
            onSubmit?.();
            triggerRefresh();
        } catch (err) {
            console.error("Failed to save account:", err);
            message.error("Failed to save account");
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await deleteAccounts([account!._id]);
            message.success("Account deleted successfully");
            onCancel?.();
            triggerRefresh();
        } catch (err) {
            console.error(err);
            message.error("Failed to delete account");
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
                initialValue={account?.icon}
                onIconChange={(emoji: string) => {
                    form.setFieldValue("icon", emoji); // <- Sync with Antd Form
                }}
            />

            <Form.Item name="balance" label="Balance" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <div>
                        {account && (
                            <Popconfirm
                                title="Are you sure you want to delete this account?"
                                okText="Yes"
                                cancelText="No"
                                onConfirm={handleDelete}
                            >
                                <Button danger loading={isDeleting}>Delete</Button>
                            </Popconfirm>
                        )}
                    </div>
                    <div>
                        <Button onClick={onCancel} style={{ marginRight: "20px" }}>Cancel</Button>
                        <Button type="primary" htmlType="submit">
                            {account?._id ? "Update" : "Create"}
                        </Button>
                    </div>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default AccountForm;

