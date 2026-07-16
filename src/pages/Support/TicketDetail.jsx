// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/TicketDetail.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./TicketDetail.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

/* ════════════════════════════════════════════════════════════
   ERROR MESSAGE EXTRACTOR
════════════════════════════════════════════════════════════ */
function extractErrorMessage(error) {
  if (!error.response) {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      return {
        title: "Request timed out",
        message:
          "The server took too long to respond. Please check your connection and try again.",
        code: "TIMEOUT",
        status: null,
      };
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return {
        title: "You're offline",
        message:
          "No internet connection detected. Please check your network and try again.",
        code: "OFFLINE",
        status: null,
      };
    }
    return {
      title: "Network error",
      message:
        "Could not connect to the server. Please check your internet connection.",
      code: "NETWORK",
      status: null,
    };
  }

  const { status, data } = error.response;

  const serverMsg =
    data?.message ||
    data?.error?.message ||
    data?.error ||
    data?.detail ||
    data?.errors?.[0]?.message ||
    data?.msg ||
    null;

  switch (status) {
    case 400:
      return {
        title: "Bad request",
        message:
          serverMsg ||
          "The request was invalid. Please check and try again.",
        code: "BAD_REQUEST",
        status,
      };
    case 401:
      return {
        title: "Authentication required",
        message:
          serverMsg || "Your session has expired. Please sign in again.",
        code: "UNAUTHORIZED",
        status,
      };
    case 403:
      return {
        title: "Access denied",
        message:
          serverMsg ||
          "You don't have permission to view this ticket. It may belong to another account.",
        code: "FORBIDDEN",
        status,
      };
    case 404:
      return {
        title: "Ticket not found",
        message:
          serverMsg ||
          "This ticket doesn't exist or may have been deleted.",
        code: "NOT_FOUND",
        status,
      };
    case 410:
      return {
        title: "Ticket removed",
        message:
          serverMsg || "This ticket has been permanently deleted.",
        code: "GONE",
        status,
      };
    case 422:
      return {
        title: "Validation error",
        message: serverMsg || "The ticket ID format is invalid.",
        code: "VALIDATION",
        status,
      };
    case 429:
      return {
        title: "Too many requests",
        message:
          serverMsg ||
          "You've made too many requests. Please wait a moment and try again.",
        code: "RATE_LIMITED",
        status,
      };
    case 500:
      return {
        title: "Server error",
        message:
          serverMsg ||
          "Something went wrong on our end. Our team has been notified.",
        code: "SERVER_ERROR",
        status,
      };
    case 502:
    case 503:
    case 504:
      return {
        title: "Service unavailable",
        message:
          serverMsg ||
          "The server is temporarily unavailable. Please try again in a few minutes.",
        code: "SERVICE_DOWN",
        status,
      };
    default:
      return {
        title: `Error ${status}`,
        message:
          serverMsg || `An unexpected error occurred (HTTP ${status}).`,
        code: "UNKNOWN",
        status,
      };
  }
}

/* ════════════════════════════════════════════════════════════
   ERROR ICONS
════════════════════════════════════════════════════════════ */
const errorIcons = {
  TIMEOUT: "⏱️",
  OFFLINE: "📡",
  NETWORK: "🌐",
  UNAUTHORIZED: "🔒",
  FORBIDDEN: "🚫",
  NOT_FOUND: "🔍",
  GONE: "🗑️",
  RATE_LIMITED: "⏳",
  SERVER_ERROR: "⚙️",
  SERVICE_DOWN: "🔧",
  BAD_REQUEST: "⚠️",
  VALIDATION: "📝",
  UNKNOWN: "❌",
  NO_ID: "🔗",
};

