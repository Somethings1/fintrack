import { useEffect, useState } from "react";
import { Notification } from "@/models/Notification";
import { getStoredNotifications } from "@/services/notificationService";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    async function fetchNotifications() {
      const all = await getStoredNotifications();
      setNotifications(all);
    }
    fetchNotifications();
  }, []);

  return notifications;
}

