import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";
import { updateDB } from "@/utils/db";
import {Notification} from "@/models/Notification"

const NOTIFICATION_URL = "http://localhost:8080/api/notifications";
const NOTIFICATION_STORE = "notifications";

export const fetchNotifications = () => fetchStreamedEntities(NOTIFICATION_URL + "/get", NOTIFICATION_STORE);
export const getStoredNotifications = () => getStoredEntities(NOTIFICATION_STORE);
export const getNotificationById = (id: string) => getEntity(NOTIFICATION_STORE, id);
export const addNotification = (notification: any) => addEntity(NOTIFICATION_URL, NOTIFICATION_STORE, notification);
export const updateNotification = (id: string, data: any) => updateEntity(NOTIFICATION_URL, NOTIFICATION_STORE, id, data);
export const markAsRead = async (id: string) => {
    let notif: Notification = await getNotificationById(id);
    notif.read = true;

    updateNotification(id, notif);
}
export const updateNotificationLocally = (id: string, notification: any) =>
    updateDB(NOTIFICATION_STORE, { ...notification, _id: id });

export const deleteNotifications = async (ids: string[]) => {
    await deleteEntities(NOTIFICATION_URL, NOTIFICATION_STORE, ids);
};
