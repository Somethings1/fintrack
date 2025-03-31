import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authService";
import { usePolling } from "../hooks/usePolling";
import { getFromDB } from "@/utils/db";

import { Transaction } from "@/models/Transaction";
import { Account } from "@/models/Account";
import { Saving } from "@/models/Saving";
import { Category } from "@/models/Category";

const HomePage = () => {
    const navigate = useNavigate();

    // Polling intervals (e.g., 60s)
    const lastSyncTransactions = usePolling(60000, "transactions", "transactions");
    const lastSyncAccounts = usePolling(60000, "accounts", "accounts");
    const lastSyncSavings = usePolling(60000, "savings", "savings");
    const lastSyncCategories = usePolling(60000, "categories", "categories");

    // Local state
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savings, setSavings] = useState<Saving[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Load data from IndexedDB when lastSync updates
    useEffect(() => {
        getFromDB("transactions").then(setTransactions);
    }, [lastSyncTransactions]);

    useEffect(() => {
        getFromDB("accounts").then(setAccounts);
    }, [lastSyncAccounts]);

    useEffect(() => {
        getFromDB("savings").then(setSavings);
    }, [lastSyncSavings]);

    useEffect(() => {
        getFromDB("categories").then(setCategories);
    }, [lastSyncCategories]);

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    // Helper functions
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

            <h2>Transactions (Last Sync: {new Date(lastSyncTransactions).toLocaleTimeString()})</h2>
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

            <h2>Accounts (Last Sync: {new Date(lastSyncAccounts).toLocaleTimeString()})</h2>
            <table>
                <thead>
                    <tr><th>ID</th><th>Owner</th><th>Balance</th><th>Icon</th><th>Name</th></tr>
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
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={5}>No accounts available</td></tr>
                    )}
                </tbody>
            </table>

            <h2>Savings (Last Sync: {new Date(lastSyncSavings).toLocaleTimeString()})</h2>
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

            <h2>Categories (Last Sync: {new Date(lastSyncCategories).toLocaleTimeString()})</h2>
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

            <button onClick={handleLogout}>Logout</button>
        </div>
    );
};

export default HomePage;

