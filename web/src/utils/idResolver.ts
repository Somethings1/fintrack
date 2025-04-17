import { getAccountById } from "@/services/accountService";
import { getSavingById } from "@/services/savingService";
import { getCategoryById } from "@/services/categoryService";

let accountCache: Record<string, string> = {};
let categoryCache: Record<string, string> = {};

/**
 * Resolves the account name by its ID, searching both accounts and savings.
 */
export async function resolveAccountName(accountId: string): Promise<string> {
  if (accountCache[accountId]) return accountCache[accountId];

  // Try to find in accounts
  const account = await getAccountById(accountId);
  if (account) {
    accountCache[accountId] = account.name;
    return account.name;
  }

  // Fallback: Try to find in savings
  const saving = await getSavingById(accountId);
  if (saving) {
    accountCache[accountId] = saving.name;
    return saving.name;
  }

  // Not found: External
  accountCache[accountId] = "External";
  return "External";
}

/**
 * Resolves the category name by its ID.
 */
export async function resolveCategoryName(categoryId?: string): Promise<string> {
  if (!categoryId) return "Transfer";
  if (categoryCache[categoryId]) return categoryCache[categoryId];

  const category = await getCategoryById(categoryId);
  const name = category?.name || "Transfer";

  categoryCache[categoryId] = name;
  return name;
}

