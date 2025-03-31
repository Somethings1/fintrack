import { getDB, saveToDB } from "@/utils/db";

const TRANSACTION_URL = "http://localhost:8080/api/transactions/get/";
const TRANSACTION_STORE = "transactions";

export async function fetchTransactions(year: number) {
    const response = await fetch(TRANSACTION_URL + year, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to fetch transactions:", response.statusText);
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

    let transactions = jsonData
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            try {
                const txn = JSON.parse(line);
                return txn;
            } catch (e) {
                console.error("Error parsing transaction JSON:", line, e);
                return null;
            }
        })
        .filter(txn => txn !== null);

    saveToDB(TRANSACTION_STORE, transactions);

    if (transactions.length === 0) {
        console.warn("No transactions received from backend.");
        return [];
    }


    return transactions;
}

export async function getStoredTransactions() {
    try {
        const db = await getDB();
        const transactions = await db.getAll(TRANSACTION_STORE);
        return transactions;
    } catch (error) {
        console.error("Error retrieving transactions from IndexedDB:", error);
        return [];
    }
}

