import { useEffect, useState } from "react";
import { Notification } from "@/models/Notification";
import { getStoredNotifications } from "@/services/notificationService";
import { useRefresh } from "@/context/RefreshProvider";

let cachedNotifications: Notification[] = [];
const subscribers = new Set<(notifications: Notification[]) => void>();
let isInitialized = false;

async function refreshData() {
    const data = await getStoredNotifications();
    cachedNotifications = data;
    subscribers.forEach((callback) => callback(cachedNotifications));
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>(cachedNotifications);
    const { register, unregister } = useRefresh();

    useEffect(() => {
        subscribers.add(setNotifications);

        const onRefresh = () => refreshData();

        register("notifications", onRefresh);

        if (!isInitialized) {
            isInitialized = true;
            refreshData();
        }

        return () => {
            subscribers.delete(setNotifications);
            unregister("notifications", onRefresh);
        };
    }, []);

    return notifications;
}

