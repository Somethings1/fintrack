import { addMoney } from "@/utils/money";
import { useTransactions } from "@/hooks/useTransactions";
import dayjs from "dayjs";
import React from "react";
import TotalBox from "./TotalBox";

const TotalExpense: React.FC = () => {
    const { transactions: txs } = useTransactions();
    const getCurrent = async () => {
        const now = dayjs();
        return txs
            .filter(t => t.type === "expense" && dayjs(t.dateTime).isSame(now, "month"))
            .reduce((sum, t) => addMoney(sum, t.amount), 0);
    };

    const getPrevious = async () => {
        const prev = dayjs().subtract(1, "month");
        return txs
            .filter(t => t.type === "expense" && dayjs(t.dateTime).isSame(prev, "month"))
            .reduce((sum, t) => addMoney(sum, t.amount), 0);
    };

    return (
        <TotalBox
            title="Total expense"
            calculateCurrent={getCurrent}
            calculatePrevious={getPrevious}
            highlightDirection="decrease"
            type="expense"
        />
    );
};

export default TotalExpense;

