import  TransactionTable  from '@/components/TransactionTable';
import Title from '@/components/Title';
import Subtitle from '@/components/Subtitle';
import { Row } from 'antd';

const Transactions = () => {
    return (
        <>

            <Row gutter={[16, 16]} style={{ margin: 0, marginBottom: 20 }}>
            <Title>Transactions</Title>
            <Subtitle>View, manage and export your transactions with filters and sortings.</Subtitle>
            </Row>
        <TransactionTable />
        </>
    );
}
export default Transactions;

