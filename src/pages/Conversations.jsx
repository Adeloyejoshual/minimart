// ════════════════════════════════════════════════════════════
// FILE: src/pages/Conversations.jsx
// Route: /conversations
// ════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

import BottomNav from "../components/BottomNav";
import "../styles/Conversations.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const POLL_INTERVAL   = 15_000;
const PREVIEW_MAX_LEN = 55;
const MAX_UNREAD_DISP = 99;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const timeLabel = (dateStr) => {
  if (!dateStr) return "";
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60)     return "now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;

  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d >= today)     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d >= yesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const truncate = (str, len = PREVIEW_MAX_LEN) =>
  str.length > len ? str.slice(0, len) + "…" : str;

const fmtUnread = (n) =>
  n > MAX_UNREAD_DISP ? `${MAX_UNREAD_DISP}+` : String(n);

/* ═══════════════════════════════════════════════════════════════
   ANIMATION PRESETS
═══════════════════════════════════════════════════════════════ */
const spring = { type: "spring", stiffness: 320, damping: 28 };

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const threadReveal = {
  hidden:  { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1 },
  exit:    { opacity: 0, x: -30, transition: { duration: 0.2 } },
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icons = {
  back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64
              4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chat: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
             8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
             15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  error: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </svg>
  ),
  lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   FETCHER
═══════════════════════════════════════════════════════════════ */
async function fetchConversations(userId) {
  const token = getToken();
  if (!token || !userId) return [];

  const { data } = await axios.get(`${API}/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
    params:  { userId, limit: 50, page: 1 },
    timeout: 10000,
  });

  const list = Array.isArray(data) ? data : [];
  list.sort(
    (a, b) =>
      new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
  );
  return list;
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════════════════════════ */
const Avatar = memo(function Avatar({ src, name, online, size = 52 }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U"
  )}&background=111&color=fff&size=${size * 2}`;

  return (
    <div className="cv-avatar" style={{ width: size, height: size }}>
      <img
        src={src || fallback}
        alt={name || "User"}
        className="cv-avatar__img"
        style={{ width: size, height: size }}
        onError={(e) => { e.target.src = fallback; }}
      />
      {online && <span className="cv-avatar__online" />}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════════ */
const EmptyState = memo(function EmptyState({ filtered = false, search = "" }) {
  if (filtered) {
    return (
      <motion.div
        className="cv-empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <p className="cv-empty__title">
          {search ? `No results for "${search}"` : "🎉 All caught up!"}
        </p>
        <p className="cv-empty__sub">
          {search
            ? "Try a different search term"
            : "No unread messages — nice work!"}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="cv-empty"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
    >
      <div className="cv-empty__icon">
        <Icons.chat />
      </div>
      <p className="cv-empty__title">No conversations yet</p>
      <p className="cv-empty__sub">
        When you message a seller or someone messages you, your conversations
        will appear here.
      </p>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADER
═══════════════════════════════════════════════════════════════ */
const SkeletonThread = memo(function SkeletonThread() {
  return (
    <div className="cv-skeleton">
      <div className="cv-skeleton__avatar cv-shimmer" />
      <div className="cv-skeleton__body">
        <div className="cv-skeleton__line cv-skeleton__line--name cv-shimmer" />
        <div className="cv-skeleton__line cv-skeleton__line--msg cv-shimmer" />
      </div>
    </div>
  );
});

const SkeletonList = memo(function SkeletonList() {
  return (
    <div className="cv-skeleton-list">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonThread key={i} />
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   THREAD ITEM
═══════════════════════════════════════════════════════════════ */
const ThreadItem = memo(function ThreadItem({ thread, userId, onClick, index }) {
  const isMine    = thread.last_sender_id === userId;
  const unread    = Number(thread.unread_count || 0);
  const hasUnread = unread > 0;

  const preview    = thread.last_message || "";
  const displayMsg = isMine ? `You: ${preview}` : preview;
  const truncated  = truncate(displayMsg);

  return (
    <motion.div
      className={`cv-thread${hasUnread ? " cv-thread--unread" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      variants={threadReveal}
      transition={{ ...spring, delay: index * 0.03 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <Avatar
        src={thread.other_user_image}
        name={thread.other_user_name}
        online={thread.other_user_online}
      />

      <div className="cv-thread__content">
        {/* Row 1: Name + Time */}
        <div className="cv-thread__row">
          <span className={`cv-thread__name${hasUnread ? " cv-thread__name--bold" : ""}`}>
            {thread.other_user_name || "User"}
          </span>
          <span className={`cv-thread__time${hasUnread ? " cv-thread__time--bold" : ""}`}>
            {timeLabel(thread.last_message_at)}
          </span>
        </div>

        {/* Row 2: Preview + Product + Badge */}
        <div className="cv-thread__row">
          <span className={`cv-thread__preview${hasUnread ? " cv-thread__preview--bold" : ""}`}>
            {truncated || "No messages yet"}
          </span>

          <div className="cv-thread__meta">
            {thread.product_image && (
              <img
                src={thread.product_image}
                alt=""
                className="cv-thread__product-img"
              />
            )}

            <AnimatePresence>
              {hasUnread && (
                <motion.span
                  className="cv-thread__badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                >
                  {fmtUnread(unread)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Row 3: Product title */}
        {thread.product_title && (
          <span className="cv-thread__product-title">
            re: {thread.product_title}
          </span>
        )}
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR STATE
═══════════════════════════════════════════════════════════════ */
const ErrorState = memo(function ErrorState({ message, onRetry, isRetrying }) {
  return (
    <motion.div
      className="cv-error"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <div className="cv-error__icon">
        <Icons.error />
      </div>
      <p className="cv-error__title">Could not load messages</p>
      <p className="cv-error__msg">{message}</p>
      <motion.button
        className="cv-error__btn"
        onClick={onRetry}
        disabled={isRetrying}
        whileTap={{ scale: 0.95 }}
      >
        {isRetrying ? (
          <>
            <span className="cv-spinner-sm" /> Refreshing…
          </>
        ) : (
          <>
            <Icons.refresh /> Retry
          </>
        )}
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NOT LOGGED IN
═══════════════════════════════════════════════════════════════ */
const NotLoggedIn = memo(function NotLoggedIn({ onLogin }) {
  return (
    <motion.div
      className="cv-noauth"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
    >
      <div className="cv-noauth__icon">
        <Icons.lock />
      </div>
      <p className="cv-noauth__title">Log in to see your messages</p>
      <p className="cv-noauth__sub">
        Your conversations with buyers and sellers will appear here
      </p>
      <motion.button
        className="cv-noauth__btn"
        onClick={onLogin}
        whileTap={{ scale: 0.95 }}
      >
        Log in
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Conversations({ user }) {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [tab,        setTab]        = useState("all");
  const [isRetrying, setIsRetrying] = useState(false);

  /* ── Fetch conversations ── */
  const {
    data:      threads = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey:  ["conversations", user?.id],
    queryFn:   () => fetchConversations(user?.id),
    enabled:   !!user?.id && !!getToken(),
    staleTime: 30 * 1000,
    gcTime:    10 * 60 * 1000,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
    retry: 2,
  });

  /* ── Invalidate unread count when page loads ── */
  // This clears the BottomNav badge when user views messages
  useState(() => {
    queryClient.invalidateQueries({ queryKey: ["unread-message-count"] });
  });

  /* ── Filtered threads ── */
  const filtered = useMemo(() => {
    return threads.filter((t) => {
      if (tab === "unread" && Number(t.unread_count || 0) === 0) return false;

      if (search.trim()) {
        const q       = search.toLowerCase();
        const name    = (t.other_user_name || "").toLowerCase();
        const msg     = (t.last_message || "").toLowerCase();
        const product = (t.product_title || "").toLowerCase();
        if (!name.includes(q) && !msg.includes(q) && !product.includes(q))
          return false;
      }

      return true;
    });
  }, [threads, tab, search]);

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + Number(t.unread_count || 0), 0),
    [threads]
  );

  /* ── Handlers ── */
  const openThread = useCallback(
    (thread) => {
      const threadId = thread.thread_id || thread.id;
      navigate(`/chat/${threadId}`);
    },
    [navigate]
  );

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refetch();
    } finally {
      setIsRetrying(false);
    }
  }, [refetch]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  /* ═══════════════════════════════════════════════════════════
     NOT LOGGED IN
  ═══════════════════════════════════════════════════════════ */
  if (!user?.id) {
    return (
      <div className="cv-root">
        <NotLoggedIn onLogin={() => navigate("/auth")} />
        <BottomNav />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="cv-root">
      {/* ── Header ── */}
      <header className="cv-header">
        <div className="cv-header__top">
          <div className="cv-header__left">
            <motion.button
              className="cv-header__back"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              whileTap={{ scale: 0.85, x: -3 }}
            >
              <Icons.back />
            </motion.button>

            <motion.h1
              className="cv-header__title"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={spring}
            >
              Messages
              <AnimatePresence>
                {totalUnread > 0 && (
                  <motion.span
                    className="cv-header__badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {fmtUnread(totalUnread)}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.h1>
          </div>

          <motion.button
            className="cv-header__action"
            onClick={handleRefresh}
            aria-label="Refresh"
            whileTap={{ scale: 0.85, rotate: -45 }}
          >
            <Icons.refresh />
          </motion.button>
        </div>

        {/* Search */}
        {threads.length > 3 && (
          <motion.div
            className="cv-search-wrap"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.06 }}
          >
            <span className="cv-search__icon">
              <Icons.search />
            </span>
            <input
              className="cv-search__input"
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <AnimatePresence>
              {search && (
                <motion.button
                  className="cv-search__clear"
                  onClick={() => setSearch("")}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  ×
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Tabs */}
        {threads.length > 0 && (
          <div className="cv-tabs">
            <button
              className={`cv-tab${tab === "all" ? " cv-tab--active" : ""}`}
              onClick={() => setTab("all")}
            >
              All
              <span className="cv-tab__count">{threads.length}</span>
            </button>
            <button
              className={`cv-tab${tab === "unread" ? " cv-tab--active" : ""}`}
              onClick={() => setTab("unread")}
            >
              Unread
              {totalUnread > 0 && (
                <span className="cv-tab__count cv-tab__count--unread">
                  {fmtUnread(totalUnread)}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="cv-body">
        {/* Loading */}
        {loading && <SkeletonList />}

        {/* Error */}
        {!loading && isError && (
          <ErrorState
            message={error?.message || "Connection error"}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}

        {/* Empty — no conversations */}
        {!loading && !isError && threads.length === 0 && <EmptyState />}

        {/* Empty — filter returned nothing */}
        {!loading &&
          !isError &&
          threads.length > 0 &&
          filtered.length === 0 && (
            <EmptyState filtered search={tab === "all" ? search : ""} />
          )}

        {/* Thread list */}
        {!loading && !isError && filtered.length > 0 && (
          <motion.div
            className="cv-thread-list"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((thread, i) => (
              <ThreadItem
                key={thread.thread_id || thread.id}
                thread={thread}
                userId={user.id}
                onClick={() => openThread(thread)}
                index={i}
              />
            ))}
          </motion.div>
        )}

        {/* Bottom spacer for BottomNav */}
        <div className="cv-spacer" />
      </div>

      <BottomNav />
    </div>
  );
}