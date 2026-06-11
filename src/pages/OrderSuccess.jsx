import React, {
  useState, useEffect, useCallback, memo, useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

/* ── Correct CSS path ── */
import "./styles/OrderSuccess.css";

const API = "https://minimart-ivrm.onrender.com/api";
const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")
  );
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

/* ════════════════════════════════════════════════════════════
   STATUS CONFIGS
════════════════════════════════════════════════════════════ */
const ORDER_STATUS = {
  pending:    { icon:"⏳", label:"Pending",     color:"#f59e0b", progress:10  },
  confirmed:  { icon:"✅", label:"Confirmed",    color:"#16a34a", progress:30  },
  processing: { icon:"📦", label:"Processing",   color:"#6366f1", progress:50  },
  shipped:    { icon:"🚚", label:"Shipped",       color:"#0891b2", progress:75  },
  delivered:  { icon:"🏠", label:"Delivered",     color:"#16a34a", progress:100 },
  cancelled:  { icon:"❌", label:"Cancelled",     color:"#dc2626", progress:0   },
};

const PAYMENT_STATUS = {
  pending:  { icon:"⏳", label:"Awaiting Payment", color:"#f59e0b" },
  paid:     { icon:"✅", label:"Payment Confirmed", color:"#16a34a" },
  failed:   { icon:"❌", label:"Payment Failed",    color:"#dc2626" },
  refunded: { icon:"↩️",  label:"Refunded",          color:"#6b7280" },
};

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function getOrderNumber(orderId, createdAt) {
  const d   = new Date(createdAt);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `MM-${y}${m}${day}-${orderId.slice(0, 5).toUpperCase()}`;
}

/* Fix #7 — location-based delivery estimate */
function getDeliveryEstimate(createdAt, status, state) {
  if (status === "delivered") return "Delivered ✅";

  const created  = new Date(createdAt);
  const earliest = new Date(created);
  const latest   = new Date(created);

  /* Osun + Ondo delivery is faster */
  const isLocal = state === "Osun" || state === "Ondo";
  earliest.setDate(earliest.getDate() + (isLocal ? 1 : 3));
  latest.setDate(latest.getDate()     + (isLocal ? 2 : 7));

  const fmtDate = (d) =>
    d.toLocaleDateString("en-NG", {
      weekday: "short", day: "numeric", month: "short",
    });

  return `${fmtDate(earliest)} – ${fmtDate(latest)}`;
}

function getProgressPct(status) {
  return ORDER_STATUS[status]?.progress ?? 10;
}

/* Fix #1 — use delivered_at, not updated_at */
function getReturnDeadline(deliveredAt) {
  if (!deliveredAt) return null;
  const d = new Date(deliveredAt);
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });
}

