import React, { createContext, useContext, useMemo } from "react";
import { usePolling } from "@/hooks/usePolling";

type PollingContextType = {
  [key: string]: number;
};

const PollingContext = createContext<PollingContextType>({});

const POLLING_KEYS = ["transactions", "accounts", "savings", "categories", "subscriptions"];

export const PollingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const values = POLLING_KEYS.reduce((acc, key) => {
    acc[key] = usePolling(60000, key, key);
    return acc;
  }, {} as PollingContextType);

  const pollingValues = useMemo(() => values, [...Object.values(values)]); // optional

  return (
    <PollingContext.Provider value={pollingValues}>
      {children}
    </PollingContext.Provider>
  );
};

export const usePollingContext = () => useContext(PollingContext);

