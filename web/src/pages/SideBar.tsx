import React, { useState } from "react";
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
import { colors } from "../theme/color";

const { Sider } = Layout;
const { Title } = Typography;

interface SidebarProps {
  setCurrentPage: (page: string) => void;
  collapsed: boolean;
  onBreakpoint: (broken: boolean) => void;
}

interface MenuItemProps {
  itemKey: string;
  icon: React.ReactNode;
  label: string;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  collapsed: boolean;
}

const CustomMenuItem: React.FC<MenuItemProps> = ({
  itemKey,
  icon,
  label,
  selectedKey,
  setSelectedKey,
  collapsed,
}) => {
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedKey === itemKey;
  const isHovered = hovered && !isSelected;

  const style: React.CSSProperties = {
      padding: collapsed ? "0 13px" : "5px 20px",
      borderRadius: "100px",
      height: collapsed ? "40px" : "auto",
      fontSize: "0.9rem",
    color: isSelected
        ? colors.white
        : colors.black,
    backgroundColor: isSelected
      ? colors.primary[600]
      : isHovered
      ? colors.primary[400]
      : "transparent",
    transition: "all 0.2s ease",
  };

  return (
    <Menu.Item
      key={itemKey}
      icon={icon}
      style={style}
      onClick={() => setSelectedKey(itemKey)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </Menu.Item>
  );
};

const SideBar: React.FC<SidebarProps> = ({ setCurrentPage, collapsed, onBreakpoint }) => {
  const [selectedKey, setSelectedKey] = useState("overview");

  const handleSelection = (key: string) => {
    setSelectedKey(key);
    setCurrentPage(key);
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      width={250}
      collapsedWidth={50}
      breakpoint="lg"
      onBreakpoint={onBreakpoint}
      theme="light"
      style={{ backgroundColor: colors.primary[100] }}
      trigger={null}
    >
      <div style={{ padding: "16px", textAlign: "center", color: "#000" }}>
        <Title
          level={3}
          style={{
            fontFamily: "Orbitron",
            color: "#000",
            margin: 0,
            fontSize: collapsed ? "24px" : "28px",
            transition: "all 0.3s ease",
          }}
        >
          {collapsed ? "F" : "FinTrack"}
        </Title>
      </div>
      <Menu
        mode="vertical"
        selectedKeys={[selectedKey]}
        style={{
          backgroundColor: colors.primary[100],
          borderRight: "none",
          marginTop: "20px",
        }}
      >
        <CustomMenuItem
          itemKey="overview"
          icon={<DashboardOutlined />}
          label="Overview"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
        <CustomMenuItem
          itemKey="transactions"
          icon={<TransactionOutlined />}
          label="Transactions"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
        <CustomMenuItem
          itemKey="budget"
          icon={<DollarOutlined />}
          label="Budget"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
        <CustomMenuItem
          itemKey="accounts"
          icon={<BankOutlined />}
          label="Accounts"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
        <CustomMenuItem
          itemKey="savings"
          icon={<WalletOutlined />}
          label="Savings"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
        <CustomMenuItem
          itemKey="subscriptions"
          icon={<AppstoreOutlined />}
          label="Subscriptions"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
        <CustomMenuItem
          itemKey="settings"
          icon={<SettingOutlined />}
          label="Settings"
          selectedKey={selectedKey}
          setSelectedKey={handleSelection}
          collapsed={collapsed}
        />
      </Menu>
    </Sider>
  );
};

export default SideBar;

