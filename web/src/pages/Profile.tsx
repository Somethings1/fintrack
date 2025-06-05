import {
    Button,
    Form,
    Input,
    Select,
    Switch,
    Upload,
    Typography,
    Row,
    Col,
    Card,
    Avatar,
} from "antd";
import { ArrowLeftOutlined, UploadOutlined, LogoutOutlined } from "@ant-design/icons";
import { useEffect, useState, useContext } from "react";
import { supabase, logout } from "@/services/authService";
import type { UploadProps } from "antd";
import { getMessageApi } from "@/utils/messageProvider";
import { useSettings } from "../context/SettingsContext";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;
const { Option } = Select;

const currencyPositions = [
    { label: "Before", value: "before" },
    { label: "After", value: "after" },
];

const locales = ["en-US", "vi-VN", "fr-FR", "ja-JP"];

export function ProfilePage() {
    const [form] = Form.useForm();
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const message = getMessageApi();

    const { settings, setSettings, refreshSettings, loading } = useSettings();

    useEffect(() => {
        refreshSettings().then((profile) => {
            form.setFieldsValue({
                email: profile.email,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                notification_income: profile.notification_income,
                notification_expense: profile.notification_expense,
                display_locale: profile.display_locale,
                display_currency: profile.display_currency,
                display_floating_points: profile.display_floating_points,
                currency_position: profile.currency_position,
            });
            setAvatarUrl(profile.avatar_url);
        });
    }, []);

    const handleUpdate = async (values: any) => {
        const updated = {
            ...settings,
            ...values,
            avatar_url: avatarUrl,
        };

        const success = await setSettings(updated);
        if (success) {
            message.success("Profile updated");
        } else {
            message.error("Update failed");
        }
    };

    const handleAvatarUpload: UploadProps["customRequest"] = async ({ file, onSuccess, onError }) => {
        const { data: { user } } = await supabase.auth.getUser();
        const filePath = `avatars/${user?.id}-${Date.now()}`;

        const { data, error } = await supabase.storage
            .from("avatar")
            .upload(filePath, file as File);

        if (error) {
            onError?.(error);
            message.error("Failed to upload avatar");
        } else {
            const { data: urlData } = supabase.storage
                .from("avatar")
                .getPublicUrl(filePath);

            setAvatarUrl(urlData.publicUrl);
            handleUpdate(form.getFieldsValue);
            message.success("Avatar uploaded");
            onSuccess?.(file);
        }
    };

    const navigate = useNavigate();
    const handleLogout = () => {
        logout();
        navigate("/");
    }

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
            <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                style={{ marginBottom: 8, padding: 0 }}
            >
                Back
            </Button>
            <Title level={2}>Your Profile</Title>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleUpdate}
                initialValues={{
                    email: "",
                    full_name: "",
                    avatar_url: "",
                    notification_income: true,
                    notification_expense: true,
                    display_locale: "en-US",
                    display_currency: "USD",
                    display_floating_points: 2,
                    currency_position: "before",
                }}
            >
                <Card style={{ marginBottom: 24 }}>
                    <Form.Item>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <Avatar size={64} src={avatarUrl || undefined}>
                                {form.getFieldValue("full_name")?.charAt(0)}
                            </Avatar>
                            <Upload showUploadList={false} customRequest={handleAvatarUpload}>
                                <Button icon={<UploadOutlined />}>Upload Avatar</Button>
                            </Upload>
                        </div>
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Email" name="email">
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Full Name" name="full_name">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card title="Notification Settings" style={{ marginBottom: 24 }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="notification_income"
                                valuePropName="checked"
                                label="Income Notification"
                            >
                                <Switch />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="notification_expense"
                                valuePropName="checked"
                                label="Expense Notification"
                            >
                                <Switch />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card title="Money Display Settings" style={{ marginBottom: 24 }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Locale" name="display_locale">
                                <Select>
                                    {locales.map((loc) => (
                                        <Option key={loc} value={loc}>{loc}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Currency" name="display_currency">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Floating Points" name="display_floating_points">
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Currency Position" name="currency_position">
                                <Select options={currencyPositions} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Row justify="space-between">
                    <Col>
                        <Button type="primary" onClick={() => form.submit()} loading={loading}>
                            Save Changes
                        </Button>
                    </Col>
                    <Col>
                        <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
                            Logout
                        </Button>
                    </Col>
                </Row>
            </Form>
        </div>
    );
}

