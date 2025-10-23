import React from "react";
import TotalBox from "./TotalBox";
import { getStoredSavings } from "@/services/savingService";
import { getStoredTransactions } from "@/services/transactionService";
import dayjs from "dayjs";
import { useSavings } from "@/hooks/useSavings";
import { useTransactions } from "@/hooks/useTransactions";

const TotalSavings: React.FC = () => {
    const savings = useSavings()
    const { transactions } = useTransactions();

    const getCurrent = async () => {
        return savings.reduce((sum, s) => sum + (s.balance || 0), 0);
    };

    const getPrevious = async () => {
        const thisMonth = dayjs();

        const savingIds = savings.map(s => s.id);

        const thisMonthTxs = transactions.filter(t =>
            dayjs(t.dateTime).isSame(thisMonth, "month")
        );

        const adjustment = thisMonthTxs.reduce((sum, t) => {
            const fromSaving = savingIds.includes(t.sourceAccount);
            const toSaving = savingIds.includes(t.destinationAccount);

            if (fromSaving) sum += t.amount; // pretend it was never withdrawn
            if (toSaving) sum -= t.amount;   // pretend it was never deposited

            return sum;
        }, 0);

        return savings.reduce((sum, s) => sum + (s.balance || 0), 0) + adjustment;
    };

    return (
        <TotalBox
            title="Total saving"
            calculateCurrent={getCurrent}
            calculatePrevious={getPrevious}
            type=""
        />
    );
};

export default TotalSavings;