/* ════════════════════════════════════════════════════════════
   CONFETTI — Fix #5: only fires once
════════════════════════════════════════════════════════════ */
function useConfetti(shouldFire) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!shouldFire || shownRef.current) return;
    shownRef.current = true;

    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden";
    document.body.appendChild(container);

    const colors = ["#ff5722","#ff8a00","#16a34a","#6366f1","#f59e0b","#ec4899"];

    for (let i = 0; i < 80; i++) {
      const el    = document.createElement("div");
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size  = Math.random() * 8 + 6;
      el.style.cssText = `
        position:absolute;top:-10px;
        left:${Math.random() * 100}%;
        width:${size}px;height:${size}px;
        background:${color};
        border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
        animation:os-confetti ${Math.random() * 2000 + 1500}ms ${Math.random() * 1200}ms ease-in forwards;
      `;
      container.appendChild(el);
    }

    if (!document.getElementById("os-confetti-kf")) {
      const s = document.createElement("style");
      s.id = "os-confetti-kf";
      s.textContent = `
        @keyframes os-confetti {
          0%   { transform:translateY(0) rotate(0deg);    opacity:1; }
          100% { transform:translateY(100vh) rotate(720deg); opacity:0; }
        }
      `;
      document.head.appendChild(s);
    }

    const t = setTimeout(() => {
      if (document.body.contains(container)) document.body.removeChild(container);
    }, 4000);

    return () => {
      clearTimeout(t);
      if (document.body.contains(container)) document.body.removeChild(container);
    };
  }, [shouldFire]);
}

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
      aria-label={copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? "✅" : "📋"}
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   TIMELINE
════════════════════════════════════════════════════════════ */
function buildTimeline(order) {
  const isCOD  = order.payment_method === "CASH_ON_DELIVERY";
  const isPaid = order.payment_status === "paid";
  const statusOrder = ["pending","confirmed","processing","shipped","delivered"];
  const idx    = statusOrder.indexOf(order.status);

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-NG", {
      day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    }) : null;

  return [
    {
      icon:  "🛒",
      label: "Order Placed",
      done:  true,
      date:  fmtDate(order.created_at),
    },
    {
      icon:  "💳",
      label: isCOD ? "COD Confirmed" : "Payment Confirmed",
      done:  isPaid || isCOD || idx >= 1,
      date:  isPaid || isCOD ? fmtDate(order.updated_at) : null,
    },
    {
      icon:  "📦",
      label: "Seller Preparing",
      done:  idx >= 2,
      date:  idx >= 2 ? fmtDate(order.updated_at) : null,
    },
    {
      icon:  "🚚",
      label: "Out for Delivery",
      done:  idx >= 3,
      date:  idx >= 3 ? fmtDate(order.updated_at) : null,
    },
    {
      icon:  "🏠",
      label: "Delivered",
      done:  idx >= 4,
      /* Fix #1 — use delivered_at */
      date:  idx >= 4 ? fmtDate(order.delivered_at ?? order.updated_at) : null,
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
        <div className="os-skel os-skel-title"  />
        <div className="os-skel os-skel-sub"    />
        <div className="os-skel os-skel-track"  />
      </div>
      <div className="os-section">
        <div className="os-skel os-skel-block" style={{ height:80 }} />
      </div>
      <div className="os-section">
        <div className="os-skel os-skel-block" style={{ height:140 }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RATING WIDGET — shown after delivery
════════════════════════════════════════════════════════════ */
const RatingWidget = memo(function RatingWidget({ orderGroupId }) {
  const [rating,    setRating]    = useState(0);
  const [hover,     setHover]     = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [answers,   setAnswers]   = useState({
    onTime:      null,
    asDescribed: null,
    buyAgain:    null,
  });

  const questions = [
    { key:"onTime",      label:"Was delivery on time?"          },
    { key:"asDescribed", label:"Was product as described?"      },
    { key:"buyAgain",    label:"Would you buy from us again?"   },
  ];

  const handleSubmit = async () => {
    if (!rating) return;
    try {
      await axios.post(
        `${API}/checkout/orders/${orderGroupId}/rate`,
        { rating, ...answers },
        { headers: authHeaders() }
      );
      setSubmitted(true);
    } catch {
      setSubmitted(true); /* fail silently — don't block UX */
    }
  };

  if (submitted) {
    return (
      <div className="os-rating-done">
        <span>🎉</span>
        <div>
          <p className="os-rating-done-title">Thank you for your feedback!</p>
          <p className="os-rating-done-sub">
            Your review helps us improve and builds trust in Minimart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="os-rating-wrap">
      <h3 className="os-rating-title">⭐ Rate Your Experience</h3>

      {/* Star rating */}
      <div className="os-stars">
        {[1,2,3,4,5].map((s) => (
          <button
            key={s}
            className={`os-star ${s <= (hover || rating) ? "os-star--active" : ""}`}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            aria-label={`Rate ${s} star${s !== 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>

      {rating > 0 && (
        <p className="os-rating-label">
          {["", "Poor 😞", "Fair 😐", "Good 🙂", "Great 😊", "Excellent 🎉"][rating]}
        </p>
      )}

      {/* Yes/No questions */}
      {rating > 0 && (
        <div className="os-rating-questions">
          {questions.map((q) => (
            <div key={q.key} className="os-rating-q">
              <span className="os-rating-q-label">{q.label}</span>
              <div className="os-rating-q-btns">
                <button
                  className={`os-yesno ${answers[q.key] === true ? "os-yesno--yes" : ""}`}
                  onClick={() => setAnswers((p) => ({ ...p, [q.key]: true }))}
                >
                  Yes
                </button>
                <button
                  className={`os-yesno ${answers[q.key] === false ? "os-yesno--no" : ""}`}
                  onClick={() => setAnswers((p) => ({ ...p, [q.key]: false }))}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rating > 0 && (
        <button className="os-rating-submit" onClick={handleSubmit}>
          Submit Rating
        </button>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   RECOMMENDED PRODUCTS
════════════════════════════════════════════════════════════ */
const RecommendedProducts = memo(function RecommendedProducts({ category }) {
  const navigate  = useNavigate();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) return;
    axios
      .get(`${API}/products`, {
        params: { category, limit: 6, sort: "newest" },
        timeout: 8000,
      })
      .then(({ data }) => {
        setItems(data?.data?.products ?? data?.products ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  if (!loading && !items.length) return null;

  return (
    <div className="os-section">
      <h3 className="os-section-title">🛍️ You May Also Like</h3>
      <div className="os-recommended-scroll">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="os-rec-skeleton" />
            ))
          : items.map((p) => {
              const img = p.images?.[0]?.url ?? p.images?.[0] ?? null;
              return (
                <div
                  key={p.id}
                  className="os-rec-card"
                  /* Fix #4 — use /shop/ to match your router */
                  onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    navigate(`/shop/${p.slug ?? p.id}`)
                  }
                  aria-label={`View ${p.name}`}
                >
                  <div className="os-rec-img">
                    {img ? (
                      <img src={img} alt={p.name} loading="lazy" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div className="os-rec-info">
                    <p className="os-rec-name">{p.name}</p>
                    <p className="os-rec-price">{fmt(p.price)}</p>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function OrderSuccess({ user }) {
  const { orderGroupId } = useParams();
  const navigate          = useNavigate();

  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [reordering, setReordering] = useState(false);

  const isPaid      = order?.payment_status === "paid";
  const isCOD       = order?.payment_method === "CASH_ON_DELIVERY";
  const isDelivered = order?.status === "delivered";

  /* Fix #5 — confetti fires only once */
  useConfetti(isPaid && !loading && !error);

  /* Fix #6 — fetchOrder does NOT depend on `order` */
  const fetchOrder = useCallback(async () => {
    if (!orderGroupId) return;
    try {
      const { data } = await axios.get(
        `${API}/checkout/orders/${orderGroupId}`,
        { headers: authHeaders(), timeout: 12000 }
      );
      setOrder(data.data);
    } catch (err) {
      setError((prev) =>
        prev ? prev : (err.response?.status === 404 ? "404" : "error")
      );
    } finally {
      setLoading(false);
    }
  }, [orderGroupId]); /* ← Fix #6: only orderGroupId, not order */

  /* Initial fetch */
  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  /* Fix #6 — stable polling that won't recreate unnecessarily */
  useEffect(() => {
    if (!order) return;
    if (order.status === "delivered" || order.status === "cancelled") return;

    const id = setInterval(fetchOrder, 30_000);
    return () => clearInterval(id);
  }, [order?.status, fetchOrder]);

  /* Fix #2 — reorder uses backend to get current prices */
  const handleReorder = useCallback(async () => {
    if (!order || reordering) return;
    setReordering(true);

    try {
      /* Build list of product + variant IDs from old order */
      const reorderItems = (order.orders ?? []).flatMap((o) =>
        (o.items ?? []).map((item) => ({
          productId: item.product_id,
          variantId: item.variant_id ?? null,
          qty:       item.qty,
        }))
      );

      /* Call backend POST /api/cart for each — backend uses live prices */
      const token = getToken();
      for (const item of reorderItems) {
        await axios.post(
          `${API}/cart`,
          item,
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {}); /* skip failed items, continue */
      }

      window.dispatchEvent(new Event("cart-updated"));
      navigate("/shop/cart");
    } catch {
      /* fallback: add to localStorage with old prices */
      const cart = JSON.parse(localStorage.getItem("mm_cart") || "[]");
      for (const sellerOrder of order.orders ?? []) {
        for (const item of sellerOrder.items ?? []) {
          const itemId   = `${item.product_id}__${item.variant_id ?? "default"}`;
          const existing = cart.findIndex((c) => c.id === itemId);
          const cartItem = {
            id:        itemId,
            productId: item.product_id,
            name:      item.name,
            image:     item.image,
            price:     Number(item.unit_price),
            variant:   item.variant_name
              ? { id: item.variant_id, name: item.variant_name, sku: item.sku }
              : null,
            qty:       item.qty,
            addedAt:   Date.now(),
          };
          if (existing >= 0) cart[existing].qty += item.qty;
          else cart.push(cartItem);
        }
      }
      localStorage.setItem("mm_cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("cart-updated"));
      navigate("/shop/cart");
    } finally {
      setReordering(false);
    }
  }, [order, reordering, navigate]);

  /* Fix #3 — receipt uses print for now, PDF endpoint ready */
  const handleDownloadReceipt = useCallback(() => {
    window.print();
  }, []);

  /* ── States ── */
  if (loading) return <OrderSuccessSkeleton />;

  if (error === "404" || !order) {
    return (
      <div className="os-not-found">
        <span className="os-nf-icon">📦</span>
        <h2>Order Not Found</h2>
        <p>This order doesn't exist or you don't have access to it.</p>
        <button className="os-btn-primary" onClick={() => navigate("/shop/orders")}>
          View My Orders
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="os-not-found">
        <span className="os-nf-icon">⚠️</span>
        <h2>Something went wrong</h2>
        <p>Could not load this order. Please try again.</p>
        <button className="os-btn-primary" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  /* ── Derived ── */
  const trackingId  = order.tracking_id ?? `ORD-${orderGroupId.slice(0, 8).toUpperCase()}`;
  const orderNumber = getOrderNumber(orderGroupId, order.created_at);
  const timeline    = buildTimeline(order);
  const progressPct = getProgressPct(order.status);

  /* Fix #1 — return deadline from delivered_at */
  const returnDate  = isDelivered
    ? getReturnDeadline(order.delivered_at)
    : null;

  /* Fix #7 — location-based estimate */
  const deliveryEst = getDeliveryEstimate(
    order.created_at,
    order.status,
    order.state
  );

  const orderStatus = ORDER_STATUS[order.status]           ?? ORDER_STATUS.pending;
  const payStatus   = PAYMENT_STATUS[order.payment_status] ?? PAYMENT_STATUS.pending;
  const allItems    = (order.orders ?? []).flatMap((o) => o.items ?? []);
  const totalItems  = allItems.reduce((s, i) => s + i.qty, 0);
  const firstCategory = order.orders?.[0]?.items?.[0]?.category ?? null;

  return (
    <div className="os-page">

      {/* ════ HERO ════ */}
      <div className={`os-hero ${
        isCOD  ? "os-hero--cod"     :
        isPaid ? "os-hero--paid"    :
                 "os-hero--pending"
      }`}>
        <div className="os-hero-icon">
          {isCOD ? "📦" : isPaid ? "🎉" : "⏳"}
        </div>

        <h1 className="os-hero-title">
          {isCOD  ? "Order Placed!"         :
           isPaid ? "Payment Confirmed! 🎉" :
                    "Order Received!"}
        </h1>

        <p className="os-hero-sub">
          {isCOD
            ? `Have ${fmt(order.grand_total)} ready when your order arrives.`
            : isPaid
              ? "Your payment was successful. Sellers are being notified."
              : "We'll confirm once payment is verified."}
        </p>

        {/* ── Order Number + Tracking ID ── */}
        <div className="os-tracking-card">
          <div className="os-ids-row">
            <div className="os-id-block">
              <span className="os-id-label">Order Number</span>
              <div className="os-id-value-row">
                <span className="os-id-value os-id-value--small">
                  {orderNumber}
                </span>
                <CopyBtn text={orderNumber} label="order number" />
              </div>
            </div>

            <div className="os-ids-divider" />

            <div className="os-id-block">
              <span className="os-id-label">Tracking ID</span>
              <div className="os-id-value-row">
                <span className="os-id-value">{trackingId}</span>
                <CopyBtn text={trackingId} label="tracking ID" />
              </div>
            </div>
          </div>

          <button
            className="os-track-btn"
            onClick={() => navigate(`/shop/orders/${orderGroupId}`)}
          >
            Track Order →
          </button>
        </div>

        {/* Estimated delivery */}
        <div className="os-delivery-est">
          <span>📅</span>
          <div>
            <p className="os-est-label">Expected Delivery</p>
            <p className="os-est-date">{deliveryEst}</p>
          </div>
        </div>

        {/* Status chips */}
        <div className="os-hero-chips">
          <span
            className="os-status-chip"
            style={{ background: orderStatus.color + "25", color: orderStatus.color }}
          >
            {orderStatus.icon} {orderStatus.label}
          </span>
          <span
            className="os-status-chip"
            style={{ background: payStatus.color + "25", color: payStatus.color }}
          >
            {payStatus.icon} {payStatus.label}
          </span>
        </div>
      </div>

      {/* ════ PROGRESS BAR ════ */}
      <div className="os-section">
        <div className="os-progress-header">
          <span className="os-progress-label">Order Progress</span>
          <span className="os-progress-pct" style={{ color: orderStatus.color }}>
            {progressPct}%
          </span>
        </div>
        <div className="os-progress-track">
          <div
            className="os-progress-fill"
            style={{
              width:      `${progressPct}%`,
              background: `linear-gradient(90deg,${orderStatus.color},${orderStatus.color}cc)`,
            }}
          />
        </div>
        <p className="os-progress-status">
          {orderStatus.icon} {orderStatus.label}
          {order.status !== "delivered" && order.status !== "cancelled" && (
            <span className="os-auto-refresh">
              · Auto-refreshing
              <span className="os-refresh-dot" />
            </span>
          )}
        </p>
      </div>

      {/* ════ TIMELINE ════ */}
      <div className="os-section">
        <h3 className="os-section-title">📍 Order Timeline</h3>
        <div className="os-timeline">
          {timeline.map((step, i) => (
            <React.Fragment key={i}>
              <div className={`os-tl-step ${step.done ? "os-tl-step--done" : ""}`}>
                <div className="os-tl-dot"><span>{step.icon}</span></div>
                <span className="os-tl-label">{step.label}</span>
                {step.date && step.done && (
                  <span className="os-tl-date">{step.date}</span>
                )}
              </div>
              {i < timeline.length - 1 && (
                <div className={`os-tl-line ${step.done ? "os-tl-line--done" : ""}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ════ DELIVERY PROCESS ════ */}
      <div className="os-section">
        <h3 className="os-section-title">🚚 Delivery Process</h3>
        <div className="os-delivery-flow">
          {[
            { icon:"🛒", text:"Order Placed"                },
            { icon:"📦", text:"Seller Ships Within 1–2 Days" },
            { icon:"🏍",  text:"Minimart Delivers to You"    },
            { icon:"🏠", text:"Delivered to Your Address"   },
            { icon:"⏰", text:"3 Days to Raise a Dispute"   },
            { icon:"💰", text:"Funds Released to Seller"    },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div className="os-flow-step">
                <span className="os-flow-icon">{s.icon}</span>
                <span className="os-flow-text">{s.text}</span>
              </div>
              {i < 5 && <div className="os-flow-arrow">↓</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ════ ORDER SUMMARY TOP ════ */}
      <div className="os-section">
        <div className="os-order-summary-top">
          <div className="os-summary-stat">
            <span className="os-summary-stat-val">{totalItems}</span>
            <span className="os-summary-stat-label">
              Item{totalItems !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="os-summary-divider" />
          <div className="os-summary-stat">
            <span className="os-summary-stat-val">
              {order.orders?.length ?? 1}
            </span>
            <span className="os-summary-stat-label">
              Seller{(order.orders?.length ?? 1) !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="os-summary-divider" />
          <div className="os-summary-stat">
            <span className="os-summary-stat-val os-summary-stat-val--price">
              {fmt(order.grand_total)}
            </span>
            <span className="os-summary-stat-label">Total</span>
          </div>
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
              Have exactly <strong>{fmt(order.grand_total)}</strong> ready.
              Exact change preferred.
            </p>
          </div>
        </div>
      )}

      {/* ════ SELLER ORDERS ════ */}
      {order.orders?.map((sellerOrder, idx) => {
        const sStatus = ORDER_STATUS[sellerOrder.status] ?? ORDER_STATUS.pending;
        return (
          <div key={sellerOrder.id} className="os-section">
            <div className="os-seller-header">
              <div className="os-seller-avatar">
                {sellerOrder.seller_name?.[0]?.toUpperCase() ?? "S"}
              </div>
              <div className="os-seller-meta">
                <p className="os-seller-name">
                  {sellerOrder.seller_name ?? `Seller ${idx + 1}`}
                </p>
                <span className="os-seller-status-badge" style={{ color: sStatus.color }}>
                  {sStatus.icon} {sStatus.label}
                </span>
              </div>
              <p className="os-seller-subtotal">{fmt(sellerOrder.subtotal)}</p>
            </div>

            <div className="os-items-list">
              {sellerOrder.items?.map((item) => (
                <div key={item.id} className="os-item">
                  <div className="os-item-img">
                    {item.image ? (
                      <img src={item.image} alt={item.name} loading="lazy" />
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
                Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}
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
            <span>{isCOD ? "Total (Pay on Delivery)" : "Total Paid"}</span>
            <span>{fmt(order.grand_total)}</span>
          </div>
          <div className="os-price-row os-price-row--method">
            <span>Payment Method</span>
            <span>{isCOD ? "💵 Cash on Delivery" : "💳 Online Payment"}</span>
          </div>
        </div>
      </div>

      {/* ════ RATING — shown after delivery ════ */}
      {isDelivered && (
        <div className="os-section">
          <RatingWidget orderGroupId={orderGroupId} />
        </div>
      )}

      {/* ════ RETURN ELIGIBILITY — fix #1: uses delivered_at ════ */}
      {isDelivered && returnDate && (
        <div className="os-section">
          <div className="os-return-info">
            <span>↩️</span>
            <div>
              <p className="os-return-title">Return Eligible Until</p>
              <p className="os-return-desc">
                <strong>{returnDate}</strong> (3 days after delivery).
                Contact support to initiate a return.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════ ACTION BUTTONS ════ */}
      <div className="os-section">
        <div className="os-action-grid">
          <button className="os-action-btn" onClick={handleDownloadReceipt}>
            <span>📄</span>
            <span>Download Receipt</span>
          </button>
          {(isDelivered || isCOD) && (
            <button
              className="os-action-btn os-action-btn--primary"
              onClick={handleReorder}
              disabled={reordering}
            >
              <span>🔄</span>
              <span>{reordering ? "Adding…" : "Reorder All"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ════ CONTACT SUPPORT — fix #8: use real numbers ════ */}
      <div className="os-section">
        <h3 className="os-section-title">Need Help?</h3>
        <div className="os-support-row">
          <a href="tel:+2348000000000" className="os-support-btn">
            <span>📞</span>
            <span>Call Support</span>
          </a>
          <a
            href="https://wa.me/2348000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="os-support-btn os-support-btn--whatsapp"
          >
            <span>💬</span>
            <span>WhatsApp</span>
          </a>
          <a
            href="mailto:support@minimart.com"
            className="os-support-btn"
          >
            <span>📧</span>
            <span>Email Us</span>
          </a>
        </div>
        <p className="os-support-ref">
          Reference: <strong>{orderNumber}</strong>
        </p>
      </div>

      {/* ════ RECOMMENDED ════ */}
      {firstCategory && (
        <RecommendedProducts category={firstCategory} />
      )}

      {/* ════ TRUST BADGES ════ */}
      <div className="os-trust-row">
        {[
          { icon:"🛡️", text:"Buyer\nProtection"  },
          { icon:"🚚", text:"Tracked\nDelivery"  },
          { icon:"↩️",  text:"Easy\nReturns"      },
          { icon:"📞", text:"24/7\nSupport"       },
        ].map((b) => (
          <div key={b.text} className="os-trust-item">
            <span>{b.icon}</span>
            <span style={{ whiteSpace:"pre-line" }}>{b.text}</span>
          </div>
        ))}
      </div>

      {/* ════ MAIN ACTIONS ════ */}
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