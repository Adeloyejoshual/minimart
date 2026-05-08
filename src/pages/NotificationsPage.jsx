import { useState, useEffect } from "react";

const NOTIFICATIONS = [
  {
    id: "1",
    type: "order",
    title: "New Order Received",
    message: "Someone purchased your iPhone 14 Pro listing for $850.00",
    time: new Date(Date.now() - 1000 * 60 * 3),
    read: false,
    avatar: null,
    icon: "🛒",
    meta: { amount: "$850.00", product: "iPhone 14 Pro" },
  },
  {
    id: "2",
    type: "message",
    title: "New Message from Amir K.",
    message: "Hey, is the MacBook still available? Can we negotiate the price?",
    time: new Date(Date.now() - 1000 * 60 * 18),
    read: false,
    avatar: "AK",
    icon: null,
    meta: { sender: "Amir K." },
  },
  {
    id: "3",
    type: "product",
    title: "Product View Milestone",
    message: "Your listing 'Sony A7 IV Camera' just hit 500 views!",
    time: new Date(Date.now() - 1000 * 60 * 45),
    read: false,
    avatar: null,
    icon: "👁️",
    meta: { views: 500, product: "Sony A7 IV Camera" },
  },
  {
    id: "4",
    type: "verify",
    title: "Store Verification Approved",
    message: "Congratulations! Your store has been verified. You now have a verified badge.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: true,
    avatar: null,
    icon: "✅",
    meta: {},
  },
  {
    id: "5",
    type: "review",
    title: "New Review on Your Store",
    message: "Sara M. left you a 5-star review: 'Fast shipping and great communication!'",
    time: new Date(Date.now() - 1000 * 60 * 60 * 5),
    read: true,
    avatar: "SM",
    icon: null,
    meta: { rating: 5, reviewer: "Sara M." },
  },
  {
    id: "6",
    type: "promo",
    title: "Promotion Ending Soon",
    message: "Your boost for 'Dell XPS 15' expires in 6 hours. Renew to keep your visibility.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 8),
    read: true,
    avatar: null,
    icon: "⚡",
    meta: { product: "Dell XPS 15", hours: 6 },
  },
  {
    id: "7",
    type: "order",
    title: "Payment Released",
    message: "Payment of $1,200.00 for 'Gaming PC Setup' has been released to your wallet.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
    avatar: null,
    icon: "💰",
    meta: { amount: "$1,200.00" },
  },
  {
    id: "8",
    type: "message",
    title: "New Message from Layla H.",
    message: "Can you provide more photos of the item? Also, what's the condition?",
    time: new Date(Date.now() - 1000 * 60 * 60 * 26),
    read: true,
    avatar: "LH",
    icon: null,
    meta: { sender: "Layla H." },
  },
  {
    id: "9",
    type: "system",
    title: "Security Alert",
    message: "A new login was detected from Chrome on Windows in Dubai, UAE.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 48),
    read: true,
    avatar: null,
    icon: "🔐",
    meta: {},
  },
  {
    id: "10",
    type: "product",
    title: "Price Drop Alert",
    message: "A product in your watchlist "Nike Air Max 2024" dropped by 15%.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 72),
    read: true,
    avatar: null,
    icon: "📉",
    meta: { discount: "15%" },
  },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "order", label: "Orders" },
  { id: "message", label: "Messages" },
  { id: "product", label: "Products" },
  { id: "system", label: "System" },
];

const TYPE_CONFIG = {
  order: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
  message: { color: "#6366f1", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)" },
  product: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
  verify: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
  review: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)" },
  promo: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)" },
  system: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
};

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function groupNotifications(list) {
  const today = [], yesterday = [], older = [];
  const now = new Date();
  list.forEach((n) => {
    const diff = now - n.time;
    if (diff < 86400000) today.push(n);
    else if (diff < 172800000) yesterday.push(n);
    else older.push(n);
  });
  const groups = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (older.length) groups.push({ label: "Earlier", items: older });
  return groups;
}

