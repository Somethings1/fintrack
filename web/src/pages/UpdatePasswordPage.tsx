import React, { useState } from "react";
import { supabase } from "@/services/authService";
import { useNavigate } from "react-router-dom";
import "./UpdatePasswordPage.css";
import { Typography } from "antd";

const UpdatePasswordPage = () => {
    const { Title } = Typography;

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setError("🚫 Passwords do not match.");
            return;
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            setError(`❌ ${error.message}`);
        } else {
            navigate("/login");
        }
    };

    return (
        <div className="update-wrapper">
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
            <div className="update-container">
                <h2 className="update-title">Set a New Password</h2>
                <p className="update-subtitle">Make it strong. Make it unforgettable.</p>
                <form className="update-form" onSubmit={handleUpdate}>
                    <input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="update-input"
                    />
                    <input
                        type="password"
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="update-input"
                    />
                    <button type="submit" className="update-button">
                        Update Password
                    </button>
                </form>
                {error && <p className="update-error">{error}</p>}
            </div>
        </div>
    );
};

export default UpdatePasswordPage;

