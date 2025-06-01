import React, { useState, useEffect } from "react";
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

import { useNotifications } from "@/hooks/useNotifications";
import { markAsRead } from "@/services/notificationService";
import { Notification } from "@/models/Notification";

const NotificationPopover = () => {
    const allNotifications = useNotifications();
    const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

    // Filter notifications based on scheduled time
    const filterByScheduledTime = () => {
        const now = dayjs();
        const filtered = allNotifications.filter(
            (n) => dayjs(n.scheduledAt).isBefore(now) || dayjs(n.scheduledAt).isSame(now)
        );
        setFilteredNotifications(filtered);
    };

    useEffect(() => {
        filterByScheduledTime();
        const intervalId = setInterval(filterByScheduledTime, 5000);
        return () => clearInterval(intervalId);
    }, [allNotifications]);

    // Unread count calculation
    const unreadNotifications = filteredNotifications.filter((n) => !n.read);
    const unreadCount = unreadNotifications.length;

    const onNotificationClick = async (notification: Notification) => {
        setSelectedNotification(notification);

        if (!notification.read) {
            await markAsRead([notification._id], true);
            setFilteredNotifications((prev) =>
                prev.map((n) =>
                    n._id === notification._id ? { ...n, read: true } : n
                )
            );
        }
    };

    const onBackClick = () => {
        setSelectedNotification(null);
    };

    const onMarkAllAsRead = async () => {
        const unreadIds = unreadNotifications.map((n) => n._id);
        if (unreadIds.length === 0) return;

        await markAsRead(unreadIds);

        // Optimistically update UI
        setFilteredNotifications((prev) =>
            prev.map((n) =>
                unreadIds.includes(n._id) ? { ...n, read: true } : n
            )
        );
    };

    const content = (
        <div
            style={{
                width: 300,
                maxHeight: 320,
                overflowY: "auto",
                paddingRight: 8,
            }}
        >
            {selectedNotification ? (
                <>
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
                        Scheduled:{" "}
                        {dayjs(selectedNotification.scheduledAt).format("YYYY-MM-DD HH:mm")}
                    </Typography.Text>
                </>
            ) : filteredNotifications.length === 0 ? (
                <Typography.Text type="secondary">No notifications</Typography.Text>
            ) : (
                <>

                    <Typography.Title level={5}>Notifications</Typography.Title>
                    <List
                        size="small"
                        dataSource={filteredNotifications}
                        renderItem={(item) => (
                            <List.Item
                                style={{
                                    cursor: "pointer",
                                    backgroundColor: item.read ? "transparent" : "#e6f7ff",
                                    borderTop: ".25px solid grey",
                                    borderBottom: ".25px solid grey",
                                }}
                                onClick={() => onNotificationClick(item)}
                            >
                                <Typography.Text strong={!item.read}>
                                    {item.title}
                                </Typography.Text>
                            </List.Item>
                        )}
                    />
                    {unreadCount > 0 && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                            <Button size="small" type="link" onClick={onMarkAllAsRead}>
                                Mark all as read
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            placement="bottomRight"
            overlayStyle={{ width: 320 }}
        >
            <Badge count={unreadCount} size="small" overflowCount={99}>
                <BellOutlined style={{ fontSize: "20px", cursor: "pointer", display: "block" }} />
            </Badge>
        </Popover>

    );
};

export default NotificationPopover;

