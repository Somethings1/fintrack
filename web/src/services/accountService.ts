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

const ACCOUNT_URL = "http://localhost:8080/api/accounts";
const ACCOUNT_STORE = "accounts";

export const fetchAccounts = () => fetchStreamedEntities(ACCOUNT_URL + "/get", ACCOUNT_STORE);
export const getStoredAccounts = () => getStoredEntities(ACCOUNT_STORE);
export const getAccountById = (id: string) => getEntity(ACCOUNT_STORE, id);
export const addAccount = (account: any) => addEntity(ACCOUNT_URL, ACCOUNT_STORE, account);
export const updateAccount = (id: string, data: any) => updateEntity(ACCOUNT_URL, ACCOUNT_STORE, id, data);
export const updateAccountLocally = (id: string, account: any) =>
    updateDB(ACCOUNT_STORE, { ...account, _id: id });

export const deleteAccounts = async (ids: string[]) => {
    await deleteEntities(ACCOUNT_URL, ACCOUNT_STORE, ids);

    const transactions = await getStoredTransactions() as Transaction[];

    for (const tx of transactions) {
        if (ids.includes(tx.sourceAccount) || ids.includes(tx.destinationAccount)) {
            deleteTransactionsLocally([tx._id]);
        }
    }
};
