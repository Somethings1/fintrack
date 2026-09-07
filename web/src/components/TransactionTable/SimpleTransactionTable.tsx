import { Spin,Table } from "antd";
import React,{ useMemo } from "react";

import { getSimpleColumns } from "@/config/transactionTableColumns";
import { useTransactions } from "@/hooks/useTransactions";

const SimpleTransactionTable: React.FC = () => {
    const {
        transactions: rawTransactions,
        isLoading,
    } = useTransactions();

    const columns = useMemo(() => getSimpleColumns(), []);

    const data = useMemo(() => rawTransactions.slice(0, 3), [rawTransactions]);

    return (
        <Spin spinning={isLoading}>
            <Table
                rowKey="_id"
                dataSource={data}
                columns={columns}
                pagination={false}
                scroll={{ x: 'max-content' }}
            />
        </Spin>
    );
};

export default SimpleTransactionTable;

