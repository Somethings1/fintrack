import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";
import { deleteTransactionsLocally, getStoredTransactions } from "./transactionService";
import { Transaction } from "@/models/Transaction";
import { updateDB } from "@/utils/db";

const SAVING_URL = "http://localhost:8080/api/savings";
const SAVING_STORE = "savings";

export const fetchSavings = () => fetchStreamedEntities(SAVING_URL + "/get", SAVING_STORE);
export const getStoredSavings = () => getStoredEntities(SAVING_STORE);
export const getSavingById = (id: string) => getEntity(SAVING_STORE, id);
export const addSaving = (saving: any) => addEntity(SAVING_URL, SAVING_STORE, saving);
export const updateSaving = (id: string, data: any) => updateEntity(SAVING_URL, SAVING_STORE, id, data);
export const updateSavingLocally = (id: string, saving: any) =>
    updateDB(SAVING_STORE, { ...saving, _id: id });

export const deleteSavings = async (ids: string[]) => {
    await deleteEntities(SAVING_URL, SAVING_STORE, ids);

    const transactions = await getStoredTransactions() as Transaction[];

    for (const tx of transactions) {
        if (ids.includes(tx.sourceAccount) || ids.includes(tx.destinationAccount)) {
            deleteTransactionsLocally([tx._id]);
        }
    }
};

