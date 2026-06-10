import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate }  from "react-router-dom";
import axios            from "axios";

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

/* ── Status config ── */
const STATUS_CONFIG = {
  pending:    { icon:"⏳", label:"Pending",     color:"#f59e0b", bg:"rgba(245,158,11,0.1)"  },
  confirmed:  { icon:"✅", label:"Confirmed",    color:"#16a34a", bg:"rgba(22,163,74,0.1)"  },
  processing: { icon:"📦", label:"Processing",   color:"#6366f1", bg:"rgba(99,102,241,0.1)" },
  shipped:    { icon:"🚚", label:"Shipped",       color:"#0891b2", bg:"rgba(8,145,178,0.1)"  },
  delivered:  { icon:"🏠", label:"Delivered",     color:"#16a34a", bg:"rgba(22,163,74,0.1)"  },
  cancelled:  { icon:"❌", label:"Cancelled",     color:"#dc2626", bg:"rgba(220,38,38,0.1)"  },
  refunded:   { icon:"↩️",  label:"Refunded",      color:"#6b7280", bg:"rgba(107,114,128,0.1)"},
};

const PAYMENT_CONFIG = {
  pending:  { icon:"⏳", label:"Unpaid",    color:"#f59e0b" },
  paid:     { icon:"✅", label:"Paid",      color:"#16a34a" },
  failed:   { icon:"❌", label:"Failed",    color:"#dc2626" },
  refunded: { icon:"↩️",  label:"Refunded",  color:"#6b7280" },
};

const FILTER_TABS = [
  { key:"all",       label:"All"        },
  { key:"pending",   label:"Pending"    },
  { key:"confirmed", label:"Confirmed"  },
  { key:"shipped",   label:"Shipped"    },
  { key:"delivered", label:"Delivered"  },
  { key:"cancelled", label:"Cancelled"  },
];