/* ════════════════════════════════════════════════════════════
   ERROR DISPLAY
════════════════════════════════════════════════════════════ */
function TicketError({ error, onRetry, isRetrying }) {
  const navigate = useNavigate();
  const icon = errorIcons[error.code] || "❌";

  const showRetry = ![
    "FORBIDDEN",
    "NOT_FOUND",
    "GONE",
    "VALIDATION",
    "NO_ID",
  ].includes(error.code);

  return (
    <div className="td-error-page">
      <div className="td-error">
        <div className="td-error__icon">{icon}</div>
        <h2 className="td-error__title">{error.title}</h2>
        <p className="td-error__message">{error.message}</p>

        {error.status && (
          <p className="td-error__status">
            Error code: HTTP {error.status}
          </p>
        )}

        <div className="td-error__actions">
          {showRetry && (
            <button
              className="td-error__btn td-error__btn--primary"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <span className="td-error__spinner" />
                  Retrying…
                </>
              ) : (
                "Try Again"
              )}
            </button>
          )}

          {error.code === "UNAUTHORIZED" && (
            <button
              className="td-error__btn td-error__btn--primary"
              onClick={() =>
                navigate(
                  "/auth?redirect=" +
                    encodeURIComponent(window.location.pathname)
                )
              }
            >
              Sign In
            </button>
          )}

          <button
            className="td-error__btn td-error__btn--secondary"
            onClick={() => navigate("/support")}
          >
            Back to Tickets
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RESOLVE TICKET ID FROM PARAMS
   ─────────────────────────────────────────────────────────
   React Router may name the param differently depending on
   the <Route path> definition. This checks every possibility.
════════════════════════════════════════════════════════════ */
function useTicketId() {
  const params   = useParams();
  const location = useLocation();

  // 1. Check common param names
  const fromParams =
    params.ticketId ||
    params.id ||
    params.ticket_id ||
    params.tid ||
    null;

  if (fromParams) return fromParams;

  // 2. Fallback: extract UUID from the URL path directly
  const pathParts = location.pathname.split("/").filter(Boolean);
  // URL: /support/tickets/UUID  →  pathParts = ["support", "tickets", "UUID"]
  const lastPart = pathParts[pathParts.length - 1];

  // UUID v4 pattern
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (lastPart && uuidRegex.test(lastPart)) {
    return lastPart;
  }

  // 3. Check all param values
  const allValues = Object.values(params).filter(Boolean);
  const uuidValue = allValues.find((v) => uuidRegex.test(v));
  if (uuidValue) return uuidValue;

  // 4. Last resort: return whatever the last path segment is
  //    (so the error message shows the actual value, not "undefined")
  return lastPart || null;
}

/* ════════════════════════════════════════════════════════════
   STATUS BADGE
════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const map = {
    open:        { label: "Open",        cls: "td-badge--open"     },
    pending:     { label: "Pending",     cls: "td-badge--pending"  },
    in_progress: { label: "In Progress", cls: "td-badge--progress" },
    resolved:    { label: "Resolved",    cls: "td-badge--resolved" },
    closed:      { label: "Closed",      cls: "td-badge--closed"   },
  };

  const info = map[status?.toLowerCase()] || {
    label: status || "Unknown",
    cls: "",
  };

  return <span className={`td-badge ${info.cls}`}>{info.label}</span>;
}

/* ════════════════════════════════════════════════════════════
   PRIORITY BADGE
════════════════════════════════════════════════════════════ */
function PriorityBadge({ priority }) {
  const map = {
    low:      { label: "Low",      cls: "td-priority--low"    },
    medium:   { label: "Medium",   cls: "td-priority--medium" },
    high:     { label: "High",     cls: "td-priority--high"   },
    urgent:   { label: "Urgent",   cls: "td-priority--urgent" },
    critical: { label: "Critical", cls: "td-priority--urgent" },
  };

  const info = map[priority?.toLowerCase()] || null;
  if (!info) return null;

  return (
    <span className={`td-priority ${info.cls}`}>{info.label}</span>
  );
}

/* ════════════════════════════════════════════════════════════
   FORMAT DATE
════════════════════════════════════════════════════════════ */
function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

