import React, { useEffect, useState } from "react";
import { Form, InputNumber, Button, DatePicker, Radio, Select, Space, Input } from "antd";
import { Account } from "@/models/Account"; // Import Account model
import { Transaction } from "@/models/Transaction"; // Import Transaction model
import { Category } from "@/models/Category"; // Import Category model
import { getStoredAccounts } from "@/services/accountService"; // Account service
import { getStoredCategories } from "@/services/categoryService"; // Category service
import dayjs from "dayjs"; // Using dayjs
import { useRefresh } from "../../../context/RefreshProvider";

interface TransactionFormProps {
    transaction: Partial<Transaction>;
    onSubmit: (values: Transaction) => void;
    onCancel?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ transaction, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const [transactionType, setTransactionType] = useState<string>('income');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { triggerRefresh } = useRefresh();

    useEffect(() => {
        const {
            sourceAccount,
            destinationAccount,
            category,
            ...rest
        } = transaction;

        form.setFieldsValue({
            ...rest,
            sourceAccount: sourceAccount === "000000000000000000000000" ? undefined : sourceAccount,
            destinationAccount: destinationAccount === "000000000000000000000000" ? undefined : destinationAccount,
            category: category === "000000000000000000000000" ? undefined : category,
        });
    }, [transaction]);


    // Fetch accounts and categories
    useEffect(() => {
        const fetchAccountsAndCategories = async () => {
            const accountsData = await getStoredAccounts();
            setAccounts(accountsData);
            const categoriesData = await getStoredCategories();
            setCategories(categoriesData);
        };

        fetchAccountsAndCategories();
    }, []);

    // Handle transaction type change
    const handleTransactionTypeChange = (e: any) => {
        setTransactionType(e.target.value);
    };

    const handleFinish = (values: any) => {
        // Ensure dateTime is a valid dayjs or Date object
        const updatedTransaction = {
            ...values,
            _id: transaction._id,
            dateTime: values.dateTime instanceof dayjs ? values.dateTime.toISOString() : values.dateTime, // Convert to Date if it's a dayjs object
            sourceAccount: values.sourceAccount || '000000000000000000000000',  // Fallback UUID
            destinationAccount: values.destinationAccount || '000000000000000000000000',  // Fallback UUID
            category: values.category || '000000000000000000000000',
            creator: localStorage.getItem("username"),
            isDeleted: false,
            note: values.note || '', // Ensure note is passed, default to empty string if not specified
        };
        onSubmit(updatedTransaction);
    };

    return (
        <Form
            form={form}
            layout="horizontal" // Switch from "vertical" to "horizontal"
            labelCol={{ span: 8 }} // Width of the label column
            wrapperCol={{ span: 16 }} // Width of the input column
            labelAlign="left"
            requiredMark={false}
            onFinish={handleFinish}
        >
            <Form.Item name="type" wrapperCol={{ span: 24 }} rules={[{ required: true }]}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Radio.Group onChange={handleTransactionTypeChange} value={transactionType}>
                        <Radio.Button value="income">Income</Radio.Button>
                        <Radio.Button value="expense">Expense</Radio.Button>
                        <Radio.Button value="transfer">Transfer</Radio.Button>
                    </Radio.Group>
                </div>
            </Form.Item>
            <Form.Item
                name="dateTime"
                label="Date"
                rules={[{ required: true }]}
                getValueProps={(value) => ({
                    value: value ? dayjs(value) : "", // Convert value to dayjs object
                })}
            >
                <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} />
            </Form.Item>

            {/* Conditionally render based on transaction type */}
            {transactionType === 'income' && (
                <>
                    <Form.Item name="destinationAccount" label="Destination Account" rules={[{ required: true }]}>
                        <Select>
                            {accounts.map(account => (
                                <Select.Option key={account._id} value={account._id}>
                                    {account.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                        <Select>
                            {categories.map(category => (
                                <Select.Option key={category._id} value={category._id}>
                                    {category.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </>
            )}

            {transactionType === 'expense' && (
                <>
                    <Form.Item name="sourceAccount" label="Source Account" rules={[{ required: true }]}>
                        <Select>
                            {accounts.map(account => (
                                <Select.Option key={account._id} value={account._id}>
                                    {account.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                        <Select>
                            {categories.map(category => (
                                <Select.Option key={category._id} value={category._id}>
                                    {category.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </>
            )}

            {transactionType === 'transfer' && (
                <>
                    <Form.Item name="sourceAccount" label="Source Account" rules={[{ required: true }]}>
                        <Select>
                            {accounts.map(account => (
                                <Select.Option key={account._id} value={account._id}>
                                    {account.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="destinationAccount" label="Destination Account" rules={[{ required: true }]}>
                        <Select>
                            {accounts.map(account => (
                                <Select.Option key={account._id} value={account._id}>
                                    {account.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </>
            )}

            {/* Add Note Field */}
            <Form.Item name="note" label="Note">
                <Input.TextArea placeholder="Enter a note" />
            </Form.Item>

            <Form.Item>
                <Space style={{ display: 'flex', justifyContent: 'end' }}>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button type="primary" htmlType="submit">Submit</Button>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default TransactionForm;

