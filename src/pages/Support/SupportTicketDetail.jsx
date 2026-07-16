// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportTicketDetail.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/ticket-detail-page.css";
import "../../styles/help/ticket-detail.css";
import "../../styles/help/ticket-status-badge.css";
import "../../styles/help/priority-badge.css";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  useMemo,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import TicketStatusBadge from "../../components/help/TicketStatusBadge";
import PriorityBadge     from "../../components/help/PriorityBadge";
import {
  IconArrowLeft,
  IconSend,
  IconPaperclip,
  IconX,
  IconLock,
  IconCheckCircle,
  IconRotateCcw,
  IconAlertTriangle,
  IconClock,
  IconUser,
  IconLoader,
  IconRefresh,
} from "../../components/help/icons/HelpIcons";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL;
const POLL_INTERVAL = 20_000;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeader = () => ({
  headers: { Authorization: `Bearer ${getToken()}` },
});

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function formatDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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
  return formatDateTime(d);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canReopenTicket(ticket) {
  if (!ticket)                    return false;
  if (ticket.status !== "closed") return false;
  if (!ticket.reopen_deadline)    return true;
  return new Date(ticket.reopen_deadline) > new Date();
}

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE)
    return `"${file.name}" exceeds the 10 MB limit.`;
  if (!ALLOWED_TYPES.includes(file.type))
    return `"${file.name}" has an unsupported file type.`;
  return null;
}

/* ════════════════════════════════════════════════════════════
   UNWRAP TICKET
════════════════════════════════════════════════════════════ */
function unwrapTicket(data) {
  if (!data) return null;
  if (data.ticket && typeof data.ticket === "object" && data.ticket.id)
    return data.ticket;
  if (data.id)       return data;
  if (data.data?.id) return data.data;
  return null;
}

