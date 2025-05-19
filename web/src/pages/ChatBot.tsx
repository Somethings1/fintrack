import React, { useRef, useState, useEffect } from "react";
import { Transaction } from "@/models/Transaction";
import { Account } from "@/models/Account";
import { Category } from "@/models/Category";
import { Button, Input, Tooltip, Spin, Modal, Avatar } from "antd";
import { UserOutlined, SendOutlined, RobotOutlined } from "@ant-design/icons";
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
import { useRefresh } from "@/context/RefreshProvider";

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
    const refreshToken = useRefresh();
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

        return { accounts: accountMap, categories: categoryMap };
    };

    useEffect(() => {
        fetchNames();
    }, [refreshToken]);

    const removeLastMessageButtons = () => {
        setMessages((current) => {
            const updated = [...current];
            const last = updated.length - 1;
            if (last >= 0 && updated[last].buttons) {
                const cleaned = { ...updated[last] };
                delete cleaned.buttons;
                updated[last] = cleaned;
                return updated;
            }
            return current;
        });
    }

    const handleResultFromChatbot = (transaction, error, validity) => {
        transaction.dateTime = new Date();
        if (error) {
            if (error.type === "account") setAccountToAdd({ name: error.name });
            else setCategoryToAdd({ name: error.name });
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
                                    ? handleAddAccount()
                                    : handleAddCategory(),
                        },
                        {
                            label: "Edit this transaction",
                            onClick: () => handleEdit(transaction)
                        },
                    ],
                },
            ]);
        } else {
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
        removeLastMessageButtons();
        setMessages((prev) => [...prev, { from: "user", text: userText }]);
        setInput("");

        await handleSend(input, accountNames, categoryNames);
    }

    const handleSend = async (input: string, accountNames: any, categoryNames: any) => {
        setLoading(true);

        try {
            const { transaction, error, validity } = await talkToGemini(input, accountNames, categoryNames);
            handleResultFromChatbot(transaction, error, validity);
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
        removeLastMessageButtons();
        setMessages((prev) => [
            ...prev,
            {
                from: "bot",
                text: "New transaction added successfully. What's next?"
            }
        ]);
    };

    const handleCancelAddEdit = () => {
        setTransactionToEdit(null);
        setShowAddEditModal(false);
    }

    const handleEdit = (tx: any) => {
        setTransactionToEdit(tx);
        setShowAddEditModal(true);
    };

    const handleAddAccount = () => {
        setAccountModalOpen(true);
    };

    const handleAddCategory = () => {
        setCategoryModalOpen(true);
    };

    const handleNewAccount = async () => {
        const { accounts, categories } = await fetchNames();
        removeLastMessageButtons();
        setMessages((prev) => [
            ...prev,
            {
                from: "bot",
                text: "New account added. Now I'm trying to recreate your transaction"
            }
        ]);
        handleSend(lastInput, accounts, categories);
        setAccountModalOpen(false);
    }

    const handleNewCategory = async () => {
        const { accounts, categories } = await fetchNames();
        removeLastMessageButtons();
        setMessages((prev) => [
            ...prev,
            {
                from: "bot",
                text: "New category added. Now I'm trying to recreate your transaction"
            }
        ]);
        handleSend(lastInput, accounts, categories);
        setCategoryModalOpen(false);
    }

    if (Object.keys(categoryNames).length === 0) {
        return <Spin />; // or some loading state until categories are ready
    }


    return (

        <div className="chatbot-container">

            {visible && (
                <div className="chatbot-popup">
                    <h3 style={{textAlign: "center", padding: "10px", borderBottom: "1px solid #D0D0D4"}}>Fintrack assistant</h3>
                    <div className="chatbot-messages">
                        {messages.map((msg, idx) => {
                            const isUser = msg.from === "user";
                            return (
                                <div
                                    key={idx}
                                    className={`chat-bubble ${isUser ? "user" : "bot"}`}
                                    style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                                >
                                    {/* Avatar */}
                                    {!isUser && (
                                        <Avatar
                                            icon={<RobotOutlined />}
                                            style={{
                                                backgroundColor: "#7265e6",
                                                flexShrink: 0,
                                            }}
                                        />
                                    )
                                    }

                                    {/* Bubble content */}
                                    <div style={{ flex: 1 }}>
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
                                            <div className="chat-buttons" style={{ marginTop: 8 }}>
                                                {msg.buttons.map((btn, i) => (
                                                    <Button key={i} size="small" onClick={btn.onClick}>
                                                        {btn.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {isUser && (
                                        <Avatar
                                            icon={<UserOutlined />}
                                            style={{
                                                backgroundColor: "#EFEFF1",
                                                flexShrink: 0,
                                                color: "black",
                                            }}
                                        />

                                    )}
                                </div>

                            );
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
                            id="send-button"
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
                    className="chatbot-icon chatbot-icon-active"
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

