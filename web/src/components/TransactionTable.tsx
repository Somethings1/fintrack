// TransactionTable.tsx
import { Table, Button, Modal } from "antd";
import { useEffect, useState } from "react";
import { Transaction } from "@/models/Transaction";
import { getStoredTransactions, deleteTransactions, addTransaction, updateTransaction } from "@/services/transactionService";
import { resolveAccountName, resolveCategoryName } from "@/utils/idResolver";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import TransactionForm from "./forms/TransactionForm";
import SimpleTransactionTable from "./SimpleTransactionTable";

const TransactionTable: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
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
        };

        fetchData();
    }, [lastSync]);

    const handleDelete = (transaction: Transaction) => {
        setTransactionToDelete(transaction);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (transactionToDelete) {
            await deleteTransactions([transactionToDelete._id]);
            setShowDeleteModal(false);
            setTransactionToDelete(null);
            triggerRefresh();
        }
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

    const columns = [
        {
            title: "Date",
            dataIndex: "dateTime",
            key: "dateTime",
            render: (value: Date) => new Date(value).toLocaleDateString("en-GB", {
                day: '2-digit',
                month: '2-digit',
            }),
        },
        {
            title: "Amount",
            dataIndex: "amount",
            key: "amount",
            render: (value: number) => `${value.toLocaleString()} đ`,
        },
        {
            title: "Type",
            dataIndex: "type",
            key: "type",
            render: (type: Transaction["type"]) => type.charAt(0).toUpperCase() + type.slice(1),
        },
        {
            title: "Source",
            dataIndex: "sourceAccountName",
            key: "sourceAccountName",
        },
        {
            title: "Destination",
            dataIndex: "destinationAccountName",
            key: "destinationAccountName",
        },
        {
            title: "Category",
            dataIndex: "categoryName",
            key: "categoryName",
        },
        {
            title: "Note",
            dataIndex: "note",
            key: "note",
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, transaction: Transaction) => (
                <>
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(transaction)} size="small" style={{ marginRight: 8 }} />
                    <Button icon={<DeleteOutlined />} onClick={() => handleDelete(transaction)} size="small" danger />
                </>
            ),
        },
    ];

    return (
        <>
            <Table
                rowKey="_id"
                dataSource={transactions}
                columns={columns}
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
                <p>Are you sure you want to delete this transaction?</p>
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

            <Button type="primary" onClick={handleAdd}>
                Add New Transaction
            </Button>
        </>
    );
};

export default TransactionTable;

