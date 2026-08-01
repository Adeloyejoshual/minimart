// src/pages/Profile/components/Payments.jsx
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Link } from "react-router-dom";
import { API, authH } from "./helpers";
import { Ic } from "./icons";
import "./Payments.css";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const STATUS_FILTERS = [
  { key: "all",       label: "All"       },
  { key: "pending",   label: "Pending"   },
  { key: "success",   label: "Successful"},
  { key: "failed",    label: "Failed"    },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired",   label: "Expired"   },
];

const STATUS_META = {
  pending: {
    label: "Processing",
    color: "amber",
    icon : "Clock",
  },
  success: {
    label: "Successful",
    color: "green",
    icon : "CheckCircle",
  },
  failed: {
    label: "Failed",
    color: "red",
    icon : "AlertCircle",
  },
  cancelled: {
    label: "Cancelled",
    color: "gray",
    icon : "X",
  },
  expired: {
    label: "Expired",
    color: "gray",
    icon : "Clock",
  },
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const formatNaira = (amount) => {
  if (amount === 0) return "Free";
  return `₦${Number(amount).toLocaleString("en-NG")}`;
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day   : "numeric",
    month : "short",
    year  : "numeric",
    hour  : "2-digit",
    minute: "2-digit",
  });
};

const formatRelative = (iso) => {
  const now    = Date.now();
  const then   = new Date(iso).getTime();
  const diffMs = now - then;
  const mins   = Math.floor(diffMs / 60_000);
  const hours  = Math.floor(mins / 60);
  const days   = Math.floor(hours / 24);

  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDate(iso).split(",")[0];
};

/* ─────────────────────────────────────────────
   SummaryCards
───────────────────────────────────────────── */
const SummaryCards = memo(({ summary }) => (
  <div className="payments__summary">
    <div className="payments__stat payments__stat--green">
      <div className="payments__stat-value">{summary.success}</div>
      <div className="payments__stat-label">Successful</div>
    </div>
    <div className="payments__stat payments__stat--amber">
      <div className="payments__stat-value">{summary.pending}</div>
      <div className="payments__stat-label">Pending</div>
    </div>
    <div className="payments__stat payments__stat--red">
      <div className="payments__stat-value">
        {summary.failed + summary.cancelled + summary.expired}
      </div>
      <div className="payments__stat-label">Failed</div>
    </div>
    <div className="payments__stat payments__stat--blue">
      <div className="payments__stat-value">{formatNaira(summary.total_paid)}</div>
      <div className="payments__stat-label">Total Paid</div>
    </div>
  </div>
));
SummaryCards.displayName = "SummaryCards";

/* ─────────────────────────────────────────────
   PaymentRow
───────────────────────────────────────────── */
const PaymentRow = memo(({
  payment,
  onVerify,
  onRetry,
  onCopyRef,
  onNavigate,
  verifying,
  retrying,
}) => {
  const meta        = STATUS_META[payment.status] ?? STATUS_META.pending;
  const Icon        = Ic[meta.icon] ?? Ic.Clock;
  const isVerifying = verifying === payment.id;
  const isRetrying  = retrying  === payment.id;

  const showStaleWarning =
    payment.status === "pending" && payment.age_minutes > 30;

  return (
    <div className={`payments__row payments__row--${meta.color}`}>
      {/* Thumbnail */}
      <div className="payments__row-thumb">
        {payment.product?.thumbnail ? (
          <img
            src={payment.product.thumbnail}
            alt={payment.product.title}
            loading="lazy"
          />
        ) : (
          <div className="payments__row-thumb-placeholder">
            <Ic.Package />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="payments__row-main">
        <div className="payments__row-top">
          <h3 className="payments__row-title">
            {payment.product?.title ?? "(Product deleted)"}
          </h3>
          <span className={`payments__badge payments__badge--${meta.color}`}>
            <Icon />
            {meta.label}
          </span>
        </div>

        <div className="payments__row-meta">
          {payment.plan && (
            <span className="payments__meta-item">
              <Ic.Zap />
              {payment.plan.name}
              {payment.plan.duration_days &&
                ` · ${payment.plan.duration_days}d`}
            </span>
          )}
          <span className="payments__meta-item payments__meta-item--amount">
            {formatNaira(payment.amount)}
          </span>
          <span className="payments__meta-item">
            {payment.method === "paystack" ? "💳 Paystack" : "🎁 Free"}
          </span>
        </div>

        <div className="payments__row-time">
          <span title={formatDate(payment.created_at)}>
            {formatRelative(payment.created_at)}
          </span>
          <button
            className="payments__ref-btn"
            onClick={() => onCopyRef(payment.reference)}
            title="Copy reference"
          >
            {Ic.Copy && <Ic.Copy />}
            <code>{payment.reference.slice(0, 16)}…</code>
          </button>
        </div>

        {/* Stale warning */}
        {showStaleWarning && (
          <div className="payments__stale-warning">
            <Ic.AlertCircle />
            <div>
              <strong>Taking longer than usual</strong>
              <p>
                Bank transfers can take up to 24 hours to confirm during
                Paystack network delays. Your money is safe — we'll
                auto-activate your listing as soon as Paystack confirms.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="payments__row-actions">
          {payment.status === "pending" && payment.can_verify && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onVerify(payment)}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <span className="spinner" />
                  Checking…
                </>
              ) : (
                <>
                  <Ic.Refresh />
                  Check Status
                </>
              )}
            </button>
          )}

          {(payment.status === "failed" ||
            payment.status === "cancelled" ||
            payment.status === "expired") &&
            payment.product?.status !== "deleted" && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onRetry(payment)}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <span className="spinner" />
                  Preparing…
                </>
              ) : (
                <>
                  <Ic.Refresh />
                  Retry Payment
                </>
              )}
            </button>
          )}

          {payment.status === "success" && payment.product && (
            <Link
              to={`/product/${payment.product.id}`}
              className="btn btn--ghost btn--sm"
            >
              {Ic.ExternalLink && <Ic.ExternalLink />}
              View Listing
            </Link>
          )}

          {payment.product?.id && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => onNavigate?.(payment.product.id)}
            >
              Manage Listing
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
PaymentRow.displayName = "PaymentRow";

