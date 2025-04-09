import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";

import {
    getAccountById,
    updateAccount,
} from "./accountService";

import {
    getSavingById,
    updateSaving,
} from "./savingService";

const TRANSACTION_URL = "http://localhost:8080/api/transactions";
const TRANSACTION_STORE = "transactions";

function getAmount(transaction: any): number {
    return typeof transaction.amount === "number"
        ? transaction.amount
        : parseFloat(transaction.amount || 0);
}

async function adjustBalance(id: string, amount: number) {
    const account = await getAccountById(id);
    if (account) {
        account.balance = (account.balance || 0) + amount;
        console.log(`Updated balance on account ${id} with amount ${amount}`)
        return updateAccount(id, account);
    }

    const saving = await getSavingById(id);
    if (saving) {
        saving.balance = (saving.balance || 0) + amount;
        return updateSaving(id, saving);
    }
}

export const fetchTransactions = (year: number) =>
    fetchStreamedEntities(`${TRANSACTION_URL}/get/${year}`, TRANSACTION_STORE);

export const getStoredTransactions = () =>
    getStoredEntities(TRANSACTION_STORE);

export const getTransactionById = (id: string) =>
    getEntity(TRANSACTION_STORE, id);

export async function addTransaction(transaction: any) {
    const id = await addEntity(TRANSACTION_URL, TRANSACTION_STORE, transaction);
    if (!id) return;

    transaction._id = id;

    const amount = getAmount(transaction);
    await adjustBalance(transaction.sourceAccount, -amount);
    await adjustBalance(transaction.destinationAccount, amount);
}

export async function updateTransaction(id: string, updated: any) {
    const prev = await getTransactionById(id);
    if (!prev) {
        console.error("Old transaction not found. Skipping balance correction.");
        return;
    }

    await updateEntity(TRANSACTION_URL, TRANSACTION_STORE, id, updated);

    const oldAmount = getAmount(prev);
    const newAmount = getAmount(updated);

    // Reverse old effect
    await adjustBalance(prev.sourceAccount, oldAmount);
    await adjustBalance(prev.destinationAccount, -oldAmount);

    // Apply new effect
    await adjustBalance(updated.sourceAccount, -newAmount);
    await adjustBalance(updated.destinationAccount, newAmount);
}

export async function deleteTransactions(ids: string[]) {
    for (const id of ids) {
        const txn = await getTransactionById(id);
        if (!txn) continue;

        const amount = getAmount(txn);

        await adjustBalance(txn.sourceAccount, amount);
        await adjustBalance(txn.destinationAccount, -amount);
    }

    await deleteEntities(TRANSACTION_URL, TRANSACTION_STORE, ids);
}

