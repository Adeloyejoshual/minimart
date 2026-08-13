/**
 * src/pages/Shop/MyOrders.jsx
 * Route: /shop/orders
 *
 * Order history page.
 *
 * v2 — Retry payment + loading states
 * ─────────────────────────────────────────────────────
 * ✓ Tight 22-24px line spacing (Jumia density)
 * ✓ Status filter tabs with counts
 * ✓ Order cards with tracking ID, items, status, total
 * ✓ Complete Payment button with loading + inline error
 * ✓ Track navigates to /shop/orders/ORD-XXXX
 * ✓ Auto-refresh on tab focus
 * ✓ Refresh button
 * ✓ Empty state per filter
 * ✓ Loading skeleton
 * ✓ Auth redirect if 401
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./styles/MyOrders.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const authHeader = () => ({
  Authorization: `Bearer ${getToken()}`,
});

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* ═══════════════════════════════════════════════════════════════
   STATUS CONFIG
═══════════════════════════════════════════════════════════════ */
const STATUS_CONFIG = {
  pending   : { label: "Pending",    color: "#F59E0B", bg: "#FEF3C7" },
  confirmed : { label: "Confirmed",  color: "#2563EB", bg: "#EFF6FF" },
  processing: { label: "Processing", color: "#7C3AED", bg: "#F5F3FF" },
  shipped   : { label: "Shipped",    color: "#0891B2", bg: "#ECFEFF" },
  delivered : { label: "Delivered",  color: "#16A34A", bg: "#ECFDF5" },
  cancelled : { label: "Cancelled",  color: "#DC2626", bg: "#FEF2F2" },
};

const PAYMENT_STATUS = {
  paid   : { label: "Paid",   color: "#16A34A" },
  pending: { label: "Unpaid", color: "#F59E0B" },
  failed : { label: "Failed", color: "#DC2626" },
};

