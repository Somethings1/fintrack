import { useState } from "react";
import { signIn, signUp } from "../services/authService"; // Assume signUp is implemented
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
    const [tab, setTab] = useState<"login" | "signup">("login");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");  // New state for name
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = await signIn(username, password);
            localStorage.setItem("username", data.username);
            navigate("/home");
        } catch (err) {
            setError("Invalid credentials");
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signUp(name, username, password);  // Pass name along with username and password
            setTab("login");
            setError("Signup successful. Please log in.");
        } catch (err) {
            setError("Signup failed");
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "1rem" }}>
                <button
                    onClick={() => setTab("login")}
                    style={{ fontWeight: tab === "login" ? "bold" : "normal" }}
                >
                    Login
                </button>
                <button
                    onClick={() => setTab("signup")}
                    style={{ fontWeight: tab === "signup" ? "bold" : "normal" }}
                >
                    Signup
                </button>
            </div>

            <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
                {tab === "signup" && (
                    <input
                        type="text"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={{ display: "block", width: "100%", marginBottom: "1rem" }}
                    />
                )}
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={{ display: "block", width: "100%", marginBottom: "1rem" }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ display: "block", width: "100%", marginBottom: "1rem" }}
                />
                <button type="submit" style={{ width: "100%" }}>
                    {tab === "login" ? "Login" : "Signup"}
                </button>
            </form>

            {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}
        </div>
    );
};

export default LoginPage;

