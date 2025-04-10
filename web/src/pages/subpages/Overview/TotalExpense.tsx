import React from "react";
import TotalBox from "./TotalBox";
import { getStoredTransactions } from "@/services/transactionService";
import dayjs from "dayjs";

const TotalExpense: React.FC = () => {
  const getCurrent = async () => {
    const txs = await getStoredTransactions();
    const now = dayjs();
    return txs
      .filter(t => t.type === "expense" && dayjs(t.dateTime).isSame(now, "month"))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getPrevious = async () => {
    const txs = await getStoredTransactions();
    const prev = dayjs().subtract(1, "month");
    return txs
      .filter(t => t.type === "expense" && dayjs(t.dateTime).isSame(prev, "month"))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <TotalBox
      title="Total expense"
      calculateCurrent={getCurrent}
      calculatePrevious={getPrevious}
      highlightDirection="decrease"
    />
  );
};

export default TotalExpense;

