import React, { createContext, useContext, useEffect, useState } from "react";
import { registerRefreshCallback } from "./RefreshBus";

const RefreshContext = createContext({
    refreshToken: 0,
    triggerRefresh: () => {},
});

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [refreshToken, setRefreshToken] = useState(0);

    const triggerRefresh = () => {
        setRefreshToken((prev) => prev + 1);
    }

    useEffect(() => {
        registerRefreshCallback(triggerRefresh);
    }, []);

    return (
        <RefreshContext.Provider value={{ refreshToken, triggerRefresh }}>
            {children}
        </RefreshContext.Provider>
    );
};

export const useRefresh = () => useContext(RefreshContext);

