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
  Space,
} from "antd";
import { GoogleOutlined } from "@ant-design/icons";

const { Link } = Typography;

const LoginPage = () => {
  const [form] = Form.useForm();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (values: any) => {
    setError(null);
    const { email, password, name, confirmPassword } = values;

    try {
      if (tab === "login") {
        await signIn(email, password);
      } else {
        if (password !== confirmPassword) {
          setError("Passwords do not match!");
          return;
        }
        await signUp(name, email, password);
      }
      navigate("/home");
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

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <Tabs
        activeKey={tab}
        onChange={(key) => {
          setTab(key as "login" | "signup");
          setError(null);
          form.resetFields();
        }}
        centered
      >
        <Tabs.TabPane tab="Login" key="login" />
        <Tabs.TabPane tab="Sign Up" key="signup" />
      </Tabs>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {tab === "signup" && (
          <>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </>
        )}

        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
          <Input />
        </Form.Item>

        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>

        {tab === "signup" && (
          <Form.Item name="confirmPassword" label="Confirm Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        )}

        {tab === "login" && (
          <Form.Item>
            <Link onClick={() => navigate("/reset-password")}>Forgot password?</Link>
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {tab === "login" ? "Login" : "Sign Up"}
          </Button>
        </Form.Item>
      </Form>

      <Divider plain>OR</Divider>

      <Button icon={<GoogleOutlined />} block onClick={handleGoogleLogin}>
        Sign in with Google
      </Button>
    </div>
  );
};

export default LoginPage;

