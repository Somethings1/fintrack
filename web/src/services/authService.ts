import axios from "axios";

const API_URL = "http://localhost:8080/auth";

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Send cookies with every request
});

// Queued refresh handling to prevent multiple simultaneous requests
let isRefreshing = false;
let refreshSubscribers: (() => void)[] = [];

const subscribeTokenRefresh = (callback: () => void) => {
    refreshSubscribers.push(callback);
};

const onTokenRefreshed = () => {
    refreshSubscribers.forEach((callback) => callback());
    refreshSubscribers = [];
};

// Function to refresh access token
const refreshAccessToken = async () => {
    try {
        await axios.post(`${API_URL}/refresh`, {}, { withCredentials: true });
        onTokenRefreshed();
    } catch (error) {
        console.error("Session expired, logging out user");
        window.location.href = "/login";
        throw error;
    }
};

// Sign in function (cookies store tokens automatically)
export const signIn = async (email: string, password: string) => {
    const response = await api.post("/signin", { username: email, password });
    return response.data; // No need to handle tokens manually
};

export const signUp = async (name: string, email: string, password: string) => {
    console.log("Sending signup request:", { name, username: email, password }); // Debug

    const response = await api.post("/signup", { name, username: email, password });
    return response.data; // No need to handle tokens manually
};

// Logout function
export const logout = async () => {
    try {
        const response = await api.post("/logout");
        if (!response.status.toString().startsWith("2")) {
            throw new Error("Failed to logout");
        }

        // Clear cookies
        document.cookie.split(";").forEach((cookie) => {
            const cookieName = cookie.split("=")[0].trim();
            document.cookie = `${cookieName}=;expires=${new Date(0).toUTCString()};path=/`;
        });

        // Clear localStorage
        localStorage.clear();

        // Clear sessionStorage
        sessionStorage.clear();

        // Clear IndexedDB (specifically the FinanceTracker database)
        const request = indexedDB.deleteDatabase("FinanceTracker");

        request.onsuccess = () => {
            console.log("Successfully deleted FinanceTracker database from IndexedDB");
        };

        request.onerror = (event) => {
            console.error("Error deleting FinanceTracker database:", event);
        };

    } catch (error) {
        console.error("Logout error:", error);
    }
};

// Auto-refresh expired tokens
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve) => {
                    subscribeTokenRefresh(() => {
                        resolve(axios(originalRequest));
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await refreshAccessToken();
                return axios(originalRequest);
            } catch (err) {
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// Fetch user data (no need to manually include tokens)
export const fetchUserData = async () => {
    return api.post("/verify");
};

export default api;

