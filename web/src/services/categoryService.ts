import type { Category } from "@/models/Category";
import { Transaction } from "@/models/Transaction";
import {
addEntity,
deleteEntities,
fetchStreamedEntities,
getEntity,
getStoredEntities,
updateEntity,
} from "./entityService";
import { getStoredTransactions,updateTransaction } from "./transactionService";

const CATEGORY_URL = "/api/categories";
const CATEGORY_STORE = "categories";

export const fetchCategories = () =>
    fetchStreamedEntities(`${CATEGORY_URL}/get`, CATEGORY_STORE);

export const getStoredCategories = () =>
    getStoredEntities<Category>(CATEGORY_STORE);

export const getCategoryById = (id: string) =>
    getEntity<Category>(CATEGORY_STORE, id);

export const addCategory = (category: Partial<Category>) =>
    addEntity(CATEGORY_URL, CATEGORY_STORE, category);

export const updateCategory = (id: string, updatedCategory: Partial<Category>) =>
    updateEntity(CATEGORY_URL, CATEGORY_STORE, id, updatedCategory);

export const deleteCategories = async (ids: string[]) => {
    await deleteEntities(CATEGORY_URL, CATEGORY_STORE, ids);

    const transactions = await getStoredTransactions() as Transaction[];

    for (const tx of transactions) {
        if (ids.includes(tx.category ?? '')) {
            await updateTransaction(tx._id, {
                ...tx,
                isDeleted: true,
            });
        }
    }
};

