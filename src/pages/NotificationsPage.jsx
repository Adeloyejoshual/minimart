import { useEffect, useState } from "react";

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const token = localStorage.getItem("token");

  // fetch notifications
  const fetchNotifications = async () => {
    const res = await fetch("/api/notifications", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setNotifications(data.data || []);
  };

  // fetch unread count
  const fetchUnread = async () => {
    const res = await fetch("/api/notifications/unread-count", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setUnread(data.count || 0);
  };

  useEffect(() => {
    fetchUnread();
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    await fetch(`/api/notifications/read/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    fetchNotifications();
    fetchUnread();
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Bell Icon */}
      <button onClick={() => setOpen(!open)}>
        🔔
        {unread > 0 && (
          <span style={{
            background: "red",
            color: "white",
            borderRadius: "50%",
            padding: "2px 6px",
            fontSize: "12px",
            marginLeft: "5px"
          }}>
            {unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          width: "300px",
          background: "#fff",
          border: "1px solid #ddd",
          maxHeight: "400px",
          overflowY: "auto",
          zIndex: 1000
        }}>
          {notifications.length === 0 ? (
            <p style={{ padding: 10 }}>No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                style={{
                  padding: 10,
                  background: n.is_read ? "#fff" : "#f5f5f5",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer"
                }}
              >
                <strong>{n.title}</strong>
                <p style={{ margin: 0 }}>{n.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}