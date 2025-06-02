import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { saveToDB } from "@/utils/db";
import { socketService } from "@/services/socketService";
import { triggerRefresh } from "@/context/RefreshBus";

type LastSyncMap = Record<string, string>;

const POLLING_KEYS = ["transactions", "accounts", "savings", "categories", "subscriptions", "notifications"];

type PollingContextType = {
    lastSyncMap: LastSyncMap;
};

const PollingContext = createContext<PollingContextType>({ lastSyncMap: {} });

async function fetchCollection(
    collection: string,
    lastSync: string,
    updateLastSync: (collection: string, timestamp: string) => void
) {
    try {
        const res = await fetch(`http://localhost:8080/api/${collection}/get-since/${lastSync}`, {
            method: "GET",
            credentials: "include",
        });
        if (!res.ok) return;

        const reader = res.body?.getReader();
        if (!reader) {
            console.error(`Failed to get reader for collection ${collection}`);
            return;
        }

        const decoder = new TextDecoder();
        let jsonData = "";
        let latestTimestamp = lastSync;
        const entriesToSave: any[] = [];

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

            for (const entry of newEntries) {
                if (entry.lastUpdate && entry.lastUpdate > latestTimestamp) {
                    latestTimestamp = entry.lastUpdate;
                }
                entriesToSave.push(entry);
            }

            jsonData = "";
        }

        if (entriesToSave.length > 0) {
            await saveToDB(collection, entriesToSave);
            updateLastSync(collection, latestTimestamp);
        }
    } catch (error) {
        console.error(`Polling error for collection ${collection}:`, error);
    }
}

export const PollingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lastSyncMap, setLastSyncMap] = useState<LastSyncMap>(() => {
        const map: LastSyncMap = {};
        POLLING_KEYS.forEach(key => {
            map[key] = localStorage.getItem(`lastSync_${key}`) || new Date(0).toISOString();
        });
        return map;
    });

    const updateLastSync = (collection: string, timestamp: string) => {
        setLastSyncMap(prev => {
            if (prev[collection] >= timestamp) return prev;
            const newMap = { ...prev, [collection]: timestamp };
            localStorage.setItem(`lastSync_${collection}`, timestamp);
            return newMap;
        });
        triggerRefresh(collection);
    };

    const lastSyncMapRef = React.useRef(lastSyncMap);
    useEffect(() => {
        lastSyncMapRef.current = lastSyncMap;
    }, [lastSyncMap]);

    const fetchCollectionCb = useCallback(
        (collection: string) => fetchCollection(collection, lastSyncMapRef.current[collection], updateLastSync),
        [updateLastSync]
    );


    useEffect(() => {
        POLLING_KEYS.forEach(fetchCollectionCb);
    }, []);


    useEffect(() => {
        socketService.start();

        const unsubscribe = socketService.subscribe(({ collection, action, detail }) => {
            if (action === "reconnect") {
                POLLING_KEYS.forEach(fetchCollectionCb);
            } else if (POLLING_KEYS.includes(collection)) {
                fetchCollection(collection, lastSyncMap[collection], updateLastSync)
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <PollingContext.Provider value={{ lastSyncMap }}>
            {children}
        </PollingContext.Provider>
    );
};

export const usePollingContext = () => useContext(PollingContext);

