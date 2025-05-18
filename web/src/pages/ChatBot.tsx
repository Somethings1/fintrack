import React, { useState, useEffect } from "react";
import { Transaction } from "@/models/Transaction";
import { Account } from "@/models/Account";
import { Category } from "@/models/Category";
import { Button, Input, Tooltip, Spin, Modal } from "antd";
import { SendOutlined, RobotOutlined } from "@ant-design/icons";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredSavings } from "@/services/savingService";
import { getStoredCategories } from "@/services/categoryService";
import "./ChatBot.css"; // Style it like an adult, please
import { useTransactions } from "@/hooks/useTransactions";
import { normalizeTransaction } from "@/utils/transactionUtils";
import AddEditTransactionModal from "@/components/modals/AddEditTransactionModal";
import { talkToGemini } from "../utils/chatbotUtils";
import AccountForm from "../components/forms/AccountForm";
import CategoryForm from "../components/forms/CategoryForm";

interface Message {
    from: "user" | "bot";
    text: string;
    transaction?: Transaction,
    buttons?: { label: string; onClick: () => void }[];
}

const ChatBot: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            from: "bot",
            text: "Hi! I can understand sentences like “I spent 200k for lunch from wallet” and turn them into transactions. Try me!",
        },
    ]);
    const [input, setInput] = useState("");
    const [lastInput, setLastInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [accountNames, setAccountNames] = useState<Record<string, string>>({});
    const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
    const { addTransaction } = useTransactions();
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState(null);

    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [accountToAdd, setAccountToAdd] = useState<Account>(null);

    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [categoryToAdd, setCategoryToAdd] = useState<Category>(null);

    let accountOptions, categoryOptions;

    const fetchNames = async () => {
        const accounts = await getStoredAccounts();
        const savings = await getStoredSavings();
        accountOptions = [...accounts, ...savings];

        categoryOptions = await getStoredCategories();

        const accountMap: Record<string, string> = {};
        const categoryMap: Record<string, string> = {};

        accountOptions.forEach(a => accountMap[a._id] = a.name);
        categoryOptions.forEach(c => categoryMap[c._id] = c.name);

        setAccountNames(accountMap);
        setCategoryNames(categoryMap);
    };

    useEffect(() => {
        fetchNames();
    }, []);


    const handleResultFromChatbot = (transaction, error) => {
        if (error) {
            if (error.type === "account") setAccountToAdd({name: error.name});
            else setCategoryToAdd({name: error.name});
            setMessages((prev) => [
                ...prev,
                {
                    from: "bot",
                    text: error.message,
                    transaction,
                    buttons: [
                        {
                            label: error.type === "account" ? "Add Account" : "Add Category",
                            onClick: () =>
                                error.type === "account"
                                    ? handleAddAccount(error.name)
                                    : handleAddCategory(error.name),
                        },
                        {
                            label: "Edit",
                            onClick: () => handleEdit(transaction)
                        },
                    ],
                },
            ]);
        } else {
            transaction.dateTime = new Date();
            setMessages((prev) => [
                ...prev,
                {
                    from: "bot",
                    text: "Here's the transaction I created. Want to accept or edit it?",
                    transaction,
                    buttons: [
                        { label: "Accept", onClick: () => handleAccept(transaction) },
                        { label: "Edit", onClick: () => handleEdit(transaction) },
                    ],
                },
            ]);
        }
    }

    const handleFirstSend = async () => {
        if (!input.trim()) return;
        const userText = input.trim();
        setLastInput(input);
        setMessages((prev) => [...prev, { from: "user", text: userText }]);
        setInput("");

        await handleSend(input)
    }

    const handleSend = async (input: string) => {
        setLoading(true);

        try {
            const { transaction, error } = await talkToGemini(input, accountNames, categoryNames);
            handleResultFromChatbot(transaction, error);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    from: "bot",
                    text: "Something went wrong while talking to my digital brain. Try again?",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (tx: any) => {
        tx = normalizeTransaction(tx);
        await addTransaction(tx);
        setShowAddEditModal(false);
    };

    const handleCancelAddEdit = () => {
        setTransactionToEdit(null);
        setShowAddEditModal(false);
    }

    const handleEdit = (tx: any) => {
        setTransactionToEdit(tx);
        setShowAddEditModal(true);
    };

    const handleAddAccount = (name: string) => {
        setAccountModalOpen(true);
    };

    const handleAddCategory = (name: string) => {
        setCategoryModalOpen(true);
    };

    const handleNewAccount = () => {
        fetchNames();
        handleSend(lastInput);
        setAccountModalOpen(false);
    }

    const handleNewCategory = () => {
        fetchNames();
        handleSend(lastInput);
        setCategoryModalOpen(false);
    }

    if (Object.keys(categoryNames).length === 0) {
        return <Spin />; // or some loading state until categories are ready
    }


    return (

        <div className="chatbot-container">

            {visible && (
                <div className="chatbot-popup">
                    <div className="chatbot-messages">
                        {messages.map((msg, idx) => {
                            return (
                                <div
                                    key={idx}
                                    className={`chat-bubble ${msg.from === "user" ? "user" : "bot"}`}
                                >
                                    <div className="chat-text">{msg.text}</div>
                                    {msg.transaction && (
                                        <div
                                            style={{
                                                background: "#f6f6f6",
                                                border: "1px solid #e0e0e0",
                                                borderRadius: 8,
                                                padding: 12,
                                                marginTop: 8,
                                                fontSize: 13,
                                                color: "#333",
                                            }}
                                        >
                                            <div><strong>Amount:</strong> {(msg.transaction.amount ?? 0).toLocaleString()} đ</div>
                                            <div><strong>Type:</strong> {msg.transaction.type}</div>
                                            <div><strong>Date:</strong> {new Date(msg.transaction.dateTime).toLocaleString()}</div>
                                            {msg.transaction.sourceAccount && (
                                                <div><strong>Source:</strong> {accountNames[msg.transaction.sourceAccount]}</div>
                                            )}
                                            {msg.transaction.destinationAccount && (
                                                <div><strong>Destination:</strong> {accountNames[msg.transaction.destinationAccount]}</div>
                                            )}
                                            {msg.transaction.category && (
                                                <div><strong>Category:</strong> {categoryNames[msg.transaction.category]}</div>
                                            )}
                                            {msg.transaction.note && (
                                                <div><strong>Note:</strong> {msg.transaction.note}</div>
                                            )}
                                        </div>
                                    )}
                                    {msg.buttons && (
                                        <div className="chat-buttons">
                                            {msg.buttons.map((btn, i) => (
                                                <Button key={i} size="small" onClick={btn.onClick}>
                                                    {btn.label}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {loading && <Spin style={{ marginTop: 8 }} />}
                    </div>

                    <div className="chatbot-input-row">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onPressEnter={handleFirstSend}
                            placeholder="Type a sentence..."
                        />
                        <Button
                            icon={<SendOutlined />}
                            type="primary"
                            onClick={handleFirstSend}
                        />
                    </div>
                </div>
            )}
            {!visible ? (
                <Tooltip title="Ask ChatBot">
                    <Button
                        shape="circle"
                        icon={<RobotOutlined />}
                        size="large"
                        onClick={() => setVisible(true)}
                        className="chatbot-icon"
                    />
                </Tooltip>
            ) : (
                <Button
                    shape="circle"
                    icon={<RobotOutlined />}
                    size="large"
                    onClick={() => setVisible(false)}
                    className="chatbot-icon"
                />
            )}


            <AddEditTransactionModal
                open={showAddEditModal}
                onCancel={handleCancelAddEdit}
                onSubmit={handleAccept}
                transactionToEdit={transactionToEdit}
                accountOptions={accountOptions}
                categoryOptions={categoryOptions}
            />

            <Modal
                title="New account"
                open={accountModalOpen}
                onCancel={() => setAccountModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <AccountForm account={accountToAdd} onSubmit={handleNewAccount} onCancel={() => setAccountModalOpen(false)} />
            </Modal>

            <Modal
                title="New category"
                open={categoryModalOpen}
                onCancel={() => setCategoryModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <CategoryForm category={categoryToAdd} onSubmit={handleNewCategory} onCancel={() => setCategoryModalOpen(false)} />
            </Modal>

        </div>
    );
};

export default ChatBot;

