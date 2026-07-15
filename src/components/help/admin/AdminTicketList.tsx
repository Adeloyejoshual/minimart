// src/components/help/admin/AdminTicketList.tsx
'use client';

import '@/styles/help/admin-ticket-list.css';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminUpdateTicketStatus } from '@/lib/help/actions';
import { formatDate } from '@/lib/help/utils';
import PriorityBadge from '@/components/help/PriorityBadge';
import type { SupportTicket, SupportAnalytics, TicketPriority } from '@/types/help';
import {
  IconSearch,
  IconUsers,
  IconCheckCircle,
  IconAlertTriangle,
  IconBarChart,
  IconEye,
  IconStar,
} from '@/components/help/icons/HelpIcons';

const STATUS_OPTIONS = [
  'open',
  'waiting_for_customer',
  'in_progress',
  'escalated',
  'resolved',
  'closed',
];

interface AdminTicketListProps {
  tickets: SupportTicket[];
  total: number;
  analytics: SupportAnalytics;
  currentUserId: string;
}

export default function AdminTicketList({
  tickets,
  total,
  analytics,
  currentUserId,
}: AdminTicketListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/support?${params.toString()}`);
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    startTransition(() =>
      adminUpdateTicketStatus(ticketId, newStatus, currentUserId)
    );
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-container">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Support Dashboard</h1>
            <p className="admin-subtitle">{total} total tickets</p>
          </div>
          <Link href="/admin/support/analytics" className="admin-analytics-link">
            <IconBarChart size={16} />
            Analytics
          </Link>
        </div>

        {/* Analytics Cards */}
        <div className="admin-analytics-grid">
          <div className="admin-stat-card admin-stat-total">
            <div className="admin-stat-icon">
              <IconUsers size={20} />
            </div>
            <p className="admin-stat-value">{analytics.total}</p>
            <p className="admin-stat-label">Total Tickets</p>
          </div>

          <div className="admin-stat-card admin-stat-open">
            <div className="admin-stat-icon">
              <IconAlertTriangle size={20} />
            </div>
            <p className="admin-stat-value">{analytics.open}</p>
            <p className="admin-stat-label">Open</p>
          </div>

          <div className="admin-stat-card admin-stat-resolved">
            <div className="admin-stat-icon">
              <IconCheckCircle size={20} />
            </div>
            <p className="admin-stat-value">{analytics.resolved}</p>
            <p className="admin-stat-label">Resolved</p>
          </div>

          <div className="admin-stat-card admin-stat-rating">
            <div className="admin-stat-icon">
              <IconStar size={20} />
            </div>
            <p className="admin-stat-value">{analytics.avgRating}</p>
            <p className="admin-stat-label">Avg Rating</p>
          </div>
        </div>

        {/* Filters */}
        <div className="admin-filters">
          <div className="admin-search-wrapper">
            <IconSearch size={16} className="admin-search-icon" />
            <input
              type="text"
              placeholder="Search ticket number or subject..."
              defaultValue={searchParams.get('search') || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="admin-search-input"
            />
          </div>

          <select
            defaultValue={searchParams.get('status') || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="admin-filter-select"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            defaultValue={searchParams.get('priority') || ''}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="admin-filter-select"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Tickets Table */}
        <div className="admin-table-wrapper">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead className="admin-table-head">
                <tr>
                  <th className="admin-table-th">Ticket</th>
                  <th className="admin-table-th">User</th>
                  <th className="admin-table-th">Subject</th>
                  <th className="admin-table-th">Category</th>
                  <th className="admin-table-th">Priority</th>
                  <th className="admin-table-th">Status</th>
                  <th className="admin-table-th">Created</th>
                  <th className="admin-table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="admin-table-body">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="admin-table-row">
                    <td className="admin-table-td">
                      <span className="admin-ticket-number">
                        {ticket.ticket_number}
                      </span>
                    </td>
                    <td className="admin-table-td">
                      <p className="admin-user-name">
                        {ticket.user?.full_name || 'Unknown'}
                      </p>
                      <p className="admin-user-email">
                        {ticket.user?.email || ''}
                      </p>
                    </td>
                    <td className="admin-table-td">
                      <p className="admin-ticket-subject">{ticket.subject}</p>
                    </td>
                    <td className="admin-table-td">
                      <span className="admin-ticket-category">
                        {ticket.category}
                      </span>
                    </td>
                    <td className="admin-table-td">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="admin-table-td">
                      <select
                        defaultValue={ticket.status}
                        onChange={(e) =>
                          handleStatusChange(ticket.id, e.target.value)
                        }
                        className="admin-status-select"
                        disabled={isPending}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="admin-table-td">
                      <span className="admin-ticket-date">
                        {formatDate(ticket.created_at)}
                      </span>
                    </td>
                    <td className="admin-table-td">
                      <Link
                        href={`/admin/support/tickets/${ticket.id}`}
                        className="admin-view-link"
                      >
                        <IconEye size={14} />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {tickets.length === 0 && (
              <div className="admin-table-empty">
                <p>No tickets found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}