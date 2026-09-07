import { registerRefreshCallback,unregisterRefreshCallback } from '@/context/RefreshBus';
import type { Subscription } from '@/models/Subscription';
import { getStoredSubscriptions } from '@/services/subscriptionService';
import { useEffect,useState } from 'react';
export function useSubscriptions() {
    const [items, setItems] = useState<Subscription[]>([]);
    useEffect(() => {
        let active = true;
        const refresh = () => { void getStoredSubscriptions().then(data => { if (active) setItems(data); }).catch(() => { if (active) setItems([]); }); };
        registerRefreshCallback('subscriptions', refresh); refresh();
        return () => { active = false; unregisterRefreshCallback('subscriptions', refresh); };
    }, []);
    return items;
}
