// src/components/modals/DeleteConfirmationModal.tsx
import React from 'react';
import { Modal, Typography, Alert, Space } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface DeleteConfirmationModalProps {
    open: boolean;
    onCancel: () => void;
    onOk: () => void; // Function to execute the deletion
    count: number; // Number of items to be deleted
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    open,
    onCancel,
    onOk,
    count,
}) => {
    return (
        <Modal
            title={
                <Space>
                    <WarningOutlined style={{ color: '#faad14' }} />
                    Confirm Deletion
                </Space>
            }
            open={open}
            onOk={onOk}
            onCancel={onCancel}
            okText="Yes, Delete"
            cancelText="No, Cancel"
            okButtonProps={{ danger: true }} // Make the OK button red
            width={400}
        >
            <Alert
                message="Irreversible Action"
                description="Once deleted, these transactions cannot be recovered."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <Text>
                You are about to permanently delete{' '}
                <strong>{count}</strong> transaction{count !== 1 ? 's' : ''}.
            </Text>
            <br />
            <Text>Are you absolutely sure you want to proceed?</Text>
        </Modal>
    );
};

export default DeleteConfirmationModal;
