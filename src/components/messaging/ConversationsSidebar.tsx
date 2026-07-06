import {
  useEffect,
  useState,
  useCallback,
  useRef,
  FC,
  KeyboardEvent,
} from "react";

import { Thread, User } from "./types";
import "../../styles/conversations-sidebar.css";

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */
const API           = `${import.meta.env.VITE_API_BASE_URL}/api`;
const POLL_INTERVAL = 15_000;
const FETCH_TIMEOUT = 10_000;
const PREVIEW_MAX   = 55;
const MAX_UNREAD    = 99;

/* ─────────────────────────────────────────
   Auth
───────────────────────────────────────── */
const getToken = (): string =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

const authH = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
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

  if (d >= today)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d >= yesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const truncate = (str: string, len = PREVIEW_MAX): string =>
  str.length > len ? str.slice(0, len) + "…" : str;

const fmtUnread = (n: number): string =>
  n > MAX_UNREAD ? `${MAX_UNREAD}+` : String(n);

/* ─────────────────────────────────────────
   Thread Row
───────────────────────────────────────── */
interface ThreadRowProps {
  thread:   Thread;
  userId:   string | number;
  selected: boolean;
  onClick:  () => void;
}

const ThreadRow: FC<ThreadRowProps> = ({ thread, userId, selected, onClick }) => {
  const isMine    = thread.last_sender_id === userId;
  const unread    = Number(thread.unread_count || 0);
  const hasUnread = unread > 0;
  const preview   = thread.last_message || "";
  const display   = isMine ? `You: ${preview}` : preview;

  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    thread.other_user_name || "U"
  )}&background=FF5C00&color=fff&size=92`;

  let rowClass = "cv-thread";
  if (selected)  rowClass += " cv-thread--selected";
  if (hasUnread && !selected) rowClass += " cv-thread--unread";

  return (
    <div
      role="button"
      tabIndex={0}
      className={rowClass}
      onClick={onClick}
      onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && onClick()}
    >
      {/* Avatar */}
      <div className="cv-thread__avatar-wrap">
        <img
          className="cv-thread__avatar"
          src={thread.other_user_image || fallback}
          alt={thread.other_user_name || "User"}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallback;
          }}
        />
        {thread.other_user_online && (
          <span className="cv-thread__online-dot" />
        )}
      </div>

      {/* Content */}
      <div className="cv-thread__content">
        {/* Name + time */}
        <div className="cv-thread__row">
          <span className={`cv-thread__name${hasUnread ? " cv-thread__name--unread" : ""}`}>
            {thread.other_user_name || "User"}
          </span>
          <span className={`cv-thread__time${hasUnread ? " cv-thread__time--unread" : ""}`}>
            {timeLabel(thread.last_message_at)}
          </span>
        </div>

        {/* Preview row */}
        <div className="cv-thread__preview-row">
          <span className={`cv-thread__preview${hasUnread ? " cv-thread__preview--unread" : ""}`}>
            {truncate(display) || "No messages yet"}
          </span>

          {thread.product_image && (
            <img
              className="cv-thread__product-thumb"
              src={thread.product_image}
              alt=""
            />
          )}

          {hasUnread && (
            <span className="cv-thread__unread-badge">
              {fmtUnread(unread)}
            </span>
          )}
        </div>

        {/* Product tag */}
        {thread.product_title && (
          <div className="cv-thread__product-tag">
            re: {thread.product_title}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   Props
───────────────────────────────────────── */
interface ConversationsSidebarProps {
  user:             User;
  selectedThreadId: string | null;
  onSelectThread:   (threadId: string, thread: Thread) => void;
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const ConversationsSidebar: FC<ConversationsSidebarProps> = ({
  user,
  selectedThreadId,
  onSelectThread,
}) => {
  const [threads, setThreads]  = useState<Thread[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState<string | null>(null);
  const [search,  setSearch]   = useState("");
  const [tab,     setTab]      = useState<"all" | "unread">("all");

  const mounted = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn: () => void) => {
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
    pollRef.current = setInterval(
      () => fetchConversations(false),
      POLL_INTERVAL
    );
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  /* ── Render ── */
  return (
    <aside className="cv-sidebar">
      {/* ── Header ── */}
      <div className="cv-sidebar__header">
        <div className="cv-sidebar__header-top">
          <div className="cv-sidebar__title-row">
            <span className="cv-sidebar__title">Messages</span>
            {totalUnread > 0 && (
              <span className="cv-sidebar__badge">
                {fmtUnread(totalUnread)}
              </span>
            )}
          </div>

          <button
            className="cv-sidebar__refresh-btn"
            onClick={() => fetchConversations(true)}
            aria-label="Refresh conversations"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582
                   9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0
                   01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <input
          className="cv-sidebar__search"
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Tabs */}
        {threads.length > 0 && (
          <div className="cv-sidebar__tabs">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                className={`cv-sidebar__tab${
                  tab === t ? " cv-sidebar__tab--active" : ""
                }`}
                onClick={() => setTab(t)}
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
      <div className="cv-sidebar__list">
        {loading && (
          <div className="cv-sidebar__spinner-wrap">
            <div className="cv-sidebar__spinner" />
          </div>
        )}

        {!loading && error && (
          <div className="cv-sidebar__error">
            <p className="cv-sidebar__error-text">
              Could not load messages
            </p>
            <p className="cv-sidebar__error-code">{error}</p>
            <button
              className="cv-sidebar__retry-btn"
              onClick={() => fetchConversations(true)}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && threads.length === 0 && (
          <div className="cv-sidebar__empty">
            <svg width="52" height="52" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
                   8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
                   15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="cv-sidebar__empty-title">No conversations yet</p>
            <p className="cv-sidebar__empty-sub">
              When you message a seller or someone messages you,
              your conversations will appear here.
            </p>
          </div>
        )}

        {!loading && !error && threads.length > 0 && filtered.length === 0 && (
          <p className="cv-sidebar__no-results">
            {tab === "unread"
              ? "🎉 All caught up — no unread messages!"
              : `No results for "${search}"`}
          </p>
        )}

        {!loading &&
          !error &&
          filtered.map((thread) => {
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