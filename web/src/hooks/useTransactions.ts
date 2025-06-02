// src/hooks/useTransactions.ts
import { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import { Transaction } from "@/models/Transaction";
import { getStoredTransactions, deleteTransactions as deleteTransactionsService, addTransaction as addTransactionService, updateTransaction as updateTransactionService } from "@/services/transactionService";
import { resolveAccountName, resolveCategoryName } from "@/utils/idResolver";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import { getMessageApi } from '@/utils/messageProvider';


export interface ResolvedTransaction extends Transaction {
    sourceAccountName?: string;
    destinationAccountName?: string;
    categoryName?: string;
    _searchMatches?: any; // To hold fuzzy search matches if applied elsewhere
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
    creator: typeof window !== 'undefined' ? localStorage.getItem("username") ?? "" : "", // Check for window
    isDeleted: false,
};


export const useTransactions = () => {
    const [transactions, setTransactions] = useState<ResolvedTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

    const { triggerRefresh } = useRefresh();
    const refreshToken = useRefresh();
    const message = getMessageApi();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
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

            const accountPromises = Array.from(accountsSet).map(async id => {
                accountsMap[id] = await resolveAccountName(id);
            });

            const categoryPromises = Array.from(categoriesSet).map(async id => {
                categoriesMap[id] = await resolveCategoryName(id);
            });

            await Promise.all([...accountPromises, ...categoryPromises]);

            const resolvedTransactions = sorted.map((tx) => ({
                ...tx,
                sourceAccountName: tx.sourceAccount ? accountsMap[tx.sourceAccount] : undefined,
                destinationAccountName: tx.destinationAccount ? accountsMap[tx.destinationAccount] : undefined,
                categoryName: tx.category ? categoriesMap[tx.category] : undefined,
            }));

            setTransactions(resolvedTransactions);
            setAccountOptions(Object.entries(accountsMap).map(([id, name]) => ({ value: id, label: name })));
            setCategoryOptions(Object.entries(categoriesMap).map(([id, name]) => ({ value: id, label: name })));

        } catch (error) {
            console.error("Error fetching transactions:", error);
            message.error("Failed to load transactions.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshToken]); // Refetch when polling updates

    const addTransaction = useCallback(async (values: Omit<Transaction, '_id'>) => {
        await addTransactionService(values);
    }, [triggerRefresh]);

    const updateTransaction = useCallback(async (id: string, values: Partial<Transaction>) => {
        await updateTransactionService(id, values);
    }, [triggerRefresh]);

    const deleteTransactions = useCallback(async (ids: string[]) => {
        await deleteTransactionsService(ids);
    }, [triggerRefresh]);

    return {
        transactions,
        isLoading,
        accountOptions,
        categoryOptions,
        addTransaction,
        updateTransaction,
        deleteTransactions,
        defaultTransaction, // Expose default for form initial values
    };
};
