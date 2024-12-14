import React, { useState } from "react";
import { Box, Button, Input, Heading, Text, VStack, Tabs, Fieldset } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { Field } from "../components/ui/field"

const SignUpForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!username || !password || !name) {
      setError("All fields are required.");
      return;
    }
      if (username.length < 6) {
          setError("Username must be at least 6 characters long.");
          return;
      }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (/^(.{0,7}|[^0-9]*|[^A-Z]*|[^a-z]*|[a-zA-Z0-9]*)$/.test(password)) {
      setError("Password must contain at least one lowercase letter, one uppercase letter, one special character(!@#$%^&*), and one number.");
      return;
    }


    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const userData = { username, password, name };

    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        alert("Account created successfully!");
      } else {
        const errorData = await response.json();
        setError(errorData["error"] || "Something went wrong");
      }
    } catch (err) {
      setError("Server error: " + err.message);
    }
  };

  return (
    <Box
      maxW="400px"
      mx="auto"
      p="4"
      borderWidth="1px"
      borderRadius="md"
      boxShadow="lg"
      bgColor="white">
      <Heading size="lg" textAlign="center" mb="4">
        Sign Up
      </Heading>
      <form onSubmit={handleSubmit}>
      <Fieldset.Root size="lg">
        <Fieldset.Content>
            <Field label="Name">
              <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              w="full"
              />
            </Field>
            <Field label="Username">
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  w="full"
                />
            </Field>
            <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  w="full"
                />
            </Field>
            <Field label="Confirm Password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  w="full"
                />
            </Field>
        </Fieldset.Content>
      </Fieldset.Root>
<Box h="20px">

</Box>
          {error && <Text color="red.500">{error}</Text>}

          <Button type="submit" colorScheme="blue" w="full">
            Sign Up
          </Button>
      </form>
    </Box>
  );
};

const LogInForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = { username, password };

    try {
      const response = await fetch("/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        onLogin();
        navigate("/home");
      } else {
          setError(result["error"]);
      }
    } catch (error) {
        setError("Server error: " + error.message);
    }
  };

  return (
    <Box
      maxW="400px"
      mx="auto"
      p="4"
      borderWidth="1px"
      borderRadius="md"
      boxShadow="lg"
      bgColor="white">
      <Heading size="lg" textAlign="center" mb="4">
        Log In
      </Heading>
      <form onSubmit={handleSubmit}>
      <Fieldset.Root>
      <Fieldset.Content>
          <Field label="Username">
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              w="full"
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              w="full"
            />
          </Field>
            {error && <Text color="red.500">{error}</Text>}
          <Button type="submit" colorScheme="blue" w="full">
            Sign In
          </Button>
      </Fieldset.Content>
      </Fieldset.Root>
      </form>
    </Box>
  );
};

const AuthPage = ({ onLogin }) => {
  return (
    <Box
        textAlign="center"
        p="6"
        bgImage="url('/bg.jpg')"
        bgSize="cover"
        bgPosition="center"
        minHeight="100vh">

      <Heading size="5xl">Join the Finance Revolution</Heading>
      <Box my="6">
        <Tabs.Root
            defaultValue="login"
            mt="40px"
            h="20px"
            colorScheme="teal"
            variant="enclosed">
          <Tabs.List>
            <Tabs.Trigger value="login">Log In</Tabs.Trigger>
            <Tabs.Trigger value="signup">Sign Up</Tabs.Trigger>
          </Tabs.List>

            <Tabs.Content value="login">
              <LogInForm onLogin={onLogin} />
            </Tabs.Content>
            <Tabs.Content value="signup">
              <SignUpForm />
            </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Box>
  );
};

export default AuthPage;

