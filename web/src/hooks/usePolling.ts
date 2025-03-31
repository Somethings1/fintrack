import { useState, useEffect } from "react";
import { saveToDB } from "@/utils/db";

export function usePolling(interval: number, storeName: string, endpoint: string) {
    const [lastSync, setLastSync] = useState(
        localStorage.getItem("lastSync") || new Date(0).toISOString()
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`http://localhost:8080/api/${endpoint}/get-since/${lastSync}`, {
                    method: "GET",
                    credentials: "include",
                });
                if (!res.ok) return;

                const reader = res.body?.getReader();
                if (!reader) {
                    console.error("Failed to get reader from response.");
                    return;
                }

                const decoder = new TextDecoder();
                let jsonData = "";
                let latestTimestamp = lastSync; // Keep track of last sync
                console.log("Hehe");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    jsonData += decoder.decode(value, { stream: true });

                    const newEntries = jsonData
                        .split("\n")
                        .filter(line => line.trim() !== "")
                        .map(line => {
                            try {
                                return JSON.parse(line);
                            } catch (e) {
                                console.error("Error parsing streamed JSON:", line, e);
                                return null;
                            }
                        })
                        .filter(entry => entry !== null);

                    console.log(newEntries.length);
                    if (newEntries.length > 0) {
                        await saveToDB(storeName, newEntries);

                        latestTimestamp = new Date().toISOString();
                    }
                }

                setLastSync(latestTimestamp);
                localStorage.setItem("lastSync", latestTimestamp);
            } catch (error) {
                console.error("Polling error:", error);
            }
        };

        fetchData(); // Initial fetch
        const intervalId = setInterval(fetchData, interval);

        return () => clearInterval(intervalId);
    }, [interval, storeName, endpoint]);

    return lastSync;
}

