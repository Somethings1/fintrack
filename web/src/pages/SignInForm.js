import React, { useState } from "react";

function SignInForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Create the request payload
    const payload = { username, password };

    try {
      // Send the POST request to the server
      const response = await fetch("http://localhost:8080/api/signin", {
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

export default SignInForm;

