import React, { useState } from "react";
import { resetPassword } from "@/services/authService";
import { Typography } from "antd";
import "./ResetPasswordPage.css";

const ResetPasswordPage = () => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await resetPassword(email);
            setStatus("✅ Check your email for the reset link.");
        } catch (err: any) {
            setStatus(err.message || "❌ Reset failed. Try again.");
        }
    };

    const { Title } = Typography;

    return (
        <div className="reset-wrapper">
            <div style={{ padding: "0 16px", textAlign: "center", color: "white" }}>
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

            <div className="reset-container">
                <h2 className="reset-title">Forgot your password?</h2>
                <p className="reset-subtitle">No worries. We'll send you a link to reset it.</p>
                <form className="reset-form" onSubmit={handleReset}>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="reset-input"
                    />
                    <button type="submit" className="reset-button">
                        Send Reset Email
                    </button>
                </form>
                {status && <p className="reset-status">{status}</p>}
            </div>
        </div>
    );
};

export default ResetPasswordPage;

