import { getDB, saveToDB } from "@/utils/db";

const CATEGORY_URL = "http://localhost:8080/api/categories/get";
const CATEGORY_STORE = "categories";

export async function fetchCategories() {
    const response = await fetch(CATEGORY_URL, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        console.error("Failed to fetch categories:", response.statusText);
        return [];
    }

    const reader = response.body?.getReader();
    if (!reader) {
        console.error("Failed to get reader from response.");
        return [];
    }

    const decoder = new TextDecoder();
    let jsonData = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        jsonData += decoder.decode(value, { stream: true });
    }

    let categories = jsonData
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            try {
                const cat = JSON.parse(line);
                if (cat.ID && !cat._id) {
                    cat._id = cat.ID;
                    delete cat.ID;
                }
                return cat;
            } catch (e) {
                console.error("Error parsing category JSON:", line, e);
                return null;
            }
        })
        .filter(cat => cat !== null);

    if (categories.length === 0) {
        console.warn("No categories received from backend.");
        return [];
    }

    saveToDB(CATEGORY_STORE, categories);

    return categories;
}

export async function getStoredCategories() {
    try {
        const db = await getDB();
        const categories = await db.getAll(CATEGORY_STORE);
        return categories;
    } catch (error) {
        console.error("Error retrieving categories from IndexedDB:", error);
        return [];
    }
}

