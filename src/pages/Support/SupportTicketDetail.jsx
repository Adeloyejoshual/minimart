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
import { useParams, Link } from "react-router-dom";
import axios               from "axios";
import toast               from "react-hot-toast";

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
const POLL_INTERVAL = 20_000; // 20 seconds

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
   HELPERS
════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeader = () => ({
  headers: { Authorization: `Bearer ${getToken()}` },
});

function formatDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", {
    day    : "numeric",
    month  : "short",
    year   : "numeric",
    hour   : "2-digit",
    minute : "2-digit",
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
  if (!bytes) return "";
  if (bytes < 1024)              return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function canReopen(ticket) {
  if (!ticket)                    return false;
  if (ticket.status !== "closed") return false;
  if (!ticket.reopen_deadline)    return true;
  return new Date(ticket.reopen_deadline) > new Date();
}

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 10 MB limit.`;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" has an unsupported file type.`;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════
   CONFIRMATION DIALOG
════════════════════════════════════════════════════════════ */
function ConfirmDialog({ title, body, onConfirm, onCancel, danger = false }) {
  return (
    <div className="td-confirm-overlay" role="dialog" aria-modal="true">
      <div className="td-confirm-box">
        <h3 className="td-confirm-title">{title}</h3>
        <p className="td-confirm-body">{body}</p>
        <div className="td-confirm-actions">
          <button className="td-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`td-confirm-ok ${danger ? "td-confirm-danger" : ""}`}
            onClick={onConfirm}
          >
            {danger ? "Close Ticket" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TICKET MESSAGE  (memoized to prevent re-renders)
════════════════════════════════════════════════════════════ */
const TicketMessage = memo(function TicketMessage({ msg, isOwn, isSystem }) {
  const [imgPreviews, setImgPreviews] = useState({});

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
              width        : 36,
              height       : 36,
              borderRadius : "50%",
              objectFit    : "cover",
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
            {isOwn ? "You" : (msg.sender_name ?? "Support Agent")}
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
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function SupportTicketDetail({ user }) {
  const { id }  = useParams();
  const fileRef = useRef(null);

  /* ── Ticket state ── */
  const [ticket,      setTicket]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [retryCount,  setRetryCount]  = useState(0);

  /* ── Reply state ── */
  const [reply,       setReply]       = useState("");
  const [files,       setFiles]       = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [sending,     setSending]     = useState(false);

  /* ── Action state ── */
  const [actionBusy,  setActionBusy]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── Polling ── */
  const pollRef    = useRef(null);
  const isMounted  = useRef(true);

  /* ── Thread scroll ── */
  const threadRef    = useRef(null);
  const shouldScroll = useRef(true);

  /* ════════════════════════════════════════════════════════
     FETCH TICKET
  ════════════════════════════════════════════════════════ */
  const loadTicket = useCallback(async (silent = false) => {
    const token = getToken();
    if (!token) {
      setError("Please sign in to view this ticket.");
      setLoading(false);
      return;
    }

    try {
      if (!silent) setError(null);

      const { data } = await axios.get(
        `${BASE_URL}/api/support/tickets/${id}`,
        authHeader()
      );

      /* Unwrap { success, ticket } envelope */
      const ticketData = data?.ticket ?? data;

      if (!isMounted.current) return;

      if (!ticketData?.id) {
        setError("Ticket not found.");
        setTicket(null);
      } else {
        setTicket(ticketData);
      }
    } catch (err) {
      if (!isMounted.current) return;
      const status = err?.response?.status;
      if (!silent) {
        if (status === 404) {
          setError("Ticket not found.");
        } else if (status === 401 || status === 403) {
          setError("You do not have permission to view this ticket.");
        } else {
          setError("Could not load ticket. Please try again.");
        }
      }
      console.error("[SupportTicketDetail] load:", err.message);
    } finally {
      if (!silent && isMounted.current) setLoading(false);
    }
  }, [id]);

  /* ── Initial load ── */
  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    loadTicket(false);
    return () => { isMounted.current = false; };
  }, [loadTicket]);

  /* ── Polling every 20 s ── */
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadTicket(true); // silent — no loading spinner
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [loadTicket]);

  /* ── Socket.IO real-time updates ── */
  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId || !id) return;

    /* Lazy import so this file doesn't require socket.io-client
       to be installed — falls back gracefully if not present    */
    let socket;
    import("socket.io-client")
      .then(({ io }) => {
        socket = io(BASE_URL, {
          query      : { userId },
          transports : ["websocket", "polling"],
        });

        /* Join a support-specific room keyed by ticket id */
        socket.emit("joinThread", { threadId: `ticket_${id}` });

        /* Listen for new messages pushed by the server */
        socket.on("receiveMessage", () => {
          if (isMounted.current) loadTicket(true);
        });
      })
      .catch(() => {
        /* socket.io-client not installed — polling handles it */
      });

    return () => {
      if (socket) {
        socket.emit("leaveThread", { threadId: `ticket_${id}` });
        socket.disconnect();
      }
    };
  }, [id, user?.id, loadTicket]);

  /* ── Auto-scroll to bottom ── */
  useEffect(() => {
    if (shouldScroll.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [ticket?.messages]);

  /* ════════════════════════════════════════════════════════
     FILE HANDLING
  ════════════════════════════════════════════════════════ */
  const handleFileChange = useCallback((e) => {
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

    /* Generate previews for images */
    next.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (filePreviews[`${file.name}-${file.size}`]) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFilePreviews((prev) => ({
          ...prev,
          [`${file.name}-${file.size}`]: ev.target.result,
        }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  }, [files, filePreviews]);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ════════════════════════════════════════════════════════
     REPLY
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
            Authorization  : `Bearer ${getToken()}`,
            "Content-Type" : "multipart/form-data",
          },
        }
      );

      toast.success("Reply sent");
      setReply("");
      setFiles([]);
      setFilePreviews({});
      await loadTicket(true);
    } catch (err) {
      console.error("[SupportTicketDetail] reply:", err.message);
      toast.error(err?.response?.data?.message ?? "Failed to send reply.");
    } finally {
      setSending(false);
    }
  }, [reply, files, id, loadTicket]);

  /* ── ⌘ + Enter or Ctrl + Enter to send ── */
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
      toast.error(err?.response?.data?.message ?? "Failed to close ticket.");
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
      toast.error(err?.response?.data?.message ?? "Failed to reopen ticket.");
    } finally {
      setActionBusy(false);
    }
  }, [id, loadTicket]);

  /* ════════════════════════════════════════════════════════
     DERIVED STATE  (memoized)
  ════════════════════════════════════════════════════════ */
  const {
    isClosed,
    isResolved,
    reopenOk,
    canClose,
    messages,
    currentUserId,
    hasContent,
  } = useMemo(() => {
    if (!ticket) return {
      isClosed: false, isResolved: false, reopenOk: false,
      canClose: false, messages: [], currentUserId: null, hasContent: false,
    };

    return {
      isClosed      : ticket.status === "closed",
      isResolved    : ticket.status === "resolved",
      reopenOk      : canReopen(ticket),
      canClose      : ["open","waiting_for_customer","in_progress","resolved"]
                        .includes(ticket.status),
      messages      : Array.isArray(ticket.messages) ? ticket.messages : [],
      currentUserId : user?.id ?? null,
      hasContent    : !!(ticket.description || ticket.messages?.length),
    };
  }, [ticket, user?.id]);

  const replyDisabled = sending || actionBusy || (!reply.trim() && files.length === 0);

  /* ════════════════════════════════════════════════════════
     LOADING STATE
  ════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="ticket-detail-page">
        <div className="ticket-detail-container">
          <div className="ticket-detail-loading" role="status" aria-busy="true" aria-label="Loading ticket">
            <IconLoader size={28} className="ticket-reply-spinner" />
            <p>Loading ticket…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     ERROR STATE
  ════════════════════════════════════════════════════════ */
  if (error || !ticket) {
    return (
      <div className="ticket-detail-page">
        <div className="ticket-detail-container">
          <div className="ticket-detail-error" role="alert">
            <IconAlertTriangle size={40} className="ticket-detail-error-icon" />
            <p className="ticket-detail-error-title">
              {error ?? "Ticket not found."}
            </p>
            <p className="ticket-detail-error-sub">
              The ticket may have been removed or you may not have
              permission to view it.
            </p>
            <div className="ticket-detail-error-btns">
              <button
                className="ticket-detail-retry-btn"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setRetryCount((c) => c + 1);
                  loadTicket(false);
                }}
              >
                <IconRefresh size={15} />
                Try Again
              </button>
              <Link to="/support/tickets" className="ticket-detail-error-btn">
                <IconArrowLeft size={16} />
                Back to Tickets
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     MAIN RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">

        {/* ── Confirmation dialog ── */}
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
              <PriorityBadge    priority={ticket.priority} />
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
        </div>

        {/* ── Ticket actions ── */}
        <div className="ticket-detail-actions">
          {canClose && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={actionBusy || sending}
              className="ticket-action-btn ticket-action-close"
              aria-label="Close this ticket"
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
              aria-label="Reopen this ticket"
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

        {/* ── Messages thread ── */}
        <div
          className="ticket-messages"
          ref={threadRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          onScroll={() => {
            const el = threadRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            shouldScroll.current = atBottom;
          }}
        >
          {/* Empty conversation state */}
          {!hasContent && (
            <div className="ticket-messages-empty">
              <p>No messages yet. Start the conversation below.</p>
            </div>
          )}

          {/* Original description (only if no messages yet) */}
          {messages.length === 0 && ticket.description && (
            <TicketMessage
              msg={{
                id           : "description",
                sender_id    : ticket.user_id,
                sender_name  : "You",
                message      : ticket.description,
                created_at   : ticket.created_at,
                attachments  : [],
                is_system_message: false,
              }}
              isOwn={true}
              isSystem={false}
            />
          )}

          {/* All messages */}
          {messages.map((msg) => {
            const isOwn = currentUserId
              ? msg.sender_id === currentUserId
              : !msg.is_internal_note && msg.sender_role !== "admin";

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
          <div
            className="ticket-reply-box"
            aria-label="Reply to this ticket"
          >
            <label htmlFor="ticket-reply-input" className="td-sr-only">
              Your reply
            </label>
            <textarea
              id="ticket-reply-input"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply… (⌘ + Enter to send)"
              rows={4}
              className="ticket-reply-textarea"
              aria-busy={sending}
              disabled={sending}
            />

            {/* File previews */}
            {files.length > 0 && (
              <div className="ticket-reply-files" role="list" aria-label="Attached files">
                {files.map((f, i) => {
                  const previewKey = `${f.name}-${f.size}`;
                  const preview    = filePreviews[previewKey];
                  const isImage    = f.type.startsWith("image/");

                  return (
                    <div key={i} className="ticket-reply-file-chip" role="listitem">
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