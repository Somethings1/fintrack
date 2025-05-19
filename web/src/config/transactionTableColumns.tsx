// src/config/transactionTableColumns.tsx
import React from 'react';
import { Button } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { ResolvedTransaction } from '@/hooks/useTransactions'; // Import type
import { highlightMatches } from '@/utils/transactionUtils'; // Import utility
import Balance from '../components/Balance';

type HandleEditFunction = (transaction: ResolvedTransaction) => void;

export const getBaseColumns = () => [
    {
        title: "Date",
        dataIndex: "dateTime",
        key: "dateTime",
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) =>
            new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
        render: (value: Date) =>
            new Date(value).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }),
    },
    {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) => (a.amount ?? 0) - (b.amount ?? 0),
        render: (value: number, record: ResolvedTransaction) => {
            return <Balance amount={value} type={record.type} />;
        },
    },
    {
        title: "Type",
        dataIndex: "type",
        key: "type",
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) => a.type.localeCompare(b.type),
        render: (type: ResolvedTransaction["type"]) => type ? type.charAt(0).toUpperCase() + type.slice(1) : '',
    },
    {
        title: "Source",
        dataIndex: "sourceAccountName",
        key: "sourceAccountName",
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) =>
            (a.sourceAccountName ?? "").localeCompare(b.sourceAccountName ?? ""),
    },
    {
        title: "Destination",
        dataIndex: "destinationAccountName",
        key: "destinationAccountName",
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) =>
            (a.destinationAccountName ?? "").localeCompare(b.destinationAccountName ?? ""),
    },
    {
        title: "Category",
        dataIndex: "categoryName",
        key: "categoryName",
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) =>
            (a.categoryName ?? "").localeCompare(b.categoryName ?? ""),
    },
    {
        title: "Note",
        dataIndex: "note",
        key: "note",
        render: (note: string, record: ResolvedTransaction) => {
            const match = record._searchMatches?.find((m: any) => m.key === "_normalized_note");
            if (!match || !match.indices?.length) return note ?? '';

            return (
                <span
                    dangerouslySetInnerHTML={{
                        __html: highlightMatches(note, match.indices),
                    }}
                />
            );
        },
        sorter: (a: ResolvedTransaction, b: ResolvedTransaction) => (a.note ?? "").localeCompare(b.note ?? ""),
    },
];

const HIDDEN_KEYS = ["type", "note"];

export const getSimpleColumns = () => {
    return getBaseColumns()
        .filter(col => !HIDDEN_KEYS.includes(col.key))
        .map(col => ({ ...col, sorter: false }));
};

export const getEditColumn = (handleEdit: HandleEditFunction) => ({
    title: "Actions",
    key: "actions",
    width: 80, // Adjust width as needed
    render: (_: any, transaction: ResolvedTransaction) => (
        <Button
            icon={<EditOutlined />}
            onClick={(e) => {
                e.stopPropagation(); // Prevent row click if any
                handleEdit(transaction);
            }}
            size="small"
            aria-label={`Edit transaction ${transaction._id}`}
        />
    ),
});

// Function to get all columns based on edit mode
export const getColumns = (editMode: boolean, handleEdit: HandleEditFunction) => {
    const base = getBaseColumns();
    return editMode ? [...base, getEditColumn(handleEdit)] : base;
};
