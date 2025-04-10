import { Layout } from "antd";
import { useState } from "react";
import SideBar from "./SideBar";
import AppHeader from "./Header";
import Overview from "./subpages/Overview/Overview";
import Transactions from "./subpages/Transactions/Transactions";
import Budget from "./subpages/Budget/Budget";
import Accounts from "./subpages/Accounts/Accounts";
import Savings from "./subpages/Savings/Savings";
import Subscriptions from "./subpages/Subscriptions/Subscriptions";
import Settings from "./subpages/Settings/Settings";

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
      case "settings":
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  return (
    <Layout style={{ minHeight: "100vh", minWidth: "100vw" }}>
      <SideBar
        collapsed={sidebarCollapsed}
        setCurrentPage={setCurrentPage}
      />
      <Layout>
        <AppHeader
          collapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />
        <Content style={{ padding: "20px" }}>{renderPage()}</Content>
      </Layout>
    </Layout>
  );
};

export default HomePage;

