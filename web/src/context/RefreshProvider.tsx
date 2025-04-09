import React, { createContext, useContext, useState } from "react";

const RefreshContext = createContext({
    refreshToken: 0,
    triggerRefresh: () => {},
});

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [refreshToken, setRefreshToken] = useState(0);

    const triggerRefresh = () => setRefreshToken((prev) => prev + 1);

    return (
        <RefreshContext.Provider value={{ refreshToken, triggerRefresh }}>
            {children}
        </RefreshContext.Provider>
    );
};

export const useRefresh = () => useContext(RefreshContext);

