import { getDB, saveToDB, updateDB, deleteFromDB } from "@/utils/db";
import { getMessageApi } from "../utils/messageProvider";

const getName = (store: string) => {
    if (store === "categories") return "category";
    return store.slice(0, -1);
}

export async function fetchStreamedEntities<T>(url: string, store: string) {
    const response = await fetch(url,
        {
            method: "GET",
            credentials: "include",
            headers: {
                'clientId': localStorage.getItem("clientId") ?? "",
            }
        });
    const message = getMessageApi();

    if (!response.ok) {
        console.error(`Failed to fetch from ${url}:`, response.statusText);
        if (response.status === 500)
            message.error("The server is not available right now. Please wait a few minutes and try again.");
        else if (response.status === 401)
            message.error("Please try again in a few minutes. If the problem persists, sign out then sign in again");
        else
            message.error("Unexpected error. Contact our customer service for mor information");
        return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
        console.error(`No reader available for ${url}`);
        return;
    }

    const decoder = new TextDecoder();
    let jsonData = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        jsonData += decoder.decode(value, { stream: true });
    }

    const items: T[] = jsonData
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                console.error(`Failed to parse JSON line:`, line, e);
                return null;
            }
        })
        .filter(Boolean);

    if (items.length > 0) {
        try {
            await saveToDB(store, items);
        }
        catch (error: any) {
            message.error(error.message);
        }
    }
}

export async function getStoredEntities<T>(store: string): Promise<T[]> {
    const message = getMessageApi();
    try {
        const db = await getDB();
        const all = await db.getAll(store);
        return all.filter((item: any) => item.isDeleted !== true);
    } catch (error) {
        console.error(`Error reading from store ${store}:`, error);
        message.error("Caching error. Please contact our customer service");
        return [];
    }
}

export async function getEntity<T>(store: string, id: string): Promise<T | null> {
    const message = getMessageApi();
    try {
        const db = await getDB();
        return await db.get(store, id);
    } catch (error) {
        console.error(`Error reading ${id} from store ${store}:`, error);
        message.error("Caching error. Please contact our customer service");
        return null;
    }
}

export async function addEntity<T extends { _id?: string }>(url: string, store: string, entity: T) {
    const message = getMessageApi();
    const response = await fetch(url + "/add", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "clientId": localStorage.getItem("clientId") ?? ""
        },
        body: JSON.stringify(entity),
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to add new " + store + ": " + response.statusText)
        if (response.status === 500)
            message.error("Failed to add new " + getName(store) + " because the server is unreachable right now. Please try again in a few minutes.");
        else if (response.status === 401)
            message.error("Failed to add new " + getName(store) + ". Please try again in a few minutes.");
        return;
    }

    const result = await response.json();
    entity._id = result.id;

    try {
        await saveToDB(store, [entity]);
        message.success("New " + getName(store) + " added successfully.");
    }
    catch (error: any) {
        message.error(error.message);
    }
}

export async function updateEntity<T>(url: string, store: string, id: string, updated: T) {
    const message = getMessageApi();
    const response = await fetch(`${url}/update/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "clientId": localStorage.getItem("clientId") ?? "",
        },
        body: JSON.stringify(updated),
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to edit " + store + ": " + response.statusText)
        if (response.status === 500)
            message.error("Failed to edit " + getName(store) + " because the server is unreachable right now. Please try again in a few minutes.");
        else if (response.status === 401)
            message.error("Failed to edit " + getName(store) + ". Please try again in a few minutes.");
        return;
    }

    try {
        await updateDB(store, updated);
        message.success("The " + getName(store) + " was updated successfully.");
    }
    catch (error: any) {
        message.error(error.message);
    }
}

export async function deleteEntities(url: string, store: string, ids: string[]) {
    const message = getMessageApi();
    await Promise.all(ids.map(async (id) => {
        const res = await fetch(`${url}/delete/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "clientId": localStorage.getItem("clientId") ?? "",
            },
            credentials: "include",
        });

        if (!res.ok) {
            console.error(`Failed to delete ${id} from ${url}:`, res.statusText);
            if (res.status === 500)
                message.error("Failed to delete " + getName(store) + " because the server is unreachable right now. Please try again in a few minutes")
            else if (res.status === 401)
                message.error("Failed to delete " + getName(store) + ". Please try again in a few minutes")
        }
    }));

    try {
        await Promise.all(ids.map(id => deleteFromDB(store, id)));
        message.success("Successfully deleted " + ids.length + " " + (ids.length > 1 ? store : getName(store)));
    }
    catch (error: any) {
        message.error(error.message);
    }
}

