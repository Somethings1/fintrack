import type { ReactNode } from 'react';
import { RefreshContext,refreshActions } from './refresh-context';
export function RefreshProvider({ children }: { children: ReactNode }) {
    return <RefreshContext.Provider value={refreshActions}>{children}</RefreshContext.Provider>;
}
