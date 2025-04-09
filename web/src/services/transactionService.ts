import { getDB, saveToDB, updateDB, deleteFromDB } from "@/utils/db";

const TRANSACTION_URL = "http://localhost:8080/api/transactions";
const TRANSACTION_STORE = "transactions";

/**
* Fetches transactions
* */
export async function fetchTransactions(year: number) {
    const response = await fetch(TRANSACTION_URL + "/get/" + year, {
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

    if (transactions.length === 0) {
        console.warn("No transactions received from backend.");
        return [];
    }

    saveToDB(TRANSACTION_STORE, transactions);
}

export async function getStoredTransactions() {
    try {
        const db = await getDB();
        const transactions = await db.getAll(TRANSACTION_STORE);
        return transactions.filter(txn => txn.isDeleted !== true); // ← exclude deleted on read too
    } catch (error) {
        console.error("Error retrieving transactions from IndexedDB:", error);
        return [];
    }
}

/**
 * Adds a transaction to both the backend and IndexedDB.
 */
export async function addTransaction(transaction: any) {
    // 1. Add to the backend (API)
    const response = await fetch(TRANSACTION_URL + "/add", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(transaction),
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to add transaction to backend:", response.statusText);
        return;
    }

    const result = await response.json()
    transaction._id = result.id;

    // 2. Add to IndexedDB
    await saveToDB(TRANSACTION_STORE, [transaction]);

    console.log("Transaction added successfully!");
}

/**
 * Updates a transaction in both the backend and IndexedDB.
 */
export async function updateTransaction(transactionId: string, updatedTransaction: any) {
    // 1. Update in the backend (API)
    const response = await fetch(`${TRANSACTION_URL}/update/${transactionId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedTransaction),
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to update transaction in backend:", response.statusText);
        return;
    }

    // 2. Update in IndexedDB
    await updateDB(TRANSACTION_STORE, updatedTransaction);

    console.log("Transaction updated successfully!");
}

/**
 * Deletes multiple transactions from both the backend and IndexedDB.
 */
export async function deleteTransactions(transactionIds: string[]) {
    const deletePromises = transactionIds.map(async (id) => {
        const response = await fetch(`${TRANSACTION_URL}/delete/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        if (!response.ok) {
            console.error(`Failed to delete transaction ${id} from backend:`, response.statusText);
        }
    });

    // Wait for all the delete operations to finish
    await Promise.all(deletePromises);

    // 2. Delete from IndexedDB
    await Promise.all(transactionIds.map(id => deleteFromDB(TRANSACTION_STORE, id)));

    console.log("Transactions deleted successfully!");
}

