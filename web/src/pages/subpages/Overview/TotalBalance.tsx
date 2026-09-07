import { useAccounts } from "@/hooks/useAccounts";
import { useSavings } from "@/hooks/useSavings";
import { useTransactions } from "@/hooks/useTransactions";
import dayjs from "dayjs";
import React from "react";
import TotalBox from "./TotalBox";

const TotalBalance: React.FC = () => {
    const { transactions } = useTransactions();
    const savings = useSavings();
    const accounts = useAccounts();
    const getCurrent = async () => {
        const accTotal = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        const savTotal = savings.reduce((sum, s) => sum + (s.balance || 0), 0);

        return accTotal + savTotal;
    };

    const getPrevious = async () => {
        const now = dayjs();

        const txThisMonth = transactions.filter(tx =>
            dayjs(tx.dateTime).isSame(now, "month") && tx.type !== "transfer"
        );

        const adjustment = txThisMonth.reduce((sum, tx) => {
            if (tx.type === "income") return sum - tx.amount;
            if (tx.type === "expense") return sum + tx.amount;
            return sum;
        }, 0);

        const accTotal = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        const savTotal = savings.reduce((sum, s) => sum + (s.balance || 0), 0);

        return accTotal + savTotal + adjustment;
    };

    return (
        <TotalBox
            title="Total balance"
            calculateCurrent={getCurrent}
            calculatePrevious={getPrevious}
            type=""
        />
    );
};

export default TotalBalance;

