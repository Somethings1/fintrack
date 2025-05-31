export interface Notification {
  _id: string;
  owner: string;
  type: string;
  referenceId: string;
  title: string;
  message: string;
  read: boolean;
  scheduledAt: Date;
  lastUpdate: Date;
  isDeleted: boolean;
}

