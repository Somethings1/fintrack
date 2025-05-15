import React, { useMemo } from "react";
import { Table, Spin } from "antd";

import { useTransactions } from "@/hooks/useTransactions";
import { getSimpleColumns } from "@/config/transactionTableColumns";

const SimpleTransactionTable: React.FC = () => {
    const {
        transactions: rawTransactions,
        isLoading,
    } = useTransactions();

    const columns = useMemo(() => getSimpleColumns(false, () => {}), []);

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

