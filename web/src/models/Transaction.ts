export interface Transaction {
  id: string; // MongoDB ObjectId as string
  creator: string;
  amount: number;
  dateTime: Date; // ISO string
  type: "income" | "expense" | "transfer";
  sourceAccount?: string; // ObjectId as string
  destinationAccount?: string;
  category?: string;
  note: string;
}

