// src/utils/transactionUtils.ts
import { Transaction } from "@/models/Transaction"; // Assuming Transaction model path
import dayjs from 'dayjs';
import Fuse from 'fuse.js';

export const normalizeText = (str: string | null | undefined): string =>
    (str ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();


export const applyFuzzySearch = (data: Transaction[], noteQuery: string): Transaction[] => {
    if (!noteQuery || noteQuery.trim() === "") {
        return data;
    }

    const fuse = new Fuse(data.map(tx => ({
        ...tx,
        _normalized_note: normalizeText(tx.note),
    })), {
        keys: ["_normalized_note"],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 3,
        distance: 100,
        includeMatches: true,
    });

    const normalizedQuery = normalizeText(noteQuery);
    return fuse
        .search(normalizedQuery)
        .map(result => ({
            ...result.item,
            _searchMatches: result.matches, // Store matches separately
        }));
};


export type TransactionValues = Omit<Partial<Transaction>, 'dateTime'> & { dateTime?: Date | string | dayjs.Dayjs };
export const normalizeTransaction = (values: TransactionValues): Partial<Transaction> => ({
    ...values,
    dateTime: values.dateTime ? dayjs(values.dateTime).toDate() : new Date(),
    sourceAccount: values.type === 'income' ? undefined : values.sourceAccount || undefined,
    destinationAccount: values.type === 'expense' ? undefined : values.destinationAccount || undefined,
    category: values.type === 'transfer' ? undefined : values.category || undefined,
    creator: localStorage.getItem('username') ?? '',
    isDeleted: false,
    note: values.note || '',
});
