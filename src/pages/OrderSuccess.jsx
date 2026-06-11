import React, { useState, useEffect, memo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";
const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")
  );
}

/* ── Status configs ── */
const ORDER_STATUS = {
  pending:    { icon: "⏳", label: "Pending",     color: "#f59e0b" },
  confirmed:  { icon: "✅", label: "Confirmed",    color: "#16a34a" },
  processing: { icon: "📦", label: "Processing",   color: "#6366f1" },
  shipped:    { icon: "🚚", label: "Shipped",       color: "#0891b2" },
  delivered:  { icon: "🏠", label: "Delivered",     color: "#16a34a" },
  cancelled:  { icon: "❌", label: "Cancelled",     color: "#dc2626" },
};

const PAYMENT_STATUS = {
  pending:  { icon: "⏳", label: "Awaiting Payment", color: "#f59e0b" },
  paid:     { icon: "✅", label: "Payment Confirmed", color: "#16a34a" },
  failed:   { icon: "❌", label: "Payment Failed",    color: "#dc2626" },
  refunded: { icon: "↩️",  label: "Refunded",          color: "#6b7280" },
};

/* ════════════════════════════════════════════════════════════
   COPY BUTTON
════════════════════════════════════════════════════════════ */
const CopyBtn = memo(function CopyBtn({ text, label = "" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      className="os-copy-btn"
      onClick={copy}
      aria-label={`Copy ${label}`}
      title={copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? "✅" : "📋"}
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   TIMELINE
════════════════════════════════════════════════════════════ */
function getTimelineSteps(order) {
  const status    = order.status;
  const payment   = order.payment_status;
  const isCOD     = order.payment_method === "CASH_ON_DELIVERY";

  const statusOrder = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
  ];
  const idx = statusOrder.indexOf(status);

  return [
    {
      icon:  "🛒",
      label: "Order Placed",
      done:  true,
      time:  order.created_at,
    },
    {
      icon:  "💳",
      label: isCOD ? "COD Confirmed" : "Payment Confirmed",
      done:  payment === "paid" || isCOD || idx >= 1,
      time:  null,
    },
    {
      icon:  "📦",
      label: "Seller Preparing",
      done:  idx >= 2,
      time:  null,
    },
    {
      icon:  "🚚",
      label: "Out for Delivery",
      done:  idx >= 3,
      time:  null,
    },
    {
      icon:  "🏠",
      label: "Delivered",
      done:  idx >= 4,
      time:  null,
    },
  ];
}

/* ════════════════════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════════════════════ */
function OrderSuccessSkeleton() {
  return (
    <div className="os-page">
      <div className="os-hero os-hero--loading">
        <div className="os-skel os-skel-circle" />
        <div className="os-skel os-skel-title" />
        <div className="os-skel os-skel-sub"   />
        <div className="os-skel os-skel-track" />
      </div>
      <div className="os-section">
        <div className="os-skel os-skel-block" style={{ height: 80 }} />
      </div>
      <div className="os-section">
        <div className="os-skel os-skel-block" style={{ height: 120 }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function OrderSuccess({ user }) {
  const { orderGroupId } = useParams();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!orderGroupId) return;

    setLoading(true);

    axios
      .get(`${API}/checkout/orders/${orderGroupId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        timeout: 12000,
      })
      .then(({ data }) => setOrder(data.data))
      .catch((err) => {
        setError(err.response?.status === 404 ? "404" : "error");
      })
      .finally(() => setLoading(false));
  }, [orderGroupId]);

  /* ── Loading ── */
  if (loading) return <OrderSuccessSkeleton />;

  /* ── Not found ── */
  if (error === "404" || !order) {
    return (
      <div className="os-not-found">
        <span className="os-nf-icon">📦</span>
        <h2>Order Not Found</h2>
        <p>This order doesn't exist or you don't have access to it.</p>
        <button
          className="os-btn-primary"
          onClick={() => navigate("/shop/orders")}
        >
          View My Orders
        </button>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="os-not-found">
        <span className="os-nf-icon">⚠️</span>
        <h2>Something went wrong</h2>
        <p>Could not load this order. Please try again.</p>
        <button
          className="os-btn-primary"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  const isCOD       = order.payment_method === "CASH_ON_DELIVERY";
  const isPaid      = order.payment_status === "paid";
  const trackingId  = order.tracking_id ?? `ORD-${orderGroupId.slice(0, 8).toUpperCase()}`;
  const timeline    = getTimelineSteps(order);
  const orderStatus = ORDER_STATUS[order.status]          ?? ORDER_STATUS.pending;
  const payStatus   = PAYMENT_STATUS[order.payment_status] ?? PAYMENT_STATUS.pending;

  const orderDate = new Date(order.created_at).toLocaleDateString("en-NG", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  return (
    <div className="os-page">

      {/* ════ HERO ════ */}
      <div className={`os-hero ${
        isCOD     ? "os-hero--cod"     :
        isPaid    ? "os-hero--paid"    :
                    "os-hero--pending"
      }`}>
        <div className="os-hero-icon">
          {isCOD ? "📦" : isPaid ? "🎉" : "⏳"}
        </div>

        <h1 className="os-hero-title">
          {isCOD
            ? "Order Placed!"
            : isPaid
              ? "Payment Confirmed!"
              : "Order Received!"}
        </h1>

        <p className="os-hero-sub">
          {isCOD
            ? `Have ${fmt(order.grand_total)} ready when your order arrives.`
            : isPaid
              ? "Your payment was successful. Sellers are being notified."
              : "We'll confirm your order once payment is verified."}
        </p>

        {/* ── Tracking ID — main feature ── */}
        <div className="os-tracking-card">
          <p className="os-tracking-label">Tracking ID</p>
          <div className="os-tracking-id-row">
            <span className="os-tracking-code">{trackingId}</span>
            <CopyBtn text={trackingId} label="tracking ID" />
          </div>
          <p className="os-tracking-hint">
            Use this ID to track or reference your order
          </p>
        </div>

        {/* Order date */}
        <p className="os-order-date">{orderDate}</p>

        {/* Status chips */}
        <div className="os-hero-chips">
          <span
            className="os-status-chip"
            style={{
              background: orderStatus.color + "25",
              color:      orderStatus.color,
            }}
          >
            {orderStatus.icon} {orderStatus.label}
          </span>
          <span
            className="os-status-chip"
            style={{
              background: payStatus.color + "25",
              color:      payStatus.color,
            }}
          >
            {payStatus.icon} {payStatus.label}
          </span>
        </div>
      </div>

      {/* ════ TIMELINE ════ */}
      <div className="os-section">
        <h3 className="os-section-title">📍 Order Progress</h3>
        <div className="os-timeline">
          {timeline.map((step, i) => (
            <React.Fragment key={i}>
              <div
                className={`os-tl-step ${step.done ? "os-tl-step--done" : ""}`}
              >
                <div className="os-tl-dot">
                  <span>{step.icon}</span>
                </div>
                <span className="os-tl-label">{step.label}</span>
              </div>
              {i < timeline.length - 1 && (
                <div
                  className={`os-tl-line ${step.done ? "os-tl-line--done" : ""}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ════ DELIVERY ADDRESS ════ */}
      {order.address_line && (
        <div className="os-section">
          <h3 className="os-section-title">📍 Delivering to</h3>
          <div className="os-address-card">
            <div className="os-address-icon">🏠</div>
            <div className="os-address-body">
              <p className="os-addr-name">
                {order.recipient_name}
                {order.phone && (
                  <span className="os-addr-phone"> · {order.phone}</span>
                )}
              </p>
              <p className="os-addr-line">{order.address_line}</p>
              {order.landmark && (
                <p className="os-addr-landmark">📍 {order.landmark}</p>
              )}
              {order.additional_directions && (
                <p className="os-addr-directions">
                  ℹ️ {order.additional_directions}
                </p>
              )}
              <p className="os-addr-location">
                {order.city}, {order.state}
              </p>
              {order.call_before_delivery && (
                <div className="os-addr-call-badge">
                  📞 Rider will call before delivery
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ COD REMINDER ════ */}
      {isCOD && (
        <div className="os-cod-banner">
          <span>💵</span>
          <div>
            <strong>Cash on Delivery</strong>
            <p>
              Please have exactly{" "}
              <strong>{fmt(order.grand_total)}</strong> ready
              when your order arrives. Exact change preferred.
            </p>
          </div>
        </div>
      )}

      {/* ════ SELLER ORDERS ════ */}
      {order.orders?.map((sellerOrder, idx) => {
        const sellerStatus = ORDER_STATUS[sellerOrder.status] ?? ORDER_STATUS.pending;

        return (
          <div key={sellerOrder.id} className="os-section">

            {/* Seller header */}
            <div className="os-seller-header">
              <div className="os-seller-avatar">
                {sellerOrder.seller_name?.[0]?.toUpperCase() ?? "S"}
              </div>
              <div className="os-seller-meta">
                <p className="os-seller-name">
                  {sellerOrder.seller_name ?? `Seller ${idx + 1}`}
                </p>
                <span
                  className="os-seller-status-badge"
                  style={{ color: sellerStatus.color }}
                >
                  {sellerStatus.icon} {sellerStatus.label}
                </span>
              </div>
              <p className="os-seller-subtotal">
                {fmt(sellerOrder.subtotal)}
              </p>
            </div>

            {/* Items */}
            <div className="os-items-list">
              {sellerOrder.items?.map((item) => (
                <div key={item.id} className="os-item">
                  <div className="os-item-img">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div className="os-item-info">
                    <p className="os-item-name">{item.name}</p>
                    {item.variant_name && (
                      <p className="os-item-variant">{item.variant_name}</p>
                    )}
                    {item.sku && (
                      <p className="os-item-sku">SKU: {item.sku}</p>
                    )}
                    <p className="os-item-qty">
                      {item.qty} × {fmt(item.unit_price)}
                    </p>
                  </div>
                  <p className="os-item-total">{fmt(item.subtotal)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ════ PRICE SUMMARY ════ */}
      <div className="os-section">
        <h3 className="os-section-title">💰 Payment Summary</h3>
        <div className="os-price-summary">
          <div className="os-price-row">
            <span>Subtotal</span>
            <span>{fmt(order.total_amount)}</span>
          </div>
          {order.discount > 0 && (
            <div className="os-price-row os-price-row--discount">
              <span>
                Discount
                {order.coupon_code ? ` (${order.coupon_code})` : ""}
              </span>
              <span>- {fmt(order.discount)}</span>
            </div>
          )}
          <div className="os-price-row">
            <span>Delivery Fee</span>
            <span>{fmt(order.delivery_fee)}</span>
          </div>
          <div className="os-price-divider" />
          <div className="os-price-row os-price-row--total">
            <span>
              {isCOD ? "Total (Pay on Delivery)" : "Total Paid"}
            </span>
            <span>{fmt(order.grand_total)}</span>
          </div>
          <div className="os-price-row os-price-row--method">
            <span>Payment</span>
            <span>
              {isCOD ? "💵 Cash on Delivery" : "💳 Online Payment"}
            </span>
          </div>
        </div>
      </div>

      {/* ════ WHAT HAPPENS NEXT ════ */}
      <div className="os-section">
        <h3 className="os-section-title">What happens next?</h3>
        <div className="os-next-steps">
          {[
            {
              icon:  "📬",
              title: "Seller Notified",
              desc:  "Sellers receive your order and begin preparation.",
            },
            {
              icon:  "📦",
              title: "Packaging",
              desc:  "Items are carefully packaged for delivery.",
            },
            {
              icon:  "🚚",
              title: "Minimart Pickup & Delivery",
              desc:  "We collect from seller and deliver straight to you.",
            },
            {
              icon:  isCOD ? "💵" : "✅",
              title: isCOD ? "Pay on Arrival" : "Enjoy Your Order!",
              desc:  isCOD
                ? `Have ${fmt(order.grand_total)} ready when we arrive.`
                : "Sit back and relax — your order is on its way.",
            },
          ].map((s) => (
            <div key={s.title} className="os-next-step">
              <div className="os-next-icon">{s.icon}</div>
              <div>
                <p className="os-next-title">{s.title}</p>
                <p className="os-next-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════ TRUST BADGES ════ */}
      <div className="os-trust-row">
        {[
          { icon: "🛡️", text: "Buyer\nProtection"  },
          { icon: "🚚", text: "Tracked\nDelivery"  },
          { icon: "↩️",  text: "Easy\nReturns"      },
          { icon: "📞", text: "24/7\nSupport"       },
        ].map((b) => (
          <div key={b.text} className="os-trust-item">
            <span>{b.icon}</span>
            <span style={{ whiteSpace: "pre-line" }}>{b.text}</span>
          </div>
        ))}
      </div>

      {/* ════ ACTIONS ════ */}
      <div className="os-actions">
        <button
          className="os-btn-primary"
          onClick={() => navigate("/shop/orders")}
        >
          View All Orders
        </button>
        <button
          className="os-btn-secondary"
          onClick={() => navigate("/minimart")}
        >
          Continue Shopping
        </button>
      </div>

    </div>
  );
}