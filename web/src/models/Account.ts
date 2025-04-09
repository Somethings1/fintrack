export interface Account {
  _id: string;
  owner: string;
  balance: number;
  icon: string;
  name: string;
  goal?: number;
  lastUpdate: Date;
  isDeleted: boolean;
}

