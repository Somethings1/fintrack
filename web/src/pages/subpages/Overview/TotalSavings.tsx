import React from "react";
import TotalBox from "./TotalBox";
import { getStoredSavings } from "@/services/savingService";
import { getStoredTransactions } from "@/services/transactionService";
import dayjs from "dayjs";

const TotalSavings: React.FC = () => {
  const getCurrent = async () => {
    const savings = await getStoredSavings();
    return savings.reduce((sum, s) => sum + (s.balance || 0), 0);
  };

  const getPrevious = async () => {
    const savings = await getStoredSavings();
    const transactions = await getStoredTransactions();
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

  return <TotalBox title="Total saving" calculateCurrent={getCurrent} calculatePrevious={getPrevious} />;
};

export default TotalSavings;

