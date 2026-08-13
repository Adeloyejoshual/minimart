/**
 * src/pages/Shop/OrderTracking.jsx
 * Route: /shop/orders/:orderId
 *
 * v2 — Tracking ID support
 * ─────────────────────────────────────────────────────
 * ✓ Accepts both ORD-XXXXXXXX and UUID in URL
 * ✓ Debug logging for API calls in dev
 * ✓ Better error messages for common failures
 * ✓ Retry payment sends tracking_id (not UUID)
 * ✓ Cancel sends tracking_id (not UUID)
 * ✓ All v1 features preserved
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./styles/OrderTracking.css";

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

const REFRESH_INTERVAL_MS = 30_000;

const IS_DEV = import.meta.env.DEV;

/* ═══════════════════════════════════════════════════════════════
   STATUS STEPS
═══════════════════════════════════════════════════════════════ */
const STATUS_STEPS = [
  { key: "pending",    label: "Order Placed",      subtitle: "Waiting for payment confirmation" },
  { key: "confirmed",  label: "Order Confirmed",   subtitle: "Payment received — seller notified" },
  { key: "processing", label: "Preparing",         subtitle: "Seller is packing your items" },
  { key: "shipped",    label: "Out for Delivery",  subtitle: "Loemart Express has your order" },
  { key: "delivered",  label: "Delivered",          subtitle: "Enjoy your order!" },
];

const COD_STATUS_STEPS = [
  { key: "pending",    label: "Order Placed",      subtitle: "Order confirmed — awaiting seller" },
  { key: "confirmed",  label: "Order Accepted",    subtitle: "Seller has accepted your order" },
  { key: "processing", label: "Preparing",         subtitle: "Seller is packing your items" },
  { key: "shipped",    label: "Out for Delivery",  subtitle: "Rider is on the way — pay on arrival" },
  { key: "delivered",  label: "Delivered",          subtitle: "Enjoy your order!" },
];

const ACTIVE_STATUSES     = new Set(["pending", "confirmed", "processing", "shipped"]);
const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  ArrowLeft: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Package: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Check: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Clock: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Truck: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  Pin: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Phone: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Copy: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Share: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Refresh: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Alert: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  X: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  MessageCircle: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  HelpCircle: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  CreditCard: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Cash: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   TIME HELPERS
═══════════════════════════════════════════════════════════════ */
function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ═══════════════════════════════════════════════════════════════
   LOADING SKELETON
═══════════════════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="otp-wrapper">
      <div className="otp-topbar">
        <button className="otp-back" aria-label="Back"><Icon.ArrowLeft /></button>
        <div className="otp-topbar__title-block">
          <div className="otp-skel otp-skel--title" />
          <div className="otp-skel otp-skel--subtitle" />
        </div>
      </div>
      <div className="otp-content">
        <div className="otp-skel otp-skel--card" />
        <div className="otp-skel otp-skel--card" />
        <div className="otp-skel otp-skel--card" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ERROR STATE
