import React, { useState, useEffect, useRef } from "react";
import {
    Popover,
    List,
    Typography,
    Badge,
    Button,
    Divider,
} from "antd";
import {
    BellOutlined,
    ArrowLeftOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useNotifications } from "@/hooks/useNotifications";
import { markAsRead } from "@/services/notificationService";
import { Notification } from "@/models/Notification";

dayjs.extend(relativeTime);

const BATCH_SIZE = 10;

const NotificationPopover = () => {
    const allNotifications = useNotifications();
    const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    const processNotifications = () => {
        const now = dayjs();
        const filtered = allNotifications
            .filter(n => dayjs(n.scheduledAt).isBefore(now) || dayjs(n.scheduledAt).isSame(now))
            .sort((a, b) => dayjs(b.scheduledAt).valueOf() - dayjs(a.scheduledAt).valueOf());
        setFilteredNotifications(filtered);
    };

    useEffect(() => {
        processNotifications();
        const intervalId = setInterval(processNotifications, 5000);
        return () => clearInterval(intervalId);
    }, [allNotifications]);

    const unreadNotifications = filteredNotifications.filter(n => !n.read);
    const unreadCount = unreadNotifications.length;

    const onNotificationClick = async (notification: Notification) => {
        setSelectedNotification(notification);

        if (!notification.read) {
            await markAsRead([notification._id], true);
            setFilteredNotifications(prev =>
                prev.map(n => n._id === notification._id ? { ...n, read: true } : n)
            );
        }
    };

    const onBackClick = () => {
        setSelectedNotification(null);
    };

    const onMarkAllAsRead = async () => {
        const unreadIds = unreadNotifications.map(n => n._id);
        if (unreadIds.length === 0) return;

        await markAsRead(unreadIds);

        setFilteredNotifications(prev =>
            prev.map(n => unreadIds.includes(n._id) ? { ...n, read: true } : n)
        );
    };

    const getTimeLabel = (time: string) => {
        const now = dayjs();
        const scheduled = dayjs(time);
        const diff = now.diff(scheduled, 'minute');

        if (diff < 1) return "now";
        if (diff < 60) return `${diff} minute${diff > 1 ? "s" : ""} ago`;

        const hourDiff = now.diff(scheduled, 'hour');
        if (hourDiff < 24) return `${hourDiff} hour${hourDiff > 1 ? "s" : ""} ago`;

        return scheduled.format("YYYY-MM-DD HH:mm");
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
        if (atBottom && visibleCount < filteredNotifications.length) {
            setVisibleCount(prev => prev + BATCH_SIZE);
        }
    };

    const visibleNotifications = filteredNotifications.slice(0, visibleCount);

    const content = (
        <div style={{ width: 350, height: 400, display: "flex", flexDirection: "column" }}>
            {selectedNotification ? (
                <>
                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            paddingRight: 8,
                            paddingBottom: 8,
                        }}
                    >
                        <Button
                            type="link"
                            icon={<ArrowLeftOutlined />}
                            onClick={onBackClick}
                            style={{ marginBottom: 8, padding: 0 }}
                        >
                            Back
                        </Button>
                        <Typography.Title level={5}>{selectedNotification.title}</Typography.Title>
                        <Typography.Paragraph>{selectedNotification.message}</Typography.Paragraph>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Scheduled: {dayjs(selectedNotification.scheduledAt).format("YYYY-MM-DD HH:mm")}
                        </Typography.Text>
                    </div>
                </>
            ) : (
                <>
                    <Typography.Title level={5}>Notifications</Typography.Title>
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            paddingRight: 8,
                        }}
                    >
                        <List
                            size="small"
                            dataSource={visibleNotifications}
                            renderItem={(item) => (
                                <List.Item
                                    style={{
                                        cursor: "pointer",
                                        backgroundColor: item.read ? "transparent" : "#e6f7ff",
                                        fontWeight: item.read ? "normal" : "bold",
                                        borderBottom: "1px solid #f0f0f0",
                                    }}
                                    onClick={() => onNotificationClick(item)}
                                >
                                    <div>
                                        <Typography.Text strong={!item.read}>
                                            {item.title}
                                        </Typography.Text>
                                        <div style={{ fontSize: 12, color: "#888" }}>
                                            {getTimeLabel(item.scheduledAt)}
                                        </div>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </div>

                    <Divider style={{ margin: "8px 0" }} />

                    <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 8px" }}>
                        <Button size="small" type="link" onClick={onMarkAllAsRead}>
                            Mark all as read
                        </Button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            placement="bottomRight"
            overlayStyle={{ width: 370 }}
        >
            <div style={{ width: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Badge count={unreadCount} size="small" overflowCount={99}>
                    <BellOutlined style={{ fontSize: "20px", cursor: "pointer" }} />
                </Badge>
            </div>
        </Popover>
    );
};

export default NotificationPopover;
