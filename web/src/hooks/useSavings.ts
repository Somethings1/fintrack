import { useEffect, useState } from "react";
import { Saving } from "@/models/Saving";
import { getStoredSavings } from "@/services/savingService";
import { useRefresh } from "@/context/RefreshProvider";

let cachedSavings: Saving[] = [];
const subscribers = new Set<(savings: Saving[]) => void>();
let isInitialized = false;

async function refreshData() {
    const data = await getStoredSavings();
    cachedSavings = data;
    subscribers.forEach((callback) => callback(cachedSavings));
}

export function useSavings() {
    const [savings, setSavings] = useState<Saving[]>(cachedSavings);
    const { register, unregister } = useRefresh();

    useEffect(() => {
        subscribers.add(setSavings);

        const onRefresh = () => refreshData();

        register("savings", onRefresh);

        if (!isInitialized) {
            isInitialized = true;
            refreshData();
        }

        return () => {
            subscribers.delete(setSavings);
            unregister("savings", onRefresh);
        };
    }, []);

    return savings;
}

