// src/hooks/useTransactionFilters.ts
import { useState, useMemo } from 'react';
import { Transaction } from '@/models/Transaction'; // Or ResolvedTransaction if needed
import { applyFuzzySearch } from '@/utils/transactionUtils'; // Import fuzzy search utility

export interface TransactionFilters {
    type: 'income' | 'expense' | 'transfer' | null;
    dateRange: [Date, Date] | null;
    amountRange: [number, number] | null;
    sourceAccount: string | null;
    destinationAccount: string | null;
    category: string | null;
    note: string;
}

const initialFilters: TransactionFilters = {
    type: null,
    dateRange: null,
    amountRange: null,
    sourceAccount: null,
    destinationAccount: null,
    category: null,
    note: ""
};

export const useTransactionFilters = (initialData: Transaction[]) => {
    const [filters, setFilters] = useState<TransactionFilters>(initialFilters);

    const isFilterActive = useMemo(() => Object.values(filters).some(val => {
        if (!val) return false;
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === 'string') return val.trim() !== '';
        return true; // For amountRange potentially being [0, x]
    }), [filters]);

    const filteredTransactions = useMemo(() => {
        const { type, dateRange, amountRange, sourceAccount, destinationAccount, category, note } = filters;

        // Apply fuzzy search first if note filter is active
        let dataToFilter = applyFuzzySearch(initialData, note);

        // Apply other filters
        return dataToFilter.filter(tx => {
            if (type && tx.type !== type) return false;
            if (dateRange && (new Date(tx.dateTime) < dateRange[0] || new Date(tx.dateTime) > dateRange[1])) return false;
            if (amountRange && (tx.amount < amountRange[0] || tx.amount > amountRange[1])) return false;
            if (sourceAccount && tx.sourceAccount !== sourceAccount) return false;
            if (destinationAccount && tx.destinationAccount !== destinationAccount) return false;
            if (category && tx.category !== category) return false;
            return true;
        });
    }, [initialData, filters]);

    const resetFilters = () => {
        setFilters(initialFilters);
    };

    return {
        filters,
        setFilters,
        filteredTransactions,
        isFilterActive,
        resetFilters,
    };
};
