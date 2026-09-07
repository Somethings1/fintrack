import { Layout } from "antd";
import { useState } from "react";
import ChatBot from "./ChatBot";
import AppHeader from "./Header";
import SideBar from "./SideBar";
import Accounts from "./subpages/Accounts/Accounts";
import Budget from "./subpages/Budget/Budget";
import Overview from "./subpages/Overview/Overview";
import Savings from "./subpages/Savings/Savings";
import Subscriptions from "./subpages/Subscriptions/Subscriptions";
import Transactions from "./subpages/Transactions/Transactions";

const { Content } = Layout;

const HomePage = () => {
    const [currentPage, setCurrentPage] = useState("overview");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);


    const renderPage = () => {
        switch (currentPage) {
            case "transactions":
                return <Transactions />;
            case "budget":
                return <Budget />;
            case "accounts":
                return <Accounts />;
            case "savings":
                return <Savings />;
            case "subscriptions":
                return <Subscriptions />;
            default:
                return (<Overview
                    linkToTransactions={() => setCurrentPage("transactions")}
                    linkToBudget={() => setCurrentPage("budget")}
                    linkToSavings={() => setCurrentPage("savings")}
                    linkToAccounts={() => { setCurrentPage("accounts") }}
                />);
        }
    };

    return (
        <Layout style={{ height: "100vh", overflow: "hidden" }}>
            <SideBar
                currentPage={currentPage}
                collapsed={sidebarCollapsed}
                setCurrentPage={setCurrentPage}
                onBreakpoint={(broken) => setSidebarCollapsed(broken)}
            />
            <Layout style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <AppHeader
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    collapsed={sidebarCollapsed}
                    setSidebarCollapsed={setSidebarCollapsed}
                />
                <Content style={{ padding: "20px", overflow: "auto", flex: 1 }}>{renderPage()}</Content>
                <ChatBot />
            </Layout>
        </Layout>
    );
};

export default HomePage;

