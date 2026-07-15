// src/components/help/TicketList.tsx
'use client';

import '@/styles/help/ticket-list.css';

import { useState } from 'react';
import Link from 'next/link';
import type { SupportTicket, TicketStatus } from '@/types/help';
import { formatDate } from '@/lib/help/utils';
import TicketStatusBadge from '@/components/help/TicketStatusBadge';
import PriorityBadge from '@/components/help/PriorityBadge';
import {
  IconPlus,
  IconSearch,
  IconChevronRight,
  IconClock,
  IconMessageSquare,
  IconArrowLeft,
} from '@/components/help/icons/HelpIcons';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Waiting', value: 'waiting_for_customer' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

interface TicketListProps {
  tickets: SupportTicket[];
}

export default function TicketList({ tickets }: TicketListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = tickets.filter((t) => {
    const matchSearch =
      !search ||
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="ticket-list-page">
      <div className="ticket-list-container">
        {/* Header */}
        <div className="ticket-list-header">
          <div className="ticket-list-header-left">
            <Link href="/help" className="ticket-list-back">
              <IconArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="ticket-list-title">My Tickets</h1>
              <p className="ticket-list-count">
                {tickets.length} total {tickets.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>
          <Link href="/support/contact" className="ticket-list-new-btn">
            <IconPlus size={16} />
            <span>New Ticket</span>
          </Link>
        </div>

        {/* Search & Filters */}
        <div className="ticket-list-filters">
          <div className="ticket-list-search-wrapper">
            <IconSearch size={16} className="ticket-list-search-icon" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ticket-list-search-input"
              aria-label="Search tickets"
            />
          </div>

          <div className="ticket-list-status-filters">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`ticket-list-status-btn ${
                  statusFilter === f.value ? 'ticket-list-status-active' : ''
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket Cards */}
        {filtered.length === 0 ? (
          <div className="ticket-list-empty">
            <IconMessageSquare size={48} className="ticket-list-empty-icon" />
            <h3 className="ticket-list-empty-title">No tickets found</h3>
            <p className="ticket-list-empty-desc">
              {tickets.length === 0
                ? 'You have not submitted any support requests yet.'
                : 'No tickets match your current filters.'}
            </p>
            <Link href="/support/contact" className="ticket-list-empty-btn">
              <IconPlus size={16} />
              Create Your First Ticket
            </Link>
          </div>
        ) : (
          <div className="ticket-list-cards">
            {filtered.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/support/tickets/${ticket.id}`}
                className="ticket-card"
              >
                <div className="ticket-card-content">
                  <div className="ticket-card-top-row">
                    <span className="ticket-card-number">
                      {ticket.ticket_number}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>

                  <h3 className="ticket-card-subject">{ticket.subject}</h3>

                  <div className="ticket-card-meta">
                    <span className="ticket-card-category">
                      {ticket.category}
                    </span>
                    <span className="ticket-card-date">
                      <IconClock size={12} />
                      {formatDate(ticket.created_at)}
                    </span>
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                </div>

                <IconChevronRight
                  size={20}
                  className="ticket-card-arrow"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}