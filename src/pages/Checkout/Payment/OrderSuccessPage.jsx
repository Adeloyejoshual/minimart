/**
 * src/pages/Checkout/Payment/OrderSuccessPage.jsx
 *
 * Post-order success screen.
 *
 * v2 — COD-aware messaging
 * ─────────────────────────────────────────────────
 * ✓ COD: "Order Placed" — never "Payment Successful"
 * ✓ Online: "Payment Confirmed" — clear + accurate
 * ✓ Flat Jumia design matching checkout aesthetic
 * ✓ Transparent SVG icons (no emoji)
 * ✓ Delivery date range from backend
 * ✓ Coupon savings shown if applied
 * ✓ Skeleton loading state
 * ✓ Retry payment link for online orders that failed
 */

import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./styles/OrderSuccessPage.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  CheckCircle: ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle
        className="osp-check__ring"
        cx="26" cy="26" r="24"
        fill="none" stroke="currentColor" strokeWidth="2.5"
      />
      <path
        className="osp-check__tick"
        fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        d="M14.5 27L22 34l16-16"
      />
    </svg>
  ),
  Package: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Pin: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Phone: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Truck: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  Cash: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="12" x2="6.01" y2="12" />
      <line x1="18" y1="12" x2="18.01" y2="12" />
    </svg>
  ),
  Card: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Copy: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Check: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Alert: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Calendar: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   NEXT STEPS (per payment method)
═══════════════════════════════════════════════════════════════ */
const COD_STEPS = [
  { icon: Icon.Check,   text: "Order confirmed" },
  { icon: Icon.Package, text: "Seller prepares your items" },
  { icon: Icon.Truck,   text: "Loemart Express picks up your order" },
  { icon: Icon.Cash,    text: "Pay rider when it arrives" },
];

const ONLINE_STEPS = [
  { icon: Icon.Check,   text: "Payment confirmed" },
  { icon: Icon.Package, text: "Seller prepares your items" },
  { icon: Icon.Truck,   text: "Loemart Express picks up your order" },
  { icon: Icon.Pin,     text: "Delivered to your bus stop" },
];

