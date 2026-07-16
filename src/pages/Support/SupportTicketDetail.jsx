// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/TicketDetail.jsx (or wherever your ticket page lives)
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

/* ════════════════════════════════════════════════════════════
   ERROR MESSAGE EXTRACTOR
   ────────────────────────────────────────────────────────────
   Pulls the REAL error from Axios responses instead of
   showing a vague "Could not load" message.
════════════════════════════════════════════════════════════ */
function extractErrorMessage(error) {
  // No response at all — network / timeout
  if (!error.response) {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      return {
        title: "Request timed out",
        message: "The server took too long to respond. Please check your connection and try again.",
        code: "TIMEOUT",
        status: null,
      };
    }
    if (!navigator.onLine) {
      return {
        title: "You're offline",
        message: "No internet connection detected. Please check your network and try again.",
        code: "OFFLINE",
        status: null,
      };
    }
    return {
      title: "Network error",
      message: "Could not connect to the server. Please check your internet connection.",
      code: "NETWORK",
      status: null,
    };
  }

  const { status, data } = error.response;

  // Extract message from various API response shapes
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
        message: serverMsg || "The request was invalid. Please check and try again.",
        code: "BAD_REQUEST",
        status,
      };

    case 401:
      return {
        title: "Authentication required",
        message: serverMsg || "Your session has expired. Please sign in again.",
        code: "UNAUTHORIZED",
        status,
      };

    case 403:
      return {
        title: "Access denied",
        message: serverMsg || "You don't have permission to view this ticket. It may belong to another account.",
        code: "FORBIDDEN",
        status,
      };

    case 404:
      return {
        title: "Ticket not found",
        message: serverMsg || "This ticket doesn't exist or may have been deleted.",
        code: "NOT_FOUND",
        status,
      };

    case 410:
      return {
        title: "Ticket removed",
        message: serverMsg || "This ticket has been permanently deleted.",
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
        message: serverMsg || "You've made too many requests. Please wait a moment and try again.",
        code: "RATE_LIMITED",
        status,
      };

    case 500:
      return {
        title: "Server error",
        message: serverMsg || "Something went wrong on our end. Our team has been notified.",
        code: "SERVER_ERROR",
        status,
      };

    case 502:
    case 503:
    case 504:
      return {
        title: "Service unavailable",
        message: serverMsg || "The server is temporarily unavailable. Please try again in a few minutes.",
        code: "SERVICE_DOWN",
        status,
      };

    default:
      return {
        title: `Error ${status}`,
        message: serverMsg || `An unexpected error occurred (HTTP ${status}).`,
        code: "UNKNOWN",
        status,
      };
  }
}

/* ════════════════════════════════════════════════════════════
   ERROR ICON MAP
════════════════════════════════════════════════════════════ */
const errorIcons = {
  TIMEOUT:      "⏱️",
  OFFLINE:      "📡",
  NETWORK:      "🌐",
  UNAUTHORIZED: "🔒",
  FORBIDDEN:    "🚫",
  NOT_FOUND:    "🔍",
  GONE:         "🗑️",
  RATE_LIMITED:  "⏳",
  SERVER_ERROR: "⚙️",
  SERVICE_DOWN: "🔧",
  BAD_REQUEST:  "⚠️",
  VALIDATION:   "📝",
  UNKNOWN:      "❌",
};

/* ════════════════════════════════════════════════════════════
   ERROR DISPLAY COMPONENT
════════════════════════════════════════════════════════════ */
function TicketError({ error, onRetry, isRetrying }) {
  const navigate = useNavigate();
  const icon = errorIcons[error.code] || "❌";

  return (
    <div className="ticket-error">
      <div className="ticket-error__icon">{icon}</div>
      <h2 className="ticket-error__title">{error.title}</h2>
      <p className="ticket-error__message">{error.message}</p>

      {/* Show HTTP status for debugging */}
      {error.status && (
        <p className="ticket-error__status">
          Error code: HTTP {error.status}
        </p>
      )}

      <div className="ticket-error__actions">
        {/* Don't show retry for 403/404/410 — those won't change */}
        {!["FORBIDDEN", "NOT_FOUND", "GONE"].includes(error.code) && (
          <button
            className="ticket-error__btn ticket-error__btn--primary"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <span className="ticket-error__spinner" />
                Retrying…
              </>
            ) : (
              "Try Again"
            )}
          </button>
        )}

        {/* Redirect to login on 401 */}
        {error.code === "UNAUTHORIZED" && (
          <button
            className="ticket-error__btn ticket-error__btn--primary"
            onClick={() => navigate("/auth?redirect=" + encodeURIComponent(window.location.pathname))}
          >
            Sign In
          </button>
        )}

        <button
          className="ticket-error__btn ticket-error__btn--secondary"
          onClick={() => navigate("/support")}
        >
          Back to Tickets
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN TICKET DETAIL PAGE
════════════════════════════════════════════════════════════ */
export default function TicketDetail() {
  const { ticketId } = useParams();
  const navigate     = useNavigate();

  const [ticket,     setTicket]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);  // { title, message, code, status }
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchTicket = useCallback(async () => {
    const token = getToken();

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

    // Basic UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ticketId)) {
      setError({
        title: "Invalid ticket ID",
        message: `"${ticketId}" is not a valid ticket identifier.`,
        code: "VALIDATION",
        status: 422,
      });
      setLoading(false);
      return;
    }

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

      setTicket(data.ticket || data);
    } catch (err) {
      // ── Extract the REAL error ──
      const parsed = extractErrorMessage(err);

      // Log full error for debugging (only in dev)
      if (import.meta.env.DEV) {
        console.error("[TicketDetail] API Error:", {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
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

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="ticket-loading">
        <div className="ticket-loading__spinner" />
        <p>Loading ticket…</p>
      </div>
    );
  }

  /* ── Error state — shows REAL error ── */
  if (error) {
    return (
      <TicketError
        error={error}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  /* ── Success — render ticket ── */
  if (!ticket) {
    return (
      <TicketError
        error={{
          title: "No data",
          message: "The server returned an empty response.",
          code: "UNKNOWN",
          status: null,
        }}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  return (
    <div className="ticket-detail">
      {/* Your existing ticket detail rendering here */}
      <h1>{ticket.subject || ticket.title}</h1>
      <p>{ticket.description || ticket.body}</p>
      {/* ... rest of your ticket UI ... */}
    </div>
  );
}