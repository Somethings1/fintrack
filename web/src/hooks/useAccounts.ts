import { registerRefreshCallback,unregisterRefreshCallback } from '@/context/RefreshBus';
import type { Account } from '@/models/Account';
import { getStoredAccounts } from '@/services/accountService';
import { useEffect,useState } from 'react';
export function useAccounts() {
    const [items, setItems] = useState<Account[]>([]);
    useEffect(() => {
        let active = true;
        const refresh = () => { void getStoredAccounts().then(data => { if (active) setItems(data); }).catch(() => { if (active) setItems([]); }); };
        registerRefreshCallback('accounts', refresh); refresh();
        return () => { active = false; unregisterRefreshCallback('accounts', refresh); };
    }, []);
    return items;
}
