import { getStoredAccounts } from "@/services/accountService";
import { getStoredCategories } from "@/services/categoryService";
import { Account } from "../models/Account";

let accountCache: Record<string, string> = {};
let categoryCache: Record<string, string> = {};

export async function resolveAccountName(accountId: string): Promise<string> {
  if (accountCache[accountId]) return accountCache[accountId];

  const accounts = await getStoredAccounts();
  const account = accounts.find((a: Account) => a._id === accountId);

  const name = account ? account.name : "External";
  accountCache[accountId] = name;

  return name;
}

export async function resolveCategoryName(categoryId?: string): Promise<string> {
  if (categoryCache[categoryId]) return categoryCache[categoryId];

  const categories = await getStoredCategories();
  const category = categories.find((c) => c._id === categoryId);

  const name = category ? category.name : "External";
  categoryCache[categoryId] = name;

  return name;
}