const FILTER_TABS = [
  { key: "all",        label: "All" },
  { key: "pending",    label: "Pending" },
  { key: "confirmed",  label: "Confirmed" },
  { key: "shipped",    label: "Shipped" },
  { key: "delivered",  label: "Delivered" },
  { key: "cancelled",  label: "Cancelled" },
];

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  ArrowLeft: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Package: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Refresh: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  ChevronRight: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Alert: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Pin: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  CreditCard: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Cash: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  ShoppingBag: ({ size = 32 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   DATE HELPER
═══════════════════════════════════════════════════════════════ */
function formatShortDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function OrderSkeleton() {
  return (
    <div className="mo-skel-card">
      <div className="mo-skel mo-skel--w60" />
      <div className="mo-skel mo-skel--w80" />
      <div className="mo-skel mo-skel--w40" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════════ */
function EmptyState({ filter }) {
  const isFiltered = filter !== "all";

  return (
    <div className="mo-empty">
      <span className="mo-empty__icon"><Icon.ShoppingBag /></span>
      <p className="mo-empty__title">
        {isFiltered ? `No ${filter} orders` : "No orders yet"}
      </p>
      <p className="mo-empty__sub">
        {isFiltered
          ? "Try a different filter or check back later."
          : "When you place an order, it will appear here."}
      </p>
      {!isFiltered && (
        <Link to="/" className="mo-btn mo-btn--primary">
          Start Shopping
        </Link>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORDER CARD
═══════════════════════════════════════════════════════════════ */
function OrderCard({ order, onRetryPayment, retryingId, retryError }) {
  const navigate = useNavigate();

  const statusCfg  = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const paymentCfg = PAYMENT_STATUS[order.payment_status] ?? PAYMENT_STATUS.pending;

  const isCOD         = order.payment_method === "CASH_ON_DELIVERY";
  const isPaidPending = !isCOD && order.payment_status !== "paid";
  const trackingId    = order.tracking_id ?? order.id;
  const isRetrying    = retryingId === trackingId;
  const hasRetryError = retryError?.trackingId === trackingId;

  const handleTrack = () => {
    navigate(`/shop/orders/${trackingId}`);
  };

  return (
    <div
      className="mo-card"
      onClick={handleTrack}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleTrack(); }}
    >
      {/* Row 1: Date + Status */}
      <div className="mo-card__top">
        <span className="mo-card__date">{formatShortDate(order.created_at)}</span>
        <div className="mo-card__badges">
          <span
            className="mo-card__status"
            style={{ color: statusCfg.color, background: statusCfg.bg }}
          >
            {statusCfg.label}
          </span>
          <span className="mo-card__payment" style={{ color: paymentCfg.color }}>
            {paymentCfg.label}
          </span>
        </div>
      </div>

      {/* Row 2: Tracking ID */}
      <div className="mo-card__tracking">
        <span className="mo-card__tracking-id">{trackingId}</span>
      </div>

      {/* Row 3: Details */}
      <div className="mo-card__details">
        <div className="mo-card__detail">
          <Icon.Package size={12} />
          <span>{order.order_count} seller{order.order_count === 1 ? "" : "s"}</span>
        </div>
        {(order.city || order.state) && (
          <div className="mo-card__detail">
            <Icon.Pin />
            <span>{[order.city, order.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        <div className="mo-card__detail">
          {isCOD ? <Icon.Cash /> : <Icon.CreditCard />}
          <span>{isCOD ? "Cash on Delivery" : "Online Payment"}</span>
        </div>
      </div>

      {/* Row 4: Total + Track */}
      <div className="mo-card__bottom">
        <div className="mo-card__total">
          <span className="mo-card__total-label">Total</span>
          <span className="mo-card__total-value">{fmt(order.grand_total)}</span>
        </div>
        <div className="mo-card__track">
          <span>Track</span>
          <Icon.ChevronRight />
        </div>
      </div>

      {/* Payment incomplete banner */}
      {isPaidPending && (
        <div
          className="mo-card__unpaid"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mo-card__unpaid-text">
            <Icon.Alert size={12} /> Payment incomplete
          </span>
          <button
            type="button"
            className={`mo-card__unpaid-btn ${isRetrying ? "mo-card__unpaid-btn--loading" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isRetrying) onRetryPayment(trackingId);
            }}
            disabled={isRetrying}
          >
            {isRetrying ? "Loading…" : "Complete Payment"}
          </button>
        </div>
      )}

      {/* Retry error */}
      {hasRetryError && (
        <div
          className="mo-card__retry-error"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon.Alert size={12} />
          <span>{retryError.message}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MyOrders() {
  const navigate = useNavigate();

  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [retryError, setRetryError] = useState(null);

  const mountedRef = useRef(true);

  /* ── Fetch orders ── */
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const { data } = await axios.get(`${API}/checkout/orders`, {
        headers: authHeader(),
        timeout: 15_000,
      });

      if (!mountedRef.current) return;
      setOrders(data.data ?? []);
    } catch (err) {
      if (!mountedRef.current) return;

      if (err.response?.status === 401) {
        navigate("/auth", { state: { from: "/shop/orders" } });
        return;
      }

      setError(err.response?.data?.message ?? "Could not load your orders.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [navigate]);

  /* ── Mount + visibility refresh ── */
  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();

    const onVisible = () => {
      if (document.visibilityState === "visible" && mountedRef.current) {
        fetchOrders(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchOrders]);

  /* ── Retry payment ── */
  const handleRetryPayment = useCallback(async (trackingId) => {
    setRetryingId(trackingId);
    setRetryError(null);

    try {
      const { data } = await axios.post(
        `${API}/checkout/retry-payment`,
        { orderGroupId: trackingId },
        { headers: authHeader(), timeout: 15_000 }
      );

      const link = data?.data?.paymentLink;

      if (link) {
        /*
         * Redirect to Flutterwave payment page.
         * Don't clear retryingId — user is leaving the page.
         * When they return (success or failure), the page
         * refreshes and shows updated status.
         */
        window.location.href = link;
      } else {
        throw new Error("No payment link received");
      }
    } catch (err) {
      const message =
        err.response?.data?.message ??
        err.message ??
        "Could not generate payment link. Please try again.";

      setRetryError({ trackingId, message });
      setRetryingId(null);
    }
  }, []);

  /* ── Filtered orders ── */
  const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  /* ── Tab counts ── */
  const tabCounts = useMemo(() => {
    const counts = { all: orders.length };
    for (const tab of FILTER_TABS) {
      if (tab.key !== "all") {
        counts[tab.key] = orders.filter((o) => o.status === tab.key).length;
      }
    }
    return counts;
  }, [orders]);

  return (
    <div className="mo-wrapper">

      {/* ══ TOP BAR ══ */}
      <div className="mo-topbar">
        <button
          type="button"
          className="mo-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <Icon.ArrowLeft />
        </button>
        <div className="mo-topbar__info">
          <h1 className="mo-topbar__title">My Orders</h1>
          {!loading && orders.length > 0 && (
            <p className="mo-topbar__sub">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <button
          type="button"
          className="mo-refresh"
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <span className={refreshing ? "mo-refresh--spin" : ""}>
            <Icon.Refresh />
          </span>
        </button>
      </div>

      {/* ══ FILTER TABS ══ */}
      {!loading && orders.length > 0 && (
        <div className="mo-tabs" role="tablist">
          {FILTER_TABS.map((tab) => {
            const count  = tabCounts[tab.key] ?? 0;
            const active = filter === tab.key;

            /* Hide empty tabs except "all" */
            if (tab.key !== "all" && count === 0) return null;

            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                className={`mo-tab ${active ? "mo-tab--active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span className="mo-tab__count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ══ ERROR ══ */}
      {error && (
        <div className="mo-error">
          <Icon.Alert />
          <span>{error}</span>
          <button type="button" onClick={() => fetchOrders()}>
            Retry
          </button>
        </div>
      )}

      {/* ══ CONTENT ══ */}
      <div className="mo-content">
        {loading ? (
          <>
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
          </>
        ) : filteredOrders.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onRetryPayment={handleRetryPayment}
              retryingId={retryingId}
              retryError={retryError}
            />
          ))
        )}
      </div>

    </div>
  );
}