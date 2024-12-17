import { openDB, deleteDB } from "idb";

// Constants
const DATABASE_NAME = "cache";
const STORES = {
  TRANSACTIONS: "transactions",
  ACCOUNTS: "accounts",
  CATEGORIES: "categories",
};

// Initialize IndexedDB
async function initDB() {
  return openDB(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const transactionStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: "ID", autoIncrement: false });
        // Create indexes for frequently queried fields
        transactionStore.createIndex("type", "type", { unique: false });
        transactionStore.createIndex("amount", "amount", { unique: false });
        transactionStore.createIndex("dateTime", "dateTime", { unique: false });
        transactionStore.createIndex("sourceAccount", "sourceAccount", { unique: false });
        transactionStore.createIndex("destinationAccount", "destinationAccount", { unique: false });
        transactionStore.createIndex("category", "category", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
        db.createObjectStore(STORES.ACCOUNTS, { keyPath: "ID", autoIncrement: false });
      }
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: "ID", autoIncrement: false });
      }
    },
  });
}

// Utility to store data in IndexedDB (separate fields for transaction)
async function storeData(storeName, data) {
  const db = await initDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  // If it's a transaction, split the fields into separate columns
  if (storeName === STORES.TRANSACTIONS) {
    const transactionData = {
      ID: data.ID,
      type: data.Type,
      amount: data.Amount,
      dateTime: data.DateTime,
      sourceAccount: data.SourceAccount,
      destinationAccount: data.DestinationAccount,
      category: data.Category,
      note: data.Note,
    };
    console.log(transactionData);
    await store.put(transactionData); // Put data with split fields
  } else {
    // For accounts and categories, store them as they are
    await store.put(data);
  }

  await tx.done;
}

// Generic function to fetch streamed JSON data
async function fetchStreamedData(url, onDataReceived) {
  try {
    const response = await fetch(url);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode streamed chunk
      buffer += decoder.decode(value, { stream: true });

      // Process each complete JSON line
      let boundary = buffer.lastIndexOf("\n");
      if (boundary !== -1) {
        const completeData = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);

        const items = completeData.split("\n").filter(Boolean);
        for (const itemString of items) {
          try {
            const item = JSON.parse(itemString);
            onDataReceived(item);
          } catch (error) {
            console.error("Error parsing streamed item:", error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching streamed data from ${url}:`, error);
  }
}

// Fetch and store transactions (split into columns)
export async function fetchTransactionsToDB(year) {
  console.log("Fetching transactions...");
  await fetchStreamedData(`api/transactions/get/${year}`, async (transaction) => {
    await storeData(STORES.TRANSACTIONS, transaction);
    console.log("Stored transaction:", transaction);
  });
  console.log("All transactions fetched and stored.");
}

// Fetch and store accounts
export async function fetchAccountsToDB() {
  console.log("Fetching accounts...");
  await fetchStreamedData("/api/accounts/get", async (account) => {
    await storeData(STORES.ACCOUNTS, account);
    console.log("Stored account:", account);
  });
  console.log("All accounts fetched and stored.");
}

// Fetch and store categories
export async function fetchCategoriesToDB() {
  console.log("Fetching categories...");
  await fetchStreamedData("/api/categories/get", async (category) => {
    await storeData(STORES.CATEGORIES, category);
    console.log("Stored category:", category);
  });
  console.log("All categories fetched and stored.");
}

export async function dropDatabase() {
  try {
    await deleteDB("cache");
    console.log("Database 'cache' has been dropped successfully.");
  } catch (error) {
    console.error("Error dropping the database:", error);
  }
}
