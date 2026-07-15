// src/components/help/TicketStatusBadge.tsx

import '@/styles/help/ticket-status-badge.css';

import type { TicketStatus } from '@/types/help';

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; variant: string }
> = {
  open: { label: 'Open', variant: 'status-open' },
  waiting_for_customer: { label: 'Awaiting Reply', variant: 'status-waiting' },
  in_progress: { label: 'In Progress', variant: 'status-progress' },
  escalated: { label: 'Escalated', variant: 'status-escalated' },
  resolved: { label: 'Resolved', variant: 'status-resolved' },
  closed: { label: 'Closed', variant: 'status-closed' },
};

interface TicketStatusBadgeProps {
  status: TicketStatus;
}

export default function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    variant: 'status-closed',
  };

  return (
    <span className={`ticket-status-badge ${config.variant}`}>
      <span className="ticket-status-dot" />
      {config.label}
    </span>
  );
}