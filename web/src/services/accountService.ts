import { getDB } from "@/utils/db";

const ACCOUNT_URL = "http://localhost:8080/api/accounts/get";
const ACCOUNT_STORE = "accounts";

export async function fetchAccounts() {
    const response = await fetch(ACCOUNT_URL, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to fetch accounts:", response.statusText);
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

    let accounts = jsonData
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            try {
                console.log(line);
                const acc = JSON.parse(line);
                if (acc.ID && !acc._id) {
                    acc._id = acc.ID;
                    delete acc.ID;
                }
                return acc;
            } catch (e) {
                console.error("Error parsing account JSON:", line, e);
                return null;
            }
        })
        .filter(acc => acc !== null);

    if (accounts.length === 0) {
        console.warn("No accounts received from backend.");
        return [];
    }

    try {
        const db = await getDB();
        const tx = db.transaction(ACCOUNT_STORE, "readwrite");
        const store = tx.objectStore(ACCOUNT_STORE);

        accounts.forEach(acc => {
            store.put(acc);
        });

        await tx.done;
    } catch (error) {
        console.error("Error storing accounts in IndexedDB:", error);
    }

    return accounts;
}

export async function getStoredAccounts() {
    try {
        const db = await getDB();
        const accounts = await db.getAll(ACCOUNT_STORE);
        return accounts;
    } catch (error) {
        console.error("Error retrieving accounts from IndexedDB:", error);
        return [];
    }
}

