// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportTicketDetail.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/SupportTicketDetail.css";

import {
  useState, useEffect, useRef,
  useCallback, memo, useMemo,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import {
  IconArrowLeft, IconSend, IconPaperclip, IconX,
  IconLock, IconCheckCircle, IconRotateCcw,
  IconAlertTriangle, IconClock, IconUser,
  IconLoader, IconRefresh,
} from "../../components/help/icons/HelpIcons";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL;
const POLL_INTERVAL = 20_000;

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
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
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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
  if (data.ticket?.id) return data.ticket;
  if (data.id)         return data;
  if (data.data?.id)   return data.data;
  return null;
}

/* ════════════════════════════════════════════════════════════
   EXTRACT API ERROR
════════════════════════════════════════════════════════════ */
function extractApiError(err, url) {
  if (axios.isCancel(err)) return null;

  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return {
        title: "Request timed out",
        detail: "The server took too long to respond.",
        hint: "Check your internet connection and try again.",
        httpStatus: null, url, serverRaw: null,
      };

    if (typeof navigator !== "undefined" && !navigator.onLine)
      return {
        title: "You are offline",
        detail: "No internet connection detected.",
        hint: "Please connect to the internet and try again.",
        httpStatus: null, url, serverRaw: null,
      };

    return {
      title: "Network error",
      detail: err.message || "Could not reach the server.",
      hint: "Check your connection or try again in a moment.",
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
      data.message             ||
      data.error?.message      ||
      (typeof data.error === "string" ? data.error : null) ||
      data.detail              ||
      data.errors?.[0]?.message ||
      data.errors?.[0]         ||
      data.msg                 ||
      data.reason              ||
      data.description         ||
      null;
    serverMsg = raw && typeof raw === "object" ? JSON.stringify(raw) : raw;
  }

  const titleMap = {
    400: "Bad request",        401: "Authentication required",
    403: "Access denied",      404: "Ticket not found",
    410: "Ticket removed",     422: "Invalid request",
    429: "Too many requests",  500: "Server error",
    502: "Bad gateway",        503: "Service unavailable",
    504: "Gateway timeout",
  };
  const hintMap = {
    400: "Check your input and try again.",
    401: "Please sign in again.",
    403: "This ticket may belong to a different account.",
    404: "The ticket may have been deleted.",
    422: "The ticket ID format may be invalid.",
    429: "Wait a moment before trying again.",
    500: "This is a server-side issue. Try again shortly.",
    502: "The server gateway is down. Try again in a few minutes.",
    503: "The server is temporarily under maintenance.",
    504: "The server gateway timed out. Try again in a few minutes.",
  };

  return {
    title:      `${titleMap[status] ?? "Error"} (${status})`,
    detail:     serverMsg || `The server returned HTTP ${status} with no further detail.`,
    hint:       hintMap[status] || "Please try again.",
    httpStatus: status,
    url:        actualUrl,
    serverRaw:  data,
  };
}

/* ════════════════════════════════════════════════════════════
   STATUS BADGE  (inline — no separate import)
════════════════════════════════════════════════════════════ */
const STATUS_META = {
  open:                     { label: "Open" },
  in_progress:              { label: "In Progress" },
  waiting_for_customer:     { label: "Waiting" },
  resolved:                 { label: "Resolved" },
  closed:                   { label: "Closed" },
};

const StatusBadge = memo(function StatusBadge({ status }) {
  const key = status ?? "open";
  const meta = STATUS_META[key] ?? { label: key };
  const cls  = key === "waiting_for_customer" ? "waiting" : key;
  return (
    <span className={`stdp-status-badge stdp-status-${cls}`}>
      {meta.label}
    </span>
  );
});

