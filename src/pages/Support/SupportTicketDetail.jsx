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
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
   ─────────────────────────────────────────────────────────
   API returns  { success: true, ticket: { id, ticket_number… } }
   We need the inner ticket, not the envelope.
   Falls back gracefully for { id, ticket_number } direct shapes.
════════════════════════════════════════════════════════════ */
function unwrapTicket(data) {
  if (!data) return null;

  // Standard envelope: { success, ticket: { id, … } }
  if (data.ticket && typeof data.ticket === "object" && data.ticket.id)
    return data.ticket;

  // Direct object: { id, ticket_number, … }
  if (data.id)
    return data;

  // Rare: { data: { id, … } }
  if (data.data?.id)
    return data.data;

  return null;
}

/* ════════════════════════════════════════════════════════════
   EXTRACT REAL ERROR MESSAGE FROM AXIOS ERROR
   ─────────────────────────────────────────────────────────
   Reads the actual server message from err.response.data
   instead of swallowing it with a generic fallback.
════════════════════════════════════════════════════════════ */
function extractApiError(err, ticketId) {
  // No response — network / offline / timeout
  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return "The request timed out. Please check your connection and try again.";
    if (typeof navigator !== "undefined" && !navigator.onLine)
      return "You appear to be offline. Please check your internet connection.";
    return "Network error — could not reach the server.";
  }

  const { status, data } = err.response;

  // Pull real message from every common API shape
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
      return serverMsg || "Bad request. Please try again.";
    case 401:
      return serverMsg || "Your session has expired. Please sign in again.";
    case 403:
      return serverMsg ||
        "You don't have permission to view this ticket. It may belong to another account.";
    case 404:
      return serverMsg ||
        `Ticket #${ticketId?.slice(0, 8) ?? "?"} was not found. It may have been deleted.`;
    case 410:
      return serverMsg || "This ticket has been permanently deleted.";
    case 422:
      return serverMsg || "The ticket ID format is invalid.";
    case 429:
      return serverMsg || "Too many requests. Please wait a moment and try again.";
    case 500:
      return serverMsg || "Server error — our team has been notified. Please try again shortly.";
    case 502:
    case 503:
    case 504:
      return serverMsg || "Service temporarily unavailable. Please try again in a few minutes.";
    default:
      return serverMsg || `Unexpected error (HTTP ${status}). Please try again.`;
  }
}

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════ */
const ConfirmDialog = memo(function ConfirmDialog({
  title,
  body,
  onConfirm,
  onCancel,
  danger = false,
}) {
  return (
    <div
      className="td-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="td-confirm-title"
    >
      <div className="td-confirm-box">
        <h3 className="td-confirm-title" id="td-confirm-title">
          {title}
        </h3>
        <p className="td-confirm-body">{body}</p>
        <div className="td-confirm-actions">
          <button className="td-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
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
    <div
      className={`ticket-message ${
        isOwn ? "ticket-message-own" : "ticket-message-agent"
      }`}
    >
      {/* Avatar */}
      <div className="ticket-message-avatar" aria-hidden="true">
        {msg.sender_avatar ? (
          <img
            src={msg.sender_avatar}
            alt={msg.sender_name ?? "User"}
            style={{
              width: 36, height: 36,
              borderRadius: "50%", objectFit: "cover",
            }}
          />
        ) : (
          <IconUser size={18} />
        )}
      </div>

      {/* Content */}
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

        {/* Attachments */}
        {msg.attachments?.length > 0 && (
          <div className="ticket-message-attachments">
            {msg.attachments.map((att) => {
              const isImage = att.file_type?.startsWith("image/");
              return (
                <div key={att.id} className="ticket-message-attachment-wrap">
                  {isImage && (
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="ticket-attachment-preview"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
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
                      <span className="ticket-att-size">
                        {formatBytes(att.file_size)}
                      </span>
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
   LOADING SKELETON
════════════════════════════════════════════════════════════ */
const LoadingSkeleton = memo(function LoadingSkeleton() {
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
   ERROR STATE
════════════════════════════════════════════════════════════ */
const ErrorState = memo(function ErrorState({
  ticketId,
  errorMessage,
  onRetry,
}) {
  const navigate = useNavigate();

  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">
        <div className="ticket-detail-error" role="alert">
          <IconAlertTriangle size={44} className="ticket-detail-error-icon" />

          <p className="ticket-detail-error-title">Could not load ticket</p>

          {/*
            THE FIX:
            Show the REAL error message from the server / network.
            No more generic "Please try again" — users see exactly
            what went wrong (403 permission, 404 not found, 500 server, etc.)
          */}
          <p className="ticket-detail-error-msg">{errorMessage}</p>

          {/* Show ticket ID so user knows which one failed */}
          {ticketId && ticketId !== "undefined" && (
            <p className="ticket-detail-error-tid">
              Ticket ID: <code>{ticketId}</code>
            </p>
          )}

          <div className="ticket-detail-error-btns">
            <button className="ticket-detail-retry-btn" onClick={onRetry}>
              <IconRefresh size={15} />
              Try Again
            </button>

            <Link
              to="/support/tickets"
              className="ticket-detail-error-btn"
            >
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
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function SupportTicketDetail({ user }) {
  /* ── useParams() — id matches <Route path="/support/tickets/:id"> ── */
  const params = useParams();

  /*
   * DEFENSIVE param reading.
   * Covers all possible route param names so it never resolves
   * to the string "undefined":
   *   /support/tickets/:id          → params.id
   *   /support/tickets/:ticketId    → params.ticketId
   *   /support/tickets/:ticket_id   → params.ticket_id
   */
  const rawId =
    params.id ||
    params.ticketId ||
    params.ticket_id ||
    null;

  /*
   * If the URL contains an actual UUID, use it directly.
   * e.g. /support/tickets/f485f5d8-7138-46eb-97b4-1d944aecfb82
   * Even if useParams() returns {}  we can pull it from the path.
   */
  const uuidFromPath = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const last  = parts[parts.length - 1];
    const uuid  =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuid.test(last) ? last : null;
  }, []);

  const id = rawId && rawId !== "undefined" ? rawId : uuidFromPath;

  /* ── State ── */
  const [ticket,       setTicket]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [errorMsg,     setErrorMsg]     = useState(null);
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

  /* ════════════════════════════════════════════════════════
     LOAD TICKET
  ════════════════════════════════════════════════════════ */
  const loadTicket = useCallback(
    async (silent = false) => {
      const token = getToken();

      /* ── No token ── */
      if (!token) {
        setErrorMsg("Please sign in to view this ticket.");
        setLoading(false);
        return;
      }

      /* ── No valid ID ── */
      if (!id) {
        setErrorMsg(
          "No ticket ID found in the URL. Please go back and select a ticket."
        );
        setLoading(false);
        return;
      }

      /* ── Validate UUID format ── */
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(id)) {
        setErrorMsg(
          `"${id}" is not a valid ticket identifier. Please check the URL.`
        );
        setLoading(false);
        return;
      }

      try {
        if (!silent) setErrorMsg(null);

        const { data } = await axios.get(
          `${BASE_URL}/api/support/tickets/${id}`,
          authHeader()
        );

        if (!isMounted.current) return;

        /* Unwrap { success, ticket: { … } } envelope */
        const ticketData = unwrapTicket(data);

        if (!ticketData) {
          if (!silent) setErrorMsg("Ticket data was empty. Please try again.");
        } else {
          setTicket(ticketData);
          if (!silent) setErrorMsg(null);
        }
      } catch (err) {
        if (!isMounted.current) return;

        /* Log full error in dev for debugging */
        if (import.meta.env.DEV) {
          console.error("[SupportTicketDetail] fetch error", {
            id,
            status : err?.response?.status,
            data   : err?.response?.data,
            message: err.message,
          });
        }

        /* Only update error UI for non-silent fetches */
        if (!silent) {
          setErrorMsg(extractApiError(err, id));
        }
      } finally {
        if (isMounted.current && !silent) setLoading(false);
      }
    },
    [id]
  );

  /* ── Mount / unmount ── */
  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    setErrorMsg(null);
    setTicket(null);
    loadTicket(false);
    return () => {
      isMounted.current = false;
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

  /* ── Auto-scroll to bottom ── */
  useEffect(() => {
    if (shouldScroll.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [ticket?.messages?.length]);

  /* ════════════════════════════════════════════════════════
     DERIVED STATE
  ════════════════════════════════════════════════════════ */
  const {
    isClosed,
    isResolved,
    reopenOk,
    canClose,
    messages,
    currentUserId,
  } = useMemo(() => {
    if (!ticket)
      return {
        isClosed: false, isResolved: false, reopenOk: false,
        canClose: false, messages: [], currentUserId: null,
      };

    return {
      isClosed   : ticket.status === "closed",
      isResolved : ticket.status === "resolved",
      reopenOk   : canReopenTicket(ticket),
      canClose   : ["open", "waiting_for_customer", "in_progress", "resolved"].includes(
        ticket.status
      ),
      messages   : Array.isArray(ticket.messages) ? ticket.messages : [],
      /*
       * currentUserId — read every possible id field the API might return.
       * user prop comes from App.jsx → GET /api/users/me.
       */
      currentUserId:
        user?.id ?? user?._id ?? user?.user_id ?? user?.uuid ?? null,
    };
  }, [ticket, user]);

  /* ════════════════════════════════════════════════════════
     FILE HANDLING
  ════════════════════════════════════════════════════════ */
  const handleFileChange = useCallback(
    (e) => {
      const selected = Array.from(e.target.files || []);
      const errors   = [];
      const valid    = [];
      const seen     = new Set(files.map((f) => `${f.name}-${f.size}`));

      for (const file of selected) {
        const key = `${file.name}-${file.size}`;
        if (seen.has(key)) {
          errors.push(`"${file.name}" is already attached.`);
          continue;
        }
        const err = validateFile(file);
        if (err) { errors.push(err); continue; }
        valid.push(file);
        seen.add(key);
      }

      if (errors.length) toast.error(errors.join("\n"), { duration: 4000 });

      const next = [...files, ...valid].slice(0, 5);
      setFiles(next);

      /* Image previews */
      next.forEach((file) => {
        const key = `${file.name}-${file.size}`;
        if (!file.type.startsWith("image/") || filePreviews[key]) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (isMounted.current)
            setFilePreviews((prev) => ({ ...prev, [key]: ev.target.result }));
        };
        reader.readAsDataURL(file);
      });

      e.target.value = "";
    },
    [files, filePreviews]
  );

  const removeFile = useCallback(
    (index) => setFiles((prev) => prev.filter((_, i) => i !== index)),
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
      const formData = new FormData();
      formData.append("message", reply.trim());
      files.forEach((f) => formData.append("attachments", f));

      await axios.post(
        `${BASE_URL}/api/support/tickets/${id}/messages`,
        formData,
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
      const msg = extractApiError(err, id);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }, [reply, files, id, loadTicket]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleReply();
      }
    },
    [handleReply]
  );

  /* ════════════════════════════════════════════════════════
     CLOSE TICKET
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
      toast.error(extractApiError(err, id));
    } finally {
      setActionBusy(false);
    }
  }, [id, loadTicket]);

  /* ════════════════════════════════════════════════════════
     REOPEN TICKET
  ════════════════════════════════════════════════════════ */
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
      toast.error(extractApiError(err, id));
    } finally {
      setActionBusy(false);
    }
  }, [id, loadTicket]);

  /* ── Retry ── */
  const handleRetry = useCallback(() => {
    setLoading(true);
    setErrorMsg(null);
    setTicket(null);
    loadTicket(false);
  }, [loadTicket]);

  /* ════════════════════════════════════════════════════════
     RENDER — LOADING
  ════════════════════════════════════════════════════════ */
  if (loading) return <LoadingSkeleton />;

  /* ════════════════════════════════════════════════════════
     RENDER — ERROR
  ════════════════════════════════════════════════════════ */
  if (errorMsg || !ticket) {
    return (
      <ErrorState
        ticketId={id}
        errorMessage={
          errorMsg ?? "Ticket not found. It may have been deleted."
        }
        onRetry={handleRetry}
      />
    );
  }

  const replyDisabled =
    sending || actionBusy || (!reply.trim() && files.length === 0);

  /* ════════════════════════════════════════════════════════
     RENDER — TICKET
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">

        {/* Confirm dialog */}
        {showConfirm && (
          <ConfirmDialog
            title="Close this ticket?"
            body="Once closed, you will have 7 days to reopen it. Are you sure?"
            danger
            onConfirm={handleClose}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* ── Header ── */}
        <div className="ticket-detail-header">
          <Link
            to="/support/tickets"
            className="ticket-detail-back"
            aria-label="Back to tickets"
          >
            <IconArrowLeft size={20} />
          </Link>

          <div className="ticket-detail-header-info">
            <div className="ticket-detail-header-badges">
              <span className="ticket-detail-number">
                {ticket.ticket_number}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="ticket-detail-subject">{ticket.subject}</h1>
            <div className="ticket-detail-meta">
              <span className="ticket-detail-category">{ticket.category}</span>
              <span className="ticket-detail-separator" />
              <span
                className="ticket-detail-date"
                title={formatDateTime(ticket.created_at)}
              >
                <IconClock size={12} />
                {timeAgo(ticket.created_at)}
              </span>
            </div>
          </div>

          {/* Manual refresh */}
          <button
            className="ticket-detail-refresh-btn"
            onClick={() => loadTicket(false)}
            aria-label="Refresh ticket"
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
              <IconLock size={16} />
              Close Ticket
            </button>
          )}
          {reopenOk && (
            <button
              onClick={handleReopen}
              disabled={actionBusy || sending}
              className="ticket-action-btn ticket-action-reopen"
            >
              <IconRotateCcw size={16} />
              Reopen Ticket
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
            const atBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            shouldScroll.current = atBottom;
          }}
        >
          {/* Empty */}
          {messages.length === 0 && !ticket.description && (
            <div className="ticket-messages-empty">
              <p>No messages yet. Start the conversation below.</p>
            </div>
          )}

          {/* Original description when no messages */}
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

          {/* All messages */}
          {messages.map((msg) => {
            /*
             * Determine ownership.
             * If currentUserId is known, compare directly.
             * Fallback: treat as own if not from admin/support_agent role.
             */
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
              aria-busy={sending}
              disabled={sending || actionBusy}
            />

            {/* File chips */}
            {files.length > 0 && (
              <div
                className="ticket-reply-files"
                role="list"
                aria-label="Files to attach"
              >
                {files.map((f, i) => {
                  const key     = `${f.name}-${f.size}`;
                  const preview = filePreviews[key];
                  const isImage = f.type.startsWith("image/");
                  return (
                    <div
                      key={i}
                      className="ticket-reply-file-chip"
                      role="listitem"
                    >
                      {isImage && preview && (
                        <img
                          src={preview}
                          alt={f.name}
                          className="ticket-reply-file-thumb"
                        />
                      )}
                      <IconPaperclip size={12} aria-hidden="true" />
                      <span className="ticket-reply-file-name">{f.name}</span>
                      <span className="ticket-reply-file-size">
                        {formatBytes(f.size)}
                      </span>
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

            {/* Toolbar */}
            <div className="ticket-reply-toolbar">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="ticket-reply-attach-btn"
                aria-label="Attach files"
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
                aria-label="Select files to attach"
                tabIndex={-1}
              />

              <button
                onClick={handleReply}
                disabled={replyDisabled}
                className="ticket-reply-send-btn"
                aria-label="Send reply"
                aria-busy={sending}
              >
                {sending ? (
                  <IconLoader size={16} className="ticket-reply-spinner" />
                ) : (
                  <IconSend size={16} />
                )}
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        )}

        {/* ── Resolved banner ── */}
        {isResolved && (
          <div className="ticket-resolved-banner" role="status">
            <IconCheckCircle size={20} />
            <span>This ticket has been resolved</span>
          </div>
        )}

        {/* ── Closed banner ── */}
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