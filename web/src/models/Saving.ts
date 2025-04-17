export interface Saving {
  _id: string;
  owner: string;
  balance: number;
  icon: string;
  name: string;
  goal: number;
  createdDate: Date; // ISO date
  goalDate: Date; // ISO date
  lastUpdate: Date;
  isDeleted: boolean;
}

