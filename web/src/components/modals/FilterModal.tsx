// src/components/modals/FilterModal.tsx
import React from 'react';
import { Modal, Form, Select, DatePicker, Slider, Input, Button } from 'antd';
import { TransactionFilters } from '@/hooks/useTransactionFilters'; // Import type
import { AccountOption, CategoryOption } from '@/hooks/useTransactions'; // Import types

interface FilterModalProps {
    open: boolean;
    onCancel: () => void;
    initialValues: TransactionFilters;
    onApply: (values: TransactionFilters) => void;
    onReset: () => void;
    accountOptions: AccountOption[];
    categoryOptions: CategoryOption[];
}

const FilterModal: React.FC<FilterModalProps> = ({
    open,
    onCancel,
    initialValues,
    onApply,
    onReset,
    accountOptions,
    categoryOptions,
}) => {
    const [form] = Form.useForm();

    const handleReset = () => {
        form.resetFields();
        onReset(); // Call the reset function passed from the hook/parent
        onCancel(); // Close modal after reset
    };

    const handleApply = (values: any) => {
        // Potentially transform values if needed before applying
        onApply(values as TransactionFilters);
        onCancel(); // Close modal after applying
    };

    return (
        <Modal
            title="Filter Transactions"
            open={open}
            onCancel={onCancel}
            footer={null} // Custom footer buttons
            destroyOnClose // Reset form state when modal closes
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleApply}
                initialValues={initialValues}
            >
                <Form.Item name="type" label="Type">
                    <Select allowClear placeholder="Any Type">
                        <Select.Option value="income">Income</Select.Option>
                        <Select.Option value="expense">Expense</Select.Option>
                        <Select.Option value="transfer">Transfer</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item name="dateRange" label="Date Range">
                    <DatePicker.RangePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="amountRange" label="Amount Range">
                    <Slider range min={0} max={50000000} step={100000} tooltip={{ formatter: value => `${value?.toLocaleString()} đ` }}/>
                </Form.Item>

                <Form.Item name="sourceAccount" label="Source Account">
                    <Select allowClear options={accountOptions} placeholder="Any Source" />
                </Form.Item>

                <Form.Item name="destinationAccount" label="Destination Account">
                    <Select allowClear options={accountOptions} placeholder="Any Destination" />
                </Form.Item>

                <Form.Item name="category" label="Category">
                    <Select allowClear options={categoryOptions} placeholder="Any Category" />
                </Form.Item>

                <Form.Item name="note" label="Note">
                    <Input placeholder="Search notes..." />
                </Form.Item>

                <Form.Item>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button htmlType="button" onClick={handleReset}>
                            Reset
                        </Button>
                        <Button type="primary" htmlType="submit">
                            Apply Filters
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default FilterModal;
