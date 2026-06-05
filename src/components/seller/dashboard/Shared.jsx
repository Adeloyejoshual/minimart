// components/seller/dashboard/Shared.jsx

// ── Format Naira ──────────────────────────────────────────────
export const formatNGN = (value, decimals = 2) =>
  `₦${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

// ── Status map ────────────────────────────────────────────────
const STATUS_MAP = {
  active:       { label: "Active",       color: "#10b981", bg: "#ecfdf5" },
  approved:     { label: "Approved",     color: "#3b82f6", bg: "#eff6ff" },
  pending:      { label: "Pending",      color: "#f59e0b", bg: "#fffbeb" },
  under_review: { label: "Under Review", color: "#6366f1", bg: "#eef2ff" },
  suspended:    { label: "Suspended",    color: "#6b7280", bg: "#f9fafb" },
  rejected:     { label: "Rejected",     color: "#ef4444", bg: "#fef2f2" },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span style={{
      display:       "inline-block",
      padding:       "0.2rem 0.65rem",
      borderRadius:  "100px",
      fontSize:      "0.72rem",
      fontWeight:    700,
      color:         s.color,
      background:    s.bg,
    }}>
      {s.label}
    </span>
  );
};

// ── Time ago ──────────────────────────────────────────────────
export const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ── Skeleton ──────────────────────────────────────────────────
export const DashboardSkeleton = () => (
  <div className="sd-skeleton-wrap">
    <div className="sd-skeleton-sidebar">
      <div className="sd-skeleton-circle" />
      {[1,2,3,4,5,6].map((i) => (
        <div key={i} className="sd-skeleton-row" />
      ))}
    </div>
    <div className="sd-skeleton-main">
      <div className="sd-skeleton-topbar" />
      <div className="sd-skeleton-stats">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="sd-skeleton-card" />
        ))}
      </div>
      <div className="sd-skeleton-grid">
        <div className="sd-skeleton-block tall" />
        <div className="sd-skeleton-block" />
      </div>
      <div className="sd-skeleton-block wide" />
    </div>
  </div>
);

// ── Error ─────────────────────────────────────────────────────
export const DashboardError = ({ error, onRetry }) => (
  <div className="sd-error">
    <div className="sd-error-icon">⚠️</div>
    <h3>Something went wrong</h3>
    <p>{error ?? "Failed to load dashboard data"}</p>
    <button className="sd-retry-btn" onClick={onRetry}>
      🔄 Try Again
    </button>
    <a href="/" className="sd-error-home">← Back to Home</a>
  </div>
);