/* ════════════════════════════════════════════════════════════
   PRIORITY BADGE  (inline)
════════════════════════════════════════════════════════════ */
const PriorityBadge = memo(function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={`stdp-priority-badge stdp-priority-${priority}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
});

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════ */
const ConfirmDialog = memo(function ConfirmDialog({
  title, body, onConfirm, onCancel,
}) {
  return (
    <div
      className="stdp-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stdp-dlg-title"
    >
      <div className="stdp-dialog">
        <h3 className="stdp-dialog-title" id="stdp-dlg-title">{title}</h3>
        <p className="stdp-dialog-body">{body}</p>
        <div className="stdp-dialog-actions">
          <button className="stdp-dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="stdp-dialog-confirm" onClick={onConfirm}>
            Close Ticket
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
      <div className="stdp-msg-system">
        <span>{msg.message}</span>
      </div>
    );
  }

  const side = isOwn ? "stdp-msg--own" : "stdp-msg--agent";

  return (
    <div className={`stdp-msg ${side}`}>
      {/* Avatar */}
      <div className="stdp-msg-avatar" aria-hidden="true">
        {msg.sender_avatar
          ? <img src={msg.sender_avatar} alt={msg.sender_name ?? "User"} />
          : <IconUser size={18} />
        }
      </div>

      {/* Content */}
      <div className="stdp-msg-content">
        <div className="stdp-msg-header">
          <span className="stdp-msg-sender">
            {isOwn ? "You" : (msg.sender_name ?? "Support Agent")}
          </span>
          <span className="stdp-msg-time" title={formatDateTime(msg.created_at)}>
            {timeAgo(msg.created_at)}
          </span>
        </div>

        <div className="stdp-msg-bubble">{msg.message}</div>

        {/* Attachments */}
        {msg.attachments?.length > 0 && (
          <div className="stdp-msg-attachments">
            {msg.attachments.map((att) => {
              const isImg = att.file_type?.startsWith("image/");
              return (
                <div key={att.id}>
                  {isImg && (
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="stdp-att-preview"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </a>
                  )}
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="stdp-att-link"
                  >
                    <IconPaperclip size={12} />
                    <span className="stdp-att-name">{att.file_name}</span>
                    {att.file_size && (
                      <span className="stdp-att-size">{formatBytes(att.file_size)}</span>
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
   ERROR STATE
════════════════════════════════════════════════════════════ */
const ErrorState = memo(function ErrorState({ id, error, onRetry }) {
  const navigate  = useNavigate();
  const [raw, setRaw] = useState(false);

  const noRetry = [403, 404, 410].includes(error?.httpStatus);
  const is500   = (error?.httpStatus ?? 0) >= 500;

  return (
    <div className="stdp-page">
      <div className="stdp-container">
        <div className="stdp-error" role="alert" aria-live="assertive">

          <div className="stdp-error-icon" aria-hidden="true">
            <IconAlertTriangle size={26} />
          </div>

          <h2 className="stdp-error-title">
            {error?.title ?? "Could not load ticket"}
          </h2>

          <p className="stdp-error-detail">
            {error?.detail ?? "An unexpected error occurred."}
          </p>

          {error?.hint && (
            <p className="stdp-error-hint">💡 {error.hint}</p>
          )}

          {/* Info table */}
          {(id || error?.httpStatus || error?.url) && (
            <div className="stdp-error-table">
              {id && (
                <div className="stdp-error-row">
                  <span className="stdp-error-key">Ticket ID</span>
                  <code className="stdp-error-val">{id}</code>
                </div>
              )}
              {error?.httpStatus && (
                <div className="stdp-error-row">
                  <span className="stdp-error-key">HTTP Status</span>
                  <code className={`stdp-error-val${is500 ? " stdp-error-val--red" : ""}`}>
                    {error.httpStatus}
                  </code>
                </div>
              )}
              {error?.url && (
                <div className="stdp-error-row">
                  <span className="stdp-error-key">Endpoint</span>
                  <code className="stdp-error-val stdp-error-val--url">{error.url}</code>
                </div>
              )}
            </div>
          )}

          {/* Raw response */}
          {error?.serverRaw != null && (
            <>
              <button
                className="stdp-error-raw-toggle"
                onClick={() => setRaw((v) => !v)}
                aria-expanded={raw}
              >
                {raw ? "▾ Hide" : "▸ Show"} server response
              </button>
              {raw && (
                <pre className="stdp-error-raw">
                  {typeof error.serverRaw === "string"
                    ? error.serverRaw
                    : JSON.stringify(error.serverRaw, null, 2)}
                </pre>
              )}
            </>
          )}

          {/* Action buttons */}
          <div className="stdp-error-actions">
            {!noRetry && (
              <button className="stdp-error-btn-primary" onClick={onRetry}>
                <IconRefresh size={15} /> Try Again
              </button>
            )}
            {error?.httpStatus === 401 && (
              <button
                className="stdp-error-btn-primary"
                onClick={() =>
                  navigate("/auth?redirect=" + encodeURIComponent(window.location.pathname))
                }
              >
                Sign In
              </button>
            )}
            <Link to="/support/tickets" className="stdp-error-btn-ghost">
              <IconArrowLeft size={16} /> Back to Tickets
            </Link>
          </div>

          {is500 && (
            <p className="stdp-error-500-note">
              This is a backend server error — not something you did wrong.
              If it persists, please{" "}
              <Link to="/support" className="stdp-error-link">contact support</Link>{" "}
              and share the Ticket ID and endpoint above.
            </p>
          )}

        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   LOADING STATE
════════════════════════════════════════════════════════════ */
const LoadingState = memo(function LoadingState() {
  return (
    <div className="stdp-page">
      <div className="stdp-container">
        <div className="stdp-loading" role="status" aria-busy="true">
          <IconLoader size={30} className="stdp-spinner" />
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
  const params   = useParams();

  /* ── Resolve ticket ID ── */
  const id = useMemo(() => {
    const fromParams =
      params.id || params.ticketId || params.ticket_id || null;

    if (fromParams && fromParams !== "undefined" && fromParams !== "null")
      return fromParams;

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parts = window.location.pathname.split("/").filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--)
      if (UUID.test(parts[i])) return parts[i];

    return null;
  }, [params]);

  /* ── State ── */
  const [ticket,      setTicket]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState(null);
  const [reply,       setReply]       = useState("");
  const [files,       setFiles]       = useState([]);
  const [previews,    setPreviews]    = useState({});   // key → dataURL
  const [sending,     setSending]     = useState(false);
  const [actionBusy,  setActionBusy]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── Refs ── */
  const fileRef      = useRef(null);
  const threadRef    = useRef(null);
  const isMounted    = useRef(true);
  const shouldScroll = useRef(true);
  const pollRef      = useRef(null);
  const abortRef     = useRef(null);
  const lastToastKey = useRef(null);    // FIX #9 — toast deduplication

  /* ════════════════════════════════════════════════════════
     LOAD TICKET
  ════════════════════════════════════════════════════════ */
  const loadTicket = useCallback(async (silent = false) => {
    const token = getToken();
    const url   = `${BASE_URL}/api/support/tickets/${id}`;

    /* ── Auth guard ── */
    if (!token) {
      if (!silent) {
        setApiError({
          title: "Authentication required",
          detail: "Please sign in to view support tickets.",
          hint: "Tap Sign In below.",
          httpStatus: 401, url: null, serverRaw: null,
        });
        setLoading(false);
      }
      return;
    }

    /* ── ID present? ── */
    if (!id) {
      if (!silent) {
        setApiError({
          title: "Missing ticket ID",
          detail: "No ticket ID was found in the URL.",
          hint: "Go back and select a ticket from the list.",
          httpStatus: null, url: null, serverRaw: null,
        });
        setLoading(false);
      }
      return;
    }

    /* ── UUID format ── */
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      if (!silent) {
        setApiError({
          title: "Invalid ticket ID",
          detail: `"${id}" is not a valid UUID.`,
          hint: "Check the URL and try again.",
          httpStatus: 422, url: null, serverRaw: null,
        });
        setLoading(false);
      }
      return;
    }

    /* ── Abort previous request ── */
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal:  ctrl.signal,
        timeout: 15_000,
      });

      if (!isMounted.current) return;

      const ticketData = unwrapTicket(data);

      if (!ticketData) {
        if (!silent) {
          setApiError({
            title: "Empty response",
            detail: "The server returned success but no ticket data.",
            hint: "This may be temporary. Please try again.",
            httpStatus: null, url, serverRaw: data,
          });
        }
      } else {
        // FIX #1 — always clear error on success (silent or not)
        setTicket(ticketData);
        setApiError(null);
      }
    } catch (err) {
      if (!isMounted.current) return;
      if (axios.isCancel(err))  return;

      /* Always log full error details for developers */
      console.group(`%c[Ticket ${id}] API Error`, "color:red;font-weight:bold");
      console.error("URL    :", url);
      console.error("Status :", err?.response?.status ?? "no response");
      console.error("Body   :", err?.response?.data);
      console.error("Axios  :", err.message);
      console.groupEnd();

      if (!silent) {
        setApiError(extractApiError(err, url));
      }
    } finally {
      // FIX #2 — always hide spinner on non-silent, regardless of abort
      if (isMounted.current && !silent) setLoading(false);
    }
  }, [id]);

  /* ── Mount / unmount ── */
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

  /* ── Polling — FIX #6: skip when tab hidden ── */
  useEffect(() => {
    const start = () => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (isMounted.current && !document.hidden) loadTicket(true);
      }, POLL_INTERVAL);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", start);
    };
  }, [loadTicket]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (shouldScroll.current && threadRef.current)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [ticket?.messages?.length]);

  /* ════════════════════════════════════════════════════════
     DERIVED STATE
  ════════════════════════════════════════════════════════ */
  const { isClosed, isResolved, reopenOk, canClose, messages, currentUserId } =
    useMemo(() => {
      if (!ticket) return {
        isClosed: false, isResolved: false,
        reopenOk: false, canClose: false,
        messages: [], currentUserId: null,
      };
      return {
        isClosed:  ticket.status === "closed",
        isResolved: ticket.status === "resolved",
        reopenOk:  canReopenTicket(ticket),
        canClose:  ["open","waiting_for_customer","in_progress","resolved"]
                     .includes(ticket.status),
        messages:  Array.isArray(ticket.messages) ? ticket.messages : [],
        currentUserId:
          user?.id ?? user?._id ?? user?.user_id ?? user?.uuid ?? null,
      };
    }, [ticket, user]);

  /* ════════════════════════════════════════════════════════
     FILE HANDLING — FIX #4: clean up previews on remove
  ════════════════════════════════════════════════════════ */
  const handleFileChange = useCallback((e) => {
    const selected = Array.from(e.target.files || []);
    const errors   = [];
    const valid    = [];
    const seen     = new Set(files.map((f) => `${f.name}-${f.size}`));

    for (const file of selected) {
      const key = `${file.name}-${file.size}`;
      if (seen.has(key)) { errors.push(`"${file.name}" already attached.`); continue; }
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
      if (!file.type.startsWith("image/") || previews[key]) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (isMounted.current)
          setPreviews((p) => ({ ...p, [key]: ev.target.result }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  }, [files, previews]);

  // FIX #4 — delete preview key when file is removed
  const removeFile = useCallback((i) => {
    setFiles((prev) => {
      const removed = prev[i];
      if (removed) {
        const key = `${removed.name}-${removed.size}`;
        setPreviews((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  /* ════════════════════════════════════════════════════════
     RESET POLL — FIX #10: restart poll after reply
  ════════════════════════════════════════════════════════ */
  const resetPoll = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (isMounted.current && !document.hidden) loadTicket(true);
    }, POLL_INTERVAL);
  }, [loadTicket]);

  /* ════════════════════════════════════════════════════════
     SEND REPLY — FIX #8: optimistic update
  ════════════════════════════════════════════════════════ */
  const handleReply = useCallback(async () => {
    if (!reply.trim() && files.length === 0) return;
    setSending(true);
    shouldScroll.current = true;

    const optimistic = {
      id:               `optimistic-${Date.now()}`,
      sender_id:        currentUserId,
      sender_name:      "You",
      sender_avatar:    null,
      message:          reply.trim(),
      created_at:       new Date().toISOString(),
      attachments:      [],
      is_system_message: false,
      _optimistic:      true,
    };

    /* Show immediately */
    setTicket((prev) => prev
      ? { ...prev, messages: [...(prev.messages ?? []), optimistic] }
      : prev
    );

    const replyText = reply.trim();
    const replyFiles = [...files];
    setReply("");
    setFiles([]);
    setPreviews({});

    try {
      const fd = new FormData();
      fd.append("message", replyText);
      replyFiles.forEach((f) => fd.append("attachments", f));

      await axios.post(
        `${BASE_URL}/api/support/tickets/${id}/messages`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Reply sent");
      resetPoll();           // FIX #10 — restart poll timer
      await loadTicket(true); // replace optimistic with server data
    } catch (err) {
      /* Remove optimistic message on failure */
      setTicket((prev) => prev
        ? { ...prev, messages: (prev.messages ?? []).filter((m) => !m._optimistic) }
        : prev
      );
      /* Restore draft */
      setReply(replyText);
      setFiles(replyFiles);

      const parsed = extractApiError(
        err, `${BASE_URL}/api/support/tickets/${id}/messages`
      );
      toast.error(parsed?.detail ?? "Failed to send reply.");
    } finally {
      setSending(false);
    }
  }, [reply, files, id, currentUserId, loadTicket, resetPoll]);

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
      const parsed = extractApiError(
        err, `${BASE_URL}/api/support/tickets/${id}/reopen`
      );
      toast.error(parsed?.detail ?? "Failed to reopen ticket.");
    } finally {
      setActionBusy(false);
    }
  }, [id, loadTicket]);

  // FIX #3 — abort before retry to prevent race condition
  const handleRetry = useCallback(() => {
    abortRef.current?.abort();
    setLoading(true);
    setApiError(null);
    setTicket(null);
    loadTicket(false);
  }, [loadTicket]);

  /* ════════════════════════════════════════════════════════
     RENDER GUARDS
  ════════════════════════════════════════════════════════ */
  if (loading) return <LoadingState />;
  if (apiError || !ticket)
    return <ErrorState id={id} error={apiError} onRetry={handleRetry} />;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  const replyDisabled = sending || actionBusy || (!reply.trim() && files.length === 0);

  return (
    <div className="stdp-page">
      <div className="stdp-container">

        {/* ── Confirm dialog ── */}
        {showConfirm && (
          <ConfirmDialog
            title="Close this ticket?"
            body="Once closed, you have 7 days to reopen it. Are you sure?"
            onConfirm={handleClose}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* ════════════════════════════════════════════════
            HEADER
        ════════════════════════════════════════════════ */}
        <div className="stdp-header">
          <Link to="/support/tickets" className="stdp-back" aria-label="Back to tickets">
            <IconArrowLeft size={20} />
          </Link>

          <div className="stdp-header-info">
            <div className="stdp-header-badges">
              <span className="stdp-ticket-number">{ticket.ticket_number}</span>
              <StatusBadge   status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="stdp-subject">{ticket.subject}</h1>
            <div className="stdp-meta">
              {ticket.category && (
                <span className="stdp-category">{ticket.category}</span>
              )}
              {ticket.category && <span className="stdp-dot" aria-hidden="true" />}
              <span
                className="stdp-date"
                title={formatDateTime(ticket.created_at)}
              >
                <IconClock size={12} />
                {timeAgo(ticket.created_at)}
              </span>
            </div>
          </div>

          <button
            className="stdp-refresh-btn"
            onClick={() => loadTicket(false)}
            aria-label="Refresh ticket"
            disabled={actionBusy || sending}
          >
            <IconRefresh size={16} />
          </button>
        </div>

        {/* ════════════════════════════════════════════════
            ACTIONS
        ════════════════════════════════════════════════ */}
        <div className="stdp-actions">
          {canClose && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={actionBusy || sending}
              className="stdp-action-btn stdp-action-close"
            >
              <IconLock size={16} /> Close Ticket
            </button>
          )}
          {reopenOk && (
            <button
              onClick={handleReopen}
              disabled={actionBusy || sending}
              className="stdp-action-btn stdp-action-reopen"
            >
              <IconRotateCcw size={16} /> Reopen Ticket
            </button>
          )}
          {isClosed && !reopenOk && (
            <div className="stdp-action-expired" role="status">
              <IconAlertTriangle size={15} />
              Reopen period has expired
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            MESSAGE THREAD
        ════════════════════════════════════════════════ */}
        <div
          className="stdp-thread"
          ref={threadRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          onScroll={() => {
            const el = threadRef.current;
            if (!el) return;
            shouldScroll.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {/* Empty state */}
          {messages.length === 0 && !ticket.description && (
            <div className="stdp-thread-empty">
              No messages yet. Start the conversation below.
            </div>
          )}

          {/* Show description as first message if no messages array */}
          {messages.length === 0 && ticket.description && (
            <TicketMessage
              msg={{
                id:                "__desc__",
                sender_id:         ticket.user_id,
                sender_name:       "You",
                sender_avatar:     null,
                message:           ticket.description,
                created_at:        ticket.created_at,
                attachments:       [],
                is_system_message: false,
              }}
              isOwn={true}
              isSystem={false}
            />
          )}

          {/* Messages */}
          {messages.map((msg) => {
            // FIX #5 — better isOwn fallback logic
            const isOwn = currentUserId
              ? String(msg.sender_id) === String(currentUserId)
              : (msg.sender_role === "customer" || msg.sender_role === "user");

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

        {/* ════════════════════════════════════════════════
            REPLY BOX
        ════════════════════════════════════════════════ */}
        {!isClosed && (
          <div className="stdp-reply-box">
            <label htmlFor="stdp-reply-ta" className="stdp-sr-only">
              Your reply
            </label>
            <textarea
              id="stdp-reply-ta"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply… (⌘ Enter or Ctrl + Enter to send)"
              rows={4}
              className="stdp-reply-textarea"
              disabled={sending || actionBusy}
            />

            {/* File chips */}
            {files.length > 0 && (
              <div className="stdp-reply-files" role="list">
                {files.map((f, i) => {
                  const key     = `${f.name}-${f.size}`;
                  const preview = previews[key];
                  return (
                    <div key={`${key}-${i}`} className="stdp-reply-chip" role="listitem">
                      {f.type.startsWith("image/") && preview && (
                        <img
                          src={preview}
                          alt={f.name}
                          className="stdp-reply-chip-thumb"
                        />
                      )}
                      <IconPaperclip size={12} aria-hidden="true" />
                      <span className="stdp-reply-chip-name">{f.name}</span>
                      <span className="stdp-reply-chip-size">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="stdp-reply-chip-remove"
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
            <div className="stdp-reply-toolbar">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="stdp-attach-btn"
                disabled={sending || files.length >= 5}
                aria-label="Attach files"
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
                className="stdp-file-hidden"
                tabIndex={-1}
                aria-hidden="true"
              />

              <button
                onClick={handleReply}
                disabled={replyDisabled}
                className="stdp-send-btn"
                aria-busy={sending}
              >
                {sending
                  ? <><IconLoader size={16} className="stdp-spinner" /> Sending…</>
                  : <><IconSend size={16} /> Send Reply</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            BANNERS
        ════════════════════════════════════════════════ */}
        {isResolved && (
          <div className="stdp-banner stdp-banner--resolved" role="status">
            <IconCheckCircle size={20} />
            <span>This ticket has been resolved</span>
          </div>
        )}

        {isClosed && (
          <div className="stdp-banner stdp-banner--closed" role="status">
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