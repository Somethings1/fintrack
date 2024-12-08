import React, { useState, useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Function to check if the access token is still valid
  const verifyAuthentication = async () => {
    try {
      const response = await fetch('/api/verify', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error verifying authentication:', error);
      setIsAuthenticated(false);
    }
  };

  // Function to refresh the access token if expired
  const refreshToken = async () => {
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        credentials: 'include', // Include cookies (such as refresh token)
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      setIsAuthenticated(false);
    }
  };

  // Run token verification and refresh logic on initial load
  useEffect(() => {
    // Check if user is authenticated when the component mounts
    verifyAuthentication();

    // Optionally: Periodically refresh the token (e.g., every 10 minutes)
    const interval = setInterval(refreshToken, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval); // Cleanup on component unmount
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false); // Update state to reflect logged out status
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={isAuthenticated ? <HomePage onLogout={handleLogout} /> : <WelcomePage />}
        />
        <Route
          path="/auth"
          element={<AuthPage onLogin={() => setIsAuthenticated(true)} />}
        />
        <Route
          path="/home"
          element={isAuthenticated ? <HomePage onLogout={handleLogout} /> : <Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
