// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportTicketDetail.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/ticket-detail-page.css";
import "../../styles/help/ticket-detail.css";
import "../../styles/help/ticket-status-badge.css";
import "../../styles/help/priority-badge.css";

import { useState, useEffect, useRef } from "react";
import { useParams, Link }            from "react-router-dom";
import axios                           from "axios";
import toast                           from "react-hot-toast";
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
} from "../../components/help/icons/HelpIcons";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SupportTicketDetail({ user }) {
  const { id }    = useParams();
  const fileRef   = useRef(null);

  const [ticket,  setTicket]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply,   setReply]   = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("marketplace_token");
    if (!token) { setLoading(false); return; }

    axios
      .get(`${BASE_URL}/api/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setTicket(res.data))
      .catch(() => toast.error("Could not load ticket"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem("marketplace_token");
      await axios.post(
        `${BASE_URL}/api/support/tickets/${id}/messages`,
        { message: reply },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Reply sent");
      setReply("");
      // Reload ticket
      const res = await axios.get(`${BASE_URL}/api/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTicket(res.data);
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    const token = localStorage.getItem("marketplace_token");
    try {
      await axios.patch(
        `${BASE_URL}/api/support/tickets/${id}`,
        { status: "closed" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Ticket closed");
      setTicket((prev) => prev ? { ...prev, status: "closed" } : prev);
    } catch {
      toast.error("Failed to close ticket");
    }
  };

  const formatDateTime = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="ticket-detail-page">
        <div className="ticket-detail-container" style={{ textAlign: "center", paddingTop: 80 }}>
          <p style={{ color: "#A8A39D" }}>Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ticket-detail-page">
        <div className="ticket-detail-container" style={{ textAlign: "center", paddingTop: 80 }}>
          <p>Ticket not found.</p>
          <Link to="/support/tickets">Back to tickets</Link>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === "closed";
  const messages = ticket.messages || [];

  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">
        {/* Header */}
        <div className="ticket-detail-header">
          <Link to="/support/tickets" className="ticket-detail-back">
            <IconArrowLeft size={20} />
          </Link>
          <div className="ticket-detail-header-info">
            <div className="ticket-detail-header-badges">
              <span className="ticket-detail-number">{ticket.ticket_number}</span>
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="ticket-detail-subject">{ticket.subject}</h1>
            <div className="ticket-detail-meta">
              <span className="ticket-detail-category">{ticket.category}</span>
              <span className="ticket-detail-separator" />
              <span className="ticket-detail-date">
                <IconClock size={12} />
                {formatDateTime(ticket.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="ticket-detail-actions">
            <button onClick={handleClose} className="ticket-action-btn ticket-action-close">
              <IconLock size={16} />
              Close Ticket
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="ticket-messages">
          {/* Initial description */}
          <div className="ticket-message ticket-message-own">
            <div className="ticket-message-avatar">
              <IconUser size={18} />
            </div>
            <div className="ticket-message-content">
              <div className="ticket-message-header">
                <span className="ticket-message-sender">You</span>
                <span className="ticket-message-time">{formatDateTime(ticket.created_at)}</span>
              </div>
              <div className="ticket-message-bubble">{ticket.description}</div>
            </div>
          </div>

          {messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`ticket-message ${isOwn ? "ticket-message-own" : "ticket-message-agent"}`}
              >
                <div className="ticket-message-avatar">
                  <IconUser size={18} />
                </div>
                <div className="ticket-message-content">
                  <div className="ticket-message-header">
                    <span className="ticket-message-sender">
                      {isOwn ? "You" : "Support Agent"}
                    </span>
                    <span className="ticket-message-time">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  <div className="ticket-message-bubble">{msg.message}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply */}
        {!isClosed && (
          <div className="ticket-reply-box">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
              className="ticket-reply-textarea"
            />
            <div className="ticket-reply-toolbar">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="ticket-reply-attach-btn"
              >
                <IconPaperclip size={16} />
                Attach files
              </button>
              <input ref={fileRef} type="file" multiple className="ticket-reply-file-hidden" />

              <button
                onClick={handleReply}
                disabled={sending || !reply.trim()}
                className="ticket-reply-send-btn"
              >
                {sending ? (
                  <IconLoader size={16} className="ticket-reply-spinner" />
                ) : (
                  <IconSend size={16} />
                )}
                Send Reply
              </button>
            </div>
          </div>
        )}

        {ticket.status === "resolved" && (
          <div className="ticket-resolved-banner">
            <IconCheckCircle size={20} />
            <span>This ticket has been resolved</span>
          </div>
        )}
      </div>
    </div>
  );
}