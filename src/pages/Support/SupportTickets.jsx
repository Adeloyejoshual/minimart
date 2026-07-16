// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportTickets.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/SupportTickets.css";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Link }                                            from "react-router-dom";
import axios                                               from "axios";

import {
  IconPlus, IconSearch, IconChevronRight, IconClock,
  IconMessageSquare, IconArrowLeft, IconLoader,
  IconRefresh, IconAlertTriangle,
} from "../../components/help/icons/HelpIcons";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const STATUS_FILTERS = [
  { label: "All",         value: "" },
  { label: "Open",        value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Waiting",     value: "waiting_for_customer" },
  { label: "Resolved",    value: "resolved" },
  { label: "Closed",      value: "closed" },
];

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function timeAgo(d) {
  if (!d) return "";
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return formatDate(d);
}

function extractApiError(err, url) {
  if (axios.isCancel(err)) return null;

  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return {
        title: "Request timed out",
        detail: "The server took too long to respond.",
        hint: "Check your connection and try again.",
        httpStatus: null, url, serverRaw: null,
      };
    if (typeof navigator !== "undefined" && !navigator.onLine)
      return {
        title: "You are offline",
        detail: "No internet connection detected.",
        hint: "Please reconnect and try again.",
        httpStatus: null, url, serverRaw: null,
      };
    return {
      title: "Network error",
      detail: err.message || "Could not reach the server.",
      hint: "Check your connection or try again shortly.",
      httpStatus: null, url, serverRaw: null,
    };
  }

  const { status, data, config } = err.response;
  const actualUrl = config?.url ?? url;

  let serverMsg = null;
  if (typeof data === "string" && data.trim()) {
    if (data.trim().startsWith("<")) {
      const t = data.match(/<title[^>]*>([^<]+)<\/title>/i);
      const p = data.match(/<p[^>]*>([^<]{10,300})<\/p>/i);
      serverMsg = t?.[1]?.trim() || p?.[1]?.trim() || "Server returned an HTML error page.";
    } else if (data.length < 500) {
      serverMsg = data.trim();
    }
  } else if (data && typeof data === "object") {
    const raw =
      data.message || data.error?.message ||
      (typeof data.error === "string" ? data.error : null) ||
      data.detail || data.errors?.[0]?.message ||
      data.errors?.[0] || data.msg || data.reason || null;
    serverMsg = raw && typeof raw === "object" ? JSON.stringify(raw) : raw;
  }

  const titleMap = {
    400: "Bad request",       401: "Authentication required",
    403: "Access denied",     404: "Not found",
    429: "Too many requests", 500: "Server error",
    502: "Bad gateway",       503: "Service unavailable",
    504: "Gateway timeout",
  };
  const hintMap = {
    400: "Check your request and try again.",
    401: "Please sign in again.",
    403: "You may not have permission to view these tickets.",
    404: "The tickets endpoint was not found.",
    429: "Wait a moment before trying again.",
    500: "Server-side issue. Try again shortly.",
    502: "Server gateway is down. Try in a few minutes.",
    503: "Server under maintenance. Try again soon.",
    504: "Server timed out. Try in a few minutes.",
  };

  return {
    title:      `${titleMap[status] ?? "Error"} (${status})`,
    detail:     serverMsg || `HTTP ${status} with no further detail.`,
    hint:       hintMap[status] || "Please try again.",
    httpStatus: status,
    url:        actualUrl,
    serverRaw:  data,
  };
}

/* ════════════════════════════════════════════════════════════
   STATUS BADGE
════════════════════════════════════════════════════════════ */
const STATUS_META = {
  open: "Open", in_progress: "In Progress",
  waiting_for_customer: "Waiting", resolved: "Resolved", closed: "Closed",
};

const StatusBadge = memo(function StatusBadge({ status }) {
  const key   = status ?? "open";
  const label = STATUS_META[key] ?? key;
  const mod   = key === "waiting_for_customer" ? "waiting" : key;
  return <span className={`stp-badge stp-badge--${mod}`}>{label}</span>;
});

