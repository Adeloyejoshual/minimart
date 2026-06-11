import React, {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import "./Checkout/styles/OrderHistory.css";

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

/* ── Order number helper — consistent with OrderSuccess ── */
function getOrderNumber(orderId, createdAt) {
  if (!orderId) return "MM-UNKNOWN";
  const d   = new Date(createdAt ?? Date.now());
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const ref = (orderId?.slice?.(0, 5) ?? "XXXXX").toUpperCase();
  return `MM-${y}${m}${day}-${ref}`;
}

/* ── Delivery estimate — matches OrderSuccess ── */
function getDeliveryEstimate(createdAt, status, state) {
  if (status === "delivered" || status === "cancelled") return null;

  const created  = new Date(createdAt ?? Date.now());
  const earliest = new Date(created);
  const latest   = new Date(created);
  const isLocal  = state === "Osun" || state === "Ondo";

  earliest.setDate(earliest.getDate() + (isLocal ? 1 : 3));
  latest.setDate(latest.getDate()     + (isLocal ? 2 : 7));

  const fmtD = (d) =>
    d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });

  return `${fmtD(earliest)} – ${fmtD(latest)}`;
}

/* ════════════════════════════════════════════════════════════
   STATUS CONFIGS
════════════════════════════════════════════════════════════ */
const STATUS_CONFIG = {
  pending:    { icon:"⏳", label:"Pending",     color:"#f59e0b", bg:"rgba(245,158,11,0.1)"   },
  confirmed:  { icon:"✅", label:"Confirmed",    color:"#16a34a", bg:"rgba(22,163,74,0.1)"   },
  processing: { icon:"📦", label:"Processing",   color:"#6366f1", bg:"rgba(99,102,241,0.1)"  },
  shipped:    { icon:"🚚", label:"Shipped",       color:"#0891b2", bg:"rgba(8,145,178,0.1)"   },
  delivered:  { icon:"🏠", label:"Delivered",     color:"#16a34a", bg:"rgba(22,163,74,0.1)"   },
  cancelled:  { icon:"❌", label:"Cancelled",     color:"#dc2626", bg:"rgba(220,38,38,0.1)"   },
  refunded:   { icon:"↩️",  label:"Refunded",      color:"#6b7280", bg:"rgba(107,114,128,0.1)" },
};

const PAYMENT_CONFIG = {
  pending:  { icon:"⏳", label:"Unpaid",    color:"#f59e0b" },
  paid:     { icon:"✅", label:"Paid",      color:"#16a34a" },
  failed:   { icon:"❌", label:"Failed",    color:"#dc2626" },
  refunded: { icon:"↩️",  label:"Refunded",  color:"#6b7280" },
};

const FILTER_TABS = [
  { key:"all",       label:"All"       },
  { key:"pending",   label:"Pending"   },
  { key:"confirmed", label:"Confirmed" },
  { key:"shipped",   label:"Shipped"   },
  { key:"delivered", label:"Delivered" },
  { key:"cancelled", label:"Cancelled" },
];

const SORT_OPTIONS = [
  { value:"newest",  label:"Newest First"   },
  { value:"oldest",  label:"Oldest First"   },
  { value:"highest", label:"Highest Amount" },
  { value:"lowest",  label:"Lowest Amount"  },
];

