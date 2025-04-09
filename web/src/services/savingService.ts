import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";

const SAVING_URL = "http://localhost:8080/api/savings";
const SAVING_STORE = "savings";

export const fetchSavings = () => fetchStreamedEntities(SAVING_URL + "/get", SAVING_STORE);
export const getStoredSavings = () => getStoredEntities(SAVING_STORE);
export const getSavingById = (id: string) => getEntity(SAVING_STORE, id);
export const addSaving = (saving: any) => addEntity(SAVING_URL, SAVING_STORE, saving);
export const updateSaving = (id: string, data: any) => updateEntity(SAVING_URL, SAVING_STORE, id, data);
export const deleteSavings = (ids: string[]) => deleteEntities(SAVING_URL, SAVING_STORE, ids);

