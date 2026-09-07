import { getAccountById } from "@/services/accountService";
import { getCategoryById } from "@/services/categoryService";
import { getSavingById } from "@/services/savingService";


/**
 * Resolves the account name by its ID, searching both accounts and savings.
 */
export async function resolveAccountName(accountId: string): Promise<string> {

  // Try to find in accounts
  const account = await getAccountById(accountId);
  if (account) {
    return account.name;
  }

  // Fallback: Try to find in savings
  const saving = await getSavingById(accountId);
  if (saving) {
    return saving.name;
  }

  // Not found: External
  return "External";
}

/**
 * Resolves the category name by its ID.
 */
export async function resolveCategoryName(categoryId?: string): Promise<string> {
  if (!categoryId) return "Transfer";

  const category = await getCategoryById(categoryId);
  const name = category?.name || "Transfer";
  return name;
}

