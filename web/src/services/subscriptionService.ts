import type { Subscription } from "@/models/Subscription";
import { updateDB } from "@/utils/db";
import {
addEntity,
deleteEntities,
fetchStreamedEntities,
getEntity,
getStoredEntities,
updateEntity,
} from "./entityService";

const SUBSCRIPTION_URL = "/api/subscriptions";
const SUBSCRIPTION_STORE = "subscriptions";

export const fetchSubscriptions = () => fetchStreamedEntities(SUBSCRIPTION_URL + "/get-since/1970-01-01T00:00:00.000Z", SUBSCRIPTION_STORE);
export const getStoredSubscriptions = () => getStoredEntities<Subscription>(SUBSCRIPTION_STORE);
export const getSubscriptionById = (id: string) => getEntity<Subscription>(SUBSCRIPTION_STORE, id);
export const addSubscription = (subscription: Partial<Subscription>) => addEntity(SUBSCRIPTION_URL, SUBSCRIPTION_STORE, subscription);
export const updateSubscription = (id: string, data: Partial<Subscription>) => updateEntity(SUBSCRIPTION_URL, SUBSCRIPTION_STORE, id, data);
export const updateSubscriptionLocally = (id: string, subscription: Partial<Subscription>) =>
    updateDB(SUBSCRIPTION_STORE, { ...subscription, _id: id });

export const deleteSubscriptions = async (ids: string[]) => {
    await deleteEntities(SUBSCRIPTION_URL, SUBSCRIPTION_STORE, ids);
};
