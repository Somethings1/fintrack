import { registerRefreshCallback,unregisterRefreshCallback } from '@/context/RefreshBus';
import type { Category } from '@/models/Category';
import { getStoredCategories } from '@/services/categoryService';
import { useEffect,useState } from 'react';
export function useCategories() {
    const [items, setItems] = useState<Category[]>([]);
    useEffect(() => {
        let active = true;
        const refresh = () => { void getStoredCategories().then(data => { if (active) setItems(data); }).catch(() => { if (active) setItems([]); }); };
        registerRefreshCallback('categories', refresh); refresh();
        return () => { active = false; unregisterRefreshCallback('categories', refresh); };
    }, []);
    return items;
}
