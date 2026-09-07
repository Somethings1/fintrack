import type { Saving } from "@/models/Saving";
import { Transaction } from "@/models/Transaction";
import { updateDB } from "@/utils/db";
import {
addEntity,
deleteEntities,
fetchStreamedEntities,
getEntity,
getStoredEntities,
updateEntity,
} from "./entityService";
import { deleteTransactionsLocally,getStoredTransactions } from "./transactionService";

const SAVING_URL = "/api/savings";
const SAVING_STORE = "savings";

export const fetchSavings = () => fetchStreamedEntities(SAVING_URL + "/get-since/1970-01-01T00:00:00.000Z", SAVING_STORE);
export const getStoredSavings = () => getStoredEntities<Saving>(SAVING_STORE);
export const getSavingById = (id: string) => getEntity<Saving>(SAVING_STORE, id);
export const addSaving = (saving: Partial<Saving>) => addEntity(SAVING_URL, SAVING_STORE, saving);
export const updateSaving = (id: string, data: Partial<Saving>) => updateEntity(SAVING_URL, SAVING_STORE, id, data);
export const updateSavingLocally = (id: string, saving: Partial<Saving>) =>
    updateDB(SAVING_STORE, { ...saving, _id: id });

export const deleteSavings = async (ids: string[]) => {
    await deleteEntities(SAVING_URL, SAVING_STORE, ids);

    const transactions = await getStoredTransactions() as Transaction[];

    for (const tx of transactions) {
        if (ids.includes(tx.sourceAccount ?? "") || ids.includes(tx.destinationAccount ?? "")) {
            deleteTransactionsLocally([tx._id]);
        }
    }
};

