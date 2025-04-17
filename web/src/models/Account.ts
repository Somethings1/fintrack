export interface Account {
  _id: string;
  owner: string;
  balance: number;
  icon: string;
  name: string;
  lastUpdate: Date;
  isDeleted: boolean;
}

