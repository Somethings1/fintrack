import { useEffect, useState } from "react";
import { Account } from "@/models/Account";
import { getStoredAccounts } from "@/services/accountService";
import { useRefresh } from "@/context/RefreshProvider";

let cachedAccounts: Account[] = [];
const subscribers = new Set<(accounts: Account[]) => void>();

let isInitialized = false;

async function refreshData() {
    const data = await getStoredAccounts();
    cachedAccounts = data;
    subscribers.forEach((callback) => callback(cachedAccounts));
}

export function useAccounts() {
    const [accounts, setAccounts] = useState<Account[]>(cachedAccounts);
    const { register, unregister } = useRefresh();

    useEffect(() => {
        subscribers.add(setAccounts);

        const onRefresh = () => refreshData();

        register("accounts", onRefresh);

        if (!isInitialized) {
            isInitialized = true;
            refreshData();
        }

        return () => {
            subscribers.delete(setAccounts);
            unregister("accounts", onRefresh);
        };
    }, []);

    return accounts;
}

