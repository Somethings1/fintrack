// src/components/modals/ExportModal.tsx
import React from 'react';
import { Modal, Checkbox, Select, Button, Space, Typography } from 'antd';
import { ExportFileType } from '@/hooks/useTransactionExport'; // Import type

const { Option } = Select;
const { Title } = Typography;

interface ExportModalProps {
    open: boolean;
    onCancel: () => void;
    onOk: () => void; // This function will trigger the export logic in the parent hook
    columns: { key: string; title: string }[]; // All available columns
    selectedColumns: string[]; // Currently selected column keys
    selectedFileType: ExportFileType; // Currently selected file type
    onColumnChange: (checkedValues: string[]) => void; // Handler for column selection change
    onFileTypeChange: (value: ExportFileType) => void; // Handler for file type change
}

const ExportModal: React.FC<ExportModalProps> = ({
    open,
    onCancel,
    onOk,
    columns,
    selectedColumns,
    selectedFileType,
    onColumnChange,
    onFileTypeChange,
}) => {

    // Prepare checkbox options from the columns prop
    const checkboxOptions = columns
        // Filter out action columns if they exist and aren't meant to be exported
        .filter(col => col.key !== 'actions')
        .map(col => ({
            label: col.title,
            value: col.key,
        }));

    return (
        <Modal
            title="Export Transactions"
            open={open}
            onOk={onOk} // Trigger the export when OK is clicked
            onCancel={onCancel}
            okText="Export"
            cancelText="Cancel"
            width={500}
            destroyOnClose // Reset state if needed when closed
        >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                    <Title level={5}>Select Columns to Export:</Title>
                    <Checkbox.Group
                        options={checkboxOptions}
                        value={selectedColumns}
                        onChange={(checkedValues) => onColumnChange(checkedValues as string[])}
                        style={{ display: 'flex', flexDirection: 'column' }} // Layout checkboxes vertically
                    />
                    {/* Optional: Add Select All / Deselect All */}
                    {/*
                    <Button size="small" onClick={() => onColumnChange(checkboxOptions.map(opt => opt.value))}>Select All</Button>
                    <Button size="small" onClick={() => onColumnChange([])}>Deselect All</Button>
                    */}
                </div>

                <div>
                    <Title level={5}>Select File Type:</Title>
                    <Select
                        value={selectedFileType}
                        style={{ width: 150 }}
                        onChange={onFileTypeChange}
                    >
                        <Option value="xlsx">Excel (.xlsx)</Option>
                        <Option value="csv">CSV (.csv)</Option>
                        <Option value="pdf">PDF (.pdf)</Option>
                    </Select>
                </div>
            </Space>
        </Modal>
    );
};

export default ExportModal;
