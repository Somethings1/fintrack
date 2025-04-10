import { Layout, Avatar, Popover, Button } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LeftOutlined,
  RightOutlined,
  BellOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { logout } from "@/services/authService";

const { Header } = Layout;

interface HeaderProps {
  setSidebarCollapsed: (collapsed: boolean) => void;
  collapsed: boolean;
}

const AppHeader: React.FC<HeaderProps> = ({ setSidebarCollapsed, collapsed }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <Header
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        background: "#fff",
        boxShadow: "0 2px 8px #f0f1f2",
      }}
    >
      {/* Left-side controls: Collapse Button + Navigation Arrows */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Collapse Button */}
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setSidebarCollapsed(!collapsed)}
          style={{ fontSize: "18px" }}
        />

        {/* Navigation Arrows */}
        <LeftOutlined
          onClick={() => navigate(-1)}
          style={{ fontSize: "18px", cursor: "pointer" }}
        />
        <RightOutlined
          onClick={() => navigate(1)}
          style={{ fontSize: "18px", cursor: "pointer" }}
        />
      </div>

      {/* Right-side controls: Notifications + Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <Popover content="No notifications" trigger="click">
          <BellOutlined style={{ fontSize: "18px", cursor: "pointer" }} />
        </Popover>

        <Popover
          content={<Button onClick={handleLogout} type="link">Logout</Button>}
          trigger="click"
        >
          <Avatar size="large" icon={<UserOutlined />} style={{ cursor: "pointer" }} />
        </Popover>
      </div>
    </Header>
  );
};

export default AppHeader;

