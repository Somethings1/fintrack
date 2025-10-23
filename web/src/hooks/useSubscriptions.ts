import { useEffect, useState } from "react";
import { Subscription } from "@/models/Subscription";
import { getStoredSubscriptions } from "@/services/subscriptionService";
import { useRefresh } from "@/context/RefreshProvider";

let cachedSubscriptions: Subscription[] = [];
const subscribers = new Set<(subs: Subscription[]) => void>();
let isInitialized = false;

async function refreshData() {
    const data = await getStoredSubscriptions();
    cachedSubscriptions = data;
    subscribers.forEach((callback) => callback(cachedSubscriptions));
}

export function useSubscriptions() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>(cachedSubscriptions);
    const { register, unregister } = useRefresh();

    useEffect(() => {
        subscribers.add(setSubscriptions);

        const onRefresh = () => refreshData();

        register("subscriptions", onRefresh);

        if (!isInitialized) {
            isInitialized = true;
            refreshData();
        }

        return () => {
            subscribers.delete(setSubscriptions);
            unregister("subscriptions", onRefresh);
        };
    }, []);

    return subscriptions;
}

