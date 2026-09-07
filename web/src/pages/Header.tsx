import NotificationPopover from '@/components/NotificationPopover';
import {
LeftOutlined,
MenuFoldOutlined,
MenuUnfoldOutlined,
RightOutlined,
UserOutlined
} from "@ant-design/icons";
import { Avatar,Button,Layout,Tooltip } from "antd";
import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/settings-context";

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



    const [navigation, setNavigation] = useState({ index: 0, entries: [currentPage] });
    const canGoBack = () => navigation.index > 0;
    const canGoForward = () => navigation.index < navigation.entries.length - 1;
    const goBack = () => {
        if (!canGoBack()) return;
        const index = navigation.index - 1;
        setNavigation({ ...navigation, index });
        setCurrentPage(navigation.entries[index]);
    };
    const goForward = () => {
        if (!canGoForward()) return;
        const index = navigation.index + 1;
        setNavigation({ ...navigation, index });
        setCurrentPage(navigation.entries[index]);
    };
    const { settings } = useSettings();
    useEffect(() => {
        setNavigation(previous => {
            if (previous.entries[previous.index] === currentPage) return previous;
            const entries = [...previous.entries.slice(0, previous.index + 1), currentPage];
            return { entries, index: entries.length - 1 };
        });
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
                <Tooltip title="Profile">
                    <Avatar
                        size="large"
                        icon={<UserOutlined />}
                        style={{ cursor: "pointer" }}
                        src={settings?.avatar_url || null}
                        onClick={() => navigate("/profile")}
                    />
                </Tooltip>
            </div>
        </Header>
    );
};

export default AppHeader;

