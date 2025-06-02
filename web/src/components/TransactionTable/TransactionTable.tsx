import React, { useState, useMemo } from "react";
import { Table, Spin } from "antd";

import { useTransactions, ResolvedTransaction} from "@/hooks/useTransactions";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTransactionExport } from "@/hooks/useTransactionExport";
import { useNotifications } from "@/hooks/useNotifications";
import { getColumns } from "@/config/transactionTableColumns";
import { Notification } from "@/models/Notification";
import { addTransaction, updateTransaction, deleteTransactions } from "@/services/transactionService";

import FilterModal from "@/components/modals/FilterModal";
import ExportModal from "@/components/modals/ExportModal";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import AddEditTransactionModal from "@/components/modals/AddEditTransactionModal";
import TransactionActionBar from "./TransactionActionBar";
import './TransactionTable.css';
import { addNotification } from "@/services/notificationService";
import { updateNotification } from "@/services/notificationService";
import AddEditNotificationModal from "@/components/modals/AddEditNotificationModal";

const TransactionTable: React.FC = () => {
    // --- Hooks ---
    const {
        transactions: rawTransactions,
        isLoading,
        accountOptions,
        categoryOptions,
        defaultTransaction
    } = useTransactions();

    const {
        filters,
        setFilters,
        filteredTransactions,
        isFilterActive,
        resetFilters
    } = useTransactionFilters(rawTransactions);

    const notifications = useNotifications();

    const columnsConfig = useMemo(() => getColumns(false, () => { }, notifications), [notifications]);
    const {
        isExportModalVisible,
        showExportModal,
        hideExportModal,
        selectedColumns,
        selectedFileType,
        handleColumnChange,
        handleFileTypeChange,
        exportData,
    } = useTransactionExport(columnsConfig);

    // --- Local Component State ---
    const [editMode, setEditMode] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<ResolvedTransaction | null>(null);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [reminderToEdit, setReminderToEdit] = useState<Notification | null>(null);
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [referenceId, setReferenceId] = useState("");
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
    });

    // --- Handlers (many are now passed to the action bar) ---
    const handleEditClick = (transaction: ResolvedTransaction) => {
        setTransactionToEdit(transaction);
        setShowAddEditModal(true);
    };

    const handleAddClick = () => { // Renamed from onAddNew for clarity within this component
        setTransactionToEdit(null);
        setShowAddEditModal(true);
    };

    const handleCancelAddEdit = () => {
        setShowAddEditModal(false);
        setTransactionToEdit(null);
    };

    const handleUpsertReminderClick = (transaction: ResolvedTransaction) => {
        setReferenceId(transaction._id);
        const notification = notifications.find(notif => notif.referenceId === transaction._id);
        if (notification) {
            // Edit mode
            setReminderToEdit(notification);
        }
        setShowReminderForm(true);
    }

    const handleUpsertReminderSubmit = async (notification: Partial<Notification>) => {
        try {
            if (notification._id === "") {
                // Adding
                await addNotification(notification);
            }
            else {
                await updateNotification(notification._id, notification);
            }
            handleUpsertReminderCancel();
        } catch (error) {
            console.error("Failed");
        }
    }

    const handleUpsertReminderCancel = () => {
        setReminderToEdit(null);
        setShowReminderForm(false);
    }

    const handleSubmitTransaction = async (values: any) => {
        try {
            if (transactionToEdit) {
                await updateTransaction(transactionToEdit._id, values);
            } else {
                const finalValues = {
                    ...defaultTransaction,
                    ...values,
                    creator: values.creator || defaultTransaction.creator
                };
                await addTransaction(finalValues as any);
            }
            handleCancelAddEdit();
        } catch (error) {
            console.error("Submission failed in modal:", error)
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedRowKeys.length > 0) {
            setShowDeleteConfirmModal(true);
        }
    };

    const handleConfirmDeletion = async () => {
        await deleteTransactions(selectedRowKeys as string[]);
        setSelectedRowKeys([]);
        setShowDeleteConfirmModal(false);
        setSelectMode(false);
    };

    const handleCancelDeletion = () => {
        setShowDeleteConfirmModal(false);
    };

    const handleToggleSelectMode = () => {
        setSelectMode(prev => !prev);
        setSelectedRowKeys([]);
        if (selectMode && editMode) {
            setEditMode(false);
        }
    };

    const handleToggleEditMode = () => {
        setEditMode(prev => !prev);
        if (editMode && selectMode) {
            setSelectMode(false);
            setSelectedRowKeys([]);
        }
    };

    // --- Table Configuration ---
    const columns = useMemo(() => getColumns(editMode, handleEditClick, notifications, handleUpsertReminderClick), [editMode, notifications]);

    const rowSelection = useMemo(() => (selectMode
        ? {
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
            selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
            ],
        }
        : undefined), [selectMode, selectedRowKeys]);

    // --- Render ---
    return (
        <>
            {/* Render the Action Bar */}
            <TransactionActionBar
                isFilterActive={isFilterActive}
                filteredCount={filteredTransactions.length}
                totalCount={rawTransactions.length}
                onShowFilters={() => setShowFilterModal(true)}
                selectMode={selectMode}
                selectedRowCount={selectedRowKeys.length}
                onToggleSelectMode={handleToggleSelectMode}
                onBulkDelete={handleBulkDeleteClick}
                onShowExport={showExportModal}
                editMode={editMode}
                onToggleEditMode={handleToggleEditMode}
                onAddNew={handleAddClick}
            />

            {/* Table */}
            <Spin spinning={isLoading}>
                <Table
                    rowKey="_id"
                    dataSource={filteredTransactions}
                    columns={columns}
                    rowSelection={rowSelection}
                    rowClassName={() => "transaction-table-row"}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                        onChange: (page, pageSize) => {
                            setPagination({ current: page, pageSize });
                        },
                    }}
                    scroll={{ x: 'max-content' }}
                />
            </Spin>

            {/* Modals */}
            <FilterModal
                open={showFilterModal}
                onCancel={() => setShowFilterModal(false)}
                initialValues={filters}
                onApply={setFilters}
                onReset={resetFilters}
                accountOptions={accountOptions}
                categoryOptions={categoryOptions}
            />

            <ExportModal
                open={isExportModalVisible}
                onCancel={hideExportModal}
                onOk={() => exportData(filteredTransactions)}
                columns={columnsConfig}
                selectedColumns={selectedColumns}
                selectedFileType={selectedFileType}
                onColumnChange={handleColumnChange}
                onFileTypeChange={handleFileTypeChange}
            />

            <DeleteConfirmationModal
                open={showDeleteConfirmModal}
                onCancel={handleCancelDeletion}
                onOk={handleConfirmDeletion}
                count={selectedRowKeys.length}
            />

            <AddEditTransactionModal
                open={showAddEditModal}
                onCancel={handleCancelAddEdit}
                onSubmit={handleSubmitTransaction}
                transactionToEdit={transactionToEdit}
                defaultTransaction={defaultTransaction}
                accountOptions={accountOptions}
                categoryOptions={categoryOptions}
            />

            <AddEditNotificationModal
                open={showReminderForm}
                onCancel={handleUpsertReminderCancel}
                onSubmit={handleUpsertReminderSubmit}
                notificationToEdit={reminderToEdit}
                transactionId={referenceId}
            />
        </>
    );
};

export default TransactionTable;
