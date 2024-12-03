import React, { useState } from "react";
import SignInForm from "./pages/SignInForm";
import SignUpForm from "./pages/SignUpForm";

function App() {
  const [isSignIn, setIsSignIn] = useState(true);

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>Welcome to the App</h1>
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => setIsSignIn(true)}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: isSignIn ? "#007BFF" : "#f0f0f0",
            color: isSignIn ? "white" : "black",
            border: "1px solid #007BFF",
            cursor: "pointer",
          }}
        >
          Sign In
        </button>
        <button
          onClick={() => setIsSignIn(false)}
          style={{
            padding: "10px 20px",
            backgroundColor: !isSignIn ? "#007BFF" : "#f0f0f0",
            color: !isSignIn ? "white" : "black",
            border: "1px solid #007BFF",
            cursor: "pointer",
          }}
        >
          Sign Up
        </button>
      </div>
      {isSignIn ? <SignInForm /> : <SignUpForm />}
    </div>
  );
}

export default App;