/* ════════════════════════════════════════════════════════════
   ORDER CARD
════════════════════════════════════════════════════════════ */
const OrderCard = memo(function OrderCard({ order }) {
  const navigate  = useNavigate();
  const ref       = order.id.slice(0, 8).toUpperCase();
  const statusCfg = STATUS_CONFIG[order.status]         ?? STATUS_CONFIG.pending;
  const payCfg    = PAYMENT_CONFIG[order.payment_status] ?? PAYMENT_CONFIG.pending;
  const isCOD     = order.payment_method === "CASH_ON_DELIVERY";

  const date = new Date(order.created_at).toLocaleDateString("en-NG", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });

  return (
    <div
      className="oh-card"
      onClick={() => navigate(`/shop/orders/${order.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/shop/orders/${order.id}`)}
      aria-label={`Order ${ref} — ${fmt(order.grand_total)}`}
    >
      {/* Card header */}
      <div className="oh-card-header">
        <div className="oh-card-ref-wrap">
          <span className="oh-card-ref">#{ref}</span>
          <span className="oh-card-date">{date}</span>
        </div>
        <div className="oh-card-badges">
          <span
            className="oh-badge"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            {statusCfg.icon} {statusCfg.label}
          </span>
          <span
            className="oh-badge oh-badge--pay"
            style={{ color: payCfg.color }}
          >
            {payCfg.icon} {payCfg.label}
          </span>
        </div>
      </div>

      {/* Items preview */}
      <div className="oh-card-body">
        <div className="oh-items-count">
          <span>📦</span>
          <span>
            {order.order_count} seller order{order.order_count !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Location */}
        {order.city && (
          <div className="oh-card-location">
            <span>📍</span>
            <span>{order.city}, {order.state}</span>
          </div>
        )}

        {/* Payment method */}
        <div className="oh-card-method">
          <span>{isCOD ? "💵" : "💳"}</span>
          <span>{isCOD ? "Cash on Delivery" : "Online Payment"}</span>
        </div>
      </div>

      {/* Card footer */}
      <div className="oh-card-footer">
        <div className="oh-card-total">
          <span className="oh-total-label">Total</span>
          <span className="oh-total-amt">{fmt(order.grand_total)}</span>
        </div>
        <span className="oh-card-arrow">→</span>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════════════════════ */
function OrderCardSkeleton() {
  return (
    <div className="oh-card oh-card--skeleton">
      <div className="oh-skel oh-skel-header" />
      <div className="oh-skel oh-skel-body"   />
      <div className="oh-skel oh-skel-footer" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   EMPTY STATE
════════════════════════════════════════════════════════════ */
const EmptyOrders = memo(function EmptyOrders({ filter }) {
  const navigate = useNavigate();
  return (
    <div className="oh-empty">
      <div className="oh-empty-icon">
        {filter === "all" ? "🛒" : STATUS_CONFIG[filter]?.icon ?? "📦"}
      </div>
      <h3 className="oh-empty-title">
        {filter === "all"
          ? "No orders yet"
          : `No ${STATUS_CONFIG[filter]?.label ?? filter} orders`}
      </h3>
      <p className="oh-empty-sub">
        {filter === "all"
          ? "Your order history will appear here once you make a purchase."
          : `You don't have any ${STATUS_CONFIG[filter]?.label?.toLowerCase() ?? filter} orders.`}
      </p>
      <button
        className="oh-shop-btn"
        onClick={() => navigate("/minimart")}
      >
        Start Shopping
      </button>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function OrderHistory({ user }) {
  const navigate = useNavigate();

  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("all");

  /* Redirect if not logged in */
  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/orders" } });
  }, [user, navigate]);

  /* Fetch orders */
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    axios
      .get(`${API}/checkout/orders`, { headers: authHeaders() })
      .then(({ data }) => setOrders(data.data ?? []))
      .catch(() => setError("Failed to load orders. Please try again."))
      .finally(() => setLoading(false));
  }, [user]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    axios
      .get(`${API}/checkout/orders`, { headers: authHeaders() })
      .then(({ data }) => setOrders(data.data ?? []))
      .catch(() => setError("Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  /* Filter orders */
  const filtered = filter === "all"
    ? orders
    : orders.filter((o) => o.status === filter);

  /* Count per status for badges */
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  if (!user) return null;

  return (
    <div className="oh-page">

      {/* Topbar */}
      <div className="oh-topbar">
        <button
          className="oh-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>
        <div className="oh-topbar-center">
          <h1 className="oh-topbar-title">My Orders</h1>
          {orders.length > 0 && (
            <span className="oh-topbar-count">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Filter tabs */}
      <div className="oh-filter-wrap">
        <div className="oh-filter-tabs" role="tablist">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === "all"
              ? orders.length
              : counts[tab.key] ?? 0;

            return (
              <button
                key={tab.key}
                className={`oh-filter-tab ${filter === tab.key ? "oh-filter-tab--active" : ""}`}
                onClick={() => setFilter(tab.key)}
                role="tab"
                aria-selected={filter === tab.key}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`oh-tab-count ${filter === tab.key ? "oh-tab-count--active" : ""}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="oh-content">

        {/* Error */}
        {error && (
          <div className="oh-error" role="alert">
            <p>⚠️ {error}</p>
            <button className="oh-retry-btn" onClick={retry}>
              Try Again
            </button>
          </div>
        )}

        {/* Skeletons */}
        {!error && loading && (
          <div className="oh-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!error && !loading && filtered.length === 0 && (
          <EmptyOrders filter={filter} />
        )}

        {/* Order list */}
        {!error && !loading && filtered.length > 0 && (
          <div className="oh-list">
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* Shop FAB */}
      {!loading && orders.length > 0 && (
        <button
          className="oh-fab"
          onClick={() => navigate("/minimart")}
        >
          🛍️ Shop More
        </button>
      )}
    </div>
  );
}