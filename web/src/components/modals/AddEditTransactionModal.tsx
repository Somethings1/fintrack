// src/components/modals/AddEditTransactionModal.tsx
import React from 'react';
import { Modal } from 'antd';
import TransactionForm from '@/components/forms/TransactionForm'; // Assuming path
import { Transaction } from '@/models/Transaction'; // Use base Transaction or ResolvedTransaction if needed by form
import { AccountOption, CategoryOption } from '@/hooks/useTransactions'; // Import option types

// Define the shape of the data expected by the form's onSubmit
// This might need adjustment based on what TransactionForm actually returns
type TransactionFormSubmitValues = Omit<Transaction, '_id' | 'creator' | 'isDeleted'> & Partial<Pick<Transaction, 'creator'>>;

interface AddEditTransactionModalProps {
    open: boolean;
    onCancel: () => void;
    onSubmit: (values: TransactionFormSubmitValues) => Promise<void> | void; // Make async if needed
    transactionToEdit: Transaction | null; // Use base Transaction or ResolvedTransaction
    defaultTransaction: Partial<Transaction>;
    accountOptions: AccountOption[];
    categoryOptions: CategoryOption[];
}

const AddEditTransactionModal: React.FC<AddEditTransactionModalProps> = ({
    open,
    onCancel,
    onSubmit,
    transactionToEdit,
    defaultTransaction,
    accountOptions,
    categoryOptions,
}) => {
    const modalTitle = transactionToEdit ? "Edit Transaction" : "Add New Transaction";

    // Determine initial values for the form
    // Pass a deep copy to avoid mutating the original object if it's from state
    const initialFormValues = transactionToEdit
        ? { ...transactionToEdit }
        : defaultTransaction;

    return (
        <Modal
            title={modalTitle}
            open={open}
            onCancel={onCancel}
            footer={null} // Footer is typically handled by the form's submit button
            destroyOnClose // Important to reset form state when modal closes
            width={600} // Adjust width as needed
        >
            {/* Render the form only when the modal is open to ensure proper state */}
            {open && (
                 <TransactionForm
                    // Keying the form can help force re-initialization if needed,
                    // especially switching between add and edit rapidly.
                    // key={transactionToEdit ? `edit-${transactionToEdit._id}` : 'add'}
                    transaction={initialFormValues}
                    onSubmit={onSubmit}
                    onCancel={onCancel} // Pass cancel handler to the form if it has its own cancel button
                    accountOptions={accountOptions}
                    categoryOptions={categoryOptions}
                />
            )}
        </Modal>
    );
};

export default AddEditTransactionModal;
