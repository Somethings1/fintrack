import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp, signInWithGoogle } from "@/services/authService";
import {
    Tabs,
    Form,
    Input,
    Button,
    Typography,
    Alert,
    Divider,
} from "antd";
import { GoogleOutlined } from "@ant-design/icons";

const { Link, Title } = Typography;

const LoginPage = () => {
    const [form] = Form.useForm();
    const [tab, setTab] = useState<"login" | "signup">("login");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSubmit = async (values: any) => {
        setError(null);
        const { email, password, name, confirmPassword } = values;

        try {
            if (tab === "login") {
                await signIn(email, password);
                navigate("/home");
            } else {
                if (password !== confirmPassword) {
                    setError("Passwords do not match!");
                    return;
                }
                await signUp(name, email, password);
                setMessage("Sign up successfully. Please check your mail box to find confirmation mail.")
                setTab("login");
            }
        } catch (err: any) {
            setError(err.message || `${tab} failed`);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || "Google login failed");
        }
    };

    const renderForm = () => (
        <>
            {error && (
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {message && (
                <Alert
                    message={message}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                {tab === "signup" && (
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>
                )}

                <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: "email" }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="password"
                    label="Password"
                    rules={[{ required: true }]}
                >
                    <Input.Password />
                </Form.Item>

                {tab === "signup" && (
                    <Form.Item
                        name="confirmPassword"
                        label="Confirm Password"
                        rules={[{ required: true }]}
                    >
                        <Input.Password />
                    </Form.Item>
                )}

                {tab === "login" && (
                    <Form.Item>
                        <Link onClick={() => navigate("/reset-password")}>
                            Forgot password?
                        </Link>
                    </Form.Item>
                )}

                <Form.Item>
                    <Button type="primary" htmlType="submit" block>
                        {tab === "login" ? "Login" : "Sign Up"}
                    </Button>
                </Form.Item>
            </Form>

            <Divider plain>OR</Divider>

            <Button
                icon={<GoogleOutlined />}
                block
                onClick={handleGoogleLogin}
            >
                Sign in with Google
            </Button>
        </>
    );

    return (
        <div
            style={{
                padding: "1px",
                width: "100vw",
                height: "100vh",
                background: 'url("background.jpg") center center/cover',
            }}
        >
            <div
                style={{
                    padding: "0 16px",
                    textAlign: "center",
                    color: "white",
                }}
            >
                <Title
                    level={3}
                    style={{
                        fontFamily: "Orbitron",
                        color: "black",
                        margin: 0,
                        fontSize: "28px",
                        transition: "all 0.3s ease",
                        position: "fixed",
                        top: "20px",
                        left: "20px",
                        zIndex: 9999,
                    }}
                >
                    Fintrack
                </Title>
            </div>

            <div
                style={{
                    maxWidth: 400,
                    margin: "100px auto",
                    padding: 24,
                    border: "1px solid #eee",
                    borderRadius: 8,
                    background: "white",
                }}
            >
                <Tabs
                    activeKey={tab}
                    onChange={(key) => {
                        setTab(key as "login" | "signup");
                        setError(null);
                        form.resetFields();
                    }}
                    centered
                    items={[
                        {
                            key: "login",
                            label: "Login",
                            children: renderForm(),
                        },
                        {
                            key: "signup",
                            label: "Sign Up",
                            children: renderForm(),
                        },
                    ]}
                />
            </div>
        </div>
    );
};

export default LoginPage;

