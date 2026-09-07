import { getLedgerConfig } from '@/config/ledger';
import { ownedAvatarPath, prepareAvatar } from '@/services/avatarService';
import type { Settings } from "@/context/settings-context";
import { logout,supabase } from "@/services/authService";
import { getMessageApi } from "@/utils/messageProvider";
import { ArrowLeftOutlined,LogoutOutlined,UploadOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import {
Avatar,
Button,
Card,
Col,
Form,
Input,
Row,
Select,
Typography,
Upload
} from "antd";
import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/settings-context";

const { Title } = Typography;
const { Option } = Select;

const currencyPositions = [
    { label: "Before", value: "before" },
    { label: "After", value: "after" },
];

const locales = ["en-US", "vi-VN", "fr-FR", "ja-JP"];

export function ProfilePage() {
    const [form] = Form.useForm();
    const [uploading, setUploading] = useState(false);
    const ledger = getLedgerConfig();
    const message = getMessageApi();

    const { settings, setSettings, refreshSettings, loading } = useSettings();

    useEffect(() => {
        refreshSettings().then((profile) => {
            if (!profile) return;
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

        });
    }, [form, refreshSettings]);

    const handleUpdate = async (values: Partial<Settings>) => {
        if (!settings) return;
        const updated = {
            ...settings,
            ...values,
            display_currency: ledger.currency,
            display_floating_points: ledger.precision,
        };

        const success = await setSettings(updated);
        if (success) {
            message.success("Profile updated");
        } else {
            message.error("Update failed");
        }
    };

    const handleAvatarUpload: UploadProps["customRequest"] = async ({ file, onSuccess, onError }) => {
        setUploading(true);
        let path = '';
        let saved = false;
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user || !settings || settings.id !== user.id || !(file instanceof File)) throw new Error('Sign in again before uploading.');
            const image = await prepareAvatar(file);
            path = `${user.id}/${crypto.randomUUID()}.webp`;
            const uploaded = await supabase.storage.from('avatar').upload(path, image, { contentType: 'image/webp', upsert: false, cacheControl: '300' });
            if (uploaded.error) throw new Error('Upload failed.');
            saved = await setSettings({ ...settings, avatar_path: path });
            if (!saved) throw new Error('Could not save the avatar.');
            if (ownedAvatarPath(settings.avatar_path, user.id)) await supabase.storage.from('avatar').remove([settings.avatar_path]);
            message.success('Avatar uploaded');
            onSuccess?.({});
        } catch {
            if (path && !saved) await supabase.storage.from('avatar').remove([path]);
            const error = new Error('Avatar not saved. Use a PNG, JPEG or WebP under 2 MiB and 4096 pixels.');
            message.error(error.message);
            onError?.(error);
        } finally { setUploading(false); }
    };
    const navigate = useNavigate();
    const handleLogout = async () => {
        try { await logout(); } catch { message.error('Sign out failed. Please retry.'); }
    };

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
                    display_currency: ledger.currency,
                    display_floating_points: ledger.precision,
                    currency_position: "before",
                }}
            >
                <Card style={{ marginBottom: 24 }}>
                    <Form.Item>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <Avatar size={64} src={settings?.avatar_url || undefined}>
                                {form.getFieldValue("full_name")?.charAt(0)}
                            </Avatar>
                            <Upload accept="image/png,image/jpeg,image/webp" maxCount={1} disabled={uploading || loading} showUploadList={false} customRequest={handleAvatarUpload}>
                                <Button loading={uploading} icon={<UploadOutlined />}>Upload Avatar</Button>
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
                            <Form.Item label="Ledger currency (no currency conversion)" name="display_currency">
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Currency decimal places" name="display_floating_points">
                                <Input type="number" disabled />
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
                        <Button type="primary" onClick={() => form.submit()} disabled={uploading} loading={loading}>
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

