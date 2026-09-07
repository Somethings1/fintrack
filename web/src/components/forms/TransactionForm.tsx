import { getLedgerConfig } from "@/config/ledger";
import { validateMoney } from "@/utils/money";
import { Account } from "@/models/Account";
import { Category } from "@/models/Category";
import { Saving } from "@/models/Saving";
import { Transaction } from "@/models/Transaction";
import { getStoredAccounts } from "@/services/accountService";
import { getStoredCategories } from "@/services/categoryService";
import { getStoredSavings } from "@/services/savingService";
import type { TransactionValues } from "@/utils/transactionUtils";
import { normalizeTransaction } from "@/utils/transactionUtils";
import type { RadioChangeEvent } from "antd";
import {
Button,
DatePicker,
Form,
Input,
InputNumber,
Radio,
Select,
Space
} from "antd";
import dayjs from "dayjs";
import React,{ useEffect,useRef,useState } from "react";

interface TransactionFormProps {
    transaction: Partial<Transaction>;
    onSubmit: (values: Partial<Transaction>) => void | Promise<void>;
    onCancel?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ transaction, onSubmit, onCancel }) => {
    const [form] = Form.useForm();
    const { precision, currency } = getLedgerConfig();
    const moneyRule = { validator: (_: unknown, value: unknown) => validateMoney(value, precision, true) ? Promise.resolve() : Promise.reject(new Error(`Enter a valid ${currency} amount (up to ${precision} decimal places).`)) };
    const submitting = useRef(false);
    const [busy, setBusy] = useState(false);
    const [transactionType, setTransactionType] = useState<string>('income');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savings, setSavings] = useState<Saving[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    const combinedAccounts = [...accounts.map(a => ({ ...a, type: "account" })), ...savings.map(s => ({ ...s, type: "saving" }))];

    useEffect(() => {
        const { sourceAccount, destinationAccount, category, ...rest } = transaction;

        if (transaction.type)
            setTransactionType(transaction.type);

        form.setFieldsValue({
            ...rest,
            sourceAccount: sourceAccount === "000000000000000000000000" ? undefined : sourceAccount,
            destinationAccount: destinationAccount === "000000000000000000000000" ? undefined : destinationAccount,
            category: category === "000000000000000000000000" ? undefined : category,
        });
    }, [transaction, form]);

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

    const handleTransactionTypeChange = (e: RadioChangeEvent) => {
        setTransactionType(e.target.value);
    };

    const handleFinish = async (values: TransactionValues) => {
        if (submitting.current) return;
        submitting.current = true; setBusy(true);
        const normalized = normalizeTransaction(values);
        const updatedTransaction = {
            ...normalized,
            _id: transaction._id,
        };

        try { await onSubmit(updatedTransaction); } finally { submitting.current = false; setBusy(false); }
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
            <Form.Item
                name="type"
                wrapperCol={{ span: 24 }}
                rules={[{ required: true, message: "Please select a transaction type." }]}>
                <Radio.Group style={{ display: 'flex', justifyContent: 'center' }} onChange={handleTransactionTypeChange}>
                        <Radio.Button value="income">Income</Radio.Button>
                        <Radio.Button value="expense">Expense</Radio.Button>
                        <Radio.Button value="transfer">Transfer</Radio.Button>
                </Radio.Group>
            </Form.Item>

            <Form.Item
                name="dateTime"
                label="Date"
                rules={[{ required: true, message: "Please select date and time" }]}
                getValueProps={(value) => ({
                    value: value ? dayjs(value) : "",
                })}
            >
                <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="amount" label="Amount" rules={[moneyRule, { required: true }]}>
                <InputNumber min={10 ** -precision} step={10 ** -precision} max={1e12} style={{ width: "100%" }} />
            </Form.Item>

            {
                transactionType === 'income' && (
                    <>
                        <Form.Item
                            name="destinationAccount"
                            label="Destination Account"
                            rules={[{ required: true, message: "Please select a destination account" }]}>
                            <Select>{renderAccountOptions()}</Select>
                        </Form.Item>
                        <Form.Item
                            name="category"
                            label="Category"
                            rules={[{ required: true, message: "Please select a category" }]}>
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
                )
            }

            {
                transactionType === 'expense' && (
                    <>
                        <Form.Item
                            name="sourceAccount"
                            label="Source Account"
                            rules={[{ required: true, message: "Please select a source account" }]}>
                            <Select>{renderAccountOptions()}</Select>
                        </Form.Item>
                        <Form.Item
                            name="category"
                            label="Category"
                            rules={[{ required: true, message: "Please select a category" }]}>
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
                )
            }

            {
                transactionType === 'transfer' && (
                    <>
                        <Form.Item
                            name="sourceAccount"
                            label="Source Account"
                            rules={[{ required: true, message: "Please select a source account" }]}>
                            <Select>{renderAccountOptions()}</Select>
                        </Form.Item>

                        <Form.Item
                            name="destinationAccount"
                            label="Destination Account"
                            rules={[{ required: true, message: "Please select a destination account" }]}>
                            <Select>{renderAccountOptions()}</Select>
                        </Form.Item>
                    </>
                )
            }

            <Form.Item name="note" label="Note">
                <Input.TextArea maxLength={500} placeholder="Enter a note" />
            </Form.Item>

            <Form.Item>
                <Space style={{ display: 'flex', justifyContent: 'end' }}>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button type="primary" htmlType="submit" loading={busy} disabled={busy}>Submit</Button>
                </Space>
            </Form.Item>
        </Form >
    );
};

export default TransactionForm;

