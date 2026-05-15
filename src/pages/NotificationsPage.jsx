import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "https://minimart-ivrm.onrender.com/api/notifications";

const FILTERS = [
  { id: "all",     label: "All"      },
  { id: "order",   label: "Orders"   },
  { id: "message", label: "Messages" },
  { id: "product", label: "Products" },
  { id: "system",  label: "System"   },
];

const TYPE_CONFIG = {
  order:   { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  icon: "🛒" },
  message: { color: "#6366f1", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.25)",  icon: "💬" },
  product: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)",  icon: "📦" },
  verify:  { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  icon: "✅" },
  review:  { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.25)",  icon: "⭐" },
  promo:   { color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.25)",  icon: "⚡" },
  system:  { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   icon: "🔐" },
};

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function groupNotifications(list) {
  const today = [], yesterday = [], older = [];
  list.forEach((n) => {
    const diff = Date.now() - new Date(n.created_at).getTime();
    if (diff < 86400000)       today.push(n);
    else if (diff < 172800000) yesterday.push(n);
    else                       older.push(n);
  });
  const groups = [];
  if (today.length)     groups.push({ label: "Today",     items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (older.length)     groups.push({ label: "Earlier",   items: older });
  return groups;
}

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#10b981"];
function avatarColor(name = "") {
  const code = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
function initials(name = "") {
  return name.split(" ").map((w) => w[0] || "").join("").toUpperCase().slice(0, 2);
}

function SkeletonItem() {
  return (
    <div style={{
      display: "flex", gap: 14, padding: "16px 20px", borderRadius: 14,
      marginBottom: 8, background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.04)",
      animation: "pulse 1.6s ease-in-out infinite",
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "#1a1a2e", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 13, width: "52%", borderRadius: 6, background: "#1a1a2e", marginBottom: 9 }} />
        <div style={{ height: 11, width: "82%", borderRadius: 6, background: "#141420", marginBottom: 7 }} />
        <div style={{ height: 10, width: "30%", borderRadius: 6, background: "#141420" }} />
      </div>
    </div>
  );
}

export default function NotificationsPage({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [filter, setFilter]               = useState("all");
  const [visible, setVisible]             = useState(false);
  const [deletingId, setDeletingId]       = useState(null);
  const [markingAll, setMarkingAll]       = useState(false);
  const [pagination, setPagination]       = useState({ page: 1, has_next: false, total: 0 });

  const token   = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  /* ── Fetch ── */
  const fetchNotifications = useCallback(async (page = 1, type = "all", replace = true) => {
    try {
      replace ? setLoading(true) : setLoadingMore(true);
      const params = { page, limit: 20 };
      if (type !== "all") params.type = type;
      const { data } = await axios.get(API, { headers, params });
      if (data.success) {
        setNotifications((prev) => replace ? data.data : [...prev, ...data.data]);
        setPagination(data.pagination);
      }
    } catch {
      toast.error("Could not load notifications");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setTimeout(() => setVisible(true), 60);
    }
  }, []);

  useEffect(() => {
    setVisible(false);
    fetchNotifications(1, filter, true);
  }, [filter]);

  /* ── Mark one read (optimistic) ── */
  const markRead = async (n) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    try {
      await axios.patch(`${API}/${n.id}/read`, {}, { headers });
    } catch {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: false } : x));
      toast.error("Failed to mark as read");
    }
  };

  /* ── Mark all read (optimistic) ── */
  const markAllRead = async () => {
    setMarkingAll(true);
    const snapshot = notifications;
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    try {
      await axios.patch(`${API}/read-all`, {}, { headers });
      toast.success("All marked as read");
    } catch {
      setNotifications(snapshot);
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  /* ── Delete (optimistic) ── */
  const deleteOne = async (id) => {
    setDeletingId(id);
    await new Promise((r) => setTimeout(r, 290));
    const snapshot = notifications;
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    setDeletingId(null);
    try {
      await axios.delete(`${API}/${id}`, { headers });
    } catch {
      setNotifications(snapshot);
      toast.error("Failed to delete notification");
    }
  };

  /* ── Load more ── */
  const loadMore = () => fetchNotifications(pagination.page + 1, filter, false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const groups      = groupNotifications(notifications);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Sora', sans-serif", color: "#e8e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }

        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

        .np { opacity:0; transform:translateY(16px); transition:opacity .45s ease,transform .45s ease; }
        .np.vis { opacity:1; transform:translateY(0); }

        .f-btn {
          background:transparent; border:1px solid #1e1e2e; color:#7070a0;
          padding:6px 16px; border-radius:999px; cursor:pointer;
          font-family:'Sora',sans-serif; font-size:12px; font-weight:500;
          letter-spacing:.03em; transition:all .2s ease; white-space:nowrap;
        }
        .f-btn:hover  { border-color:#3a3a5a; color:#b0b0d0; }
        .f-btn.active { background:#6366f1; border-color:#6366f1; color:#fff; }

        .ni {
          display:flex; gap:14px; padding:16px 20px; border-radius:14px;
          margin-bottom:8px; cursor:pointer; border:1px solid transparent;
          transition:all .25s ease; position:relative; overflow:hidden;
        }
        .ni.unread { background:rgba(255,255,255,.032); border-color:rgba(255,255,255,.06); }
        .ni:hover  { background:rgba(255,255,255,.055); border-color:rgba(255,255,255,.1); transform:translateX(2px); }
        .ni.del    { opacity:0; transform:translateX(40px) scale(.96); pointer-events:none; }

        .iw {
          width:42px; height:42px; border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          font-size:18px; flex-shrink:0;
        }

        .nt { font-size:13.5px; font-weight:600; color:#d8d8f0; line-height:1.3; margin-bottom:4px; }
        .ni.read .nt { color:#7070a0; font-weight:500; }

        .nm {
          font-size:12.5px; color:#606080; line-height:1.5;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .ni.unread .nm { color:#9090b8; }

        .ntime { font-size:11px; color:#404060; font-family:'DM Mono',monospace; margin-top:5px; }
        .ni.unread .ntime { color:#5050a0; }

        .udot {
          width:7px; height:7px; border-radius:50%; background:#6366f1;
          flex-shrink:0; margin-top:5px; box-shadow:0 0 6px rgba(99,102,241,.6);
        }

        .dbtn {
          background:transparent; border:none; color:#303050; cursor:pointer;
          padding:4px 6px; border-radius:6px; opacity:0; transition:all .2s;
          font-size:13px; line-height:1; flex-shrink:0;
        }
        .ni:hover .dbtn { opacity:1; color:#ef4444; }

        .glabel {
          font-size:10.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase;
          color:#404060; padding:8px 4px 10px; font-family:'DM Mono',monospace;
        }

        .mabtn {
          background:transparent; border:1px solid #1e1e2e; color:#6366f1;
          padding:7px 16px; border-radius:8px; cursor:pointer;
          font-family:'Sora',sans-serif; font-size:12px; font-weight:500;
          transition:all .2s; white-space:nowrap;
        }
        .mabtn:hover    { background:rgba(99,102,241,.1); border-color:#6366f1; }
        .mabtn:disabled { opacity:.4; cursor:not-allowed; }

        .lmbtn {
          width:100%; background:transparent; border:1px solid #1e1e2e; color:#6060a0;
          padding:12px; border-radius:12px; cursor:pointer;
          font-family:'Sora',sans-serif; font-size:12.5px; font-weight:500;
          transition:all .2s; margin-top:8px;
        }
        .lmbtn:hover    { background:rgba(255,255,255,.04); color:#a0a0c0; }
        .lmbtn:disabled { opacity:.4; cursor:not-allowed; }

        .badge {
          display:inline-flex; align-items:center; justify-content:center;
          background:#6366f1; color:#fff; font-size:10px; font-weight:700;
          min-width:20px; height:20px; padding:0 5px; border-radius:10px;
          margin-left:8px; font-family:'DM Mono',monospace;
        }

        .empty { text-align:center; padding:80px 20px; color:#404060; }
      `}</style>

      <div className={`np${visible ? " vis" : ""}`} style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:32, gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.02em", color:"#f0f0ff" }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </div>
            <p style={{ fontSize:12.5, color:"#40405a", fontFamily:"'DM Mono',monospace" }}>
              {loading
                ? "Loading..."
                : unreadCount > 0
                  ? `${unreadCount} unread update${unreadCount !== 1 ? "s" : ""}`
                  : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="mabtn" onClick={markAllRead} disabled={markingAll}>
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`f-btn${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Skeleton ── */}
        {loading && [...Array(5)].map((_, i) => <SkeletonItem key={i} />)}

        {/* ── Empty ── */}
        {!loading && notifications.length === 0 && (
          <div className="empty">
            <div style={{ fontSize:40, marginBottom:12 }}>🔔</div>
            <p style={{ fontSize:15, fontWeight:600, color:"#30305a", marginBottom:4 }}>No notifications</p>
            <p style={{ fontSize:12.5 }}>
              {filter !== "all" ? "None in this category yet." : "Nothing here yet — check back later."}
            </p>
          </div>
        )}

        {/* ── Groups ── */}
        {!loading && groups.map((group) => (
          <div key={group.label}>
            <div className="glabel">{group.label}</div>

            {group.items.map((n) => {
              const cfg      = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
              const sender   = n.meta?.sender || "";
              const ini      = sender ? initials(sender) : null;
              const isUnread = !n.is_read;

              return (
                <div
                  key={n.id}
                  className={`ni${isUnread ? " unread" : " read"}${deletingId === n.id ? " del" : ""}`}
                  onClick={() => markRead(n)}
                >
                  {/* Colored left accent bar */}
                  {isUnread && (
                    <div style={{
                      position:"absolute", left:0, top:0, bottom:0,
                      width:3, borderRadius:"3px 0 0 3px",
                      background: cfg.color,
                    }} />
                  )}

                  {/* Avatar or icon */}
                  {ini ? (
                    <div className="iw" style={{ background:avatarColor(sender), color:"#fff", fontSize:13, fontWeight:700 }}>
                      {ini}
                    </div>
                  ) : (
                    <div className="iw" style={{ background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                      {n.meta?.icon || cfg.icon}
                    </div>
                  )}

                  {/* Text */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="nt">{n.title}</div>
                    <div className="nm">{n.message}</div>
                    <div className="ntime">{timeAgo(n.created_at)}</div>
                  </div>

                  {/* Right: dot + dismiss */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                    {isUnread && <div className="udot" />}
                    <button
                      className="dbtn"
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
        ))}

        {/* ── Load more ── */}
        {!loading && pagination.has_next && (
          <button className="lmbtn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore
              ? "Loading..."
              : `Load more  ·  ${pagination.total - notifications.length} remaining`}
          </button>
        )}

        {/* ── Footer ── */}
        {!loading && notifications.length > 0 && (
          <div style={{ textAlign:"center", marginTop:28 }}>
            <p style={{ fontSize:11.5, color:"#282840", fontFamily:"'DM Mono',monospace" }}>
              {`— ${notifications.length} of ${pagination.total} notification${pagination.total !== 1 ? "s" : ""} —`}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
