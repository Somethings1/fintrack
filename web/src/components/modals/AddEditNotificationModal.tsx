import NotificationForm from '@/components/forms/NotificationForm';
import { Notification } from '@/models/Notification';
import { Modal } from 'antd';
import React from 'react';

type NotificationFormSubmitValues = Partial<Notification>;

interface AddEditNotificationModalProps {
    open: boolean;
    onCancel: () => void;
    onSubmit: (values: NotificationFormSubmitValues) => Promise<void> | void;
    notificationToEdit: Notification | null;
    transactionId: string;
}

const AddEditNotificationModal: React.FC<AddEditNotificationModalProps> = ({
    open,
    onCancel,
    onSubmit,
    notificationToEdit,
    transactionId,
}) => {
    const modalTitle = notificationToEdit ? 'Edit Reminder' : 'Add Reminder';

    const initialFormValues = notificationToEdit
        ? { ...notificationToEdit }
        : {};


    return (
        <Modal
            title={modalTitle}
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
            width={500}
        >
            {open && (
                <NotificationForm
                    transactionId={transactionId}
                    initialData={initialFormValues}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                />
            )}
        </Modal>
    );
};

export default AddEditNotificationModal;