/* ════════════════════════════════════════════════════════════
   MAIN: TICKET DETAIL
════════════════════════════════════════════════════════════ */
export default function TicketDetail() {
  const ticketId = useTicketId();
  const navigate = useNavigate();

  const [ticket, setTicket]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchTicket = useCallback(async () => {
    const token = getToken();

    /* ── No auth token ── */
    if (!token) {
      setError({
        title: "Authentication required",
        message: "Please sign in to view support tickets.",
        code: "UNAUTHORIZED",
        status: 401,
      });
      setLoading(false);
      return;
    }

    /* ── No ticket ID at all ── */
    if (!ticketId) {
      setError({
        title: "Missing ticket ID",
        message:
          "No ticket ID was found in the URL. Please go back and select a ticket.",
        code: "NO_ID",
        status: null,
      });
      setLoading(false);
      return;
    }

    /* ── Validate UUID format ── */
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(ticketId)) {
      setError({
        title: "Invalid ticket ID",
        message: `The ticket ID "${ticketId}" is not in a valid format. Please check the URL.`,
        code: "VALIDATION",
        status: 422,
      });
      setLoading(false);
      return;
    }

    /* ── Fetch ── */
    try {
      setError(null);
      setLoading(true);

      const { data } = await axios.get(
        `${API}/support/tickets/${ticketId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15_000,
        }
      );

      // Handle different API response shapes
      const ticketData = data?.ticket || data?.data || data;
      setTicket(ticketData);
    } catch (err) {
      const parsed = extractErrorMessage(err);

      if (import.meta.env.DEV) {
        console.error("[TicketDetail] API Error:", {
          ticketId,
          status: err.response?.status,
          data: err.response?.data,
          parsed,
        });
      }

      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await fetchTicket();
    } finally {
      setIsRetrying(false);
    }
  }, [fetchTicket]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="td-loading">
        <div className="td-loading__spinner" />
        <p>Loading ticket…</p>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <TicketError
        error={error}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  /* ── No data ── */
  if (!ticket) {
    return (
      <TicketError
        error={{
          title: "No data",
          message: "The server returned an empty response for this ticket.",
          code: "UNKNOWN",
          status: null,
        }}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  /* ── Ticket loaded ── */
  const replies = ticket.replies || ticket.messages || ticket.comments || [];

  return (
    <div className="td-page">
      {/* Back nav */}
      <button className="td-back" onClick={() => navigate("/support")}>
        ← Back to Tickets
      </button>

      {/* Ticket header */}
      <div className="td-header">
        <div className="td-header__top">
          <h1 className="td-header__subject">
            {ticket.subject || ticket.title || "Support Ticket"}
          </h1>
          <div className="td-header__badges">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <div className="td-header__meta">
          <span className="td-header__id">#{ticketId.slice(0, 8)}</span>
          {ticket.created_at && (
            <span className="td-header__date">
              Created {formatDate(ticket.created_at)}
            </span>
          )}
          {ticket.category && (
            <span className="td-header__cat">{ticket.category}</span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="td-body">
        <div className="td-message td-message--original">
          <div className="td-message__header">
            <span className="td-message__author">You</span>
            <span className="td-message__time">
              {formatDate(ticket.created_at)}
            </span>
          </div>
          <div className="td-message__content">
            {ticket.description || ticket.body || ticket.message || ""}
          </div>

          {/* Attachments */}
          {ticket.attachments?.length > 0 && (
            <div className="td-attachments">
              {ticket.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.url || att}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="td-attachment"
                >
                  📎 {att.name || att.filename || `Attachment ${i + 1}`}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Replies / Thread */}
        {replies.length > 0 && (
          <div className="td-replies">
            <h3 className="td-replies__title">
              Responses ({replies.length})
            </h3>
            {replies.map((reply, i) => (
              <div
                key={reply.id || i}
                className={`td-message ${
                  reply.is_admin || reply.from_support
                    ? "td-message--admin"
                    : "td-message--user"
                }`}
              >
                <div className="td-message__header">
                  <span className="td-message__author">
                    {reply.is_admin || reply.from_support
                      ? "Support Team"
                      : reply.author || "You"}
                  </span>
                  <span className="td-message__time">
                    {formatDate(reply.created_at)}
                  </span>
                </div>
                <div className="td-message__content">
                  {reply.message || reply.body || reply.content || ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}