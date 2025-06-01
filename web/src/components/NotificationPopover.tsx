import React, { useState, useEffect } from "react";
import {
  Popover,
  List,
  Typography,
  Badge,
  Button,
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
    const intervalId = setInterval(filterByScheduledTime, 30000);
    return () => clearInterval(intervalId);
  }, [allNotifications]);

  // Unread count calculation
  const unreadCount = filteredNotifications.filter((n) => !n.read).length;

  const onNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);

    if (!notification.read) {
      await markAsRead(notification._id);
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
        <List
          size="small"
          dataSource={filteredNotifications}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: "pointer",
                backgroundColor: item.read ? "transparent" : "#e6f7ff",
              }}
              onClick={() => onNotificationClick(item)}
            >
              <Typography.Text strong={!item.read}>
                {item.title}
              </Typography.Text>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      overlayStyle={{
        width: 320,
      }}
    >
      <Badge count={unreadCount} size="small" overflowCount={99}>
        <BellOutlined style={{ fontSize: "18px", cursor: "pointer" }} />
      </Badge>
    </Popover>
  );
};

export default NotificationPopover;

