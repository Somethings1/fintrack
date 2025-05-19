import React from 'react';
import { Button, Space } from 'antd';
import {
    DeleteOutlined,
    EditOutlined,
    FilterOutlined,
    SelectOutlined,
    PlusOutlined,
    DownloadOutlined
} from '@ant-design/icons';

interface TransactionActionBarProps {
    // Filter props
    isFilterActive: boolean;
    filteredCount: number;
    totalCount: number;
    onShowFilters: () => void;

    // Select/Delete props
    selectMode: boolean;
    selectedRowCount: number;
    onToggleSelectMode: () => void;
    onBulkDelete: () => void;

    // Export props
    onShowExport: () => void;

    // Edit Mode props
    editMode: boolean;
    onToggleEditMode: () => void;

    // Add props
    onAddNew: () => void;
}

const TransactionActionBar: React.FC<TransactionActionBarProps> = ({
    isFilterActive,
    filteredCount,
    totalCount,
    onShowFilters,
    selectMode,
    selectedRowCount,
    onToggleSelectMode,
    onBulkDelete,
    onShowExport,
    editMode,
    onToggleEditMode,
    onAddNew,
}) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: '8px' }}>
            {/* Left Side Buttons */}
            <Space wrap> {/* Use Ant Design Space for consistent gap and wrapping */}
                <Button
                    type={isFilterActive ? "primary" : "default"}
                    icon={<FilterOutlined />}
                    onClick={onShowFilters}
                >
                    Filters {isFilterActive && `(${filteredCount}/${totalCount})`}
                </Button>
                <Button
                    icon={<SelectOutlined />}
                    onClick={onToggleSelectMode}
                    type={selectMode ? "primary" : "default"}
                >
                    {selectMode ? "Exit Select" : "Select"}
                </Button>
                {selectMode && (
                    <Button
                        danger
                        type="primary"
                        icon={<DeleteOutlined />}
                        disabled={selectedRowCount === 0}
                        onClick={onBulkDelete}
                    >
                        Delete ({selectedRowCount})
                    </Button>
                )}
            </Space>

            {/* Right Side Buttons */}
            <Space wrap>
                 <Button icon={<DownloadOutlined />} onClick={onShowExport}>
                    Export
                </Button>
                <Button
                    icon={<EditOutlined />}
                    onClick={onToggleEditMode}
                    type={editMode ? "primary" : "default"}
                >
                    {editMode ? "Exit Edit" : "Edit Mode"}
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={onAddNew}>
                    Add New
                </Button>
            </Space>
        </div>
    );
};

export default TransactionActionBar;
