import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";
import { getStoredTransactions, updateTransaction } from "./transactionService";
import { Transaction } from "@/models/Transaction";

const CATEGORY_URL = "http://localhost:8080/api/categories";
const CATEGORY_STORE = "categories";

export const fetchCategories = () =>
    fetchStreamedEntities(`${CATEGORY_URL}/get`, CATEGORY_STORE);

export const getStoredCategories = () =>
    getStoredEntities(CATEGORY_STORE);

export const getCategoryById = (id: string) =>
    getEntity(CATEGORY_STORE, id);

export const addCategory = (category: any) =>
    addEntity(CATEGORY_URL, CATEGORY_STORE, category);

export const updateCategory = (id: string, updatedCategory: any) =>
    updateEntity(CATEGORY_URL, CATEGORY_STORE, id, updatedCategory);

export const deleteCategories = async (ids: string[]) => {
    await deleteEntities(CATEGORY_URL, CATEGORY_STORE, ids);

    const transactions = await getStoredTransactions() as Transaction[];

    for (const tx of transactions) {
        if (ids.includes(tx.category)) {
            await updateTransaction(tx._id, {
                ...tx,
                isDeleted: true,
            });
        }
    }
};

