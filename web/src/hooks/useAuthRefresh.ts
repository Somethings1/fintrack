import { useEffect } from "react";

export const useAuthRefresh = (intervalMs = 10 * 60 * 1000) => {
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch("http://localhost:8080/auth/refresh", {
                    method: "POST",
                    credentials: "include", // assumes token is in HttpOnly cookie
                });

                if (!res.ok) {
                    console.warn("Token refresh failed");
                } else {
                    console.log("Access token refreshed");
                }
            } catch (err) {
                console.error("Error during token refresh:", err);
            }
        }, intervalMs);

        return () => clearInterval(interval); // cleanup
    }, [intervalMs]);
};