/* ─────────────────────────────────────────────
   Payments — Main Component
───────────────────────────────────────────── */
export default function Payments({
  onNavigate,
  onSetSection,
  showToast,
}) {
  const [payments,    setPayments]    = useState([]);
  const [summary,     setSummary]     = useState({
    pending: 0, success: 0, failed: 0, cancelled: 0, expired: 0,
    total: 0, total_paid: 0,
  });
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [nextCursor,  setNextCursor]  = useState(null);
  const [filter,      setFilter]      = useState("all");
  const [verifying,   setVerifying]   = useState(null);
  const [retrying,    setRetrying]    = useState(null);

  const abortRef = useRef(null);

  /* ── fetch ── */
  const fetchPayments = useCallback(
    async (filterKey = "all", cursor = null, silent = false) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      if (silent)      setRefreshing(true);
      else if (cursor) setLoadingMore(true);
      else             setLoading(true);

      try {
        const params = new URLSearchParams({ limit: 20 });
        if (filterKey !== "all") params.set("status", filterKey);
        if (cursor)              params.set("cursor", cursor);

        const res = await fetch(`${API}/payment/history?${params}`, {
          headers: authH(),
          signal : abortRef.current.signal,
        });
        const d = await res.json();

        if (!res.ok) {
          showToast?.(d.message || `Error ${res.status}`, "error");
          return;
        }

        setPayments((prev) =>
          cursor ? [...prev, ...(d.payments ?? [])] : (d.payments ?? [])
        );
        setSummary(d.summary ?? summary);
        setHasMore(!!d.has_more);
        setNextCursor(d.next_cursor ?? null);
      } catch (err) {
        if (err.name !== "AbortError") {
          showToast?.("Failed to load payments.", "error");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [showToast, summary]
  );

  useEffect(() => {
    fetchPayments("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── auto-refresh pending every 30s ── */
  useEffect(() => {
    const hasPending = payments.some((p) => p.status === "pending");
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchPayments(filter, null, true);
    }, 30_000);

    return () => clearInterval(interval);
  }, [payments, filter, fetchPayments]);

  /* ── handlers ── */
  const handleFilterChange = useCallback(
    (key) => {
      setFilter(key);
      setNextCursor(null);
      fetchPayments(key);
    },
    [fetchPayments]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    fetchPayments(filter, nextCursor);
  }, [hasMore, loadingMore, nextCursor, filter, fetchPayments]);

  const handleVerify = useCallback(
    async (payment) => {
      if (!payment.product?.id) {
        showToast?.("This payment has no associated listing.", "error");
        return;
      }

      setVerifying(payment.id);

      try {
        const res = await fetch(`${API}/payment/verify-by-product`, {
          method : "POST",
          headers: authH(),
          body   : JSON.stringify({ product_id: payment.product.id }),
        });

        const d = await res.json();

        if (!res.ok) {
          if (res.status === 404) {
            showToast?.("Payment record not found.", "warning");
          } else if (res.status === 502) {
            showToast?.("Payment provider unreachable. Try again shortly.", "error");
          } else {
            showToast?.(d.message || `Error ${res.status}`, "error");
          }
          return;
        }

        if (d.success && d.status === "success") {
          showToast?.("🎉 Payment confirmed! Listing is live.", "success");
          fetchPayments(filter, null, true);
        } else if (d.status === "pending") {
          showToast?.(
            payment.age_minutes > 30
              ? "⏳ Still pending. Bank transfers can take up to 24h to confirm."
              : "⏳ Still processing. Please wait a few minutes.",
            "info",
            6000
          );
        } else if (d.status === "failed") {
          showToast?.("Payment failed. You can retry.", "error");
          fetchPayments(filter, null, true);
        } else if (d.status === "cancelled") {
          showToast?.("Payment was cancelled.", "warning");
          fetchPayments(filter, null, true);
        } else {
          showToast?.(d.message || "Unable to verify.", "warning");
        }
      } catch (err) {
        showToast?.(
          err.message ? `Network error: ${err.message}` : "Network error.",
          "error"
        );
      } finally {
        setVerifying(null);
      }
    },
    [fetchPayments, filter, showToast]
  );

  const handleRetry = useCallback(
    async (payment) => {
      if (!payment.product?.id) {
        showToast?.("This payment's listing was deleted.", "error");
        return;
      }

      setRetrying(payment.id);

      try {
        const res = await fetch(`${API}/payment/retry/${payment.id}`, {
          method : "POST",
          headers: authH(),
        });
        const d = await res.json();

        if (!res.ok) {
          showToast?.(d.message || `Error ${res.status}`, "error");
          return;
        }

        if (d.authorization_url) {
          window.location.href = d.authorization_url;
        } else if (d.is_free) {
          showToast?.("Listing activated! 🚀", "success");
          fetchPayments(filter, null, true);
        } else {
          showToast?.(d.message || "Could not restart payment.", "error");
        }
      } catch (err) {
        showToast?.(
          err.message ? `Network error: ${err.message}` : "Network error.",
          "error"
        );
      } finally {
        setRetrying(null);
      }
    },
    [fetchPayments, filter, showToast]
  );

  const handleCopyRef = useCallback(
    (ref) => {
      navigator.clipboard?.writeText(ref)
        .then(() => showToast?.("Reference copied", "success", 2000))
        .catch(() => showToast?.("Could not copy", "error"));
    },
    [showToast]
  );

  const handleNavigateToListing = useCallback(
    (productId) => {
      // Switch to products section and highlight this listing
      onSetSection?.("products");
      // Optionally scroll to product after section switch
      setTimeout(() => {
        const el = document.getElementById(`product-${productId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    },
    [onSetSection]
  );

  const filterCounts = {
    all      : summary.total,
    pending  : summary.pending,
    success  : summary.success,
    failed   : summary.failed,
    cancelled: summary.cancelled,
    expired  : summary.expired,
  };

  return (
    <div className="payments">
      <div className="payments__card">

        {/* Header */}
        <div className="payments__header">
          <div className="payments__header-left">
            <h2 className="payments__title">Payment History</h2>
            <p className="payments__subtitle">
              Track all your promotion payments
            </p>
          </div>
          <button
            className={`payments__refresh${
              refreshing ? " payments__refresh--spinning" : ""
            }`}
            onClick={() => fetchPayments(filter, null, true)}
            aria-label="Refresh"
            disabled={refreshing}
            title="Refresh"
          >
            <Ic.Refresh />
          </button>
        </div>

        {/* Summary */}
        {!loading && <SummaryCards summary={summary} />}

        {/* Filters */}
        <div className="payments__filters" role="tablist">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`payments__filter${
                filter === f.key ? " payments__filter--active" : ""
              }`}
              onClick={() => handleFilterChange(f.key)}
            >
              {f.label}
              {filterCounts[f.key] > 0 && (
                <span className="payments__filter-count">
                  {filterCounts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="payments__loading">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="payments__skeleton" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && payments.length === 0 && (
          <div className="payments__empty">
            <Ic.Package />
            <h3>No payments yet</h3>
            <p>
              {filter === "all"
                ? "Your payment history will appear here after you promote a listing."
                : `No ${filter} payments found.`}
            </p>
            {filter !== "all" ? (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => handleFilterChange("all")}
              >
                Show all
              </button>
            ) : (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => onSetSection?.("products")}
              >
                Go to Listings
              </button>
            )}
          </div>
        )}

        {/* Payments list */}
        {!loading && payments.length > 0 && (
          <div className="payments__list">
            {payments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onVerify={handleVerify}
                onRetry={handleRetry}
                onCopyRef={handleCopyRef}
                onNavigate={handleNavigateToListing}
                verifying={verifying}
                retrying={retrying}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && (
          <div className="payments__load-more">
            <button
              className="btn btn--ghost"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="spinner" />
                  Loading…
                </>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        )}

        {/* Info banner */}
        {!loading && summary.pending > 0 && (
          <div className="payments__info-banner">
            <Ic.AlertCircle />
            <div>
              <strong>Pending payments auto-refresh every 30 seconds</strong>
              <p>
                Bank transfers can take up to 24 hours to be confirmed by
                Paystack. Your listing will go live automatically once
                payment is confirmed.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}