const avatarColors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#10b981"];
function getAvatarColor(initials) {
  const i = (initials.charCodeAt(0) + initials.charCodeAt(1)) % avatarColors.length;
  return avatarColors[i];
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  const filtered = filter === "all"
    ? notifications
    : notifications.filter((n) => n.type === filter || (filter === "order" && ["order","verify","review","promo"].includes(n.type)));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const deleteOne = (id) => {
    setDeletingId(id);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setDeletingId(null);
    }, 300);
  };

  const groups = groupNotifications(filtered);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      fontFamily: "'Sora', 'DM Sans', sans-serif",
      color: "#e8e8f0",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }

        .notif-page { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease, transform 0.5s ease; }
        .notif-page.visible { opacity: 1; transform: translateY(0); }

        .filter-btn {
          background: transparent;
          border: 1px solid #1e1e2e;
          color: #7070a0;
          padding: 6px 16px;
          border-radius: 999px;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.03em;
          transition: all 0.2s ease;
        }
        .filter-btn:hover { border-color: #3a3a5a; color: #b0b0d0; }
        .filter-btn.active { background: #6366f1; border-color: #6366f1; color: white; }

        .notif-item {
          display: flex;
          gap: 14px;
          padding: 16px 20px;
          border-radius: 14px;
          margin-bottom: 8px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .notif-item::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          border-radius: 3px 0 0 3px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .notif-item.unread {
          background: rgba(255,255,255,0.032);
          border-color: rgba(255,255,255,0.06);
        }
        .notif-item.unread::before { opacity: 1; }
        .notif-item:hover {
          background: rgba(255,255,255,0.055);
          border-color: rgba(255,255,255,0.1);
          transform: translateX(2px);
        }
        .notif-item.deleting {
          opacity: 0;
          transform: translateX(40px) scale(0.96);
        }

        .icon-wrap {
          width: 42px; height: 42px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .notif-title {
          font-size: 13.5px;
          font-weight: 600;
          color: #d8d8f0;
          line-height: 1.3;
          margin-bottom: 4px;
        }
        .notif-item.read .notif-title { color: #7070a0; font-weight: 500; }

        .notif-msg {
          font-size: 12.5px;
          color: #606080;
          line-height: 1.5;
        }
        .notif-item.unread .notif-msg { color: #9090b8; }

        .notif-time {
          font-size: 11px;
          color: #404060;
          font-family: 'DM Mono', monospace;
          margin-top: 5px;
        }
        .notif-item.unread .notif-time { color: #5050a0; }

        .unread-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #6366f1;
          flex-shrink: 0;
          margin-top: 5px;
          box-shadow: 0 0 6px rgba(99,102,241,0.6);
        }

        .delete-btn {
          background: transparent;
          border: none;
          color: #303050;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          opacity: 0;
          transition: all 0.2s;
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
        }
        .notif-item:hover .delete-btn { opacity: 1; color: #ef4444; }

        .group-label {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #404060;
          padding: 8px 4px 10px;
          font-family: 'DM Mono', monospace;
        }

        .mark-all-btn {
          background: transparent;
          border: 1px solid #1e1e2e;
          color: #6366f1;
          padding: 7px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .mark-all-btn:hover { background: rgba(99,102,241,0.1); border-color: #6366f1; }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #404060;
        }

        .badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: #6366f1;
          color: white;
          font-size: 10px;
          font-weight: 700;
          width: 20px; height: 20px;
          border-radius: 50%;
          margin-left: 8px;
          font-family: 'DM Mono', monospace;
        }
      `}</style>

      <div
        className={`notif-page${visible ? " visible" : ""}`}
        style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 80px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#f0f0ff" }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="badge">{unreadCount}</span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: "#40405a", fontFamily: "'DM Mono', monospace" }}>
              {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="mark-all-btn" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter-btn${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Groups */}
        {groups.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#30305a", marginBottom: 4 }}>No notifications</p>
            <p style={{ fontSize: 12.5 }}>Nothing here yet — check back later.</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="group-label">{group.label}</div>
              {group.items.map((n, i) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                return (
                  <div
                    key={n.id}
                    className={`notif-item${n.read ? " read" : " unread"}${deletingId === n.id ? " deleting" : ""}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => markRead(n.id)}
                  >
                    {/* Unread accent */}
                    <style>{`.notif-item.unread#ni-${n.id}::before { background: ${cfg.color}; }`}</style>

                    {/* Icon / Avatar */}
                    {n.avatar ? (
                      <div className="icon-wrap" style={{ background: getAvatarColor(n.avatar), color: "white", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>
                        {n.avatar}
                      </div>
                    ) : (
                      <div className="icon-wrap" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        {n.icon}
                      </div>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-time">{timeAgo(n.time)}</div>
                    </div>

                    {/* Right side */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {!n.read && <div className="unread-dot" />}
                      <button
                        className="delete-btn"
                        onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <p style={{ fontSize: 11.5, color: "#282840", fontFamily: "'DM Mono', monospace" }}>
              — showing {filtered.length} notification{filtered.length !== 1 ? "s" : ""} —
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
