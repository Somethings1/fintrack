import { createContext,useContext } from 'react';
import { registerRefreshCallback,triggerRefresh,unregisterRefreshCallback } from './RefreshBus';
export const refreshActions = { register: registerRefreshCallback, unregister: unregisterRefreshCallback, trigger: triggerRefresh };
export const RefreshContext = createContext(refreshActions);
export const useRefresh = () => useContext(RefreshContext);
