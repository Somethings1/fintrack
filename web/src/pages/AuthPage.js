import React, { useState } from "react";
import { Box, Button, Input, Heading, Text, VStack } from "@chakra-ui/react";
import { Tabs, TabList, Tab, TabPanels, TabPanel } from "@chakra-ui/tabs";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { useNavigate } from "react-router-dom";

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
        const errorData = await response.text();
        setError(errorData || "Something went wrong");
      }
    } catch (err) {
      setError("Server error: " + err.message);
    }
  };

  return (
    <Box maxW="400px" mx="auto" p="4" borderWidth="1px" borderRadius="md" boxShadow="lg">
      <Heading size="lg" textAlign="center" mb="4">
        Sign Up
      </Heading>
      <form onSubmit={handleSubmit}>
        <VStack spacing="4">
          <FormControl>
            <FormLabel>Name</FormLabel>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              w="full"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Username</FormLabel>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              w="full"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              w="full"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Re-enter Password</FormLabel>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              w="full"
            />
          </FormControl>

          {error && <Text color="red.500">{error}</Text>}

          <Button type="submit" colorScheme="blue" w="full">
            Sign Up
          </Button>
        </VStack>
      </form>
    </Box>
  );
};

const LogInForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

      const result = await response.text();

      if (response.ok) {
        alert(`Success: ${result}`);
        onLogin();
        navigate("/home");
      } else {
        alert(`User error: ${result}`);
      }
    } catch (error) {
      alert(`Server error: ${error.message}`);
    }
  };

  return (
    <Box maxW="400px" mx="auto" p="4" borderWidth="1px" borderRadius="md" boxShadow="lg">
      <Heading size="lg" textAlign="center" mb="4">
        Sign In
      </Heading>
      <form onSubmit={handleSubmit}>
        <VStack spacing="4">
          <FormControl>
            <FormLabel>Username</FormLabel>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              w="full"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              w="full"
            />
          </FormControl>

          <Button type="submit" colorScheme="blue" w="full">
            Sign In
          </Button>
        </VStack>
      </form>
    </Box>
  );
};

const AuthPage = ({ onLogin }) => {
  return (
    <Box textAlign="center" p="6">
      <Heading>Welcome to the AuthPage</Heading>
      <Box my="6">
        <Tabs mt="40px" h="20px" colorScheme="teal" variant="enclosed">
          <TabList>
            <Tab>Sign In</Tab>
            <Tab>Sign Up</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <LogInForm onLogin={onLogin} />
            </TabPanel>
            <TabPanel>
              <SignUpForm />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
};

export default AuthPage;

