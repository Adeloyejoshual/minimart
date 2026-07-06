import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  FC,
  KeyboardEvent,
  MouseEvent,
} from "react";

import { Thread, User } from "./types";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const API           = `${import.meta.env.VITE_API_BASE_URL}/api`;
const POLL_INTERVAL = 15_000;
const FETCH_TIMEOUT = 10_000;
const PREVIEW_MAX   = 55;
const MAX_UNREAD    = 99;

/* ─────────────────────────────────────────────
   Auth
───────────────────────────────────────────── */
const getToken = (): string =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

const authH = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const timeLabel = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1_000);

  if (diff < 60)     return "now";
  if (diff < 3_600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3_600)}h`;

  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d >= today)     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d >= yesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const truncate = (str: string, len = PREVIEW_MAX): string =>
  str.length > len ? str.slice(0, len) + "…" : str;

const fmtUnread = (n: number): string =>
  n > MAX_UNREAD ? `${MAX_UNREAD}+` : String(n);

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
interface AvatarProps {
  src?:    string | null;
  name?:   string;
  online?: boolean;
  size?:   number;
}

const Avatar: FC<AvatarProps> = ({ src, name, online, size = 44 }) => {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U"
  )}&background=111&color=fff&size=${size * 2}`;

  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      <img
        src={src || fallback}
        alt={name || "User"}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = fallback;
        }}
        style={{
          width: size, height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          background: "#eee",
        }}
      />
      {online && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: 10, height: 10,
          background: "#22c55e",
          borderRadius: "50%",
          border: "2px solid #fff",
        }} />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Thread Row
───────────────────────────────────────────── */
interface ThreadRowProps {
  thread:   Thread;
  userId:   string | number;
  selected: boolean;
  onClick:  () => void;
}

