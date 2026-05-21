// pages/Conversations.jsx
// Route: /conversations or /messages

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate }                              from "react-router-dom";

const API = "https://minimart-ivrm.onrender.com/api";

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function timeLabel(dateStr) {
  if (!dateStr) return "";
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60)      return "now";
  if (diff < 3600)    return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h`;

  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  if (d >= today)     return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  if (d >= yesterday) return "Yesterday";

  return d.toLocaleDateString([], { month:"short", day:"numeric" });
}

/* ─────────────────────────────────────
   COMPONENTS
───────────────────────────────────── */
function Spinner() {
  return (
    <>
      <style>{`@keyframes cspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width:28, height:28,
        border:"3px solid #eee", borderTop:"3px solid #111",
        borderRadius:"50%", animation:"cspin .75s linear infinite",
      }}/>
    </>
  );
}

function Avatar({ src, name, online, size = 52 }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U"
  )}&background=111&color=fff&size=${size * 2}`;

  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size }}>
      <img
        src={src || fallback}
        alt={name || "User"}
        style={{
          width:size, height:size, borderRadius:"50%",
          objectFit:"cover", background:"#eee", display:"block",
        }}
        onError={(e) => { e.target.src = fallback; }}
      />
      {online && (
        <span style={{
          position:"absolute", bottom:1, right:1,
          width:12, height:12, background:"#22c55e",
          borderRadius:"50%", border:"2.5px solid #fff",
        }}/>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:12, padding:"80px 24px 0", textAlign:"center",
    }}>
      <svg width="64" height="64" fill="none" viewBox="0 0 24 24"
        stroke="#ddd" strokeWidth={1.1}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
             8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
             15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
      <p style={{ margin:0, fontSize:16, fontWeight:700, color:"#bbb" }}>
        No conversations yet
      </p>
      <p style={{ margin:0, fontSize:13, color:"#ccc", lineHeight:1.5, maxWidth:260 }}>
        When you message a seller or someone messages you, your conversations will appear here.
      </p>
    </div>
  );
}

function ThreadItem({ thread, userId, onClick }) {
  const isMine       = thread.last_sender_id === userId;
  const unread       = Number(thread.unread_count || 0);
  const hasUnread    = unread > 0;
  const preview      = thread.last_message || "";
  const displayMsg   = isMine ? `You: ${preview}` : preview;
  const truncated    = displayMsg.length > 55
    ? displayMsg.slice(0, 55) + "…"
    : displayMsg;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"14px 16px",
        background: hasUnread ? "#fafafa" : "#fff",
        borderBottom:"1px solid #f5f5f5",
        cursor:"pointer",
        transition:"background .15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
      onMouseLeave={(e) => (e.currentTarget.style.background = hasUnread ? "#fafafa" : "#fff")}
    >
      {/* Avatar */}
      <Avatar
        src={thread.other_user_image}
        name={thread.other_user_name}
        online={thread.other_user_online}
      />

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Name + time */}
        <div style={{
          display:"flex", justifyContent:"space-between",
          alignItems:"center", gap:8, marginBottom:3,
        }}>
          <span style={{
            fontWeight: hasUnread ? 800 : 600,
            fontSize:15, color:"#111",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            flex:1,
          }}>
            {thread.other_user_name || "User"}
          </span>
          <span style={{
            fontSize:11,
            color: hasUnread ? "#111" : "#aaa",
            fontWeight: hasUnread ? 700 : 400,
            flexShrink:0,
          }}>
            {timeLabel(thread.last_message_at)}
          </span>
        </div>

        {/* Preview + badge */}
        <div style={{
          display:"flex", justifyContent:"space-between",
          alignItems:"center", gap:8,
        }}>
          <span style={{
            fontSize:13,
            color: hasUnread ? "#333" : "#999",
            fontWeight: hasUnread ? 600 : 400,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            flex:1,
          }}>
            {truncated || "No messages yet"}
          </span>

          {/* Product thumbnail */}
          {thread.product_image && (
            <img
              src={thread.product_image}
              alt=""
              style={{
                width:28, height:28, borderRadius:6,
                objectFit:"cover", flexShrink:0,
                border:"1px solid #eee",
              }}
            />
          )}

          {/* Unread badge */}
          {hasUnread && (
            <span style={{
              minWidth:20, height:20, borderRadius:10,
              background:"#111", color:"#fff",
              fontSize:11, fontWeight:700,
              display:"flex", alignItems:"center", justifyContent:"center",
              padding:"0 6px", flexShrink:0,
            }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>

        {/* Product title */}
        {thread.product_title && (
          <div style={{
            fontSize:11, color:"#bbb", marginTop:3,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>
            re: {thread.product_title}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   CONVERSATIONS PAGE
═══════════════════════════════════════ */
export default function Conversations({ user }) {
  const navigate = useNavigate();

  const [threads,  setThreads]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState("all"); // all | unread
  const pollRef    = useRef(null);
  const mounted    = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn) => {
    if (mounted.current) fn();
  }, []);

  /* ── Fetch conversations ── */
  const fetchConversations = useCallback(async (showLoading = true) => {
    if (!user?.id) return;
    if (showLoading) safe(() => { setLoading(true); setError(null); });

    try {
      const res = await fetch(`${API}/conversations?userId=${user.id}`, {
        headers: authH(),
        timeout: 10_000,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      // Sort by last_message_at descending
      list.sort((a, b) =>
        new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
      );

      safe(() => setThreads(list));
    } catch (err) {
      console.error("Fetch conversations:", err.message);
      if (showLoading) safe(() => setError(err.message));
    } finally {
      if (showLoading) safe(() => setLoading(false));
    }
  }, [user?.id, safe]);

  /* ── Initial load ── */
  useEffect(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  /* ── Poll every 15s for new messages ── */
  useEffect(() => {
    if (!user?.id) return;
    pollRef.current = setInterval(() => {
      fetchConversations(false); // silent refresh
    }, 15_000);

    return () => clearInterval(pollRef.current);
  }, [user?.id, fetchConversations]);

  /* ── Open thread ── */
  const openThread = useCallback((thread) => {
    const threadId = thread.thread_id || thread.id;
    navigate(`/chat/${threadId}`);
  }, [navigate]);

  /* ── Filtered threads ── */
  const filtered = threads.filter((t) => {
    // Tab filter
    if (tab === "unread" && Number(t.unread_count || 0) === 0) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const name    = (t.other_user_name || "").toLowerCase();
      const msg     = (t.last_message || "").toLowerCase();
      const product = (t.product_title || "").toLowerCase();
      if (!name.includes(q) && !msg.includes(q) && !product.includes(q)) return false;
    }

    return true;
  });

  const totalUnread = threads.reduce(
    (sum, t) => sum + Number(t.unread_count || 0), 0
  );

  /* ── Not logged in ── */
  if (!user?.id) {
    return (
      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", height:"100dvh", gap:16,
        fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        padding:24, textAlign:"center",
      }}>
        <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
          stroke="#ccc" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
               8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
               15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <p style={{ fontSize:16, fontWeight:700, color:"#555" }}>
          Log in to see your messages
        </p>
        <button
          onClick={() => navigate("/login")}
          style={{
            padding:"11px 32px", borderRadius:24,
            border:"none", background:"#111",
            color:"#fff", fontSize:14, fontWeight:700,
            cursor:"pointer",
          }}
        >
          Log in
        </button>
      </div>
    );
  }

  /* ══════════════════════════════
     RENDER
  ══════════════════════════════ */
  return (
    <>
      <style>{`
        .cv-wrap {
          display:flex; flex-direction:column;
          height:100dvh; max-width:700px;
          margin:0 auto; background:#fff;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* ── header ── */
        .cv-header {
          padding:16px 16px 0;
          background:#fff;
          position:sticky; top:0; z-index:10;
          border-bottom:1px solid #f0f0f0;
        }
        .cv-header-top {
          display:flex; align-items:center;
          justify-content:space-between;
          margin-bottom:12px;
        }
        .cv-title { font-size:22px; font-weight:900; color:#111; letter-spacing:-0.5px; }
        .cv-unread-badge {
          background:#111; color:#fff;
          font-size:12px; font-weight:700;
          padding:2px 8px; border-radius:10px;
          margin-left:8px;
        }
        .cv-back {
          background:none; border:none; cursor:pointer;
          padding:6px; display:flex; align-items:center;
          border-radius:50%; transition:background .15s;
        }
        .cv-back:hover { background:#f5f5f5; }

        /* ── search ── */
        .cv-search {
          width:100%; padding:10px 14px;
          border-radius:12px; border:1.5px solid #eee;
          font-size:14px; background:#f8f8f8;
          outline:none; transition:border-color .15s;
          box-sizing:border-box;
          margin-bottom:12px;
          font-family:inherit;
        }
        .cv-search:focus { border-color:#999; }

        /* ── tabs ── */
        .cv-tabs {
          display:flex; gap:0;
          border-bottom:none;
        }
        .cv-tab {
          flex:1; padding:10px 0;
          text-align:center;
          font-size:13px; font-weight:700;
          color:#999; cursor:pointer;
          border-bottom:2.5px solid transparent;
          background:none; border-top:none;
          border-left:none; border-right:none;
          transition:color .15s, border-color .15s;
          font-family:inherit;
        }
        .cv-tab.active {
          color:#111;
          border-bottom-color:#111;
        }

        /* ── thread list ── */
        .cv-list {
          flex:1; overflow-y:auto;
        }

        /* ── pull indicator ── */
        .cv-refresh-hint {
          text-align:center; font-size:11px;
          color:#ccc; padding:8px;
        }

        /* ── error ── */
        .cv-error {
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:12px; padding:60px 24px;
          text-align:center;
        }
      `}</style>

      <div className="cv-wrap">

        {/* ── HEADER ── */}
        <div className="cv-header">
          <div className="cv-header-top">
            <div style={{ display:"flex", alignItems:"center" }}>
              <button
                className="cv-back"
                onClick={() => navigate(-1)}
                aria-label="Back"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
                  stroke="#111" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <span className="cv-title">
                Messages
                {totalUnread > 0 && (
                  <span className="cv-unread-badge">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </span>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchConversations(true)}
              aria-label="Refresh"
              style={{
                background:"none", border:"none", cursor:"pointer",
                padding:8, borderRadius:"50%",
                display:"flex", alignItems:"center",
                transition:"background .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
                stroke="#555" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582
                     9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0
                     01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>

          {/* Search */}
          {threads.length > 3 && (
            <input
              className="cv-search"
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          {/* Tabs */}
          {threads.length > 0 && (
            <div className="cv-tabs">
              <button
                className={`cv-tab${tab === "all" ? " active" : ""}`}
                onClick={() => setTab("all")}
              >
                All ({threads.length})
              </button>
              <button
                className={`cv-tab${tab === "unread" ? " active" : ""}`}
                onClick={() => setTab("unread")}
              >
                Unread ({totalUnread})
              </button>
            </div>
          )}
        </div>

        {/* ── BODY ── */}
        <div className="cv-list">

          {/* Loading */}
          {loading && (
            <div style={{
              display:"flex", justifyContent:"center",
              paddingTop:80,
            }}>
              <Spinner/>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="cv-error">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24"
                stroke="#f87171" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10"/>
                <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
              </svg>
              <p style={{ margin:0, fontSize:14, color:"#888" }}>
                Could not load messages
              </p>
              <p style={{
                margin:0, fontSize:11, color:"#f87171",
                fontFamily:"monospace", background:"#fef2f2",
                padding:"4px 10px", borderRadius:6,
              }}>
                {error}
              </p>
              <button
                onClick={() => fetchConversations(true)}
                style={{
                  padding:"9px 28px", borderRadius:20,
                  border:"none", background:"#111",
                  color:"#fff", fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty — no conversations at all */}
          {!loading && !error && threads.length === 0 && (
            <EmptyState/>
          )}

          {/* Empty — filter returned nothing */}
          {!loading && !error && threads.length > 0 && filtered.length === 0 && (
            <div style={{
              textAlign:"center", padding:"60px 24px",
              color:"#aaa", fontSize:14,
            }}>
              {tab === "unread"
                ? "🎉 All caught up — no unread messages!"
                : `No results for "${search}"`
              }
            </div>
          )}

          {/* Thread list */}
          {!loading && !error && filtered.map((thread) => (
            <ThreadItem
              key={thread.thread_id || thread.id}
              thread={thread}
              userId={user.id}
              onClick={() => openThread(thread)}
            />
          ))}

          {/* Bottom padding */}
          <div style={{ height:80 }}/>
        </div>

      </div>
    </>
  );
}