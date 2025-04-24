// TransactionTable.tsx
import { Table, Button, Modal, Form, Input, Slider, DatePicker, Select } from "antd";
import { useEffect, useState } from "react";
import { Transaction } from "@/models/Transaction";
import { getStoredTransactions, deleteTransactions, addTransaction, updateTransaction } from "@/services/transactionService";
import { resolveAccountName, resolveCategoryName } from "@/utils/idResolver";
import { DeleteOutlined, EditOutlined, FilterOutlined, SelectOutlined } from "@ant-design/icons";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import TransactionForm from "./forms/TransactionForm";

const TransactionTable: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [accountOptions, setAccountOptions] = useState<{ value: string, label: string }[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<{ value: string, label: string }[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const rowSelection = selectMode
        ? {
            selectedRowKeys,
            onChange: (newSelectedRowKeys: React.Key[]) => {
                setSelectedRowKeys(newSelectedRowKeys);
            },
            selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
            ],
        }
        : undefined;



    const [filters, setFilters] = useState({
        type: null,
        dateRange: null,
        amountRange: null,
        sourceAccount: null,
        destinationAccount: null,
        category: null,
        note: ""
    });

    const lastSync = usePollingContext();
    const { triggerRefresh } = useRefresh();

    const defaultTransaction: Partial<Transaction> = {
        type: "income",
        dateTime: new Date(),
        amount: 0,
        sourceAccount: null,
        destinationAccount: null,
        category: null,
        note: "",
        creator: localStorage.getItem("username") ?? "",
        isDeleted: false,
    };

    const applyFilters = (data: Transaction[]) => {
        return data.filter(tx => {
            const { type, dateRange, amountRange, sourceAccount, destinationAccount, category, note } = filters;

            if (type && tx.type !== type) return false;

            if (dateRange && (new Date(tx.dateTime) < dateRange[0] || new Date(tx.dateTime) > dateRange[1])) return false;

            if (amountRange && (tx.amount < amountRange[0] || tx.amount > amountRange[1])) return false;

            if (sourceAccount && tx.sourceAccount !== sourceAccount) return false;

            if (destinationAccount && tx.destinationAccount !== destinationAccount) return false;

            if (category && tx.category !== category) return false;

            if (note && !tx.note?.toLowerCase().includes(note.toLowerCase())) return false;

            return true;
        });
    };


    useEffect(() => {
        const fetchData = async () => {
            const all = await getStoredTransactions();
            const sorted = all.sort((a, b) =>
                new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
            );

            const resolved = await Promise.all(
                sorted.map(async (tx) => ({
                    ...tx,
                    sourceAccountName: await resolveAccountName(tx.sourceAccount),
                    destinationAccountName: await resolveAccountName(tx.destinationAccount),
                    categoryName: await resolveCategoryName(tx.category),
                }))
            );

            setTransactions(resolved);

            const accountsSet = new Set<string>();
            const categoriesSet = new Set<string>();
            const accountsMap: Record<string, string> = {};
            const categoriesMap: Record<string, string> = {};

            for (const tx of resolved) {
                if (tx.sourceAccount) accountsSet.add(tx.sourceAccount);
                if (tx.destinationAccount) accountsSet.add(tx.destinationAccount);
                if (tx.category) categoriesSet.add(tx.category);
            }

            const accountPromises = Array.from(accountsSet).map(async id => {
                const name = await resolveAccountName(id);
                accountsMap[id] = name;
            });

            const categoryPromises = Array.from(categoriesSet).map(async id => {
                const name = await resolveCategoryName(id);
                categoriesMap[id] = name;
            });

            await Promise.all([...accountPromises, ...categoryPromises]);

            setAccountOptions(Object.entries(accountsMap).map(([id, name]) => ({ value: id, label: name })));
            setCategoryOptions(Object.entries(categoriesMap).map(([id, name]) => ({ value: id, label: name })));
        };

        fetchData();
    }, [lastSync]);

    const handleConfirmDelete = async () => {
        if (transactionToDelete) {
            await deleteTransactions([transactionToDelete._id]);
            setShowDeleteModal(false);
            setTransactionToDelete(null);
            triggerRefresh();
        }
        try {
            await deleteTransactions(selectedRowKeys as string[]);
            setSelectedRowKeys([]);
            triggerRefresh(); // Refresh data
        } catch (error) {
            console.error("Error deleting transactions:", error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) return;
        setShowDeleteModal(true);
    };
    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setTransactionToDelete(null);
    };

    const handleEdit = (transaction: Transaction) => {
        setTransactionToEdit(transaction);
        setShowEditModal(true);
    };

    const handleAdd = () => {
        setTransactionToEdit(null);
        setShowEditModal(true);
    };

    const handleSubmit = async (values: any) => {
        if (transactionToEdit) {
            await updateTransaction(transactionToEdit._id, values);
        } else {
            await addTransaction(values);
        }
        setShowEditModal(false);
        triggerRefresh();
    };



    const isFilterActive = Object.values(filters).some(val => {
        if (!val) return false;
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === "string") return val.trim() !== "";
        return true;
    });


    const baseColumns = [
        {
            title: "Date",
            dataIndex: "dateTime",
            key: "dateTime",
            sorter: (a: Transaction, b: Transaction) =>
                new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
            render: (value: Date) =>
                new Date(value).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                }),
        },
        {
            title: "Amount",
            dataIndex: "amount",
            key: "amount",
            sorter: (a: Transaction, b: Transaction) => (a.amount ?? 0) - (b.amount ?? 0),
            render: (value: number) => `${value.toLocaleString()} đ`,
        },
        {
            title: "Type",
            dataIndex: "type",
            key: "type",
            sorter: (a: Transaction, b: Transaction) => a.type.localeCompare(b.type),
            render: (type: Transaction["type"]) => type.charAt(0).toUpperCase() + type.slice(1),
        },
        {
            title: "Source",
            dataIndex: "sourceAccountName",
            key: "sourceAccountName",
            sorter: (a: Transaction, b: Transaction) =>
                (a.sourceAccountName ?? "").localeCompare(b.sourceAccountName ?? ""),
        },
        {
            title: "Destination",
            dataIndex: "destinationAccountName",
            key: "destinationAccountName",
            sorter: (a: Transaction, b: Transaction) =>
                (a.destinationAccountName ?? "").localeCompare(b.destinationAccountName ?? ""),
        },
        {
            title: "Category",
            dataIndex: "categoryName",
            key: "categoryName",
            sorter: (a: Transaction, b: Transaction) =>
                (a.categoryName ?? "").localeCompare(b.categoryName ?? ""),
        },
        {
            title: "Note",
            dataIndex: "note",
            key: "note",
            sorter: (a: Transaction, b: Transaction) => (a.note ?? "").localeCompare(b.note ?? ""),
        },
    ];
    const editColumn = {
        title: "Actions",
        key: "actions",
        render: (_: any, transaction: Transaction) => (
            <Button
                icon={<EditOutlined />}
                onClick={() => handleEdit(transaction)}
                size="small"
            />
        ),
    };

    const columns = editMode ? [...baseColumns, editColumn] : baseColumns;

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <Button
                        type={isFilterActive ? "primary" : "default"}
                        icon={<FilterOutlined />}
                        onClick={() => setShowFilterModal(true)}
                    >
                        Filters
                    </Button>

                    <Button
                        icon={<SelectOutlined />}
                        onClick={() => setSelectMode(!selectMode)}
                        type={selectMode ? "primary" : "default"}
                    >
                        {selectMode ? "Exit Select Mode" : "Select"}
                    </Button>
                    {selectMode && (
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            disabled={selectedRowKeys.length === 0}
                            onClick={handleBulkDelete}
                        >
                            Delete
                        </Button>
                    )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => setEditMode(!editMode)}
                        type={editMode ? "primary" : "default"}
                    >
                        {editMode ? "Exit Edit Mode" : "Edit Mode"}
                    </Button>

                    <Button type="primary" onClick={handleAdd}>
                        Add New Transaction
                    </Button>
                </div>
            </div>


            <Table
                rowKey="_id"
                dataSource={applyFilters(transactions)}
                columns={columns}
                rowSelection={rowSelection}
                pagination={{ pageSize: 10 }}
            />

            <Modal
                title="Confirm Deletion"
                open={showDeleteModal}
                onOk={handleConfirmDelete}
                onCancel={handleCancelDelete}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
            >
                <p>You are about to delete <strong>{selectedRowKeys.length}</strong> transactions.</p>
                <p>This action is <strong>IRREVERSABLE</strong>.</p>
                <p>Do you really want to delete?</p>
            </Modal>

            <Modal
                title={transactionToEdit ? "Edit Transaction" : "Add New Transaction"}
                open={showEditModal}
                onCancel={() => setShowEditModal(false)}
                footer={null}
            >
                <TransactionForm
                    transaction={transactionToEdit ?? defaultTransaction}
                    onSubmit={handleSubmit}
                    onCancel={() => setShowEditModal(false)}
                />
            </Modal>
            <Modal
                title="Filter Transactions"
                open={showFilterModal}
                onCancel={() => setShowFilterModal(false)}
                footer={null}
            >
                <Form
                    layout="vertical"
                    onFinish={(values) => {
                        setFilters(values);
                        setShowFilterModal(false);
                    }}
                    initialValues={filters}
                >
                    <Form.Item name="type" label="Type">
                        <Select allowClear>
                            <Select.Option value="income">Income</Select.Option>
                            <Select.Option value="expense">Expense</Select.Option>
                            <Select.Option value="transfer">Transfer</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="dateRange" label="Date Range">
                        <DatePicker.RangePicker />
                    </Form.Item>

                    <Form.Item name="amountRange" label="Amount Range">
                        <Slider range min={0} max={10000000} step={100000} />
                    </Form.Item>
                    <Form.Item name="sourceAccount" label="Source Account">
                        <Select allowClear options={accountOptions} />
                    </Form.Item>

                    <Form.Item name="destinationAccount" label="Destination Account">
                        <Select allowClear options={accountOptions} />
                    </Form.Item>

                    <Form.Item name="category" label="Category">
                        <Select allowClear options={categoryOptions} />
                    </Form.Item>

                    <Form.Item name="note" label="Note (Fuzzy Search)">
                        <Input />
                    </Form.Item>

                    <Form.Item>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button type="primary" htmlType="submit" block>
                                Apply Filters
                            </Button>
                            <Button
                                htmlType="button"
                                onClick={() => {
                                    setFilters({
                                        type: null,
                                        dateRange: null,
                                        amountRange: null,
                                        sourceAccount: null,
                                        destinationAccount: null,
                                        category: null,
                                        note: ""
                                    });
                                    setShowFilterModal(false);
                                }}
                                block
                            >
                                Reset
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

        </>
    );
};

export default TransactionTable;

