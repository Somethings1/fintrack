import React, { useState } from "react";
import { resetPassword } from "@/services/authService";

const ResetPasswordPage = () => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await resetPassword(email);
            setStatus("Check your email for reset link.");
        } catch (err: any) {
            setStatus(err.message || "Reset failed");
        }
    };

    return (
        <div>
            <h2>Reset Password</h2>
            <form onSubmit={handleReset}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit">Send Reset Email</button>
            </form>
            <p>{status}</p>
        </div>
    );
};

export default ResetPasswordPage;

