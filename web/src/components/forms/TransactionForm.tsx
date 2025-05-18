import React, { useEffect, useState } from "react";
import {
    Form,
    InputNumber,
    Button,
    DatePicker,
    Radio,
    Select,
    Space,
    Input
} from "antd";
import { Account } from "@/models/Account";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredSavings } from "@/services/savingService";
import { getStoredCategories } from "@/services/categoryService";
import dayjs from "dayjs";
import { useRefresh } from "@/context/RefreshProvider";
import { normalizeTransaction } from "../../utils/transactionUtils";

interface TransactionFormProps {
    transaction: Partial<Transaction>;
    onSubmit: (values: Transaction) => void;
    onCancel?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ transaction, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const [transactionType, setTransactionType] = useState<string>('income');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savings, setSavings] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { triggerRefresh } = useRefresh();

    const combinedAccounts = [...accounts.map(a => ({ ...a, type: "account" })), ...savings.map(s => ({ ...s, type: "saving" }))];

    useEffect(() => {
        const { sourceAccount, destinationAccount, category, ...rest } = transaction;

        if (transaction._id)
            setTransactionType(transaction.type);

        form.setFieldsValue({
            ...rest,
            sourceAccount: sourceAccount === "000000000000000000000000" ? undefined : sourceAccount,
            destinationAccount: destinationAccount === "000000000000000000000000" ? undefined : destinationAccount,
            category: category === "000000000000000000000000" ? undefined : category,
        });
    }, [transaction._id]);

    useEffect(() => {
        const fetchAll = async () => {
            const [accs, savs, cats] = await Promise.all([
                getStoredAccounts(),
                getStoredSavings(),
                getStoredCategories()
            ]);
            setAccounts(accs);
            setSavings(savs);
            setCategories(cats);
        };

        fetchAll();
    }, []);

    const handleTransactionTypeChange = (e: any) => {
        setTransactionType(e.target.value);
    };

    const handleFinish = (values: any) => {
        values = normalizeTransaction(values);
        const updatedTransaction = {
            ...values,
            _id: transaction._id,
        };

        onSubmit(updatedTransaction);
    };

    const renderAccountOptions = () =>
        combinedAccounts.map(acc => (
            <Select.Option key={acc._id} value={acc._id}>
                [{acc.type === "account" ? "A" : "S"}] {acc.name}
            </Select.Option>
        ));

    return (
        <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
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
                    value: value ? dayjs(value) : "",
                })}
            >
                <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} />
            </Form.Item>

            {transactionType === 'income' && (
                <>
                    <Form.Item name="destinationAccount" label="Destination Account" rules={[{ required: true }]}>
                        <Select>{renderAccountOptions()}</Select>
                    </Form.Item>
                    <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                        <Select>
                            {categories
                                .filter(category => category.type === 'income')
                                .map(category => (
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
                        <Select>{renderAccountOptions()}</Select>
                    </Form.Item>
                    <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                        <Select>
                            {categories
                                .filter(category => category.type === 'expense')
                                .map(category => (
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
                        <Select>{renderAccountOptions()}</Select>
                    </Form.Item>

                    <Form.Item name="destinationAccount" label="Destination Account" rules={[{ required: true }]}>
                        <Select>{renderAccountOptions()}</Select>
                    </Form.Item>
                </>
            )}

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