/* ════════════════════════════════════════════════════════════
   EXTRACT REAL ERROR
   ─────────────────────────────────────────────────────────
   Returns an object { title, detail, httpStatus, url }
   so the UI can show exactly what went wrong.
════════════════════════════════════════════════════════════ */
function extractApiError(err, url) {
  /* ── No response at all ── */
  if (!err.response) {
    /* Axios cancelled (component unmounted) — not a real error */
    if (axios.isCancel(err)) return null;

    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      return {
        title      : "Request timed out",
        detail     : "The server took too long to respond. Please check your connection and try again.",
        httpStatus : null,
        url,
      };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return {
        title  : "You appear to be offline",
        detail : "Please check your internet connection and try again.",
        httpStatus : null,
        url,
      };
    }

    /* Real network failure — show the actual Axios message */
    return {
      title  : "Network error",
      detail : err.message
        ? `Could not reach the server: ${err.message}`
        : "Could not reach the server. Please check your connection.",
      httpStatus : null,
      url,
    };
  }

  /* ── Server responded ── */
  const { status, data, config } = err.response;
  const actualUrl = config?.url ?? url;

  /* Pull real server message from every common API shape */
  const serverMsg =
    (typeof data === "string" && data.length < 300 ? data : null) ||
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
        title      : "Bad request (400)",
        detail     : serverMsg || "The server rejected the request. Please try again.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 401:
      return {
        title      : "Session expired (401)",
        detail     : serverMsg || "Your session has expired. Please sign in again.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 403:
      return {
        title      : "Access denied (403)",
        detail     : serverMsg ||
          "You don't have permission to view this ticket. It may belong to a different account.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 404:
      return {
        title      : "Ticket not found (404)",
        detail     : serverMsg ||
          "This ticket does not exist or may have been deleted.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 410:
      return {
        title      : "Ticket removed (410)",
        detail     : serverMsg || "This ticket has been permanently deleted.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 422:
      return {
        title      : "Validation error (422)",
        detail     : serverMsg || "The ticket ID format is invalid.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 429:
      return {
        title      : "Too many requests (429)",
        detail     : serverMsg || "Please wait a moment and try again.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 500:
      return {
        title      : "Server error (500)",
        detail     : serverMsg || "Something went wrong on our end. Please try again shortly.",
        httpStatus : status,
        url        : actualUrl,
      };
    case 502:
    case 503:
    case 504:
      return {
        title      : `Service unavailable (${status})`,
        detail     : serverMsg || "The server is temporarily unavailable. Please try again in a few minutes.",
        httpStatus : status,
        url        : actualUrl,
      };
    default:
      return {
        title      : `Unexpected error (${status})`,
        detail     : serverMsg || `HTTP ${status} — please try again.`,
        httpStatus : status,
        url        : actualUrl,
      };
  }
}

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════ */
const ConfirmDialog = memo(function ConfirmDialog({
  title, body, onConfirm, onCancel, danger = false,
}) {
  return (
    <div
      className="td-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="td-confirm-title"
    >
      <div className="td-confirm-box">
        <h3 className="td-confirm-title" id="td-confirm-title">{title}</h3>
        <p className="td-confirm-body">{body}</p>
        <div className="td-confirm-actions">
          <button className="td-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button
            className={`td-confirm-ok${danger ? " td-confirm-danger" : ""}`}
            onClick={onConfirm}
          >
            {danger ? "Close Ticket" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   TICKET MESSAGE
════════════════════════════════════════════════════════════ */
const TicketMessage = memo(function TicketMessage({ msg, isOwn, isSystem }) {
  if (isSystem) {
    return (
      <div className="ticket-message-system">
        <span>{msg.message}</span>
      </div>
    );
  }

  return (
    <div className={`ticket-message ${isOwn ? "ticket-message-own" : "ticket-message-agent"}`}>
      <div className="ticket-message-avatar" aria-hidden="true">
        {msg.sender_avatar ? (
          <img
            src={msg.sender_avatar}
            alt={msg.sender_name ?? "User"}
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <IconUser size={18} />
        )}
      </div>

      <div className="ticket-message-content">
        <div className="ticket-message-header">
          <span className="ticket-message-sender">
            {isOwn ? "You" : msg.sender_name ?? "Support Agent"}
          </span>
          <span
            className="ticket-message-time"
            title={formatDateTime(msg.created_at)}
          >
            {timeAgo(msg.created_at)}
          </span>
        </div>

        <div className="ticket-message-bubble">{msg.message}</div>

        {msg.attachments?.length > 0 && (
          <div className="ticket-message-attachments">
            {msg.attachments.map((att) => {
              const isImage = att.file_type?.startsWith("image/");
              return (
                <div key={att.id} className="ticket-message-attachment-wrap">
                  {isImage && (
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="ticket-attachment-preview"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </a>
                  )}
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ticket-message-attachment"
                  >
                    <IconPaperclip size={12} />
                    <span className="ticket-att-name">{att.file_name}</span>
                    {att.file_size && (
                      <span className="ticket-att-size">{formatBytes(att.file_size)}</span>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   ERROR STATE — shows full real error details
════════════════════════════════════════════════════════════ */
const ErrorState = memo(function ErrorState({ id, error, onRetry }) {
  const navigate = useNavigate();

  /* Don't show retry for errors that won't change */
  const noRetry = error?.httpStatus === 403 ||
                  error?.httpStatus === 404 ||
                  error?.httpStatus === 410;

  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">
        <div className="ticket-detail-error" role="alert" aria-live="assertive">

          <IconAlertTriangle size={44} className="ticket-detail-error-icon" />

          {/* Real error title */}
          <p className="ticket-detail-error-title">
            {error?.title ?? "Could not load ticket"}
          </p>

          {/* Real error detail from server */}
          <p className="ticket-detail-error-msg">
            {error?.detail ?? "An unexpected error occurred."}
          </p>

          {/* Debug info — always visible so user can report it */}
          <div className="ticket-detail-error-debug">
            {id && (
              <p>
                <strong>Ticket ID:</strong>
                <code>{id}</code>
              </p>
            )}
            {error?.httpStatus && (
              <p>
                <strong>HTTP Status:</strong>
                <code>{error.httpStatus}</code>
              </p>
            )}
            {error?.url && (
              <p>
                <strong>URL:</strong>
                <code>{error.url}</code>
              </p>
            )}
          </div>

          <div className="ticket-detail-error-btns">
            {!noRetry && (
              <button className="ticket-detail-retry-btn" onClick={onRetry}>
                <IconRefresh size={15} />
                Try Again
              </button>
            )}

            {error?.httpStatus === 401 && (
              <button
                className="ticket-detail-retry-btn"
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

            <Link to="/support/tickets" className="ticket-detail-error-btn">
              <IconArrowLeft size={16} />
              Back to Tickets
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   LOADING
════════════════════════════════════════════════════════════ */
const LoadingState = memo(function LoadingState() {
  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">
        <div className="ticket-detail-loading" role="status" aria-busy="true">
          <IconLoader size={28} className="ticket-reply-spinner" />
          <p>Loading ticket…</p>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function SupportTicketDetail({ user }) {
  const params = useParams();

  /* ── Resolve ticket ID defensively ── */
  const id = useMemo(() => {
    /* 1. Standard param names */
    const fromParams =
      params.id ||
      params.ticketId ||
      params.ticket_id ||
      null;

    /* Reject literal "undefined" / "null" strings */
    if (fromParams && fromParams !== "undefined" && fromParams !== "null")
      return fromParams;

    /* 2. Extract UUID directly from the URL path */
    const parts = window.location.pathname.split("/").filter(Boolean);
    const uuid  =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (let i = parts.length - 1; i >= 0; i--) {
      if (uuid.test(parts[i])) return parts[i];
    }

    return null;
  }, [params]);

  /* ── State ── */
  const [ticket,       setTicket]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [apiError,     setApiError]     = useState(null); // { title, detail, httpStatus, url }
  const [reply,        setReply]        = useState("");
  const [files,        setFiles]        = useState([]);
  const [filePreviews, setFilePreviews] = useState({});
  const [sending,      setSending]      = useState(false);
  const [actionBusy,   setActionBusy]   = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  /* ── Refs ── */
  const fileRef      = useRef(null);
  const threadRef    = useRef(null);
  const isMounted    = useRef(true);
  const shouldScroll = useRef(true);
  const pollRef      = useRef(null);
  const abortRef     = useRef(null);

  /* ════════════════════════════════════════════════════════
     LOAD TICKET
  ════════════════════════════════════════════════════════ */
  const loadTicket = useCallback(async (silent = false) => {

    /* ── Guard: no token ── */
    const token = getToken();
    if (!token) {
      setApiError({
        title      : "Authentication required",
        detail     : "Please sign in to view support tickets.",
        httpStatus : 401,
        url        : null,
      });
      setLoading(false);
      return;
    }

    /* ── Guard: no ID ── */
    if (!id) {
      setApiError({
        title  : "Missing ticket ID",
        detail : "No ticket ID was found in the URL. Please go back and select a ticket.",
        httpStatus : null,
        url        : null,
      });
      setLoading(false);
      return;
    }

    /* ── Guard: validate UUID ── */
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      setApiError({
        title  : "Invalid ticket ID",
        detail : `"${id}" is not a valid UUID. Please check the URL.`,
        httpStatus : 422,
        url        : null,
      });
      setLoading(false);
      return;
    }

    /* ── Abort previous in-flight request ── */
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const url = `${BASE_URL}/api/support/tickets/${id}`;

    try {
      if (!silent) setApiError(null);

      const { data } = await axios.get(url, {
        headers : { Authorization: `Bearer ${token}` },
        signal  : controller.signal,
        timeout : 15_000,
      });

      if (!isMounted.current) return;

      const ticketData = unwrapTicket(data);

      if (!ticketData) {
        if (!silent) {
          setApiError({
            title  : "Empty response",
            detail : "The server returned a response with no ticket data. Please try again.",
            httpStatus : null,
            url,
          });
        }
      } else {
        setTicket(ticketData);
        if (!silent) setApiError(null);
      }
    } catch (err) {
      if (!isMounted.current) return;
      if (axios.isCancel(err)) return;   /* Abort — not an error */

      /* Always log full error in console for debugging */
      console.group(`[SupportTicketDetail] ❌ GET ${url}`);
      console.error("HTTP status :", err?.response?.status ?? "no response");
      console.error("Server data :", err?.response?.data ?? "(none)");
      console.error("Axios error :", err.message);
      console.error("Full error  :", err);
      console.groupEnd();

      if (!silent) {
        setApiError(extractApiError(err, url));
      }
    } finally {
      if (isMounted.current && !silent) setLoading(false);
    }
  }, [id]);

  /* ── Mount ── */
  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    setApiError(null);
    setTicket(null);
    loadTicket(false);

    return () => {
      isMounted.current = false;
      abortRef.current?.abort();
      clearInterval(pollRef.current);
    };
  }, [loadTicket]);

  /* ── Polling ── */
  useEffect(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (isMounted.current) loadTicket(true);
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [loadTicket]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (shouldScroll.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [ticket?.messages?.length]);

  /* ════════════════════════════════════════════════════════
     DERIVED STATE
  ════════════════════════════════════════════════════════ */
  const {
    isClosed, isResolved, reopenOk,
    canClose, messages, currentUserId,
  } = useMemo(() => {
    if (!ticket) return {
      isClosed: false, isResolved: false,
      reopenOk: false, canClose:   false,
      messages: [], currentUserId: null,
    };
    return {
      isClosed      : ticket.status === "closed",
      isResolved    : ticket.status === "resolved",
      reopenOk      : canReopenTicket(ticket),
      canClose      : ["open","waiting_for_customer","in_progress","resolved"]
                        .includes(ticket.status),
      messages      : Array.isArray(ticket.messages) ? ticket.messages : [],
      currentUserId : user?.id ?? user?._id ?? user?.user_id ?? user?.uuid ?? null,
    };
  }, [ticket, user]);

  /* ════════════════════════════════════════════════════════
     FILE HANDLING
  ════════════════════════════════════════════════════════ */
  const handleFileChange = useCallback((e) => {
    const selected = Array.from(e.target.files || []);
    const errors = [];
    const valid  = [];
    const seen   = new Set(files.map((f) => `${f.name}-${f.size}`));

    for (const file of selected) {
      const key = `${file.name}-${file.size}`;
      if (seen.has(key)) { errors.push(`"${file.name}" is already attached.`); continue; }
      const err = validateFile(file);
      if (err) { errors.push(err); continue; }
      valid.push(file);
      seen.add(key);
    }

    if (errors.length) toast.error(errors.join("\n"), { duration: 4000 });

    const next = [...files, ...valid].slice(0, 5);
    setFiles(next);

    next.forEach((file) => {
      const key = `${file.name}-${file.size}`;
      if (!file.type.startsWith("image/") || filePreviews[key]) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (isMounted.current)
          setFilePreviews((p) => ({ ...p, [key]: ev.target.result }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  }, [files, filePreviews]);

  const removeFile = useCallback(
    (i) => setFiles((p) => p.filter((_, idx) => idx !== i)),
    []
  );

  /* ════════════════════════════════════════════════════════
     SEND REPLY
  ════════════════════════════════════════════════════════ */
  const handleReply = useCallback(async () => {
    if (!reply.trim() && files.length === 0) return;
    setSending(true);
    shouldScroll.current = true;

    try {
      const fd = new FormData();
      fd.append("message", reply.trim());
      files.forEach((f) => fd.append("attachments", f));

      await axios.post(
        `${BASE_URL}/api/support/tickets/${id}/messages`,
        fd,
        {
          headers: {
            Authorization : `Bearer ${getToken()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Reply sent");
      setReply("");
      setFiles([]);
      setFilePreviews({});
      await loadTicket(true);
    } catch (err) {
      const parsed = extractApiError(err, `${BASE_URL}/api/support/tickets/${id}/messages`);
      toast.error(parsed?.detail ?? "Failed to send reply.");
    } finally {
      setSending(false);
    }
  }, [reply, files, id, loadTicket]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleReply();
    }
  }, [handleReply]);

  /* ════════════════════════════════════════════════════════
     CLOSE / REOPEN
  ════════════════════════════════════════════════════════ */
  const handleClose = useCallback(async () => {
    setShowConfirm(false);
    setActionBusy(true);
    try {
      await axios.patch(
        `${BASE_URL}/api/support/tickets/${id}`,
        { status: "closed" },
        authHeader()
      );
      toast.success("Ticket closed.");
      await loadTicket(false);
    } catch (err) {
      const parsed = extractApiError(err, `${BASE_URL}/api/support/tickets/${id}`);
      toast.error(parsed?.detail ?? "Failed to close ticket.");
    } finally {
      setActionBusy(false);
    }
  }, [id, loadTicket]);

  const handleReopen = useCallback(async () => {
    setActionBusy(true);
    try {
      await axios.post(
        `${BASE_URL}/api/support/tickets/${id}/reopen`,
        {},
        authHeader()
      );
      toast.success("Ticket reopened.");
      await loadTicket(false);
    } catch (err) {
      const parsed = extractApiError(err, `${BASE_URL}/api/support/tickets/${id}/reopen`);
      toast.error(parsed?.detail ?? "Failed to reopen ticket.");
    } finally {
      setActionBusy(false);
    }
  }, [id, loadTicket]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setApiError(null);
    setTicket(null);
    loadTicket(false);
  }, [loadTicket]);

  /* ════════════════════════════════════════════════════════
     RENDER GUARDS
  ════════════════════════════════════════════════════════ */
  if (loading) return <LoadingState />;

  if (apiError || !ticket) {
    return (
      <ErrorState
        id={id}
        error={apiError}
        onRetry={handleRetry}
      />
    );
  }

  const replyDisabled =
    sending || actionBusy || (!reply.trim() && files.length === 0);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">

        {showConfirm && (
          <ConfirmDialog
            title="Close this ticket?"
            body="Once closed, you have 7 days to reopen it. Are you sure?"
            danger
            onConfirm={handleClose}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* ── Header ── */}
        <div className="ticket-detail-header">
          <Link to="/support/tickets" className="ticket-detail-back" aria-label="Back">
            <IconArrowLeft size={20} />
          </Link>

          <div className="ticket-detail-header-info">
            <div className="ticket-detail-header-badges">
              <span className="ticket-detail-number">{ticket.ticket_number}</span>
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge    priority={ticket.priority} />
            </div>
            <h1 className="ticket-detail-subject">{ticket.subject}</h1>
            <div className="ticket-detail-meta">
              <span className="ticket-detail-category">{ticket.category}</span>
              <span className="ticket-detail-separator" />
              <span className="ticket-detail-date" title={formatDateTime(ticket.created_at)}>
                <IconClock size={12} />
                {timeAgo(ticket.created_at)}
              </span>
            </div>
          </div>

          <button
            className="ticket-detail-refresh-btn"
            onClick={() => loadTicket(false)}
            aria-label="Refresh"
            disabled={loading}
          >
            <IconRefresh size={16} />
          </button>
        </div>

        {/* ── Actions ── */}
        <div className="ticket-detail-actions">
          {canClose && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={actionBusy || sending}
              className="ticket-action-btn ticket-action-close"
            >
              <IconLock size={16} /> Close Ticket
            </button>
          )}
          {reopenOk && (
            <button
              onClick={handleReopen}
              disabled={actionBusy || sending}
              className="ticket-action-btn ticket-action-reopen"
            >
              <IconRotateCcw size={16} /> Reopen Ticket
            </button>
          )}
          {isClosed && !reopenOk && (
            <div className="ticket-action-expired" role="status">
              <IconAlertTriangle size={15} />
              Reopen period has expired
            </div>
          )}
        </div>

        {/* ── Thread ── */}
        <div
          className="ticket-messages"
          ref={threadRef}
          role="log"
          aria-live="polite"
          aria-label="Ticket conversation"
          onScroll={() => {
            const el = threadRef.current;
            if (!el) return;
            shouldScroll.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {messages.length === 0 && !ticket.description && (
            <div className="ticket-messages-empty">
              <p>No messages yet. Start the conversation below.</p>
            </div>
          )}

          {messages.length === 0 && ticket.description && (
            <TicketMessage
              msg={{
                id               : "__description__",
                sender_id        : ticket.user_id,
                sender_name      : "You",
                sender_avatar    : null,
                message          : ticket.description,
                created_at       : ticket.created_at,
                attachments      : [],
                is_system_message: false,
              }}
              isOwn={true}
              isSystem={false}
            />
          )}

          {messages.map((msg) => {
            const isOwn = currentUserId
              ? String(msg.sender_id) === String(currentUserId)
              : !msg.is_internal_note &&
                msg.sender_role !== "admin" &&
                msg.sender_role !== "support_agent";

            return (
              <TicketMessage
                key={msg.id}
                msg={msg}
                isOwn={isOwn}
                isSystem={!!msg.is_system_message}
              />
            );
          })}
        </div>

        {/* ── Reply box ── */}
        {!isClosed && (
          <div className="ticket-reply-box" aria-label="Reply form">
            <label htmlFor="ticket-reply-textarea" className="td-sr-only">
              Your reply
            </label>
            <textarea
              id="ticket-reply-textarea"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply… (⌘ Enter or Ctrl + Enter to send)"
              rows={4}
              className="ticket-reply-textarea"
              disabled={sending || actionBusy}
            />

            {files.length > 0 && (
              <div className="ticket-reply-files" role="list">
                {files.map((f, i) => {
                  const key     = `${f.name}-${f.size}`;
                  const preview = filePreviews[key];
                  return (
                    <div key={i} className="ticket-reply-file-chip" role="listitem">
                      {f.type.startsWith("image/") && preview && (
                        <img src={preview} alt={f.name} className="ticket-reply-file-thumb" />
                      )}
                      <IconPaperclip size={12} aria-hidden="true" />
                      <span className="ticket-reply-file-name">{f.name}</span>
                      <span className="ticket-reply-file-size">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="ticket-reply-file-remove"
                        aria-label={`Remove ${f.name}`}
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ticket-reply-toolbar">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="ticket-reply-attach-btn"
                disabled={sending || files.length >= 5}
              >
                <IconPaperclip size={16} />
                {files.length >= 5 ? "Max 5 files" : "Attach files"}
              </button>

              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="ticket-reply-file-hidden"
                tabIndex={-1}
              />

              <button
                onClick={handleReply}
                disabled={replyDisabled}
                className="ticket-reply-send-btn"
                aria-busy={sending}
              >
                {sending
                  ? <><IconLoader size={16} className="ticket-reply-spinner" /> Sending…</>
                  : <><IconSend size={16} /> Send Reply</>
                }
              </button>
            </div>
          </div>
        )}

        {isResolved && (
          <div className="ticket-resolved-banner" role="status">
            <IconCheckCircle size={20} />
            <span>This ticket has been resolved</span>
          </div>
        )}

        {isClosed && (
          <div
            className="ticket-resolved-banner"
            style={{ background: "#F3F4F6", color: "#6B7280" }}
            role="status"
          >
            <IconLock size={18} />
            <span>
              This ticket is closed
              {reopenOk && " — tap Reopen Ticket above to continue"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}