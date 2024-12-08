import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';

const SignUpForm = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation (client-side)
        if (!username || !password || !name) {
            setError("All fields are required.");
            return;
        }

        const userData = { username, password, name };

        try {
            const response = await fetch("/api/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(userData),
            });

            if (response.ok) {
                alert("Account created successfully!");
            } else {
                const errorData = await response.text();
                console.log("Error response:", errorData); // Log error details
                setError(errorData || "Something went wrong");
            }
        } catch (err) {
            console.log("Fetch error:", err); // Log fetch error details
            setError("Server error: " + err.message);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "auto", padding: "20px" }}>
        <h2 style={{ textAlign: "center" }}>Sign Up</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
        <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Name:</label>
        <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        style={{
            width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
        }}
        />
        </div>
        <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Username:</label>
        <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        style={{
            width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
        }}
        />
        </div>
        <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Password:</label>
        <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{
            width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
        }}
        />
        </div>
        {error && (
            <div
            style={{
                color: "red",
                    marginBottom: "10px",
                    fontSize: "14px",
                    textAlign: "center",
            }}
            >
            {error}
            </div>
        )}
        <button
        type="submit"
        style={{
            width: "100%",
                padding: "10px 15px",
                backgroundColor: "#007BFF",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "16px",
        }}
        >
        Sign Up
        </button>
        </form>
        </div>
    );
};

function LogInForm({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        // Create the request payload
        const payload = { username, password };

        try {
            // Send the POST request to the server
            const response = await fetch("/api/signin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            // Parse the JSON response
            const result = await response.text();

            // Alert the result
            if (response.ok) {
                alert(`Success: ${result}`);
                onLogin();
                navigate("/home");
            } else {
                alert(`User error: ${result}`);
            }
        } catch (error) {
            // Handle any network or unexpected errors
            alert(`Server error: ${error.message}`);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "auto", padding: "20px" }}>
        <h2>Sign In</h2>
        <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
        <label htmlFor="username">Username:</label>
        <input
        type="text"
        id="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        </div>
        <div style={{ marginBottom: "10px" }}>
        <label htmlFor="password">Password:</label>
        <input
        type="password"
        id="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        </div>
        <button type="submit" style={{ padding: "10px 15px" }}>
        Sign In
        </button>
        </form>
        </div>
    );
}

function AuthPage({ onLogin }) {
  const [isLogIn, setIsLogIn] = useState(true);

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>Welcome to the AuthPage</h1>
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => setIsLogIn(true)}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: isLogIn ? "#007BFF" : "#f0f0f0",
            color: isLogIn ? "white" : "black",
            border: "1px solid #007BFF",
            cursor: "pointer",
          }}
        >
          Sign In
        </button>
        <button
          onClick={() => setIsLogIn(false)}
          style={{
            padding: "10px 20px",
            backgroundColor: !isLogIn ? "#007BFF" : "#f0f0f0",
            color: !isLogIn ? "white" : "black",
            border: "1px solid #007BFF",
            cursor: "pointer",
          }}
        >
          Sign Up
        </button>
      </div>
      {isLogIn ? <LogInForm onLogin={onLogin} /> : <SignUpForm />}
    </div>
  );
}

export default AuthPage;

