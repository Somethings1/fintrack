import React, { useState, useEffect } from "react";
import { Transaction } from "@/models/Transaction";
import { Button, Input, Tooltip, Spin, message } from "antd";
import { SendOutlined, RobotOutlined } from "@ant-design/icons";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredSavings } from "@/services/savingService";
import { getStoredCategories } from "@/services/categoryService";
import "./ChatBot.css"; // Style it like an adult, please
import { useTransactions } from "../hooks/useTransactions";
import { normalizeTransaction } from "../utils/transactionUtils";

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
    const [loading, setLoading] = useState(false);
    const [accountNames, setAccountNames] = useState<Record<string, string>>({});
    const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
    const { addTransaction } = useTransactions();

    useEffect(() => {
        const fetchNames = async () => {
            const accounts = await getStoredAccounts();
            const savings = await getStoredSavings();
            const all = [...accounts, ...savings];

            const categories = await getStoredCategories();

            const accountMap: Record<string, string> = {};
            const categoryMap: Record<string, string> = {};

            all.forEach(a => accountMap[a._id] = a.name);
            categories.forEach(c => categoryMap[c._id] = c.name);

            setAccountNames(accountMap);
            setCategoryNames(categoryMap);

            console.log(categoryNames);
        };

        fetchNames();
    }, []);


    function extractJson(text: string): any {
        try {
            // Remove Markdown code fences if present
            const cleaned = text
                .replace(/```json|```/g, "")  // remove markdown fences
                .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, ""); // trim leading/trailing whitespace and newlines

            // Parse the cleaned JSON string
            return JSON.parse(cleaned);
        } catch (e) {
            console.error("Failed to parse AI response as JSON:", e, "Raw response:", text);
            return null;
        }
    }

    const handleSend = async () => {
        if (!input.trim()) return;
        const userText = input.trim();
        setMessages((prev) => [...prev, { from: "user", text: userText }]);
        setInput("");
        setLoading(true);

        try {
            const prompt = `
You are a financial assistant.

You receive a sentence from the user and return a structured JSON object like this:

{
  transaction: {
    amount: number,
    type: "income" | "expense" | "transfer",
    sourceAccount?: string (ID),
    destinationAccount?: string (ID),
    category?: string (ID),
    note: string
  },
  error: null | {
    type: "account" | "category", // what is missing
    name: string, // The name of it
    message: string // Human readable message, suggest creating one or select from existing
  }
}

You MUST always return both "transaction" and "error". Accounts and categories are provided by pair of their ID and name.
You should find suitable account and category and put their IDs in JSON result.
Use only what is provided, don't make up new account or category.

Here are the accounts:
${JSON.stringify(accountNames)}

And here are the categories:
${JSON.stringify(categoryNames)}

Now, convert this sentence:
"${userText}"
      `;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                }
            );

            const data = await response.json();
            const aiTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            const result = extractJson(aiTextResponse);
            console.log(result);

            if (!result || !result.transaction) {
                console.error("Invalid AI response format");
                return;
            }

            if (!result.transaction) {
                throw new Error("AI did not return a transaction");
            }

            const { transaction, error } = result;

            if (error) {
                setMessages((prev) => [
                    ...prev,
                    {
                        from: "bot",
                        text: error.message,
                        buttons: [
                            {
                                label: error.type === "account" ? "Add Account" : "Add Category",
                                onClick:
                                    error.type === "account" ? handleAddAccount : handleAddCategory,
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
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    from: "bot",
                    text: "Something went wrong while talking to my digital brain. Try again?",
                },
            ]);
            console.log(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (tx: any) => {
        tx = normalizeTransaction(tx);
        message.success("Hello");
        await addTransaction(tx);
    };

    const handleEdit = (tx: any) => {
        // To be implemented
    };

    const handleAddAccount = () => {
        // To be implemented
    };

    const handleAddCategory = () => {
        // To be implemented
    };

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
                            onPressEnter={handleSend}
                            placeholder="Type a sentence..."
                        />
                        <Button
                            icon={<SendOutlined />}
                            type="primary"
                            onClick={handleSend}
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


        </div>
    );
};

export default ChatBot;

