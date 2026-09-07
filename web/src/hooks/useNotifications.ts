import { registerRefreshCallback,unregisterRefreshCallback } from '@/context/RefreshBus';
import type { Notification } from '@/models/Notification';
import { getStoredNotifications } from '@/services/notificationService';
import { useEffect,useState } from 'react';
export function useNotifications() {
    const [items, setItems] = useState<Notification[]>([]);
    useEffect(() => {
        let active = true;
        const refresh = () => { void getStoredNotifications().then(data => { if (active) setItems(data); }).catch(() => { if (active) setItems([]); }); };
        registerRefreshCallback('notifications', refresh); refresh();
        return () => { active = false; unregisterRefreshCallback('notifications', refresh); };
    }, []);
    return items;
}
