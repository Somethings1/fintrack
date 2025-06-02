import { Row, Col, DatePicker } from "antd";
import MoneyFlow from "./MoneyFlow";
import RecentTransactions from "./RecentTransactions";
import TotalBalance from "./TotalBalance";
import TotalExpense from "./TotalExpense";
import TotalIncome from "./TotalIncome";
import TotalSavings from "./TotalSavings";
import BudgetOverview from "@/components/charts/BudgetOverview";
import SavingOverview from "./SavingOverview";
import dayjs, { Dayjs } from 'dayjs';
import { useState, useEffect } from 'react';
import Title from "@/components/Title";
import { getCurrentUser } from "@/services/authService";
import Subtitle from "@/components/Subtitle";

interface OverviewProps {
    linkToTransactions: () => void;
    linkToBudget: () => void;
    linkToSavings: () => void;
    linkToAccounts: () => void;
}

const Overview: React.FC<OverviewProps> = ({
    linkToTransactions,
    linkToBudget,
    linkToSavings,
    linkToAccounts,
}) => {
    const [name, setName] = useState("");

    useEffect(() => {
        const fetchName = async () => {
            try {
                const user = await getCurrentUser();
                setName(user?.user_metadata?.full_name ?? "");
            }
            catch (e) {
                console.error("Wtf???");
            }
        }
        fetchName();
    }, [])

    return (
        <>

            <Row gutter={[16, 16]} style={{ margin: 0, marginBottom: 20 }}>
                <Title>Welcome back, {name}</Title>
                <br />
                <Subtitle>Let's look at your finances this month</Subtitle>
            </Row>
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
                    <BudgetOverview linkToBudget={linkToBudget}/>
                </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={16}>
                    <RecentTransactions linkToTransactions={linkToTransactions}/>
                </Col>
                <Col xs={24} lg={8}>
                    <SavingOverview linkToSavings={linkToSavings}/>
                </Col>
            </Row>
        </>
    );
};

export default Overview;

