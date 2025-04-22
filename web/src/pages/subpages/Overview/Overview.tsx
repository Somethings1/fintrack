import { Row, Col } from "antd";
import MoneyFlow from "./MoneyFlow";
import RecentTransactions from "./RecentTransactions";
import TotalBalance from "./TotalBalance";
import TotalExpense from "./TotalExpense";
import TotalIncome from "./TotalIncome";
import TotalSavings from "./TotalSavings";
import BudgetOverview from "@/components/charts/BudgetOverview";
import SavingOverview from "./SavingOverview";

const Overview = () => {
    return (
        <>
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={12} lg={6}>
                    <TotalBalance />
                </Col>
                <Col xs={24} sm={12} md={12} lg={6}>
                    <TotalIncome />
                </Col>
                <Col xs={24} sm={12} md={12} lg={6}>
                    <TotalExpense />
                </Col>
                <Col xs={24} sm={12} md={12} lg={6}>
                    <TotalSavings />
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={16}>
                    <MoneyFlow />
                </Col>
                <Col xs={24} lg={8}>
                    <BudgetOverview />
                </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={16}>
                    <RecentTransactions />
                </Col>
                <Col xs={24} lg={8}>
                    <SavingOverview />
                </Col>
            </Row>
        </>
    );
};

export default Overview;

