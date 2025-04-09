import {
    fetchStreamedEntities,
    getStoredEntities,
    getEntity,
    addEntity,
    updateEntity,
    deleteEntities,
} from "./entityService";

const ACCOUNT_URL = "http://localhost:8080/api/accounts";
const ACCOUNT_STORE = "accounts";

export const fetchAccounts = () => fetchStreamedEntities(ACCOUNT_URL + "/get", ACCOUNT_STORE);
export const getStoredAccounts = () => getStoredEntities(ACCOUNT_STORE);
export const getAccountById = (id: string) => getEntity(ACCOUNT_STORE, id);
export const addAccount = (account: any) => addEntity(ACCOUNT_URL, ACCOUNT_STORE, account);
export const updateAccount = (id: string, data: any) => updateEntity(ACCOUNT_URL, ACCOUNT_STORE, id, data);
export const deleteAccounts = (ids: string[]) => deleteEntities(ACCOUNT_URL, ACCOUNT_STORE, ids);

