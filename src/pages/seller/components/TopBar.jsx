// pages/seller/components/TopBar.jsx
import React, { useState, useRef, useEffect } from "react";

const PAGE_META = {
  overview:  { title: "Overview",   sub: "Welcome back 👋"              },
  orders:    { title: "Orders",     sub: "Manage customer orders"        },
  products:  { title: "Products",   sub: "Your store inventory"          },
  analytics: { title: "Analytics",  sub: "Sales insights & trends"       },
  payouts:   { title: "Payouts",    sub: "Earnings & withdrawals"        },
  settings:  { title: "Settings",   sub: "Store configuration"           },
};

const timeAgo = (d) => {
  if (!d) return "";
  const mins  = Math.floor((Date.now() - new Date(d)) / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function TopBar({
  vendor, activePage, onMenuClick,
  notifications = [], unreadCount = 0,
  onMarkRead, onMarkAllRead,
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const dropRef = useRef(null);
  const { title, sub } = PAGE_META[activePage] ?? PAGE_META.overview;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header style={t.bar}>

      {/* Left */}
      <div style={{ display: "flex", alignItems: "center",
        gap: "0.875rem" }}>
        <button
          onClick={onMenuClick}
          style={t.menuBtn}
          aria-label="Open menu"
        >
          ☰
        </button>
        <div>
          <h1 style={t.title}>{title}</h1>
          <p style={t.sub}>{sub}</p>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center",
        gap: "0.625rem" }}>

        {/* Store link */}
        <a href="/" target="_blank" rel="noreferrer"
          style={t.storeLink}>
          🔗 <span style={t.storeLinkText}>View Store</span>
        </a>

        {/* Notifications */}
        <div ref={dropRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            style={t.iconBtn}
            aria-label="Notifications"
          >
            🔔
            {unreadCount > 0 && (
              <span style={t.badge}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={t.dropdown}>

              {/* Dropdown header */}
              <div style={t.dropHeader}>
                <span style={t.dropTitle}>
                  Notifications
                  {unreadCount > 0 && (
                    <span style={t.unreadPill}>{unreadCount}</span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => { onMarkAllRead?.();
                      setNotifOpen(false); }}
                    style={t.markAllBtn}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Items */}
              <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={t.emptyNotif}>
                    <span style={{ fontSize: "2rem" }}>🔕</span>
                    <p style={{ margin: "0.5rem 0 0",
                      color: "#9ca3af", fontSize: "0.85rem" }}>
                      All caught up!
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => { onMarkRead?.(n.id); }}
                      style={{
                        ...t.notifItem,
                        background: n.read ? "white" : "#f0f0ff",
                        cursor: n.read ? "default" : "pointer",
                      }}
                    >
                      <div style={{
                        ...t.notifDot,
                        opacity: n.read ? 0 : 1,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={t.notifMsg}>{n.message}</p>
                        <p style={t.notifTime}>
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}
        </div>

        {/* Avatar */}
        <div style={t.avatar} title={vendor?.store_name}>
          {(vendor?.store_name?.[0] ?? "S").toUpperCase()}
        </div>

      </div>
    </header>
  );
}

const t = {
  bar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0.875rem 1.5rem",
    background:     "white",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    zIndex:         50,
    gap:            "1rem",
    flexWrap:       "wrap",
  },
  menuBtn: {
    background:   "none",
    border:       "none",
    fontSize:     "1.35rem",
    cursor:       "pointer",
    color:        "#374151",
    padding:      "0.25rem 0.4rem",
    borderRadius: "8px",
    lineHeight:   1,
  },
  title: {
    fontWeight: 800,
    fontSize:   "1.1rem",
    color:      "#1f2937",
    margin:     0,
    lineHeight: 1.2,
  },
  sub: {
    color:    "#9ca3af",
    fontSize: "0.75rem",
    margin:   "0.1rem 0 0",
  },
  storeLink: {
    display:        "flex",
    alignItems:     "center",
    gap:            "0.3rem",
    padding:        "0.45rem 0.875rem",
    background:     "#f8fafc",
    border:         "1px solid #e5e7eb",
    borderRadius:   "10px",
    color:          "#374151",
    textDecoration: "none",
    fontSize:       "0.82rem",
    fontWeight:     600,
    whiteSpace:     "nowrap",
    transition:     "all 0.15s",
  },
  storeLinkText: {
    // Hidden on very small screens via JS is complex;
    // just keep it visible
  },
  iconBtn: {
    position:     "relative",
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    padding:      "0.45rem 0.65rem",
    cursor:       "pointer",
    fontSize:     "1rem",
    lineHeight:   1,
    transition:   "all 0.15s",
  },
  badge: {
    position:       "absolute",
    top:            "-6px",
    right:          "-6px",
    background:     "#ef4444",
    color:          "white",
    borderRadius:   "100px",
    fontSize:       "0.6rem",
    fontWeight:     800,
    minWidth:       "17px",
    height:         "17px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "0 3px",
    border:         "2px solid white",
  },
  dropdown: {
    position:     "absolute",
    top:          "calc(100% + 8px)",
    right:        0,
    width:        "320px",
    background:   "white",
    borderRadius: "16px",
    boxShadow:    "0 8px 30px rgba(0,0,0,0.12)",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    zIndex:       200,
  },
  dropHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "1rem 1.1rem 0.75rem",
    borderBottom:   "1px solid #f3f4f6",
  },
  dropTitle: {
    fontWeight:  700,
    color:       "#1f2937",
    fontSize:    "0.9rem",
    display:     "flex",
    alignItems:  "center",
    gap:         "0.5rem",
  },
  unreadPill: {
    background:   "#6366f1",
    color:        "white",
    borderRadius: "100px",
    fontSize:     "0.62rem",
    fontWeight:   800,
    padding:      "0.1rem 0.45rem",
  },
  markAllBtn: {
    background:  "none",
    border:      "none",
    color:       "#6366f1",
    cursor:      "pointer",
    fontSize:    "0.78rem",
    fontWeight:  600,
    padding:     0,
  },
  notifItem: {
    display:      "flex",
    gap:          "0.625rem",
    padding:      "0.875rem 1.1rem",
    borderBottom: "1px solid #f9fafb",
    alignItems:   "flex-start",
    transition:   "background 0.1s",
  },
  notifDot: {
    width:        "7px",
    height:       "7px",
    borderRadius: "50%",
    background:   "#6366f1",
    flexShrink:   0,
    marginTop:    "5px",
  },
  notifMsg: {
    margin:     0,
    fontSize:   "0.82rem",
    color:      "#374151",
    lineHeight: 1.4,
  },
  notifTime: {
    margin:    "0.2rem 0 0",
    fontSize:  "0.7rem",
    color:     "#9ca3af",
  },
  emptyNotif: {
    padding:        "2.5rem 1rem",
    textAlign:      "center",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
  },
  avatar: {
    width:          "36px",
    height:         "36px",
    borderRadius:   "10px",
    background:     "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:          "white",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontWeight:     800,
    fontSize:       "0.95rem",
    flexShrink:     0,
    userSelect:     "none",
  },
};