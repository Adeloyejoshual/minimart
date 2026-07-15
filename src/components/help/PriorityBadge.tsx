// src/components/help/PriorityBadge.tsx

import '@/styles/help/priority-badge.css';

import type { TicketPriority } from '@/types/help';

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; variant: string }
> = {
  low: { label: 'Low', variant: 'priority-low' },
  medium: { label: 'Medium', variant: 'priority-medium' },
  high: { label: 'High', variant: 'priority-high' },
  urgent: { label: 'Urgent', variant: 'priority-urgent' },
};

interface PriorityBadgeProps {
  priority: TicketPriority;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    variant: 'priority-low',
  };

  return (
    <span className={`priority-badge ${config.variant}`}>
      <span className="priority-dot" />
      {config.label}
    </span>
  );
}