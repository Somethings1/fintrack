export interface Account {
    currency?: string;
  _id: string;
  owner: string;
  balance: number;
  icon: string;
  name: string;
  lastUpdate: Date;
  isDeleted: boolean;
}

