import { getDB } from "@/utils/db";

const SAVING_URL = "http://localhost:8080/api/savings/get";
const SAVING_STORE = "savings";

export async function fetchSavings() {
    const response = await fetch(SAVING_URL, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to fetch savings:", response.statusText);
        return [];
    }

    const reader = response.body?.getReader();
    if (!reader) {
        console.error("Failed to get reader from response.");
        return [];
    }

    const decoder = new TextDecoder();
    let jsonData = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        jsonData += decoder.decode(value, { stream: true });
    }

    let savings = jsonData
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            try {
                const save = JSON.parse(line);
                if (save.ID && !save._id) {
                    save._id = save.ID;
                    delete save.ID;
                }
                return save;
            } catch (e) {
                console.error("Error parsing saving JSON:", line, e);
                return null;
            }
        })
        .filter(save => save !== null);

    if (savings.length === 0) {
        console.warn("No savings received from backend.");
        return [];
    }

    try {
        const db = await getDB();
        const tx = db.transaction(SAVING_STORE, "readwrite");
        const store = tx.objectStore(SAVING_STORE);

        savings.forEach(save => {
            store.put(save);
        });

        await tx.done;
    } catch (error) {
        console.error("Error storing savings in IndexedDB:", error);
    }

    return savings;
}

export async function getStoredSavings() {
    try {
        const db = await getDB();
        const savings = await db.getAll(SAVING_STORE);
        return savings;
    } catch (error) {
        console.error("Error retrieving savings from IndexedDB:", error);
        return [];
    }
}