const ThreadRow: FC<ThreadRowProps> = ({ thread, userId, selected, onClick }) => {
  const isMine   = thread.last_sender_id === userId;
  const unread   = Number(thread.unread_count || 0);
  const hasUnread = unread > 0;

  const preview    = thread.last_message || "";
  const displayMsg = isMine ? `You: ${preview}` : preview;

  const [hovered, setHovered] = useState(false);

  const bg = selected
    ? "#f0f0f0"
    : hovered
    ? "#f8f8f8"
    : hasUnread
    ? "#fafafa"
    : "#fff";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        background: bg,
        borderBottom: "1px solid #f5f5f5",
        cursor: "pointer",
        borderLeft: selected ? "3px solid #111" : "3px solid transparent",
        transition: "background .12s, border-color .12s",
      }}
    >
      <Avatar
        src={thread.other_user_image}
        name={thread.other_user_name}
        online={thread.other_user_online}
        size={44}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + time */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 2,
        }}>
          <span style={{
            fontWeight: hasUnread ? 800 : 600,
            fontSize: 14,
            color: "#111",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}>
            {thread.other_user_name || "User"}
          </span>
          <span style={{
            fontSize: 11,
            color: hasUnread ? "#111" : "#aaa",
            fontWeight: hasUnread ? 700 : 400,
            flexShrink: 0,
            marginLeft: 6,
          }}>
            {timeLabel(thread.last_message_at)}
          </span>
        </div>

        {/* Preview + badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{
            fontSize: 12,
            color: hasUnread ? "#333" : "#999",
            fontWeight: hasUnread ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}>
            {truncate(displayMsg) || "No messages yet"}
          </span>

          {thread.product_image && (
            <img
              src={thread.product_image}
              alt=""
              style={{
                width: 24, height: 24,
                borderRadius: 4,
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid #eee",
              }}
            />
          )}

          {hasUnread && (
            <span style={{
              minWidth: 18, height: 18,
              borderRadius: 9,
              background: "#111",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              flexShrink: 0,
            }}>
              {fmtUnread(unread)}
            </span>
          )}
        </div>

        {/* Product tag */}
        {thread.product_title && (
          <div style={{
            fontSize: 10,
            color: "#bbb",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            re: {thread.product_title}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Empty State
───────────────────────────────────────────── */
const EmptyState: FC = () => (
  <div style={{
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 12, padding: "80px 24px",
    textAlign: "center",
  }}>
    <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
      stroke="#ddd" strokeWidth={1.1}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
           8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
           15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#bbb" }}>
      No conversations yet
    </p>
    <p style={{ margin: 0, fontSize: 12, color: "#ccc", lineHeight: 1.5, maxWidth: 220 }}>
      When you message a seller or someone messages you,
      your conversations will appear here.
    </p>
  </div>
);

/* ─────────────────────────────────────────────
   Sidebar spinner
───────────────────────────────────────────── */
const SidebarSpinner: FC = () => (
  <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
    <div style={{
      width: 24, height: 24,
      border: "3px solid #eee",
      borderTop: "3px solid #111",
      borderRadius: "50%",
      animation: "spin .75s linear infinite",
    }} />
  </div>
);

/* ─────────────────────────────────────────────
   Main Sidebar Component
───────────────────────────────────────────── */
interface ConversationsSidebarProps {
  user:             User;
  selectedThreadId: string | null;
  onSelectThread:   (threadId: string, thread: Thread) => void;
}

const ConversationsSidebar: FC<ConversationsSidebarProps> = ({
  user,
  selectedThreadId,
  onSelectThread,
}) => {
  const [threads,  setThreads]  = useState<Thread[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState<"all" | "unread">("all");

  const mounted  = useRef(true);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback(<T,>(fn: () => T) => {
    if (mounted.current) fn();
  }, []);

  /* ── Fetch ── */
  const fetchConversations = useCallback(async (showLoader = true) => {
    if (!user?.id) return;
    if (showLoader) safe(() => { setLoading(true); setError(null); });

    try {
      const ctrl    = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);

      const res = await fetch(
        `${API}/conversations?userId=${user.id}`,
        { headers: authH(), signal: ctrl.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || `HTTP ${res.status}`);
      }

      const data: Thread[] = await res.json();
      const list = Array.isArray(data) ? data : [];
      list.sort(
        (a, b) =>
          new Date(b.last_message_at || 0).getTime() -
          new Date(a.last_message_at || 0).getTime()
      );

      safe(() => setThreads(list));
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (showLoader) safe(() => setError(err.message));
    } finally {
      if (showLoader) safe(() => setLoading(false));
    }
  }, [user?.id, safe]);

  useEffect(() => { fetchConversations(true); }, [fetchConversations]);

  /* ── Poll ── */
  useEffect(() => {
    if (!user?.id) return;
    pollRef.current = setInterval(() => fetchConversations(false), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id, fetchConversations]);

  /* ── Filter ── */
  const filtered = threads.filter((t) => {
    if (tab === "unread" && Number(t.unread_count || 0) === 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inName    = (t.other_user_name || "").toLowerCase().includes(q);
      const inMsg     = (t.last_message    || "").toLowerCase().includes(q);
      const inProduct = (t.product_title   || "").toLowerCase().includes(q);
      if (!inName && !inMsg && !inProduct) return false;
    }
    return true;
  });

  const totalUnread = threads.reduce(
    (s, t) => s + Number(t.unread_count || 0), 0
  );

  return (
    <aside style={{
      width: 320,
      minWidth: 280,
      maxWidth: 360,
      borderRight: "1px solid #ebebeb",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#fff",
      flexShrink: 0,
    }}>
      {/* Keyframe injection */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Sidebar Header ── */}
      <div style={{
        padding: "16px 16px 0",
        borderBottom: "1px solid #f0f0f0",
        background: "#fff",
      }}>
        {/* Title row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 18, fontWeight: 900,
              color: "#111", letterSpacing: "-0.5px",
            }}>
              Messages
            </span>
            {totalUnread > 0 && (
              <span style={{
                background: "#111", color: "#fff",
                fontSize: 11, fontWeight: 700,
                padding: "2px 7px", borderRadius: 10,
              }}>
                {fmtUnread(totalUnread)}
              </span>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchConversations(true)}
            aria-label="Refresh"
            style={{
              background: "none", border: "none",
              cursor: "pointer", padding: 6,
              borderRadius: "50%",
              display: "flex", alignItems: "center",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
              stroke="#555" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9
                   m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            border: "1.5px solid #eee",
            fontSize: 13,
            background: "#f8f8f8",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#999")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#eee")}
        />

        {/* Tabs */}
        {threads.length > 0 && (
          <div style={{ display: "flex" }}>
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: 12,
                  fontWeight: 700,
                  color: tab === t ? "#111" : "#aaa",
                  background: "none",
                  border: "none",
                  borderBottom: tab === t ? "2.5px solid #111" : "2.5px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color .15s",
                }}
              >
                {t === "all"
                  ? `All (${threads.length})`
                  : `Unread (${totalUnread})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Thread List ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <SidebarSpinner />}

        {!loading && error && (
          <div style={{
            padding: "40px 20px",
            textAlign: "center",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 10,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
              Could not load messages
            </p>
            <p style={{
              margin: 0, fontSize: 11, color: "#f87171",
              fontFamily: "monospace",
              background: "#fef2f2",
              padding: "3px 8px", borderRadius: 5,
            }}>
              {error}
            </p>
            <button
              onClick={() => fetchConversations(true)}
              style={{
                padding: "7px 20px",
                borderRadius: 20, border: "none",
                background: "#111", color: "#fff",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && threads.length === 0 && <EmptyState />}

        {!loading && !error && threads.length > 0 && filtered.length === 0 && (
          <p style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#aaa", fontSize: 13,
          }}>
            {tab === "unread"
              ? "🎉 All caught up!"
              : `No results for "${search}"`}
          </p>
        )}

        {!loading && !error && filtered.map((thread) => {
          const tid = String(thread.thread_id || thread.id);
          return (
            <ThreadRow
              key={tid}
              thread={thread}
              userId={user.id}
              selected={selectedThreadId === tid}
              onClick={() => onSelectThread(tid, thread)}
            />
          );
        })}
      </div>
    </aside>
  );
};

export default ConversationsSidebar;