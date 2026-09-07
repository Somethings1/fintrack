export interface Subscription {
    currency?: string;
    _id: string;
    name: string;
    icon: string;
    creator: string;
    amount: number;
    sourceAccount: string;
    category: string;

    startDate: Date;
    interval: "day" | "week" | "month" | "year";
    maxInterval: number;
    currentInterval: number;
    remindBefore: number;

    nextActive: Date;
    lastUpdate: Date;
    isDeleted: boolean;
}
