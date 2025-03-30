export interface Saving {
  id: string;
  owner: string;
  balance: number;
  icon: string;
  name: string;
  goal?: number;
  createdDate: string; // ISO date
  goalDate: string; // ISO date
}

