export interface Category {
  _id: string;
  owner: string;
  type: "income" | "expense";
  icon: string;
  name: string;
  budget?: number;
  lastUpdate: Date;
  isDeleted: boolean;
}

