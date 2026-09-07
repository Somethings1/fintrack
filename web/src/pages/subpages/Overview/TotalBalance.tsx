import { addMoney, subtractMoney } from "@/utils/money";
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
        const accTotal = accounts.reduce((sum, a) => addMoney(sum, a.balance || 0), 0);
        const savTotal = savings.reduce((sum, s) => addMoney(sum, s.balance || 0), 0);

        return addMoney(accTotal, savTotal);
    };

    const getPrevious = async () => {
        const now = dayjs();

        const txThisMonth = transactions.filter(tx =>
            dayjs(tx.dateTime).isSame(now, "month") && tx.type !== "transfer"
        );

        const adjustment = txThisMonth.reduce((sum, tx) => {
            if (tx.type === "income") return subtractMoney(sum, tx.amount);
            if (tx.type === "expense") return addMoney(sum, tx.amount);
            return sum;
        }, 0);

        const accTotal = accounts.reduce((sum, a) => addMoney(sum, a.balance || 0), 0);
        const savTotal = savings.reduce((sum, s) => addMoney(sum, s.balance || 0), 0);

        return addMoney(addMoney(accTotal, savTotal), adjustment);
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

