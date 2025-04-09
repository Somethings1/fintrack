import { getDB, saveToDB, updateDB, deleteFromDB } from "@/utils/db";

export async function fetchStreamedEntities<T>(url: string, store: string) {
    const response = await fetch(url, { method: "GET", credentials: "include" });

    if (!response.ok) {
        console.error(`Failed to fetch from ${url}:`, response.statusText);
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
        await saveToDB(store, items);
    }
}

export async function getStoredEntities<T>(store: string): Promise<T[]> {
    try {
        const db = await getDB();
        const all = await db.getAll(store);
        return all.filter((item: any) => item.isDeleted !== true);
    } catch (error) {
        console.error(`Error reading from store ${store}:`, error);
        return [];
    }
}

export async function getEntity<T>(store: string, id: string): Promise<T | null> {
    try {
        const db = await getDB();
        return await db.get(store, id);
    } catch (error) {
        console.error(`Error reading ${id} from store ${store}:`, error);
        return null;
    }
}

export async function addEntity<T extends { _id?: string }>(url: string, store: string, entity: T) {
    const response = await fetch(url + "/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entity),
        credentials: "include",
    });

    if (!response.ok) {
        console.error(`Failed to add entity to ${url}:`, response.statusText);
        return;
    }

    const result = await response.json();
    entity._id = result.id;
    await saveToDB(store, [entity]);
}

export async function updateEntity<T>(url: string, store: string, id: string, updated: T) {
    const response = await fetch(`${url}/update/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
        credentials: "include",
    });

    if (!response.ok) {
        console.error(`Failed to update entity ${id} at ${url}:`, response.statusText);
        return;
    }

    await updateDB(store, updated);
}

export async function deleteEntities(url: string, store: string, ids: string[]) {
    await Promise.all(ids.map(async (id) => {
        const res = await fetch(`${url}/delete/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        if (!res.ok) console.error(`Failed to delete ${id} from ${url}:`, res.statusText);
    }));

    await Promise.all(ids.map(id => deleteFromDB(store, id)));
}

