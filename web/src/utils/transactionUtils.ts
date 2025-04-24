// src/utils/transactionUtils.ts
import Fuse from 'fuse.js';
import { Transaction } from "@/models/Transaction"; // Assuming Transaction model path

export const normalizeText = (str: string | null | undefined): string =>
    (str ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

export const highlightMatches = (text: string, indices: ReadonlyArray<readonly [number, number]> | undefined): string => {
    if (!indices || !indices.length) return text;

    let result = "";
    let lastIndex = 0;

    indices.forEach(([start, end]) => {
        result += text.slice(lastIndex, start);
        result += `<mark>${text.slice(start, end + 1)}</mark>`;
        lastIndex = end + 1;
    });

    result += text.slice(lastIndex);
    return result;
};

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
