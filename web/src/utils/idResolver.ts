import { getAccountById } from "@/services/accountService";
import { getCategoryById } from "@/services/categoryService";

let accountCache: Record<string, string> = {};
let categoryCache: Record<string, string> = {};

/**
 * Resolves the account name by its ID, using IndexedDB and in-memory cache.
 */
export async function resolveAccountName(accountId: string): Promise<string> {
  if (accountCache[accountId]) return accountCache[accountId];

  const account = await getAccountById(accountId);
  const name = account?.name || "External";

  accountCache[accountId] = name;
  return name;
}

/**
 * Resolves the category name by its ID, using IndexedDB and in-memory cache.
 */
export async function resolveCategoryName(categoryId?: string): Promise<string> {
  if (!categoryId) return "External";
  if (categoryCache[categoryId]) return categoryCache[categoryId];

  const category = await getCategoryById(categoryId);
  const name = category?.name || "External";

  categoryCache[categoryId] = name;
  return name;
}

