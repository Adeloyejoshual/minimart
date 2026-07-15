// ════════════════════════════════════════════════════════════
// FILE: src/components/help/TicketStatusBadge.jsx
// ════════════════════════════════════════════════════════════

import '../../styles/help/ticket-status-badge.css';

/* ── Status configuration map ───────────────────────────── */
const STATUS_CONFIG = {
  open: {
    label:   'Open',
    variant: 'status-open',
  },
  waiting_for_customer: {
    label:   'Awaiting Reply',
    variant: 'status-waiting',
  },
  in_progress: {
    label:   'In Progress',
    variant: 'status-progress',
  },
  escalated: {
    label:   'Escalated',
    variant: 'status-escalated',
  },
  resolved: {
    label:   'Resolved',
    variant: 'status-resolved',
  },
  closed: {
    label:   'Closed',
    variant: 'status-closed',
  },
};

/* ── Component ───────────────────────────────────────────── */
export default function TicketStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label:   status ? status.replace(/_/g, ' ') : 'Unknown',
    variant: 'status-closed',
  };

  return (
    <span className={`ticket-status-badge ${config.variant}`}>
      <span className="ticket-status-dot" />
      {config.label}
    </span>
  );
}