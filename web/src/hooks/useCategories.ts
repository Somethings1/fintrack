import { useEffect, useState } from "react";
import { Category } from "@/models/Category";
import { getStoredCategories } from "@/services/categoryService";
import { useRefresh } from "@/context/RefreshProvider";

let cachedCategories: Category[] = [];
const subscribers = new Set<(categories: Category[]) => void>();
let isInitialized = false;

async function refreshData() {
    const data = await getStoredCategories();
    cachedCategories = data;
    subscribers.forEach((callback) => callback(cachedCategories));
}

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>(cachedCategories);
    const { register, unregister } = useRefresh();

    useEffect(() => {
        subscribers.add(setCategories);

        const onRefresh = () => refreshData();

        register("categories", onRefresh);

        if (!isInitialized) {
            isInitialized = true;
            refreshData();
        }

        return () => {
            subscribers.delete(setCategories);
            unregister("categories", onRefresh);
        };
    }, []);

    return categories;
}

