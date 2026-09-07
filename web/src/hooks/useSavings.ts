import { registerRefreshCallback,unregisterRefreshCallback } from '@/context/RefreshBus';
import type { Saving } from '@/models/Saving';
import { getStoredSavings } from '@/services/savingService';
import { useEffect,useState } from 'react';
export function useSavings() {
    const [items, setItems] = useState<Saving[]>([]);
    useEffect(() => {
        let active = true;
        const refresh = () => { void getStoredSavings().then(data => { if (active) setItems(data); }).catch(() => { if (active) setItems([]); }); };
        registerRefreshCallback('savings', refresh); refresh();
        return () => { active = false; unregisterRefreshCallback('savings', refresh); };
    }, []);
    return items;
}