/* ════════════════════════════════════════════════════════════
   PRIORITY BADGE
════════════════════════════════════════════════════════════ */
const PriorityBadge = memo(function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={`stp-priority stp-priority--${priority}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
});

/* ════════════════════════════════════════════════════════════
   ERROR STATE
════════════════════════════════════════════════════════════ */
const ErrorState = memo(function ErrorState({ error, onRetry, onSignIn }) {
  const [raw, setRaw] = useState(false);
  const is500   = (error?.httpStatus ?? 0) >= 500;
  const noRetry = [403, 404].includes(error?.httpStatus);

  return (
    <div className="stp-error" role="alert" aria-live="assertive">
      <div className="stp-error-icon" aria-hidden="true">
        <IconAlertTriangle size={22} />
      </div>
      <h2 className="stp-error-title">{error?.title ?? "Could not load tickets"}</h2>
      <p className="stp-error-detail">{error?.detail ?? "An unexpected error occurred."}</p>
      {error?.hint && <p className="stp-error-hint">💡 {error.hint}</p>}

      {(error?.httpStatus || error?.url) && (
        <div className="stp-error-table">
          {error.httpStatus && (
            <div className="stp-error-row">
              <span className="stp-error-key">HTTP</span>
              <code className={`stp-error-val${is500 ? " stp-error-val--red" : ""}`}>
                {error.httpStatus}
              </code>
            </div>
          )}
          {error.url && (
            <div className="stp-error-row">
              <span className="stp-error-key">Endpoint</span>
              <code className="stp-error-val stp-error-val--url">{error.url}</code>
            </div>
          )}
        </div>
      )}

      {error?.serverRaw != null && (
        <>
          <button
            className="stp-error-raw-toggle"
            onClick={() => setRaw((v) => !v)}
            aria-expanded={raw}
          >
            {raw ? "▾ Hide" : "▸ Show"} server response
          </button>
          {raw && (
            <pre className="stp-error-raw">
              {typeof error.serverRaw === "string"
                ? error.serverRaw
                : JSON.stringify(error.serverRaw, null, 2)}
            </pre>
          )}
        </>
      )}

      <div className="stp-error-actions">
        {!noRetry && (
          <button className="stp-error-btn-primary" onClick={onRetry}>
            <IconRefresh size={14} /> Try Again
          </button>
        )}
        {error?.httpStatus === 401 && (
          <button className="stp-error-btn-primary" onClick={onSignIn}>
            Sign In
          </button>
        )}
        <Link to="/support" className="stp-error-btn-ghost">
          <IconArrowLeft size={14} /> Support
        </Link>
      </div>

      {is500 && (
        <p className="stp-error-500-note">
          Server-side error — not your fault.{" "}
          <Link to="/support" className="stp-error-link">Contact support</Link> if it persists.
        </p>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   TICKET CARD
════════════════════════════════════════════════════════════ */
const TicketCard = memo(function TicketCard({ ticket }) {
  const hasUnread = ticket.has_unread_messages || ticket.unread_count > 0;

  return (
    <Link
      to={`/support/tickets/${ticket.id}`}
      className={`stp-card${hasUnread ? " stp-card--unread" : ""}`}
      aria-label={`Ticket ${ticket.ticket_number}: ${ticket.subject}`}
    >
      <div className="stp-card-body">
        <div className="stp-card-top">
          <span className="stp-card-number">{ticket.ticket_number}</span>
          <StatusBadge status={ticket.status} />
        </div>

        <h3 className="stp-card-subject">{ticket.subject}</h3>

        <div className="stp-card-meta">
          {ticket.category && (
            <>
              <span className="stp-card-category">{ticket.category}</span>
              <span className="stp-card-dot" aria-hidden="true" />
            </>
          )}
          <span className="stp-card-date" title={formatDate(ticket.created_at)}>
            <IconClock size={11} />
            {timeAgo(ticket.created_at)}
          </span>
          <PriorityBadge priority={ticket.priority} />
        </div>

        {ticket.message_count > 0 && (
          <div className="stp-card-messages">
            <IconMessageSquare size={11} />
            {ticket.message_count}{" "}
            {ticket.message_count === 1 ? "message" : "messages"}
          </div>
        )}
      </div>

      <IconChevronRight size={18} className="stp-card-arrow" />
    </Link>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function SupportTickets() {
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [apiError,     setApiError]     = useState(null);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isMounted = useRef(true);
  const abortRef  = useRef(null);
  const searchRef = useRef(null);

  /* ── Fetch ── */
  const loadTickets = useCallback(async () => {
    const token = getToken();
    const url   = `${BASE_URL}/api/support/tickets`;

    if (!token) {
      setApiError({
        title: "Authentication required",
        detail: "Please sign in to view your tickets.",
        hint: "Tap Sign In below.",
        httpStatus: 401, url: null, serverRaw: null,
      });
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setApiError(null);
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
        timeout: 15_000,
      });
      if (!isMounted.current) return;

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.tickets) ? data.tickets
        : Array.isArray(data?.data) ? data.data
        : [];

      setTickets(list);
      setApiError(null);
    } catch (err) {
      if (!isMounted.current || axios.isCancel(err)) return;

      console.group("%c[SupportTickets] API Error", "color:red;font-weight:bold");
      console.error("URL   :", url);
      console.error("Status:", err?.response?.status ?? "no response");
      console.error("Body  :", err?.response?.data);
      console.groupEnd();

      setApiError(extractApiError(err, url));
      setTickets([]);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadTickets();
    return () => {
      isMounted.current = false;
      abortRef.current?.abort();
    };
  }, [loadTickets]);

  const handleRetry = useCallback(() => {
    abortRef.current?.abort();
    setLoading(true);
    setApiError(null);
    setTickets([]);
    loadTickets();
  }, [loadTickets]);

  const handleSignIn = useCallback(() => {
    window.location.href =
      "/auth?redirect=" + encodeURIComponent(window.location.pathname);
  }, []);

  /* ── Derived ── */
  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (t.ticket_number ?? "").toLowerCase().includes(q) ||
      (t.subject ?? "").toLowerCase().includes(q) ||
      (t.category ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="stp-page">
        <div className="stp-container">
          <div className="stp-loading" role="status" aria-busy="true">
            <IconLoader size={26} className="stp-spinner" />
            <p>Loading your tickets…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (apiError) {
    return (
      <div className="stp-page">
        <div className="stp-container">
          <ErrorState error={apiError} onRetry={handleRetry} onSignIn={handleSignIn} />
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div className="stp-page">
      <div className="stp-container">

        {/* Header */}
        <div className="stp-header">
          <div className="stp-header-left">
            <Link to="/support" className="stp-back" aria-label="Back to support">
              <IconArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="stp-title">My Tickets</h1>
              <p className="stp-subtitle">
                {tickets.length} {tickets.length === 1 ? "request" : "requests"}
              </p>
            </div>
          </div>
          <div className="stp-header-right">
            <button
              className="stp-refresh-btn"
              onClick={handleRetry}
              aria-label="Refresh"
              disabled={loading}
            >
              <IconRefresh size={15} />
            </button>
            <Link to="/support/contact" className="stp-new-btn">
              <IconPlus size={14} />
              <span>New Ticket</span>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="stp-filters">
          <div className="stp-search-wrap">
            <IconSearch size={15} className="stp-search-icon" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search tickets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="stp-search-input"
              aria-label="Search tickets"
            />
            {search && (
              <button
                className="stp-search-clear"
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="stp-status-filters" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => {
              const count    = f.value ? (counts[f.value] ?? 0) : tickets.length;
              const isActive = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`stp-status-btn${isActive ? " stp-status-btn--active" : ""}`}
                  aria-pressed={isActive}
                >
                  {f.label}
                  {count > 0 && <span className="stp-status-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty */}
        {filtered.length === 0 ? (
          <div className="stp-empty" role="status">
            <IconMessageSquare size={40} className="stp-empty-icon" />
            <h3 className="stp-empty-title">
              {tickets.length === 0 ? "No support requests yet" : "No matches"}
            </h3>
            <p className="stp-empty-desc">
              {tickets.length === 0
                ? "Submit a request and it will appear here."
                : "Try adjusting your search or filter."}
            </p>
            {tickets.length === 0 && (
              <Link to="/support/contact" className="stp-empty-btn">
                <IconPlus size={14} /> Create Your First Ticket
              </Link>
            )}
            {tickets.length > 0 && (
              <button
                className="stp-clear-btn"
                onClick={() => { setSearch(""); setStatusFilter(""); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          /* Cards */
          <div className="stp-cards" role="list">
            {filtered.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}

        {/* Footer */}
        {tickets.length > 0 && (
          <p className="stp-footer-hint" aria-live="polite">
            Showing {filtered.length} of {tickets.length}{" "}
            {tickets.length === 1 ? "ticket" : "tickets"}
          </p>
        )}

      </div>
    </div>
  );
}