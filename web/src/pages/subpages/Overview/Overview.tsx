import MoneyFlow from "./MoneyFlow";
import RecentTransactions from "./RecentTransactions";
import TotalBalance from "./TotalBalance";
import TotalExpense from "./TotalExpense";
import TotalIncome from "./TotalIncome";
import TotalSavings from "./TotalSavings";

const Overview = () => {
    return (
        <>
            <TotalBalance />
            <TotalIncome />
            <TotalExpense />
            <TotalSavings />
            <MoneyFlow />
            <RecentTransactions />
        </>
    );
}

export default Overview;

