import { useEffect, useState } from "react";
import { Notification } from "@/models/Notification";
import { getStoredNotifications } from "@/services/notificationService";
import { useRefresh } from "../context/RefreshProvider";

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const refreshToken = useRefresh();

    useEffect(() => {
        async function fetchNotifications() {
            const all = await getStoredNotifications();
            setNotifications(all);
        }
        fetchNotifications();
    }, [refreshToken]);

    return notifications;
}