/* ════════════════════════════════════════════════════════════
   PRODUCT THUMBNAILS — what they bought
════════════════════════════════════════════════════════════ */
const ProductThumbs = memo(function ProductThumbs({ images = [], max = 4 }) {
  if (!images.length) return null;

  const visible = images.slice(0, max);
  const extra   = images.length - max;

  return (
    <div className="oh-product-thumbs">
      {visible.map((src, i) => (
        <div key={i} className="oh-thumb">
          {src ? (
            <img
              src={src}
              alt={`Product ${i + 1}`}
              loading="lazy"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <span>📦</span>
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="oh-thumb oh-thumb--extra">+{extra}</div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   ORDER CARD
════════════════════════════════════════════════════════════ */
const OrderCard = memo(function OrderCard({ order, onReorder }) {
  const navigate = useNavigate();

  /* Fix potential null crash */
  const orderNumber  = getOrderNumber(order?.id, order?.created_at);
  const trackingId   = order?.tracking_id ?? `ORD-${(order?.id?.slice?.(0, 8) ?? "UNKNOWN").toUpperCase()}`;
  const statusCfg    = STATUS_CONFIG[order?.status]          ?? STATUS_CONFIG.pending;
  const payCfg       = PAYMENT_CONFIG[order?.payment_status]  ?? PAYMENT_CONFIG.pending;
  const isCOD        = order?.payment_method === "CASH_ON_DELIVERY";
  const isDelivered  = order?.status === "delivered";
  const isPending    = order?.payment_status === "pending" && !isCOD;
  const estimate     = getDeliveryEstimate(order?.created_at, order?.status, order?.state);

  const date = new Date(order?.created_at ?? Date.now()).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });

  /* Collect product images from all seller orders */
  const productImages = useMemo(() => {
    const imgs = [];
    (order?.orders ?? []).forEach((o) => {
      (o.items ?? []).forEach((item) => {
        if (item.image) imgs.push(item.image);
      });
    });
    return imgs;
  }, [order?.orders]);

  const handleClick = useCallback(() => {
    navigate(`/shop/orders/${order.id}`);
  }, [navigate, order.id]);

  const handleTrack = useCallback((e) => {
    e.stopPropagation();
    navigate(`/shop/orders/${order.id}`);
  }, [navigate, order.id]);

  const handleReorder = useCallback((e) => {
    e.stopPropagation();
    onReorder?.(order);
  }, [onReorder, order]);

  return (
    <div
      className="oh-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`Order ${orderNumber} — ${fmt(order?.grand_total)}`}
    >
      {/* ── Pending payment banner ── */}
      {isPending && (
        <div className="oh-pending-banner">
          <span>⚠️ Payment incomplete</span>
          <button
            className="oh-pay-now-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/shop/orders/${order.id}`);
            }}
          >
            Complete Payment →
          </button>
        </div>
      )}

      {/* ── Card header ── */}
      <div className="oh-card-header">
        <div className="oh-card-ref-wrap">
          <span className="oh-card-ref">{orderNumber}</span>
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

      {/* ── Product thumbnails ── */}
      <ProductThumbs images={productImages} />

      {/* ── Card body ── */}
      <div className="oh-card-body">
        {/* Tracking ID */}
        <div className="oh-card-tracking">
          <span>🔖</span>
          <span className="oh-tracking-val">{trackingId}</span>
        </div>

        {/* Seller count */}
        <div className="oh-items-count">
          <span>📦</span>
          <span>
            {order?.order_count ?? 1} seller order
            {(order?.order_count ?? 1) !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Location */}
        {order?.city && (
          <div className="oh-card-location">
            <span>📍</span>
            <span>{order.city}, {order.state}</span>
          </div>
        )}

        {/* Delivery estimate */}
        {estimate && (
          <div className="oh-card-estimate">
            <span>📅</span>
            <span>Expected: {estimate}</span>
          </div>
        )}

        {/* Payment method */}
        <div className="oh-card-method">
          <span>{isCOD ? "💵" : "💳"}</span>
          <span>{isCOD ? "Cash on Delivery" : "Online Payment"}</span>
        </div>
      </div>

      {/* ── Card footer ── */}
      <div className="oh-card-footer">
        <div className="oh-card-total">
          <span className="oh-total-label">Total</span>
          <span className="oh-total-amt">{fmt(order?.grand_total)}</span>
        </div>

        {/* Quick actions */}
        <div className="oh-quick-actions" onClick={(e) => e.stopPropagation()}>
          {isDelivered ? (
            <button
              className="oh-quick-btn oh-quick-btn--reorder"
              onClick={handleReorder}
            >
              🔄 Reorder
            </button>
          ) : (
            <button
              className="oh-quick-btn"
              onClick={handleTrack}
            >
              Track →
            </button>
          )}
        </div>
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
      <div className="oh-skel oh-skel-thumbs" />
      <div className="oh-skel oh-skel-body"   />
      <div className="oh-skel oh-skel-footer" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUMMARY CARDS
════════════════════════════════════════════════════════════ */
const SummaryCards = memo(function SummaryCards({ orders }) {
  const pending   = orders.filter((o) => o.status === "pending").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const totalSpent = orders.reduce((s, o) => s + Number(o.grand_total ?? 0), 0);

  return (
    <div className="oh-summary">
      <div className="oh-summary-card">
        <span className="oh-summary-icon">⏳</span>
        <div>
          <p className="oh-summary-val">{pending}</p>
          <p className="oh-summary-label">Pending</p>
        </div>
      </div>
      <div className="oh-summary-card">
        <span className="oh-summary-icon">🏠</span>
        <div>
          <p className="oh-summary-val">{delivered}</p>
          <p className="oh-summary-label">Delivered</p>
        </div>
      </div>
      <div className="oh-summary-card oh-summary-card--total">
        <span className="oh-summary-icon">💰</span>
        <div>
          <p className="oh-summary-val oh-summary-val--price">
            {fmt(totalSpent)}
          </p>
          <p className="oh-summary-label">Total Spent</p>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   EMPTY STATE
════════════════════════════════════════════════════════════ */
const EmptyOrders = memo(function EmptyOrders({ filter, search }) {
  const navigate = useNavigate();

  const isSearch  = !!search;
  const statusCfg = STATUS_CONFIG[filter];

  return (
    <div className="oh-empty">
      <div className="oh-empty-icon">
        {isSearch ? "🔍" : filter === "all" ? "🛒" : statusCfg?.icon ?? "📦"}
      </div>
      <h3 className="oh-empty-title">
        {isSearch
          ? `No results for "${search}"`
          : filter === "all"
            ? "No orders yet"
            : `No ${statusCfg?.label ?? filter} orders`}
      </h3>
      <p className="oh-empty-sub">
        {isSearch
          ? "Try a different search term or order number"
          : filter === "all"
            ? "Your order history will appear here once you make a purchase."
            : `You don't have any ${statusCfg?.label?.toLowerCase() ?? filter} orders.`}
      </p>
      <button className="oh-shop-btn" onClick={() => navigate("/minimart")}>
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

  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [search,    setSearch]    = useState("");
  const [sort,      setSort]      = useState("newest");
  const [showSort,  setShowSort]  = useState(false);
  const [reordering, setReordering] = useState(false);

  const sortRef   = useRef(null);
  const searchRef = useRef(null);

  /* Redirect if not logged in */
  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/orders" } });
  }, [user, navigate]);

  /* Fetch orders */
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(
        `${API}/checkout/orders`,
        { headers: authHeaders(), timeout: 12000 }
      );
      setOrders(data.data ?? []);
    } catch {
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* Close sort on outside click */
  useEffect(() => {
    const fn = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target))
        setShowSort(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* Filter + search + sort */
  const processed = useMemo(() => {
    let result = [...orders];

    /* Filter by status */
    if (filter !== "all") {
      result = result.filter((o) => o.status === filter);
    }

    /* Search */
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result  = result.filter((o) =>
        o.id?.toLowerCase().includes(q)              ||
        o.tracking_id?.toLowerCase().includes(q)     ||
        o.city?.toLowerCase().includes(q)            ||
        String(o.grand_total ?? "").includes(q)
      );
    }

    /* Sort */
    switch (sort) {
      case "oldest":
        result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case "highest":
        result.sort((a, b) => Number(b.grand_total) - Number(a.grand_total));
        break;
      case "lowest":
        result.sort((a, b) => Number(a.grand_total) - Number(b.grand_total));
        break;
      default: /* newest */
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  }, [orders, filter, search, sort]);

  /* Counts per status */
  const counts = useMemo(() =>
    orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {}),
    [orders]
  );

  /* Reorder handler */
  const handleReorder = useCallback(async (order) => {
    if (reordering) return;
    setReordering(true);
    try {
      const token = getToken();
      const items = (order?.orders ?? []).flatMap((o) =>
        (o.items ?? []).map((item) => ({
          productId: item.product_id,
          variantId: item.variant_id ?? null,
          qty:       item.qty,
        }))
      );

      for (const item of items) {
        await axios
          .post(`${API}/cart`, item, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => {});
      }

      window.dispatchEvent(new Event("cart-updated"));
      navigate("/shop/cart");
    } catch {
      navigate("/shop/cart");
    } finally {
      setReordering(false);
    }
  }, [reordering, navigate]);

  const activeSort = SORT_OPTIONS.find((s) => s.value === sort);

  if (!user) return null;

  return (
    <div className="oh-page">

      {/* ── Topbar ── */}
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
        {/* Sort dropdown */}
        <div className="oh-sort-wrap" ref={sortRef}>
          <button
            className="oh-sort-btn"
            onClick={() => setShowSort((x) => !x)}
            aria-label="Sort orders"
          >
            ⇅
          </button>
          {showSort && (
            <div className="oh-sort-menu" role="listbox">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  className={`oh-sort-item ${sort === s.value ? "oh-sort-item--active" : ""}`}
                  onClick={() => { setSort(s.value); setShowSort(false); }}
                  role="option"
                  aria-selected={sort === s.value}
                >
                  {s.label}
                  {sort === s.value && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="oh-search-wrap">
        <span className="oh-search-icon">🔍</span>
        <input
          ref={searchRef}
          className="oh-search-input"
          type="search"
          placeholder="Search by order ID, tracking ID, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search orders"
        />
        {search && (
          <button
            className="oh-search-clear"
            onClick={() => { setSearch(""); searchRef.current?.focus(); }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Summary cards ── */}
      {!loading && orders.length > 0 && (
        <SummaryCards orders={orders} />
      )}

      {/* ── Filter tabs ── */}
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

      {/* ── Active sort indicator ── */}
      {sort !== "newest" && (
        <div className="oh-sort-indicator">
          Sorted by: <strong>{activeSort?.label}</strong>
          <button onClick={() => setSort("newest")}>Reset</button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="oh-content">

        {/* Error */}
        {error && (
          <div className="oh-error" role="alert">
            <p>⚠️ {error}</p>
            <button className="oh-retry-btn" onClick={fetchOrders}>
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

        {/* Empty */}
        {!error && !loading && processed.length === 0 && (
          <EmptyOrders filter={filter} search={search} />
        )}

        {/* Orders */}
        {!error && !loading && processed.length > 0 && (
          <div className="oh-list">
            {processed.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={handleReorder}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shop More FAB */}
      {!loading && orders.length > 0 && (
        <button
          className="oh-fab"
          onClick={() => navigate("/minimart")}
          aria-label="Shop more"
        >
          🛍️ Shop More
        </button>
      )}
    </div>
  );
}