═══════════════════════════════════════════════════════════════ */
function ErrorState({ message, debug, onRetry }) {
  return (
    <div className="otp-wrapper">
      <div className="otp-error-state">
        <div className="otp-error-state__icon"><Icon.Alert size={40} /></div>
        <h2 className="otp-error-state__title">Something went wrong</h2>
        <p className="otp-error-state__msg">{message}</p>

        {IS_DEV && debug && (
          <pre className="otp-error-state__debug">
            {JSON.stringify(debug, null, 2)}
          </pre>
        )}

        <div className="otp-error-state__actions">
          <button type="button" onClick={onRetry} className="otp-btn otp-btn--primary">
            <Icon.Refresh /> Try Again
          </button>
          <Link to="/shop/orders" className="otp-btn otp-btn--secondary">
            View All Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS TIMELINE
═══════════════════════════════════════════════════════════════ */
function StatusTimeline({ currentStatus, isCOD, timestamps = {} }) {
  const steps = isCOD ? COD_STATUS_STEPS : STATUS_STEPS;
  const isCancelled = currentStatus === "cancelled";
  const currentIdx = isCancelled ? -1 : steps.findIndex((s) => s.key === currentStatus);

  return (
    <div className="otp-timeline">
      {isCancelled && (
        <div className="otp-timeline__cancelled">
          <Icon.X size={16} /><span>This order was cancelled</span>
        </div>
      )}

      {!isCancelled && steps.map((step, idx) => {
        const isPast    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture  = idx > currentIdx;
        const timestamp = timestamps[step.key];

        return (
          <div key={step.key} className={`otp-step ${isPast ? "otp-step--past" : ""} ${isCurrent ? "otp-step--current" : ""} ${isFuture ? "otp-step--future" : ""}`}>
            <div className="otp-step__marker">
              {isPast ? <Icon.Check size={12} /> : <span className="otp-step__number">{idx + 1}</span>}
            </div>
            {idx < steps.length - 1 && <div className="otp-step__line" />}
            <div className="otp-step__body">
              <div className="otp-step__label">
                {step.label}
                {isCurrent && <span className="otp-step__badge">In progress</span>}
              </div>
              <p className="otp-step__subtitle">{step.subtitle}</p>
              {timestamp && <p className="otp-step__time">{formatDate(timestamp)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORDER ITEMS LIST
═══════════════════════════════════════════════════════════════ */
function OrderItemsList({ orders }) {
  return (
    <div className="otp-items">
      {orders.map((subOrder) => (
        <div key={subOrder.id} className="otp-items__seller-group">
          {subOrder.seller_name && (
            <div className="otp-items__seller">
              <div className="otp-items__seller-dot">
                {subOrder.seller_name[0]?.toUpperCase() ?? "S"}
              </div>
              <span>{subOrder.seller_name}</span>
            </div>
          )}
          {(subOrder.items ?? []).map((item) => (
            <div key={item.id} className="otp-item">
              <div className="otp-item__img">
                {item.image ? (
                  <img src={item.image} alt={item.product_name ?? "Product"}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <Icon.Package size={22} />
                )}
              </div>
              <div className="otp-item__info">
                <p className="otp-item__name">{item.product_name ?? "Product"}</p>
                {item.variant_name && <p className="otp-item__variant">{item.variant_name}</p>}
                <p className="otp-item__qty">Qty {item.quantity} × {fmt(item.price)}</p>
              </div>
              <p className="otp-item__price">{fmt(Number(item.price) * Number(item.quantity))}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate    = useNavigate();

  const [order,          setOrder]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [errorDebug,     setErrorDebug]     = useState(null);
  const [copied,         setCopied]         = useState(false);
  const [cancelling,     setCancelling]     = useState(false);
  const [retrying,       setRetrying]       = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [confirmCancel,  setConfirmCancel]  = useState(false);
  const [toast,          setToast]          = useState(null);

  const pollerRef  = useRef(null);
  const mountedRef = useRef(true);

  /* ══════════════════════════════════════════════════
     FETCH ORDER
     ─────────────────────────────────────────────
     The URL param (orderId) can be:
       • ORD-1F9DFB89   (tracking ID)
       • 1f9dfb89-...   (UUID)
     
     Both are accepted by the backend resolver.
  ══════════════════════════════════════════════════ */
  const fetchOrder = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError(null);
    setErrorDebug(null);

    const url = `${API}/checkout/orders/${encodeURIComponent(orderId)}`;

    if (IS_DEV) {
      console.log("[OrderTracking] Fetching:", url);
    }

    try {
      const { data } = await axios.get(url, {
        headers: authHeader(),
        timeout: 15_000,
      });

      if (!mountedRef.current) return;

      const orderData = data.data ?? data;

      if (IS_DEV) {
        console.log("[OrderTracking] Loaded:", {
          id         : orderData.id,
          tracking_id: orderData.tracking_id,
          status     : orderData.status,
        });
      }

      setOrder(orderData);
    } catch (err) {
      if (!mountedRef.current) return;

      const status  = err.response?.status;
      const message = err.response?.data?.message ?? err.message;

      console.error("[OrderTracking] fetch failed:", {
        url, status, message,
        orderId,
      });

      /*
       * Provide helpful error messages based on the failure type.
       * The most common issue: the URL uses a format the backend
       * doesn't recognize (e.g., LM-20260811-20D81 instead of
       * ORD-20D81F16).
       */
      if (status === 404) {
        setError("Order not found");
        setErrorDebug({
          hint    : "The order ID in the URL may not match any order in your account.",
          urlParam: orderId,
          status,
        });
      } else if (status === 401) {
        setError("Please log in to view this order");
        navigate("/auth", { state: { from: `/shop/orders/${orderId}` } });
        return;
      } else {
        setError(message ?? "Could not load order details.");
        setErrorDebug({ url, status, message });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [orderId, navigate]);

  /* ── Mount + unmount ── */
  useEffect(() => {
    mountedRef.current = true;
    fetchOrder();
    return () => {
      mountedRef.current = false;
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [fetchOrder]);

  /* ── Auto-refresh while active ── */
  useEffect(() => {
    if (!order) return;
    if (pollerRef.current) clearInterval(pollerRef.current);

    if (ACTIVE_STATUSES.has(order.status)) {
      pollerRef.current = setInterval(() => {
        if (mountedRef.current) fetchOrder(true);
      }, REFRESH_INTERVAL_MS);
    }

    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [order?.status, fetchOrder]);

  /* ── Toast ── */
  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => { if (mountedRef.current) setToast(null); }, 3000);
  }, []);

  /* ── Copy tracking ID ── */
  const handleCopyId = useCallback(async () => {
    const id = order?.tracking_id ?? orderId;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      showToast("Tracking ID copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  }, [order, orderId, showToast]);

  /* ── Share ── */
  const handleShare = useCallback(async () => {
    /*
     * Always share the tracking ID URL, not the current URL
     * (which might contain a UUID from an old link).
     */
    const trackId = order?.tracking_id ?? orderId;
    const url   = `${window.location.origin}/shop/orders/${trackId}`;
    const title = `My Loemart Order — ${trackId}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Order link copied!", "success");
      }
    } catch (err) {
      if (err.name !== "AbortError") showToast("Could not share", "error");
    }
  }, [order, orderId, showToast]);

  /* ── Retry payment ── */
  const handleRetryPayment = useCallback(async () => {
    setRetrying(true);

    /*
     * Send the tracking_id from the loaded order (not the URL param)
     * because the backend resolver accepts both formats.
     * Using tracking_id is more reliable.
     */
    const id = order?.tracking_id ?? order?.id ?? orderId;

    try {
      const { data } = await axios.post(
        `${API}/checkout/retry-payment`,
        { orderGroupId: id },
        { headers: authHeader(), timeout: 15_000 }
      );
      const link = data?.data?.paymentLink;
      if (link) {
        window.location.href = link;
      } else {
        throw new Error("No payment link received");
      }
    } catch (err) {
      showToast(
        err.response?.data?.message ?? "Could not generate payment link.",
        "error"
      );
      setRetrying(false);
    }
  }, [order, orderId, showToast]);

  /* ── Cancel order ── */
  const handleCancelOrder = useCallback(async () => {
    setCancelling(true);

    const id = order?.tracking_id ?? order?.id ?? orderId;

    try {
      await axios.post(
        `${API}/checkout/orders/${encodeURIComponent(id)}/cancel`,
        {},
        { headers: authHeader(), timeout: 15_000 }
      );
      showToast("Order cancelled successfully", "success");
      setConfirmCancel(false);
      await fetchOrder();
    } catch (err) {
      showToast(
        err.response?.data?.message ?? "Could not cancel order. Contact support.",
        "error"
      );
    } finally {
      setCancelling(false);
    }
  }, [order, orderId, fetchOrder, showToast]);

  /* ── Derived data ── */
  const isCOD        = order?.payment_method === "CASH_ON_DELIVERY";
  const isPaidPending = !isCOD && order?.payment_status !== "paid";
  const canCancel    = order && CANCELLABLE_STATUSES.has(order.status);

  const timestamps = useMemo(() => {
    if (!order) return {};
    return {
      pending   : order.created_at,
      confirmed : order.confirmed_at,
      processing: order.processing_at,
      shipped   : order.shipped_at,
      delivered : order.delivered_at,
    };
  }, [order]);

  const flatItemCount = useMemo(() => {
    if (!order?.orders) return 0;
    return order.orders.reduce((sum, sub) => sum + (sub.items?.length ?? 0), 0);
  }, [order]);

  /* ── Loading / error / empty ── */
  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorState message={error} debug={errorDebug} onRetry={fetchOrder} />;
  if (!order)  return <ErrorState message="Order not found" onRetry={fetchOrder} />;

  /* Use the DB's tracking_id (authoritative), fall back to URL param */
  const trackingId = order.tracking_id ?? orderId;

  return (
    <div className="otp-wrapper">

      {/* ══ TOP BAR ══ */}
      <div className="otp-topbar">
        <button type="button" className="otp-back"
          onClick={() => navigate("/shop/orders")} aria-label="Back to orders">
          <Icon.ArrowLeft />
        </button>
        <div className="otp-topbar__title-block">
          <h1 className="otp-topbar__title">Track Order</h1>
          <p className="otp-topbar__subtitle">
            {flatItemCount} item{flatItemCount === 1 ? "" : "s"} · {formatDate(order.created_at)}
          </p>
        </div>
        <button type="button" className="otp-refresh"
          onClick={() => fetchOrder(true)} disabled={refreshing} aria-label="Refresh">
          <span className={refreshing ? "otp-refresh--spin" : ""}>
            <Icon.Refresh />
          </span>
        </button>
      </div>

      <div className="otp-content">

        {/* ══ TRACKING ID ══ */}
        <div className="otp-tracking-card">
          <div className="otp-tracking-card__info">
            <p className="otp-tracking-card__label">Tracking ID</p>
            <p className="otp-tracking-card__value">{trackingId}</p>
          </div>
          <div className="otp-tracking-card__actions">
            <button type="button"
              className={`otp-icon-btn ${copied ? "otp-icon-btn--done" : ""}`}
              onClick={handleCopyId} aria-label="Copy tracking ID">
              {copied ? <Icon.Check /> : <Icon.Copy />}
            </button>
            <button type="button" className="otp-icon-btn"
              onClick={handleShare} aria-label="Share order">
              <Icon.Share />
            </button>
          </div>
        </div>

        {/* ══ PAYMENT PENDING BANNER ══ */}
        {isPaidPending && (
          <div className="otp-alert otp-alert--warning">
            <div className="otp-alert__icon"><Icon.Alert /></div>
            <div className="otp-alert__body">
              <p className="otp-alert__title">Payment Pending</p>
              <p className="otp-alert__msg">Complete your payment to activate this order.</p>
            </div>
            <button type="button" className="otp-alert__action"
              onClick={handleRetryPayment} disabled={retrying}>
              {retrying ? "Loading…" : "Pay Now"}
            </button>
          </div>
        )}

        {/* ══ STATUS TIMELINE ══ */}
        <div className="otp-section-header">
          <h2 className="otp-section-header__title">Order Status</h2>
          {ACTIVE_STATUSES.has(order.status) && (
            <span className="otp-section-header__badge">
              <span className="otp-live-dot" /> Live
            </span>
          )}
        </div>
        <div className="otp-section-body">
          <StatusTimeline currentStatus={order.status} isCOD={isCOD} timestamps={timestamps} />
        </div>

        {/* ══ DELIVERY DETAILS ══ */}
        {(order.address_line || order.city) && (
          <>
            <div className="otp-section-header">
              <h2 className="otp-section-header__title">Delivery Details</h2>
            </div>
            <div className="otp-section-body">
              <div className="otp-delivery">
                <div className="otp-delivery__icon"><Icon.Truck /></div>
                <div className="otp-delivery__body">
                  <p className="otp-delivery__title">Loemart Express</p>
                  <p className="otp-delivery__sub">Delivered to your bus stop</p>
                </div>
              </div>
              <div className="otp-address">
                <p className="otp-address__name">
                  {order.recipient_name}
                  {order.phone && <span className="otp-address__phone"> · {order.phone}</span>}
                </p>
                <p className="otp-address__line">{order.address_line}</p>
                {order.landmark && (
                  <p className="otp-address__landmark"><Icon.Pin /> {order.landmark}</p>
                )}
                <p className="otp-address__city">{order.city}, {order.state}</p>
                {order.call_before_delivery && (
                  <p className="otp-address__call"><Icon.Phone /> Rider will call first</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══ ITEMS ══ */}
        <div className="otp-section-header">
          <h2 className="otp-section-header__title">Items ({flatItemCount})</h2>
        </div>
        <div className="otp-section-body">
          <OrderItemsList orders={order.orders ?? []} />
        </div>

        {/* ══ PAYMENT SUMMARY ══ */}
        <div className="otp-section-header">
          <h2 className="otp-section-header__title">Payment Summary</h2>
        </div>
        <div className="otp-section-body">
          <div className="otp-price-row">
            <span>Subtotal</span><span>{fmt(order.total_amount)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="otp-price-row otp-price-row--discount">
              <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span>− {fmt(order.discount)}</span>
            </div>
          )}
          <div className="otp-price-row">
            <span>Delivery Fee</span>
            <span>
              {Number(order.delivery_fee) === 0
                ? <span className="otp-free-tag">FREE</span>
                : fmt(order.delivery_fee)}
            </span>
          </div>
          <div className="otp-price-divider" />
          <div className="otp-price-row otp-price-row--total">
            <span>{isCOD ? "Total (Pay on Delivery)" : "Total Paid"}</span>
            <strong>{fmt(order.grand_total)}</strong>
          </div>
          <div className="otp-payment-badge">
            {isCOD ? <Icon.Cash /> : <Icon.CreditCard />}
            {isCOD ? "Cash on Delivery" : "Paid Online"}
          </div>
        </div>

        {/* ══ ACTIONS ══ */}
        <div className="otp-actions-section">
          <h2 className="otp-actions-section__title">Need Help?</h2>
          <div className="otp-action-buttons">
            <a href={`/support?orderId=${trackingId}`} className="otp-action-btn">
              <Icon.HelpCircle /><span>Contact Support</span>
            </a>
            {order.orders?.[0]?.seller_id && (
              <Link to={`/messages?sellerId=${order.orders[0].seller_id}&orderId=${trackingId}`}
                className="otp-action-btn">
                <Icon.MessageCircle /><span>Message Seller</span>
              </Link>
            )}
            {canCancel && (
              <button type="button" className="otp-action-btn otp-action-btn--danger"
                onClick={() => setConfirmCancel(true)}>
                <Icon.X /><span>Cancel Order</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ══ CANCEL MODAL ══ */}
      {confirmCancel && (
        <div className="otp-modal-overlay"
          onClick={() => !cancelling && setConfirmCancel(false)}
          role="dialog" aria-modal="true">
          <div className="otp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="otp-modal__icon"><Icon.Alert size={24} /></div>
            <h3 className="otp-modal__title">Cancel this order?</h3>
            <p className="otp-modal__msg">
              This action cannot be undone. If you've already been charged,
              a refund will be processed within 3–5 business days.
            </p>
            <div className="otp-modal__actions">
              <button type="button" className="otp-btn otp-btn--secondary"
                onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                Keep Order
              </button>
              <button type="button" className="otp-btn otp-btn--danger"
                onClick={handleCancelOrder} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div className={`otp-toast otp-toast--${toast.type}`} role="status" aria-live="polite">
          {toast.type === "success" && <Icon.Check size={16} />}
          {toast.type === "error" && <Icon.Alert size={16} />}
          {toast.msg}
        </div>
      )}

    </div>
  );
}