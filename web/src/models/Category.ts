export interface Category {
  id: string;
  owner: string;
  type: "income" | "expense";
  icon: string;
  name: string;
  budget?: number;
}

