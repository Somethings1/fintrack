import { registerRefreshCallback,unregisterRefreshCallback } from '@/context/RefreshBus';
import type { Transaction } from '@/models/Transaction';
import { getStoredAccounts } from '@/services/accountService';
import { getStoredCategories } from '@/services/categoryService';
import { getStoredSavings } from '@/services/savingService';
import { getStoredTransactions } from '@/services/transactionService';
import type { FuseResultMatch } from 'fuse.js';
import { useEffect,useState } from 'react';
export interface ResolvedTransaction extends Transaction {
    sourceAccountName?: string;
    destinationAccountName?: string;
    categoryName?: string;
    _searchMatches?: readonly FuseResultMatch[];
}
export interface AccountOption { value: string; label: string }
export interface CategoryOption { value: string; label: string }
const topics = ['transactions', 'accounts', 'savings', 'categories'];
export function useTransactions() {
    const [transactions, setTransactions] = useState<ResolvedTransaction[]>([]);
    const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
    const [isLoading, setLoading] = useState(true);
    const [defaultTransaction] = useState<Partial<Transaction>>(() => ({ type: 'income', dateTime: new Date(), amount: 0, note: '', isDeleted: false }));
    useEffect(() => {
        let active = true;
        let revision = 0;
        const refresh = async () => {
            const current = ++revision;
            try {
                const [rows, accounts, savings, categories] = await Promise.all([getStoredTransactions(), getStoredAccounts(), getStoredSavings(), getStoredCategories()]);
                if (!active || current !== revision) return;
                const accountMap = new Map([...accounts, ...savings].map(a => [a._id, a.name]));
                const categoryMap = new Map(categories.map(c => [c._id, c.name]));
                setTransactions(rows.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).map(tx => ({
                    ...tx, sourceAccountName: accountMap.get(tx.sourceAccount ?? '') ?? 'External',
                    destinationAccountName: accountMap.get(tx.destinationAccount ?? '') ?? 'External',
                    categoryName: categoryMap.get(tx.category ?? '') ?? 'Transfer',
                })));
                setAccountOptions([...accountMap].map(([value, label]) => ({ value, label })));
                setCategoryOptions([...categoryMap].map(([value, label]) => ({ value, label })));
            } catch { if (active) setTransactions([]); }
            finally { if (active && current === revision) setLoading(false); }
        };
        const callback = () => { void refresh(); };
        for (const topic of topics) registerRefreshCallback(topic, callback);
        callback();
        return () => { active = false; for (const topic of topics) unregisterRefreshCallback(topic, callback); };
    }, []);
    return { transactions, isLoading, accountOptions, categoryOptions, defaultTransaction };
}
