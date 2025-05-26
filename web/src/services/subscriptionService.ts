import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";
import { updateDB } from "@/utils/db";

const SUBSCRIPTION_URL = "http://localhost:8080/api/subscriptions";
const SUBSCRIPTION_STORE = "subscriptions";

export const fetchSubscriptions = () => fetchStreamedEntities(SUBSCRIPTION_URL + "/get", SUBSCRIPTION_STORE);
export const getStoredSubscriptions = () => getStoredEntities(SUBSCRIPTION_STORE);
export const getSubscriptionById = (id: string) => getEntity(SUBSCRIPTION_STORE, id);
export const addSubscription = (subscription: any) => addEntity(SUBSCRIPTION_URL, SUBSCRIPTION_STORE, subscription);
export const updateSubscription = (id: string, data: any) => updateEntity(SUBSCRIPTION_URL, SUBSCRIPTION_STORE, id, data);
export const updateSubscriptionLocally = (id: string, subscription: any) =>
    updateDB(SUBSCRIPTION_STORE, { ...subscription, _id: id });

export const deleteSubscriptions = async (ids: string[]) => {
    await deleteEntities(SUBSCRIPTION_URL, SUBSCRIPTION_STORE, ids);
};
