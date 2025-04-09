import React, { createContext, useContext } from "react";
import { usePolling } from "@/hooks/usePolling";

type PollingContextType = {
    [key: string]: number; // e.g., transactions -> timestamp
};

const PollingContext = createContext<PollingContextType>({});

const POLLING_KEYS = ["transactions", "accounts", "savings", "categories"];

export const PollingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const pollingValues = POLLING_KEYS.reduce((acc, key) => {
        acc[key] = usePolling(60000, key, key); // 10s per type
        return acc;
    }, {} as PollingContextType);

    return (
        <PollingContext.Provider value={pollingValues}>
            {children}
        </PollingContext.Provider>
    );
};

export const usePollingContext = () => useContext(PollingContext);

