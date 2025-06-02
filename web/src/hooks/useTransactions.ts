import { useState, useEffect, useCallback } from 'react';
import { Transaction } from "@/models/Transaction";
import { resolveAccountName, resolveCategoryName } from "@/utils/idResolver";
import { useRefresh } from "@/context/RefreshProvider";
import { getMessageApi } from '@/utils/messageProvider';
import { getStoredTransactions } from '@/services/transactionService';

export interface ResolvedTransaction extends Transaction {
    sourceAccountName?: string;
    destinationAccountName?: string;
    categoryName?: string;
    _searchMatches?: any;
}

export interface AccountOption {
    value: string;
    label: string;
}

export interface CategoryOption {
    value: string;
    label: string;
}

const defaultTransaction: Partial<Transaction> = {
    type: "income",
    dateTime: new Date(),
    amount: 0,
    sourceAccount: null,
    destinationAccount: null,
    category: null,
    note: "",
    creator: typeof window !== 'undefined' ? localStorage.getItem("username") ?? "" : "",
    isDeleted: false,
};

let cachedTransactions: ResolvedTransaction[] = [];
let cachedAccountOptions: AccountOption[] = [];
let cachedCategoryOptions: CategoryOption[] = [];
let isInitialized = false;

const subscribers = new Set<React.Dispatch<React.SetStateAction<ResolvedTransaction[]>>>();
const accountSubscribers = new Set<React.Dispatch<React.SetStateAction<AccountOption[]>>>();
const categorySubscribers = new Set<React.Dispatch<React.SetStateAction<CategoryOption[]>>>();

async function refreshData() {
    const message = getMessageApi();
    try {
        const all = await getStoredTransactions();
        const sorted = all.sort((a, b) =>
            new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        );

        const accountsSet = new Set<string>();
        const categoriesSet = new Set<string>();
        const accountsMap: Record<string, string> = {};
        const categoriesMap: Record<string, string> = {};

        for (const tx of sorted) {
            if (tx.sourceAccount) accountsSet.add(tx.sourceAccount);
            if (tx.destinationAccount) accountsSet.add(tx.destinationAccount);
            if (tx.category) categoriesSet.add(tx.category);
        }

        await Promise.all(
            Array.from(accountsSet).map(async id => {
                accountsMap[id] = await resolveAccountName(id);
            })
        );

        await Promise.all(
            Array.from(categoriesSet).map(async id => {
                categoriesMap[id] = await resolveCategoryName(id);
            })
        );

        const resolvedTransactions = sorted.map((tx) => ({
            ...tx,
            sourceAccountName: tx.sourceAccount ? accountsMap[tx.sourceAccount] : undefined,
            destinationAccountName: tx.destinationAccount ? accountsMap[tx.destinationAccount] : undefined,
            categoryName: tx.category ? categoriesMap[tx.category] : undefined,
        }));

        cachedTransactions = resolvedTransactions;
        cachedAccountOptions = Object.entries(accountsMap).map(([id, name]) => ({ value: id, label: name }));
        cachedCategoryOptions = Object.entries(categoriesMap).map(([id, name]) => ({ value: id, label: name }));

        subscribers.forEach((cb) => cb(cachedTransactions));
        accountSubscribers.forEach((cb) => cb(cachedAccountOptions));
        categorySubscribers.forEach((cb) => cb(cachedCategoryOptions));
    } catch (error) {
        console.error("Error fetching transactions:", error);
        message.error("Failed to load transactions.");
    }
}

export const useTransactions = () => {
    const [transactions, setTransactions] = useState<ResolvedTransaction[]>(cachedTransactions);
    const [accountOptions, setAccountOptions] = useState<AccountOption[]>(cachedAccountOptions);
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(cachedCategoryOptions);
    const [isLoading, setIsLoading] = useState(false);

    const { register, unregister } = useRefresh();

    const onRefresh = useCallback(() => {
        setIsLoading(true);
        refreshData().finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        subscribers.add(setTransactions);
        accountSubscribers.add(setAccountOptions);
        categorySubscribers.add(setCategoryOptions);

        register("transactions", onRefresh);
        register("accounts", onRefresh);
        register("savings", onRefresh);
        register("categories", onRefresh);

        if (!isInitialized) {
            isInitialized = true;
            onRefresh();
        }

        return () => {
            subscribers.delete(setTransactions);
            accountSubscribers.delete(setAccountOptions);
            categorySubscribers.delete(setCategoryOptions);

            unregister("transactions", onRefresh);
            unregister("accounts", onRefresh);
            unregister("savings", onRefresh);
            unregister("categories", onRefresh);
        };
    }, [onRefresh, register, unregister]);

    return {
        transactions,
        isLoading,
        accountOptions,
        categoryOptions,
        defaultTransaction,
    };
};

