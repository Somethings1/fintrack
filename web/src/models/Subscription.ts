export interface Subscription {
    _id: string;
    creator: string;
    amount: number;
    sourceAccount: string;
    category: string;

    startDate: Date;
    interval: number;
    maxInterval: number;
    currentInterval: number;
    remindBefore: number;

    nextActive: Date;
    lastUpdate: Date;
    isDeleted: boolean;
}
