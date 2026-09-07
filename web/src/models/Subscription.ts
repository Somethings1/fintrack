export interface Subscription {
    _id: string;
    name: string;
    icon: string;
    creator: string;
    amount: number;
    sourceAccount: string;
    category: string;

    startDate: Date;
    interval: "week" | "month" | "year" | "test";
    maxInterval: number;
    currentInterval: number;
    remindBefore: number;

    nextActive: Date;
    lastUpdate: Date;
    isDeleted: boolean;
}
