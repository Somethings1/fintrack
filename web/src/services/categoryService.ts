import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";

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

export const deleteCategories = (ids: string[]) =>
    deleteEntities(CATEGORY_URL, CATEGORY_STORE, ids);

