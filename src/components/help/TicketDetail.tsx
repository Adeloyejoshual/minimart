// src/components/help/TicketDetail.tsx
'use client';

import '@/styles/help/ticket-detail.css';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { replyToTicket, closeTicket, reopenTicket } from '@/lib/help/actions';
import { formatDateTime, isReopenAllowed } from '@/lib/help/utils';
import TicketStatusBadge from '@/components/help/TicketStatusBadge';
import PriorityBadge from '@/components/help/PriorityBadge';
import type { SupportTicket } from '@/types/help';
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
} from '@/components/help/icons/HelpIcons';

interface TicketDetailProps {
  ticket: SupportTicket;
  currentUserId: string;
}

export default function TicketDetail({
  ticket,
  currentUserId,
}: TicketDetailProps) {
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState('');
  const [actionType, setActionType] = useState<'success' | 'error' | ''>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const canReopen = isReopenAllowed(ticket);

  const canClose = ['open', 'waiting_for_customer', 'in_progress', 'resolved'].includes(
    ticket.status
  );

  const isClosed = ticket.status === 'closed';

  const showAction = (message: string, type: 'success' | 'error') => {
    setActionMessage(message);
    setActionType(type);
    setTimeout(() => {
      setActionMessage('');
      setActionType('');
    }, 5000);
  };

  const handleReply = () => {
    if (!reply.trim()) return;
    startTransition(async () => {
      const result = await replyToTicket(ticket.id, reply);
      if (result.success) {
        setReply('');
        setFiles([]);
        showAction('Reply sent successfully.', 'success');
      } else {
        showAction(result.error || 'Failed to send reply.', 'error');
      }
    });
  };

  const handleClose = () => {
    startTransition(async () => {
      const result = await closeTicket(ticket.id);
      if (result.success) showAction('Ticket closed.', 'success');
      else showAction(result.error || 'Failed to close ticket.', 'error');
    });
  };

  const handleReopen = () => {
    startTransition(async () => {
      const result = await reopenTicket(ticket.id);
      if (result.success) showAction('Ticket reopened.', 'success');
      else showAction(result.error || 'Failed to reopen ticket.', 'error');
    });
  };

  return (
    <div className="ticket-detail-page">
      <div className="ticket-detail-container">
        {/* ── Header ── */}
        <div className="ticket-detail-header">
          <Link href="/support/tickets" className="ticket-detail-back">
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
              <span className="ticket-detail-date">
                <IconClock size={12} />
                {formatDateTime(ticket.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Action Message ── */}
        {actionMessage && (
          <div className={`ticket-detail-alert ticket-detail-alert-${actionType}`}>
            {actionType === 'success' ? (
              <IconCheckCircle size={18} />
            ) : (
              <IconAlertTriangle size={18} />
            )}
            <p>{actionMessage}</p>
          </div>
        )}

        {/* ── Ticket Actions ── */}
        <div className="ticket-detail-actions">
          {canClose && (
            <button
              onClick={handleClose}
              disabled={isPending}
              className="ticket-action-btn ticket-action-close"
            >
              <IconLock size={16} />
              Close Ticket
            </button>
          )}
          {canReopen && (
            <button
              onClick={handleReopen}
              disabled={isPending}
              className="ticket-action-btn ticket-action-reopen"
            >
              <IconRotateCcw size={16} />
              Reopen Ticket
            </button>
          )}
          {isClosed && !canReopen && (
            <div className="ticket-action-expired">
              <IconAlertTriangle size={16} />
              Reopen period has expired
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="ticket-messages">
          {ticket.messages?.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            const isSystem = msg.is_system_message;

            if (isSystem) {
              return (
                <div key={msg.id} className="ticket-message-system">
                  <span>{msg.message}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`ticket-message ${
                  isOwn ? 'ticket-message-own' : 'ticket-message-agent'
                }`}
              >
                {/* Avatar */}
                <div className="ticket-message-avatar">
                  {msg.sender?.avatar_url ? (
                    <Image
                      src={msg.sender.avatar_url}
                      alt={msg.sender.full_name || 'User'}
                      width={36}
                      height={36}
                      className="ticket-message-avatar-img"
                    />
                  ) : (
                    <IconUser size={18} />
                  )}
                </div>

                {/* Content */}
                <div className="ticket-message-content">
                  <div className="ticket-message-header">
                    <span className="ticket-message-sender">
                      {isOwn ? 'You' : msg.sender?.full_name || 'Support Agent'}
                    </span>
                    <span className="ticket-message-time">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>

                  <div className="ticket-message-bubble">{msg.message}</div>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ticket-message-attachments">
                      {msg.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ticket-message-attachment"
                        >
                          <IconPaperclip size={12} />
                          {att.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Reply Box ── */}
        {!isClosed && (
          <div className="ticket-reply-box">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
              className="ticket-reply-textarea"
            />

            {/* File List */}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="ticket-reply-file-hidden"
              onChange={(e) =>
                setFiles(Array.from(e.target.files || []).slice(0, 5))
              }
            />

            {files.length > 0 && (
              <div className="ticket-reply-files">
                {files.map((f, i) => (
                  <div key={i} className="ticket-reply-file-chip">
                    <IconPaperclip size={12} />
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((p) => p.filter((_, idx) => idx !== i))
                      }
                      className="ticket-reply-file-remove"
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="ticket-reply-toolbar">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="ticket-reply-attach-btn"
              >
                <IconPaperclip size={16} />
                Attach files
              </button>

              <button
                onClick={handleReply}
                disabled={isPending || !reply.trim()}
                className="ticket-reply-send-btn"
              >
                {isPending ? (
                  <IconLoader size={16} className="ticket-reply-spinner" />
                ) : (
                  <IconSend size={16} />
                )}
                Send Reply
              </button>
            </div>
          </div>
        )}

        {/* ── Resolved Banner ── */}
        {ticket.status === 'resolved' && (
          <div className="ticket-resolved-banner">
            <IconCheckCircle size={20} />
            <span>This ticket has been resolved</span>
          </div>
        )}
      </div>
    </div>
  );
}