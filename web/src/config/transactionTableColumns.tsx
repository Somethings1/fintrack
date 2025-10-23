// src/config/transactionTableColumns.tsx
import React from 'react';
import { Button, Tooltip, Tag, Space } from 'antd';
import { EditOutlined, BellOutlined } from '@ant-design/icons';
import { ResolvedTransaction } from '@/hooks/useTransactions'; // Import type
import { highlightMatches } from '@/utils/transactionUtils'; // Import utility
import Balance from '@/components/Balance';
import { Notification } from '@/models/Notification';
import dayjs from 'dayjs';

type HandleEditFunction = (transaction: ResolvedTransaction) => void;

export const getBaseColumns = (notifications: Notification[]) => [
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
            const noteHtml = match?.indices?.length
                ? <span dangerouslySetInnerHTML={{ __html: highlightMatches(note, match.indices) }} />
                : <span>{note ?? ''}</span>;

            const notif = notifications.find(n => n.referenceId === record._id);

            return (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {noteHtml}
                </span>
            );
        },
        sorter: (a, b) => (a.note ?? "").localeCompare(b.note ?? ""),
    },
];

const HIDDEN_KEYS = ["type", "reminder"];

export const getSimpleColumns = () => {
    return getBaseColumns([])
        .filter(col => !HIDDEN_KEYS.includes(col.key))
        .map(col => ({ ...col, sorter: false }));
};

export const getEditColumn = (
    handleEdit: HandleEditFunction,
) => ({
    title: "Actions",
    key: "actions",
    width: 80, // Adjust width as needed
    align: "center",
    render: (_: any, transaction: ResolvedTransaction) => (
        <Button
            icon={<EditOutlined />}
            onClick={(e) => {
                e.stopPropagation();
                handleEdit(transaction);
            }}
            shape="circle"
            className="table-edit-btn"
            aria-label={`Edit transaction ${transaction._id}`}
        />
    ),
});

const getReminderColumn = (
    notifications: Notification[],
    handleUpsertReminder: (transaction: ResolvedTransaction) => void
) => ({
    title: "Reminder",
    key: "reminder",
    dataIndex: "reminder",
    width: 120,
    align: "center",
    render: (_: any, transaction: ResolvedTransaction) => {
        const reminder = notifications.find(
            (n) => n.referenceId === transaction._id
        );

        if (!reminder) return (
            <Tooltip title="Add reminder to this transaction">
                <Button className="table-button" shape="circle" icon={<BellOutlined />} onClick={(e) => {
                    e.stopPropagation();
                    handleUpsertReminder(transaction);
                }}
                />
            </Tooltip>
        );

        const date = dayjs(reminder.scheduledAt);
        const formattedDate = date.format("MMM DD"); // e.g., "Jun 01"
        const fullDate = date.format("YYYY-MM-DD HH:mm:ss");

        const tooltipContent = (
            <>
                <div><strong>Message:</strong> {reminder.message || "No message"}</div>
                <div><strong>Scheduled At:</strong> {fullDate}</div>
            </>
        );

        return (
            <Tooltip title={tooltipContent}>
                <Tag
                    color="blue"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleUpsertReminder(transaction);
                    }}
                    style={{ cursor: "pointer", margin: 0 }}
                >
                    {formattedDate}
                </Tag>
            </Tooltip>
        );
    },
});

export const getColumns = (
    editMode: boolean,
    handleEdit: HandleEditFunction,
    notifications: Notification[],
    handleUpsertReminder: (transaction: ResolvedTransaction) => void
) => {
    const base = getBaseColumns(notifications);
    const reminderColumn = getReminderColumn(notifications, handleUpsertReminder);
    const editColumn = getEditColumn(handleEdit);
    return [...base, reminderColumn, ...(editMode ? [editColumn] : [])];
};
