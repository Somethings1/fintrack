import  TransactionTable  from '@/components/TransactionTable';
import Title from '@/components/Title';
import Subtitle from '../../../components/Subtitle';

const Transactions = () => {
    return (
        <>
        <Title>Transactions</Title>
        <Subtitle>View, manage and export your transactions with filters and sortings.</Subtitle>
        <TransactionTable />
        </>
    );
}
export default Transactions;

