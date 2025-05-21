// TransactionTable.tsx
import React, { useState, useMemo } from "react";
import { Table, Spin } from "antd"; // Removed Button
// Removed icon imports if they are *only* used in the action bar now
// import { DeleteOutlined, EditOutlined, FilterOutlined, SelectOutlined, PlusOutlined, DownloadOutlined } from "@ant-design/icons";

import { useTransactions, ResolvedTransaction, AccountOption, CategoryOption } from "@/hooks/useTransactions";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTransactionExport } from "@/hooks/useTransactionExport";
import { getColumns } from "@/config/transactionTableColumns";

import FilterModal from "@/components/modals/FilterModal";
import ExportModal from "@/components/modals/ExportModal";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import AddEditTransactionModal from "@/components/modals/AddEditTransactionModal";
import TransactionActionBar from "./TransactionActionBar"; // Import the action bar
import './TransactionTable.css';

const TransactionTable: React.FC = () => {
    // --- Hooks ---
    const {
        transactions: rawTransactions,
        isLoading,
        accountOptions,
        categoryOptions,
        addTransaction,
        updateTransaction,
        deleteTransactions,
        defaultTransaction
    } = useTransactions();

    const {
        filters,
        setFilters,
        filteredTransactions,
        isFilterActive,
        resetFilters
    } = useTransactionFilters(rawTransactions);

    const columnsConfig = useMemo(() => getColumns(false, () => { }), []);
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

    const handleSubmitTransaction = async (values: any) => {
        try {
            if (transactionToEdit) {
                await updateTransaction(transactionToEdit._id, values);
            } else {
                const finalValues = { ...defaultTransaction, ...values, creator: values.creator || defaultTransaction.creator };
                await addTransaction(finalValues as any);
            }
            handleCancelAddEdit();
        } catch (error) {
            console.error("Submission failed in modal:", error)
        }
    };

    const handleBulkDeleteClick = () => { // Renamed from onBulkDelete
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
        setSelectMode(prev => !prev); // Use functional update for safety
        setSelectedRowKeys([]);
        // If turning select mode OFF while edit mode is ON, turn edit mode OFF.
        if (selectMode && editMode) { // Check *previous* state of selectMode
            setEditMode(false);
        }
    };

    const handleToggleEditMode = () => {
        setEditMode(prev => !prev);
        // If turning edit mode OFF while select mode is ON, turn select mode OFF.
        if (editMode && selectMode) { // Check *previous* state of editMode
            setSelectMode(false);
            setSelectedRowKeys([]);
        }
    };

    // --- Table Configuration ---
    const columns = useMemo(() => getColumns(editMode, handleEditClick), [editMode]);

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
        </>
    );
};

export default TransactionTable;
