import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { RefreshProvider } from "./context/RefreshProvider";
import { message } from 'antd';
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UpdatePasswordPage from "./pages/UpdatePasswordPage";
import { getCurrentUser, supabase } from "@/services/authService"; // Import the API client
import { PollingProvider } from "./context/PollingProvider";
import { setMessageApi } from "./utils/messageProvider";
import './App.css';
import { ProfilePage } from "./pages/Profile";
import { SettingsProvider } from "./context/SettingsContext";


const PrivateRoute = ({ children }: { children: JSX.Element }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await getCurrentUser();

                if (user) {
                    localStorage.setItem("username", user.id);
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                }
            } catch {
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    if (isAuthenticated === null) return <p>Loading...</p>;
    return isAuthenticated ? children : <Navigate to="/login" />;
};

// App component which uses PrivateRoute and handles routes for the application
const App = () => {
    const [messageApi, contextHolder] = message.useMessage();

    useEffect(() => {
        setMessageApi(messageApi);
    }, [messageApi]);

    useEffect(() => {
        // On first load
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                document.cookie = `access_token=${session.access_token}; path=/; Secure; SameSite=Strict`;
            }
        });

        // On token change (login, refresh, logout, etc.)
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                document.cookie = `access_token=${session.access_token}; path=/; Secure; SameSite=Strict`;
            } else {
                // Clear cookie on logout
                document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            }
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);
    return (
        <>
            {contextHolder}
            <SettingsProvider>
                <RefreshProvider>
                    <Router>
                        <Routes>
                            <Route path="/" element={<WelcomePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                            <Route path="/update-password" element={<UpdatePasswordPage />} />

                            <Route path="/profile"
                                element={
                                    <PrivateRoute>
                                        <ProfilePage />
                                    </PrivateRoute>
                                } />
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
            </SettingsProvider>
        </>
    );
};

export default App;

