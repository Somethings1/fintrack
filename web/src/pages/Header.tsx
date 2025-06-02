import { Layout, Avatar, Popover, Button } from "antd";
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    LeftOutlined,
    RightOutlined,
    BellOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "@/services/authService";
import NotificationPopover from '@/components/NotificationPopover';

const { Header } = Layout;

interface HeaderProps {
    currentPage: string;
    setCurrentPage: (newPage: string) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    collapsed: boolean;
}

const AppHeader: React.FC<HeaderProps> = ({
    currentPage,
    setCurrentPage,
    setSidebarCollapsed,
    collapsed,
}) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    const [currentIndex, setCurrentIndex] = useState(0);
    const [history, setHistory] = useState<string[]>(["overview"]);
    const isNavigatingRef = useRef(false);

    const canGoBack = () => currentIndex > 0;
    const canGoForward = () => currentIndex < history.length - 1;

    const goBack = () => {
        const newIndex = currentIndex - 1;
        isNavigatingRef.current = true;
        setCurrentIndex(newIndex);
        setCurrentPage(history[newIndex]);
    }

    const goForward = () => {
        const newIndex = currentIndex + 1;
        isNavigatingRef.current = true;
        setCurrentIndex(newIndex);
        setCurrentPage(history[newIndex]);
    }

    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            return;
        }
        const updatedHistory = [...history.slice(0, currentIndex + 1), currentPage];
        setHistory(updatedHistory);
        setCurrentIndex(updatedHistory.length - 1);
    }, [currentPage]);

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
                <Button
                    type="text"
                    disabled={!canGoBack()}
                    icon={<LeftOutlined />}
                    onClick={goBack}
                    style={{ fontSize: "18px", margin: "0 -10px" }}
                />
                <Button
                    type="text"
                    disabled={!canGoForward()}
                    icon={<RightOutlined />}
                    onClick={goForward}
                    style={{ fontSize: "18px", margin: "0 -10px" }}
                />
            </div>

            {/* Right-side controls: Notifications + Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <NotificationPopover />

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

