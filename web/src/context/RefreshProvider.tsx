import { createContext, useContext } from "react";
import { registerRefreshCallback, triggerRefresh, unregisterRefreshCallback } from "./RefreshBus";

const RefreshContext = createContext({
  register: (topic: string, cb: () => void) => {},
  unregister: (topic: string, cb: () => void) => {},
  trigger: (topic: string) => {},
});

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RefreshContext.Provider
      value={{
        register: registerRefreshCallback,
        unregister: unregisterRefreshCallback,
        trigger: triggerRefresh,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => useContext(RefreshContext);

