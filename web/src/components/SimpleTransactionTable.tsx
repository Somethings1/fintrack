// SimpleTransactionTable.tsx
import { Table } from "antd";
import { Transaction } from "@/models/Transaction";

interface SimpleTransactionTableProps {
    transactions: Transaction[];
}

const SimpleTransactionTable: React.FC<SimpleTransactionTableProps> = ({ transactions }) => {
    const columns = [
        {
            title: "Date",
            dataIndex: "dateTime",
            key: "dateTime",
            render: (value: Date) => new Date(value).toLocaleDateString("en-GB", {
                day: '2-digit',
                month: '2-digit',
            }),
        },
        {
            title: "Amount",
            dataIndex: "amount",
            key: "amount",
            render: (value: number) => `${value.toLocaleString()} đ`,
        },
        {
            title: "Type",
            dataIndex: "type",
            key: "type",
            render: (type: string) => type.charAt(0).toUpperCase() + type.slice(1),
        },
        {
            title: "Source",
            dataIndex: "sourceAccountName",
            key: "sourceAccountName",
        },
        {
            title: "Destination",
            dataIndex: "destinationAccountName",
            key: "destinationAccountName",
        },
        {
            title: "Note",
            dataIndex: "note",
            key: "note",
        },
    ];

    return <Table rowKey="_id" dataSource={transactions} columns={columns} pagination={false} />;
};

export default SimpleTransactionTable;