/* ═══════════════════════════════════════════════════════════════
   LOADING SKELETON
═══════════════════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="osp-wrapper">
      <div className="osp-card">
        <div className="osp-skel osp-skel--icon" />
        <div className="osp-skel osp-skel--title" />
        <div className="osp-skel osp-skel--sub" />
        <div className="osp-skel osp-skel--box" />
        <div className="osp-skel osp-skel--summary" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ERROR STATE
═══════════════════════════════════════════════════════════════ */
function ErrorState({ message }) {
  return (
    <div className="osp-wrapper">
      <div className="osp-card">
        <div className="osp-icon-wrap osp-icon-wrap--error">
          <Icon.Alert />
        </div>
        <h1 className="osp-title">Unable to load order</h1>
        <p className="osp-subtitle">{message}</p>
        <div className="osp-actions">
          <Link to="/shop/orders" className="osp-btn osp-btn--primary">
            View My Orders
          </Link>
          <Link to="/" className="osp-btn osp-btn--secondary">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const navigate    = useNavigate();

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(false);

  /* ── Fetch order ── */
  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    let cancelled = false;

    axios
      .get(`${API}/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        timeout: 15_000,
      })
      .then((res) => {
        if (cancelled) return;
        setOrder(res.data.data ?? res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[OrderSuccess]", err);
        setError(
          err.response?.data?.message ??
          "Could not load order details."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [orderId, navigate]);

  /* ── Derived flags ── */
  const isCOD = order?.payment_method === "CASH_ON_DELIVERY";

  /*
   * For online payments, `payment_status` tells us if it actually
   * went through. If it says "pending" or "failed", the user
   * needs to retry payment even though the order exists.
   */
  const paymentPending = !isCOD && order?.payment_status !== "paid";

  /* ── Tracking ID ── */
  const trackingId = order?.tracking_id ?? order?.id ?? orderId;

  /* ── Copy tracking ID ── */
  const handleCopyTracking = async () => {
    try {
      await navigator.clipboard.writeText(trackingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Fallback for older browsers */
      const el = document.createElement("textarea");
      el.value = trackingId;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
      document.body.removeChild(el);
    }
  };

  /* ── Flatten items across sub-orders ── */
  const flatItems = useMemo(() => {
    if (!order?.orders) return [];
    return order.orders.flatMap((sub) =>
      (sub.items ?? []).map((item) => ({
        ...item,
        seller: sub.seller_name,
      }))
    );
  }, [order]);

  /* ── Loading / error ── */
  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorState message={error} />;

  /* ── Compute title + subtitle ── */
  const { title, subtitle } = getSuccessMessaging({
    isCOD,
    paymentPending,
    trackingId,
  });

  /* ── Choose next steps ── */
  const steps = isCOD ? COD_STEPS : ONLINE_STEPS;

  return (
    <div className="osp-wrapper">
      <div className="osp-card">

        {/* ══ ICON ══ */}
        <div
          className={`osp-icon-wrap ${
            paymentPending
              ? "osp-icon-wrap--pending"
              : "osp-icon-wrap--success"
          }`}
        >
          {paymentPending ? <Icon.Alert size={48} /> : <Icon.CheckCircle />}
        </div>

        {/* ══ HEADING ══ */}
        <h1 className="osp-title">{title}</h1>
        <p className="osp-subtitle">{subtitle}</p>

        {/* ══ TRACKING ID ══ */}
        <div className="osp-ref">
          <div className="osp-ref__body">
            <span className="osp-ref__label">Tracking ID</span>
            <span className="osp-ref__value">{trackingId}</span>
          </div>
          <button
            type="button"
            className={`osp-ref__copy ${copied ? "osp-ref__copy--done" : ""}`}
            onClick={handleCopyTracking}
            aria-label="Copy tracking ID"
          >
            {copied ? (
              <>
                <Icon.Check /> Copied
              </>
            ) : (
              <>
                <Icon.Copy /> Copy
              </>
            )}
          </button>
        </div>

        {/* ══ RETRY PAYMENT (only if online payment pending) ══ */}
        {paymentPending && (
          <div className="osp-retry">
            <p className="osp-retry__msg">
              Your order is saved but payment hasn't been confirmed yet.
            </p>
            <Link
              to={`/shop/orders/${orderId}?retry=true`}
              className="osp-btn osp-btn--primary osp-btn--full"
            >
              Complete Payment
            </Link>
          </div>
        )}

        {/* ══ ORDER SUMMARY ══ */}
        {order && (
          <>
            <div className="osp-section-header">
              <h2 className="osp-section-header__title">Order Summary</h2>
            </div>

            <div className="osp-section-body">
              {/* Items */}
              <div className="osp-items">
                {flatItems.length === 0 ? (
                  <p className="osp-items-empty">No items found.</p>
                ) : (
                  flatItems.map((item) => (
                    <div key={item.id} className="osp-item">
                      <div className="osp-item__img">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.product_name ?? "Product"}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Icon.Package size={22} />
                        )}
                      </div>

                      <div className="osp-item__info">
                        <p className="osp-item__name">
                          {item.product_name ?? "Product"}
                        </p>
                        {item.variant_name && (
                          <p className="osp-item__variant">
                            {item.variant_name}
                          </p>
                        )}
                        <p className="osp-item__qty">
                          Qty {item.quantity} × {fmt(item.price)}
                        </p>
                      </div>

                      <span className="osp-item__price">
                        {fmt(Number(item.price) * Number(item.quantity))}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="osp-totals">
                <div className="osp-total-row">
                  <span>Subtotal</span>
                  <span>{fmt(order.total_amount)}</span>
                </div>

                {Number(order.discount) > 0 && (
                  <div className="osp-total-row osp-total-row--discount">
                    <span>
                      Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}
                    </span>
                    <span>− {fmt(order.discount)}</span>
                  </div>
                )}

                <div className="osp-total-row">
                  <span>Delivery Fee</span>
                  <span>
                    {Number(order.delivery_fee) === 0
                      ? <span className="osp-free-tag">FREE</span>
                      : fmt(order.delivery_fee)
                    }
                  </span>
                </div>

                <div className="osp-total-divider" />

                <div className="osp-total-row osp-total-row--grand">
                  <span>{isCOD ? "Total to Pay on Delivery" : "Total Paid"}</span>
                  <strong>{fmt(order.grand_total)}</strong>
                </div>
              </div>

              {/* Payment method badge */}
              <div
                className={`osp-payment-badge ${
                  isCOD
                    ? "osp-payment-badge--cod"
                    : "osp-payment-badge--online"
                }`}
              >
                {isCOD ? <Icon.Cash /> : <Icon.Card />}
                {isCOD ? "Pay on Delivery" : "Paid Online"}
              </div>
            </div>
          </>
        )}

        {/* ══ DELIVERY ADDRESS ══ */}
        {order && (order.address_line || order.city) && (
          <>
            <div className="osp-section-header">
              <h2 className="osp-section-header__title">Delivering To</h2>
            </div>

            <div className="osp-section-body">
              <p className="osp-addr__name">
                {order.recipient_name}
                {order.phone && (
                  <span className="osp-addr__phone"> · {order.phone}</span>
                )}
              </p>
              <p className="osp-addr__line">{order.address_line}</p>
              {order.landmark && (
                <p className="osp-addr__landmark">
                  <Icon.Pin size={12} /> {order.landmark}
                </p>
              )}
              <p className="osp-addr__location">
                {order.city}, {order.state}
              </p>

              {order.deliveryRange?.label && (
                <div className="osp-eta">
                  <Icon.Calendar />
                  {order.deliveryRange.label}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ WHAT HAPPENS NEXT ══ */}
        <div className="osp-section-header">
          <h2 className="osp-section-header__title">What Happens Next</h2>
        </div>

        <div className="osp-section-body">
          <ol className="osp-steps">
            {steps.map(({ icon: StepIcon, text }, i) => (
              <li key={text} className="osp-step">
                <span className="osp-step__num">{i + 1}</span>
                <span className="osp-step__icon">
                  <StepIcon size={14} />
                </span>
                <span className="osp-step__text">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ══ ACTIONS ══ */}
        <div className="osp-actions">
          <Link
            to={`/shop/orders/${orderId}`}
            className="osp-btn osp-btn--primary"
          >
            Track My Order
          </Link>
          <Link to="/" className="osp-btn osp-btn--secondary">
            Continue Shopping
          </Link>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGING RESOLVER
   ─────────────────────────────────────────────────────────────
   Returns the correct title + subtitle based on:
     • Payment method (COD vs Online)
     • Payment status (pending, paid, failed)
   
   COD orders NEVER say "Payment Successful" — they say
   "Order Placed" because no payment happened.
═══════════════════════════════════════════════════════════════ */
function getSuccessMessaging({ isCOD, paymentPending }) {
  /* Online payment still pending — show payment prompt tone */
  if (paymentPending) {
    return {
      title   : "Order Created",
      subtitle: "Complete your payment to confirm the order.",
    };
  }

  /* Cash on Delivery — no payment happened yet */
  if (isCOD) {
    return {
      title   : "Order Placed",
      subtitle:
        "Your order has been received. " +
        "Have your payment ready for the rider on delivery.",
    };
  }

  /* Online payment confirmed */
  return {
    title   : "Payment Confirmed",
    subtitle: "Thanks for your order. We're preparing it now.",
  };
}