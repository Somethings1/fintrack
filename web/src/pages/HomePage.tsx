import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authService";

import { fetchTransactions, getStoredTransactions } from "@/services/transactionService";
import { fetchAccounts, getStoredAccounts } from "@/services/accountService";
import { fetchSavings, getStoredSavings } from "@/services/savingService";
import { fetchCategories, getStoredCategories } from "@/services/categoryService";

import { Transaction } from "@/models/Transaction";
import { Account } from "@/models/Account";
import { Saving } from "@/models/Saving";
import { Category } from "@/models/Category";

const HomePage = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savings, setSavings] = useState<Saving[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    useEffect(() => {
        const loadData = async () => {
            // Load and store all data
            const [storedTx, fetchedTx] = await Promise.all([
                getStoredTransactions(),
                fetchTransactions(2024)
            ]);
            setTransactions(fetchedTx.length > 0 ? fetchedTx : storedTx);

            const [storedAcc, fetchedAcc] = await Promise.all([
                getStoredAccounts(),
                fetchAccounts()
            ]);
            setAccounts(fetchedAcc.length > 0 ? fetchedAcc : storedAcc);

            const [storedSav, fetchedSav] = await Promise.all([
                getStoredSavings(),
                fetchSavings()
            ]);
            setSavings(fetchedSav.length > 0 ? fetchedSav : storedSav);

            const [storedCat, fetchedCat] = await Promise.all([
                getStoredCategories(),
                fetchCategories()
            ]);
            setCategories(fetchedCat.length > 0 ? fetchedCat : storedCat);
        };

        loadData();
    }, []);

    // Helper function to find name by ID
    const getAccountName = (_id: string | null) => {
        if (!_id) return "-";
        return accounts.find(acc => acc._id === _id)?.name || "-";
    };

    const getCategoryName = (_id: string | null) => {
        if (!_id) return "-";
        return categories.find(cat => cat._id === _id)?.name || "-";
    };

    return (
        <div>
            <h1>Finance Dashboard</h1>

            {/* Transactions Table */}
            <h2>Transactions</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th><th>Creator</th><th>Amount</th><th>Date</th><th>Type</th>
                        <th>Source</th><th>Destination</th><th>Category</th><th>Note</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.length > 0 ? (
                        transactions.map((tx) => (
                            <tr key={tx._id}>
                                <td>{tx._id}</td>
                                <td>{tx.creator}</td>
                                <td>{tx.amount}</td>
                                <td>{new Date(tx.dateTime).toLocaleString()}</td>
                                <td>{tx.type}</td>
                                <td>{getAccountName(tx.sourceAccount)}</td>
                                <td>{getAccountName(tx.destinationAccount)}</td>
                                <td>{getCategoryName(tx.category)}</td>
                                <td>{tx.note}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={9}>No transactions available</td></tr>
                    )}
                </tbody>
            </table>

            {/* Accounts Table */}
            <h2>Accounts</h2>
            <table>
                <thead>
                    <tr><th>ID</th><th>Owner</th><th>Balance</th><th>Icon</th><th>Name</th><th>Goal</th></tr>
                </thead>
                <tbody>
                    {accounts.length > 0 ? (
                        accounts.map((acc) => (
                            <tr key={acc._id}>
                                <td>{acc._id}</td>
                                <td>{acc.owner}</td>
                                <td>{acc.balance}</td>
                                <td>{acc.icon}</td>
                                <td>{acc.name}</td>
                                <td>{acc.goal}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={6}>No accounts available</td></tr>
                    )}
                </tbody>
            </table>

            {/* Savings Table */}
            <h2>Savings</h2>
            <table>
                <thead>
                    <tr><th>ID</th><th>Owner</th><th>Balance</th><th>Icon</th><th>Name</th><th>Goal</th><th>Created Date</th><th>Goal Date</th></tr>
                </thead>
                <tbody>
                    {savings.length > 0 ? (
                        savings.map((sv) => (
                            <tr key={sv._id}>
                                <td>{sv._id}</td>
                                <td>{sv.owner}</td>
                                <td>{sv.balance}</td>
                                <td>{sv.icon}</td>
                                <td>{sv.name}</td>
                                <td>{sv.goal}</td>
                                <td>{new Date(sv.createdDate).toLocaleDateString()}</td>
                                <td>{new Date(sv.goalDate).toLocaleDateString()}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={8}>No savings available</td></tr>
                    )}
                </tbody>
            </table>

            {/* Categories Table */}
            <h2>Categories</h2>
            <table>
                <thead>
                    <tr><th>ID</th><th>Owner</th><th>Type</th><th>Icon</th><th>Name</th><th>Budget</th></tr>
                </thead>
                <tbody>
                    {categories.length > 0 ? (
                        categories.map((cat) => (
                            <tr key={cat._id}>
                                <td>{cat._id}</td>
                                <td>{cat.owner}</td>
                                <td>{cat.type}</td>
                                <td>{cat.icon}</td>
                                <td>{cat.name}</td>
                                <td>{cat.budget}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={6}>No categories available</td></tr>
                    )}
                </tbody>
            </table>

            {/* Logout Button */}
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
};

export default HomePage;

