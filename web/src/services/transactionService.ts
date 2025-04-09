import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";

const TRANSACTION_URL = "http://localhost:8080/api/transactions";
const TRANSACTION_STORE = "transactions";

export const fetchTransactions = (year: number) =>
    fetchStreamedEntities(`${TRANSACTION_URL}/get/${year}`, TRANSACTION_STORE);

export const getStoredTransactions = () =>
    getStoredEntities(TRANSACTION_STORE);

export const getTransactionById = (id: string) =>
    getEntity(TRANSACTION_STORE, id);

export const addTransaction = (transaction: any) =>
    addEntity(TRANSACTION_URL, TRANSACTION_STORE, transaction);

export const updateTransaction = (id: string, updated: any) =>
    updateEntity(TRANSACTION_URL, TRANSACTION_STORE, id, updated);

export const deleteTransactions = (ids: string[]) =>
    deleteEntities(TRANSACTION_URL, TRANSACTION_STORE, ids);

