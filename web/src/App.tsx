import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { RefreshProvider } from "./context/RefreshProvider";
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import api from "@/services/authService"; // Import the API client
import { useAuthRefresh } from "./hooks/useAuthRefresh";
import { PollingProvider } from "./context/PollingProvider";

(() => {
    if (import.meta.env.DEV) {
        // 1. Clear localStorage
        localStorage.clear();

        // 2. Clear sessionStorage
        sessionStorage.clear();

        // 3. Clear IndexedDB
        indexedDB.databases().then((dbs) => {
            for (const db of dbs) {
                if (db.name) indexedDB.deleteDatabase(db.name);
            }
        });

        // 4. Optional: Clear cookies (only works for non-HttpOnly cookies)
        document.cookie.split(";").forEach((cookie) => {
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.slice(0, eqPos) : cookie;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
    }
})();


// PrivateRoute component for checking authentication and storing username in localStorage
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await api.post("/verify");

                // Save the username to localStorage
                if (response.data && response.data.username) {
                    localStorage.setItem("username", response.data.username);
                }

                setIsAuthenticated(true);

            } catch {
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    if (isAuthenticated === null) return <p>Loading...</p>; // Show a loading state while checking auth
    return isAuthenticated ? children : <Navigate to="/login" />;
};

// App component which uses PrivateRoute and handles routes for the application
const App = () => {
    useAuthRefresh();
    return (
        <RefreshProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<WelcomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/home"
                        element={
                            <PrivateRoute>
                                <PollingProvider>
                                    <HomePage />
                                </PollingProvider>
                            </PrivateRoute>
                        } />
                </Routes>
            </Router>
        </RefreshProvider>
    );
};

export default App;

