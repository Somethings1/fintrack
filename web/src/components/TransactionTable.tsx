import { Table, Button, Modal } from "antd";
import { useEffect, useState } from "react";
import { Transaction } from "@/models/Transaction";
import { getStoredTransactions, deleteTransactions, addTransaction, updateTransaction } from "@/services/transactionService";
import { resolveAccountName, resolveCategoryName } from "@/utils/idResolver";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useRefresh } from "@/context/RefreshProvider";
import { usePollingContext } from "@/context/PollingProvider";
import TransactionForm from "./forms/TransactionForm"; // Import TransactionForm component

interface TransactionTableProps {
    simpleForm?: boolean;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ simpleForm = false }) => {
    const limited = simpleForm ? 3 : 0;
    const allowSelecting = simpleForm ? false : true;
    const paging = simpleForm ? false : 10;

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const lastSync = usePollingContext();
    const refreshToken = useRefresh();
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
            const sorted = all.sort((a: Transaction, b: Transaction) =>
                new Date(b.dateTime).getTime()
                - new Date(a.dateTime).getTime());
            const limitedTxs = limited > 0 ? sorted.slice(0, limited) : sorted;

            const resolved = await Promise.all(
                limitedTxs.map(async (tx: Transaction) => ({
                    ...tx,
                    sourceAccountName: await resolveAccountName(tx.sourceAccount),
                    destinationAccountName: await resolveAccountName(tx.destinationAccount),
                    categoryName: await resolveCategoryName(tx.category),
                }))
            );

            setTransactions(resolved);
        };

        fetchData();
    }, [lastSync, limited, refreshToken]);

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
        setTransactionToEdit(transaction); // Set the transaction to edit
        setShowEditModal(true); // Show the edit modal
    };

    const handleAdd = () => {
        setTransactionToEdit(null); // Ensure we're in "Add" mode, so no existing transaction data is passed
        setShowEditModal(true);
    };

    const handleSubmit = async (values: any) => {
        if (transactionToEdit) {
            // Editing an existing transaction
            await updateTransaction(transactionToEdit._id, values);
        } else {
            // Adding a new transaction
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
        ...(simpleForm
            ? []
            : [
                {
                    title: "Category",
                    dataIndex: "categoryName",
                    key: "categoryName",
                }
            ]),
        {
            title: "Note",
            dataIndex: "note",
            key: "note",
        },
        ...(simpleForm
            ? []
            : [
                {
                    title: "Actions",
                    key: "actions",
                    render: (_, transaction: Transaction) => (
                        <>
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(transaction)} // Call handleEdit on click
                                size="small"
                                style={{ marginRight: 8 }}
                            />
                            <Button
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete(transaction)}
                                size="small"
                                danger
                            />
                        </>
                    ),
                },
            ]),
    ];

    return (
        <>
            <Table
                rowKey="_id"
                dataSource={transactions}
                columns={columns}
                pagination={paging ? { pageSize: paging } : false}
                rowSelection={allowSelecting ? {
                    type: "checkbox",
                    onChange: (selectedRowKeys: React.Key[], selectedRows: Transaction[]) => {
                        console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
                    },
                } : undefined}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                title="Confirm Deletion"
                visible={showDeleteModal}
                onOk={handleConfirmDelete}
                onCancel={handleCancelDelete}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
            >
                <p>Are you sure you want to delete this transaction?</p>
            </Modal>

            {/* Edit/Add Modal */}
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

            {/* Add New Button (optional, if you want to provide a button to add a new transaction) */}
            {!simpleForm && (
                <Button type="primary" onClick={handleAdd}>
                    Add New Transaction
                </Button>
            )}
        </>
    );
};

export default TransactionTable;

