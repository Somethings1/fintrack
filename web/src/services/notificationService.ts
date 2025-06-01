import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";
import { updateDB } from "@/utils/db";
import { getMessageApi } from "@/utils/messageProvider";
import { triggerRefresh } from "@/context/RefreshBus";

const NOTIFICATION_URL = "http://localhost:8080/api/notifications";
const NOTIFICATION_STORE = "notifications";

export const fetchNotifications = () => fetchStreamedEntities(NOTIFICATION_URL + "/get", NOTIFICATION_STORE);
export const getStoredNotifications = () => getStoredEntities(NOTIFICATION_STORE);
export const getNotificationById = (id: string) => getEntity(NOTIFICATION_STORE, id);
export const addNotification = (notification: any) => addEntity(NOTIFICATION_URL, NOTIFICATION_STORE, notification);
export const updateNotification = (id: string, data: any) => updateEntity(NOTIFICATION_URL, NOTIFICATION_STORE, id, data);
export const markAsRead = async (ids: string[], silent = false) => {
    if (!ids || ids.length === 0) return;

    const message = getMessageApi();

    try {
        const response = await fetch(`${NOTIFICATION_URL}/mark-read`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "clientId": localStorage.getItem("clientId") ?? "",
            },
            credentials: "include",
            body: JSON.stringify({ ids }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Mark as read failed:", errorData?.error);
            message.error("Cannot mark notification as read: Internal server error");
            return;
        }
        const updated: Notification[] = await Promise.all(
            ids.map(async (id) => {
                const notif = await getNotificationById(id);
                if (!notif) throw new Error(`Notification ${id} not found locally`);
                return { ...notif, read: true };
            })
        );

        await Promise.all(
            updated.map(async (notif) => {
                await updateDB(NOTIFICATION_STORE, notif);
            })
        );

        if (!silent)
            message.success(`${ids.length} notification${ids.length > 1 ? "s" : ""} marked as read.`);
        triggerRefresh();
    } catch (error) {
        console.error("Network or local error while marking notifications:", error);
        message.error("Failed to mark notifications as read");
    }
};

export const updateNotificationLocally = (id: string, notification: any) =>
    updateDB(NOTIFICATION_STORE, { ...notification, _id: id });

export const deleteNotifications = async (ids: string[]) => {
    await deleteEntities(NOTIFICATION_URL, NOTIFICATION_STORE, ids);
};
