import axios from "axios";

const API_URL = "http://localhost:8080/auth";

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

export const signIn = async (email: string, password: string) => {
    console.log("Sending login request:", { username: email, password }); // Debug

    const response = await axios.post(
        "http://localhost:8080/auth/signin",
        { username: email, password },
        {
            headers: {
                "Content-Type": "application/json",
            },
            withCredentials: true,
        }
    );

    return response.data;
};

export const logout = async () => {
    try {
        const response = await fetch("http://localhost:8080/auth/logout", {
            method: "POST",
            credentials: "include", // Ensure cookies are included
        });

        if (!response.ok) {
            throw new Error("Failed to logout");
        }
    } catch (error) {
        console.error("Logout error:", error);
    }
};


export const refreshAccessToken = async () => {
    const response = await axios.post(`${API_URL}/refresh`, {}, { withCredentials: true });
    return response.data;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            try {
                const refreshResponse = await refreshAccessToken();
                localStorage.setItem("accessToken", refreshResponse.accessToken);
                error.config.headers["Authorization"] = `Bearer ${refreshResponse.accessToken}`;
                return axios(error.config);
            } catch (refreshError) {
                localStorage.removeItem("accessToken");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export const fetchUserData = async () => {
    const token = localStorage.getItem("accessToken");
    return api.get("/verify", { headers: { Authorization: `Bearer ${token}` } });
};

export default api;

