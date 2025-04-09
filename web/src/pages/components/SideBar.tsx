import { Layout, Menu, Typography } from "antd";
import {
  DashboardOutlined,
  TransactionOutlined,
  DollarOutlined,
  BankOutlined,
  WalletOutlined,
  AppstoreOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import "@fontsource/orbitron";

const { Sider } = Layout;
const { Title } = Typography;

interface SidebarProps {
  setCurrentPage: (page: string) => void;
  collapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ setCurrentPage, collapsed }) => {
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      width={250}
      collapsedWidth={50}
      theme="dark"
      trigger={null} // Control from header
    >
      <div style={{ padding: "16px", textAlign: "center", color: "white" }}>
        <Title
          level={3}
          style={{
            fontFamily: "Orbitron",
            color: "#fff",
            margin: 0,
            fontSize: collapsed ? "24px" : "28px",
            transition: "all 0.3s ease",
          }}
        >
          {collapsed ? "F" : "FinTrack"}
        </Title>
      </div>
      <Menu
        theme="dark"
        mode="vertical"
        defaultSelectedKeys={["overview"]}
        onClick={(e) => setCurrentPage(e.key)}
      >
        <Menu.Item key="overview" icon={<DashboardOutlined />}>
          Overview
        </Menu.Item>
        <Menu.Item key="transactions" icon={<TransactionOutlined />}>
          Transactions
        </Menu.Item>
        <Menu.Item key="budget" icon={<DollarOutlined />}>
          Budget
        </Menu.Item>
        <Menu.Item key="accounts" icon={<BankOutlined />}>
          Accounts
        </Menu.Item>
        <Menu.Item key="savings" icon={<WalletOutlined />}>
          Savings
        </Menu.Item>
        <Menu.Item key="subscriptions" icon={<AppstoreOutlined />}>
          Subscriptions
        </Menu.Item>
        <Menu.Item key="settings" icon={<SettingOutlined />}>
          Settings
        </Menu.Item>
      </Menu>
    </Sider>
  );
};

export default Sidebar;

