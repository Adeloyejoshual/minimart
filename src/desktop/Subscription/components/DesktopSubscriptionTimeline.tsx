import { useState, useEffect, useCallback } from "react";
import "./styles/desktop-subscription-timeline.css";

// ─── Token helper — matches App.jsx TOKEN_KEYS ────────────────────────────────
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

interface SubscriptionRecord {
  id:                string;
  plan_slug:         string;
  billing_cycle:     string;
  amount:            number;
  amountNaira:       number;
  currency:          string;
  payment_reference: string | null;
  status:            string;
  auto_renew:        boolean;
  started_at:        string | null;
  expires_at:        string | null;
  created_at:        string;
  plan_name:         string | null;
  plan_badge:        string | null;
}

const STATUS_CONFIG: Record<string, {
  label:     string;
  className: string;
  icon:      JSX.Element;
}> = {
  active: {
    label:     "Active",
    className: "dst-status--active",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  expired: {
    label:     "Expired",
    className: "dst-status--expired",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  cancelled: {
    label:     "Cancelled",
    className: "dst-status--cancelled",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
  },
  superseded: {
    label:     "Upgraded",
    className: "dst-status--superseded",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
  pending: {
    label:     "Pending",
    className: "dst-status--pending",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  failed: {
    label:     "Failed",
    className: "dst-status--failed",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
};

const PLAN_DOT_CLASS: Record<string, string> = {
  premium:  "dst-dot--premium",
  pro:      "dst-dot--pro",
  business: "dst-dot--business",
  elite:    "dst-dot--elite",
  diamond:  "dst-dot--diamond",
};

const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-NG", {
        year: "numeric", month: "short", day: "numeric",
      })
    : "—";

const fmtFull = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-NG", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

// ═══════════════════════════════════════════════════════════════════════════════
const DesktopSubscriptionTimeline = () => {
  const [records,  setRecords]  = useState<SubscriptionRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ─── Fetch all subscription records ────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = getToken();

    if (!token) {
      setError("You are not logged in. Please log in and try again.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/subscription/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Request failed.");
      setRecords(data.subscriptions ?? []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load subscription history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="dst-wrap">
        <div className="dst-sk-title" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dst-sk-row" />
        ))}
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="dst-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p className="dst-error__title">Failed to load history</p>
          <p>{error}</p>
          <button onClick={fetchAll} className="dst-retry">Try again</button>
        </div>
      </div>
    );
  }

  // ─── Empty ──────────────────────────────────────────────────────────────────
  if (!records.length) {
    return (
      <div className="dst-wrap">
        <div className="dst-header">
          <h2 className="dst-title">Subscription History</h2>
        </div>
        <div className="dst-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
            <path d="M3 20h18"/>
          </svg>
          <p>No subscription history yet.</p>
          <p className="dst-empty__sub">
            Subscribe to a plan to see your history here.
          </p>
        </div>
      </div>
    );
  }

  // ─── Computed stats ─────────────────────────────────────────────────────────
  const paidRecords = records.filter(
    (r) => r.status !== "failed" && r.status !== "pending"
  );

  const totalSpent = paidRecords.reduce(
    (sum, r) => sum + (r.amountNaira ?? 0),
    0
  );

  const totalSubs  = paidRecords.length;

  const uniquePlans = [
    ...new Set(
      records
        .filter((r) => r.status !== "failed")
        .map((r) => r.plan_slug)
    ),
  ].length;

  const firstSub    = records[records.length - 1];
  const memberSince = firstSub ? fmtFull(firstSub.created_at) : "—";

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="dst-wrap">

      {/* Header */}
      <div className="dst-header">
        <h2 className="dst-title">Subscription History</h2>
        <span className="dst-header__count">
          {totalSubs} subscription{totalSubs !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stats bar */}
      <div className="dst-stats">
        <div className="dst-stat">
          <span className="dst-stat__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </span>
          <div>
            <span className="dst-stat__value">
              ₦{totalSpent.toLocaleString("en-NG")}
            </span>
            <span className="dst-stat__label">Total Spent</span>
          </div>
        </div>

        <div className="dst-stat">
          <span className="dst-stat__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </span>
          <div>
            <span className="dst-stat__value">{totalSubs}</span>
            <span className="dst-stat__label">Total Subscriptions</span>
          </div>
        </div>

        <div className="dst-stat">
          <span className="dst-stat__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
              <path d="M3 20h18"/>
            </svg>
          </span>
          <div>
            <span className="dst-stat__value">{uniquePlans}</span>
            <span className="dst-stat__label">Plans Used</span>
          </div>
        </div>

        <div className="dst-stat">
          <span className="dst-stat__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <div>
            <span className="dst-stat__value">{memberSince}</span>
            <span className="dst-stat__label">Member Since</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="dst-timeline">
        {records.map((record, i) => {
          const statusCfg  = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending;
          const dotClass   = PLAN_DOT_CLASS[record.plan_slug] ?? "dst-dot--default";
          const isExpanded = expanded === record.id;
          const isFirst    = i === 0;
          const isLast     = i === records.length - 1;

          return (
            <div
              key={record.id}
              className={[
                "dst-item",
                isFirst ? "dst-item--first" : "",
                isLast  ? "dst-item--last"  : "",
              ].join(" ").trim()}
            >
              {/* ── Dot + vertical line ────────────────────────────────── */}
              <div className="dst-item__line-col">
                <span className={`dst-item__dot ${dotClass}`} />
                {!isLast && <span className="dst-item__line" />}
              </div>

              {/* ── Content card ───────────────────────────────────────── */}
              <div
                className={[
                  "dst-item__content",
                  isExpanded ? "dst-item__content--expanded" : "",
                ].join(" ").trim()}
                onClick={() => toggleExpand(record.id)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(record.id);
                  }
                }}
              >
                {/* Row 1: plan name + status */}
                <div className="dst-item__top">
                  <div className="dst-item__plan">
                    {record.plan_badge && (
                      <span className="dst-item__badge">{record.plan_badge}</span>
                    )}
                    <span className="dst-item__plan-name">
                      {record.plan_name ?? record.plan_slug}
                    </span>
                  </div>
                  <span className={`dst-status ${statusCfg.className}`}>
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                </div>

                {/* Row 2: date · cycle · amount */}
                <div className="dst-item__meta">
                  <span className="dst-item__date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {fmt(record.started_at ?? record.created_at)}
                  </span>
                  <span className="dst-item__cycle">
                    {record.billing_cycle === "yearly" ? "Yearly" : "Monthly"}
                  </span>
                  <span className="dst-item__amount">
                    ₦{(record.amountNaira ?? 0).toLocaleString("en-NG")}
                  </span>
                </div>

                {/* Expanded detail grid */}
                {isExpanded && (
                  <div className="dst-item__details">
                    <div className="dst-detail-grid">
                      <div className="dst-detail">
                        <span className="dst-detail__label">Started</span>
                        <span className="dst-detail__value">
                          {fmtFull(record.started_at)}
                        </span>
                      </div>
                      <div className="dst-detail">
                        <span className="dst-detail__label">Expired / Ends</span>
                        <span className="dst-detail__value">
                          {fmtFull(record.expires_at)}
                        </span>
                      </div>
                      <div className="dst-detail">
                        <span className="dst-detail__label">Billing Cycle</span>
                        <span className="dst-detail__value">
                          {record.billing_cycle
                            ? record.billing_cycle.charAt(0).toUpperCase() +
                              record.billing_cycle.slice(1)
                            : "—"}
                        </span>
                      </div>
                      <div className="dst-detail">
                        <span className="dst-detail__label">Amount Paid</span>
                        <span className="dst-detail__value">
                          ₦{(record.amountNaira ?? 0).toLocaleString("en-NG")}
                        </span>
                      </div>
                      <div className="dst-detail">
                        <span className="dst-detail__label">Auto-Renew</span>
                        <span className={`dst-detail__value ${record.auto_renew ? "dst-detail__value--good" : ""}`}>
                          {record.auto_renew ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="dst-detail">
                        <span className="dst-detail__label">Reference</span>
                        <span className="dst-detail__value dst-detail__value--mono">
                          {record.payment_reference
                            ? record.payment_reference.length > 32
                              ? record.payment_reference.slice(0, 32) + "…"
                              : record.payment_reference
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expand / collapse chevron */}
                <span
                  className={[
                    "dst-item__expand",
                    isExpanded ? "dst-item__expand--open" : "",
                  ].join(" ").trim()}
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DesktopSubscriptionTimeline;