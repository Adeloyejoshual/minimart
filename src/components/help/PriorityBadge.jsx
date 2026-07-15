// ════════════════════════════════════════════════════════════
// FILE: src/components/help/PriorityBadge.jsx
// ════════════════════════════════════════════════════════════

import '../../styles/help/priority-badge.css';

/* ── Priority configuration map ─────────────────────────── */
const PRIORITY_CONFIG = {
  low: {
    label:   'Low',
    variant: 'priority-low',
  },
  medium: {
    label:   'Medium',
    variant: 'priority-medium',
  },
  high: {
    label:   'High',
    variant: 'priority-high',
  },
  urgent: {
    label:   'Urgent',
    variant: 'priority-urgent',
  },
};

/* ── Component ───────────────────────────────────────────── */
export default function PriorityBadge({ priority }) {
  const config = PRIORITY_CONFIG[priority] || {
    label:   priority ? priority.replace(/_/g, ' ') : 'Unknown',
    variant: 'priority-low',
  };

  return (
    <span className={`priority-badge ${config.variant}`}>
      <span className="priority-dot" />
      {config.label}
    </span>
  );
}