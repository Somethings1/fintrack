import { triggerRefresh } from "@/context/RefreshBus";
import type { Notification } from "@/models/Notification";
import { updateDB } from "@/utils/db";
import { getMessageApi } from "@/utils/messageProvider";
import { apiFetch,requireSuccess } from "./apiClient";
import {
addEntity,
deleteEntities,
fetchStreamedEntities,
getEntity,
getStoredEntities,
updateEntity,
} from "./entityService";

const NOTIFICATION_URL = "/api/notifications";
const NOTIFICATION_STORE = "notifications";

export const fetchNotifications = () => fetchStreamedEntities(NOTIFICATION_URL + "/get-since/1970-01-01T00:00:00.000Z", NOTIFICATION_STORE);
export const getStoredNotifications = () => getStoredEntities<Notification>(NOTIFICATION_STORE);
export const getNotificationById = (id: string) => getEntity<Notification>(NOTIFICATION_STORE, id);
export const addNotification = (notification: Partial<Notification>) => addEntity(NOTIFICATION_URL, NOTIFICATION_STORE, notification);
export const updateNotification = (id: string, data: Partial<Notification>) => updateEntity(NOTIFICATION_URL, NOTIFICATION_STORE, id, data);
export const markAsRead = async (ids: string[], silent = false) => {
    if (!ids.length) return;
    try {
        for (let offset=0; offset<ids.length; offset+=100) {
            const batch=ids.slice(offset,offset+100);
            const response=await apiFetch(`${NOTIFICATION_URL}/mark-read`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ids:batch}) });
            await requireSuccess(response);
            for (const id of batch) { const item=await getNotificationById(id); if (item) await updateDB(NOTIFICATION_STORE,{...item,read:true}); }
        }
        if (!silent) getMessageApi().success('Notifications marked as read.');
    } finally { triggerRefresh(NOTIFICATION_STORE); triggerRefresh('sync'); }
};

export const updateNotificationLocally = (id: string, notification: Partial<Notification>) =>
    updateDB(NOTIFICATION_STORE, { ...notification, _id: id });

export const deleteNotifications = async (ids: string[]) => {
    await deleteEntities(NOTIFICATION_URL, NOTIFICATION_STORE, ids);
};
