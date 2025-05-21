import React from "react";
import TotalBox from "./TotalBox";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredSavings } from "@/services/savingService";
import { getStoredTransactions } from "@/services/transactionService";
import dayjs from "dayjs";

const TotalBalance: React.FC = () => {
    const getCurrent = async () => {
        const accounts = await getStoredAccounts();
        const savings = await getStoredSavings();

        const accTotal = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        const savTotal = savings.reduce((sum, s) => sum + (s.balance || 0), 0);

        return accTotal + savTotal;
    };

    const getPrevious = async () => {
        const [accounts, savings, transactions] = await Promise.all([
            getStoredAccounts(),
            getStoredSavings(),
            getStoredTransactions(),
        ]);

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

