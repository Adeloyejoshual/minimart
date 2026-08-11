// pages/seller/Orders.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { sellerApi } from "./SellerDashboard";

/* ═══════════════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════════════ */
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const fmtRelative = (d) => {
  if (!d) return "—";
  const now = new Date();
  const then = new Date(d);
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
};

/* ═══════════════════════════════════════════════════════════════
   STATUS CONFIG
═══════════════════════════════════════════════════════════════ */
const VALID_STATUSES = [
  "pending", "processing", "shipped", "delivered", "cancelled",
];

const STATUS_CFG = {
  pending: {
    bg: "#fffbeb", color: "#92400e", border: "#fde68a",
    label: "Pending", icon: "⏳",
    hint: "Waiting for you to prepare",
  },
  processing: {
    bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe",
    label: "Processing", icon: "📦",
    hint: "Being prepared",
  },
  shipped: {
    bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd",
    label: "Shipped", icon: "🚚",
    hint: "In transit to customer",
  },
  delivered: {
    bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0",
    label: "Delivered", icon: "✅",
    hint: "Successfully delivered",
  },
  cancelled: {
    bg: "#fef2f2", color: "#991b1b", border: "#fecaca",
    label: "Cancelled", icon: "❌",
    hint: "Order cancelled",
  },
};

const PAYMENT_CFG = {
  paid:      { color: "#16a34a", bg: "#f0fdf4", icon: "💳", label: "Paid" },
  pending:   { color: "#f59e0b", bg: "#fffbeb", icon: "⏳", label: "Pending" },
  cod:       { color: "#f97316", bg: "#fff7ed", icon: "💵", label: "COD" },
  refunded:  { color: "#6b7280", bg: "#f9fafb", icon: "↩️", label: "Refunded" },
  failed:    { color: "#dc2626", bg: "#fef2f2", icon: "❌", label: "Failed" },
};

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */
const Badge = ({ status }) => {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{
      padding:      "3px 10px",
      borderRadius: 100,
      fontSize:     12,
      fontWeight:   700,
      background:   c.bg,
      color:        c.color,
      border:       `1px solid ${c.border}`,
      whiteSpace:   "nowrap",
      display:      "inline-flex",
      alignItems:   "center",
      gap:          4,
    }}>
      <span>{c.icon}</span>
      {c.label}
    </span>
  );
};

const PaymentBadge = ({ status, method }) => {
  const isCOD = method === "CASH_ON_DELIVERY";
  const key = isCOD ? "cod" : (status ?? "pending");
  const c = PAYMENT_CFG[key] ?? PAYMENT_CFG.pending;

  return (
    <span style={{
      padding:      "2px 8px",
      borderRadius: 6,
      fontSize:     11,
      fontWeight:   700,
      background:   c.bg,
      color:        c.color,
      display:      "inline-flex",
      alignItems:   "center",
      gap:          4,
      whiteSpace:   "nowrap",
    }}>
      <span>{c.icon}</span>
      {isCOD ? "COD" : c.label}
    </span>
  );
};

const Spin = ({ size = 24, color = "#6366f1" }) => (
  <div style={{
    width:        size,
    height:       size,
    border:       `${Math.ceil(size / 10)}px solid #e5e7eb`,
    borderTop:    `${Math.ceil(size / 10)}px solid ${color}`,
    borderRadius: "50%",
    animation:    "spin 0.7s linear infinite",
  }} />
);

/* ═══════════════════════════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════════════════════════ */
const FILTERS = [
  { key: "all",        label: "All",        icon: "📋" },
  { key: "pending",    label: "Pending",    icon: "⏳" },
  { key: "processing", label: "Processing", icon: "📦" },
  { key: "shipped",    label: "Shipped",    icon: "🚚" },
  { key: "delivered",  label: "Delivered",  icon: "✅" },
  { key: "cancelled",  label: "Cancelled",  icon: "❌" },
];

/* ═══════════════════════════════════════════════════════════════
   ORDER DETAIL PANEL (Slide-in)
═══════════════════════════════════════════════════════════════ */
const OrderPanel = ({ order: initialOrder, onClose, onUpdated }) => {
  const [order,    setOrder]    = useState(initialOrder);
  const [status,   setStatus]   = useState(initialOrder?.status);
  const [updating, setUpdating] = useState(false);
  const [msg,      setMsg]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [details,  setDetails]  = useState(null);

  /* Fetch full order details on open */
  useEffect(() => {
    let cancelled = false;

    sellerApi
      .get(`/api/seller-dashboard/orders/${initialOrder.id}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data.success) {
          setDetails(data.order ?? data.data);
        }
      })
      .catch((err) => {
        console.warn("[OrderPanel] Details fetch failed:", err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [initialOrder.id]);

  /* Close on Escape key */
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleUpdate = async () => {
    if (!status || status === order.status) return;
    setUpdating(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.patch(
        `/api/seller-dashboard/orders/${order.id}/status`,
        { status }
      );
      if (data.success) {
        setOrder((o) => ({ ...o, status: data.order.status }));
        setMsg({
          type: "success",
          text: `Status updated to "${STATUS_CFG[data.order.status]?.label}"`,
        });
        onUpdated?.();
        /* Auto-clear success message */
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg({ type: "error", text: data.message ?? "Update failed" });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Update failed",
      });
    } finally {
      setUpdating(false);
    }
  };

  const items      = details?.items ?? [];
  const totalItems = items.reduce((sum, i) => sum + Number(i.quantity ?? i.qty ?? 0), 0);
  const canUpdate  = !["delivered", "cancelled"].includes(order.status);

  return (
    <div style={op.overlay}>
      <div style={op.backdrop} onClick={onClose} />
      <div style={op.panel}>

        {/* Header */}
        <div style={op.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={op.panelTitle}>Order Details</h3>
            <p style={op.headerSub}>
              {details?.tracking_id
                ? `#${details.tracking_id}`
                : `#${order.id.slice(0, 8).toUpperCase()}`}
              <span style={{ color: "#d1d5db", margin: "0 6px" }}>·</span>
              {fmtRelative(order.created_at)}
            </p>
          </div>
          <button style={op.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
            <Spin size={30} />
          </div>
        ) : (
          <div style={op.body}>

            {/* Hero — Amount + Status */}
            <div style={op.hero}>
              <div>
                <p style={op.heroLabel}>Order Total</p>
                <p style={op.heroAmount}>{fmt(order.total)}</p>
                <p style={op.heroSub}>{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge status={order.status} />
                <div style={{ marginTop: 8 }}>
                  <PaymentBadge
                    status={details?.payment_status}
                    method={details?.payment_method}
                  />
                </div>
              </div>
            </div>

            {/* Status hint */}
            <div style={op.hint}>
              <span style={{ fontSize: 16 }}>{STATUS_CFG[order.status]?.icon}</span>
              <span>{STATUS_CFG[order.status]?.hint}</span>
            </div>

            {/* Order Items */}
            {items.length > 0 && (
              <div style={op.section}>
                <p style={op.secLabel}>
                  📦 Items ({items.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((item) => (
                    <div key={item.id} style={op.itemRow}>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name ?? item.product_name}
                          style={op.itemImg}
                        />
                      ) : (
                        <div style={{ ...op.itemImg, ...op.itemImgPh }}>📦</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={op.itemName}>
                          {item.name ?? item.product_name ?? "Product"}
                        </p>
                        {item.variant_name && (
                          <p style={op.itemMeta}>{item.variant_name}</p>
                        )}
                        <p style={op.itemMeta}>
                          {fmt(item.price)} × {item.quantity ?? item.qty}
                        </p>
                      </div>
                      <div style={op.itemPrice}>
                        {fmt(Number(item.price) * Number(item.quantity ?? item.qty))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer */}
            <div style={op.section}>
              <p style={op.secLabel}>👤 Customer</p>
              <p style={op.secVal}>
                {details?.customer_name ?? order.customer_name ?? "Guest Customer"}
              </p>
              {details?.customer_email && (
                <p style={op.secMeta}>{details.customer_email}</p>
              )}
              {details?.customer_phone && (
                <p style={op.secMeta}>📞 {details.customer_phone}</p>
              )}
            </div>

            {/* Delivery Address */}
            {(details?.address_line || details?.city) && (
              <div style={op.section}>
                <p style={op.secLabel}>📍 Delivery Address</p>
                {details.recipient_name && (
                  <p style={op.secVal}>{details.recipient_name}</p>
                )}
                {details.phone && (
                  <p style={op.secMeta}>📞 {details.phone}</p>
                )}
                {details.address_line && (
                  <p style={{ ...op.secMeta, marginTop: 4 }}>
                    {details.address_line}
                  </p>
                )}
                {(details.city || details.state) && (
                  <p style={op.secMeta}>
                    {[details.city, details.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {details.landmark && (
                  <p style={{ ...op.secMeta, fontStyle: "italic" }}>
                    Landmark: {details.landmark}
                  </p>
                )}
              </div>
            )}

            {/* Payment */}
            <div style={op.section}>
              <p style={op.secLabel}>💰 Payment</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={op.secMeta}>Subtotal</span>
                <span style={op.secVal}>{fmt(details?.subtotal ?? order.total)}</span>
              </div>
              {details?.delivery_fee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={op.secMeta}>Delivery Fee</span>
                  <span style={op.secVal}>{fmt(details.delivery_fee)}</span>
                </div>
              )}
              {details?.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#16a34a" }}>
                  <span>Discount</span>
                  <span>-{fmt(details.discount)}</span>
                </div>
              )}
              <div style={op.totalRow}>
                <span>Total</span>
                <span>{fmt(details?.grand_total ?? order.total)}</span>
              </div>
            </div>

            {/* Notes */}
            {details?.notes && (
              <div style={op.section}>
                <p style={op.secLabel}>📝 Customer Notes</p>
                <p style={{ ...op.secVal, fontWeight: 400, fontStyle: "italic" }}>
                  "{details.notes}"
                </p>
              </div>
            )}

            {/* Update Status */}
            {canUpdate ? (
              <div style={op.section}>
                <p style={op.secLabel}>🔄 Update Status</p>
                <div style={op.statusGrid}>
                  {VALID_STATUSES.map((s) => {
                    const isActive = status === s;
                    const c = STATUS_CFG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        style={{
                          padding:      "10px 12px",
                          borderRadius: 10,
                          border:       `2px solid ${isActive ? c.border : "#e5e7eb"}`,
                          background:   isActive ? c.bg : "white",
                          color:        isActive ? c.color : "#6b7280",
                          fontWeight:   isActive ? 700 : 500,
                          cursor:       "pointer",
                          fontSize:     13,
                          transition:   "all 0.15s",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          6,
                          justifyContent: "center",
                        }}
                      >
                        <span>{c.icon}</span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                {msg && (
                  <div style={{
                    marginTop:    12,
                    padding:      "10px 14px",
                    borderRadius: 10,
                    background:   msg.type === "success" ? "#ecfdf5" : "#fef2f2",
                    color:        msg.type === "success" ? "#065f46" : "#991b1b",
                    border:       `1px solid ${msg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                    fontSize:     13,
                    fontWeight:   500,
                    display:      "flex",
                    alignItems:   "center",
                    gap:          8,
                  }}>
                    <span>{msg.type === "success" ? "✅" : "⚠️"}</span>
                    {msg.text}
                  </div>
                )}

                <button
                  onClick={handleUpdate}
                  disabled={updating || status === order.status}
                  style={{
                    ...op.updateBtn,
                    opacity: updating || status === order.status ? 0.5 : 1,
                    cursor:  updating || status === order.status ? "not-allowed" : "pointer",
                  }}
                >
                  {updating ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <Spin size={16} color="white" /> Updating...
                    </span>
                  ) : (
                    "✓ Apply Status Change"
                  )}
                </button>
              </div>
            ) : (
              <div style={{
                ...op.section,
                background: "#f0fdf4",
                borderColor: "#a7f3d0",
                textAlign: "center",
              }}>
                <p style={{ margin: 0, color: "#065f46", fontWeight: 600 }}>
                  {STATUS_CFG[order.status]?.icon} This order is {STATUS_CFG[order.status]?.label.toLowerCase()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN ORDERS PAGE
═══════════════════════════════════════════════════════════════ */
export default function Orders() {
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery,  setSearchQuery]  = useState("");
  const [offset,       setOffset]       = useState(0);
  const [hasMore,      setHasMore]      = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [stats,        setStats]        = useState(null);
  const LIMIT = 15;

  /* ── Load orders ── */
  const load = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    if (reset) setLoading(true);
    try {
      const params = {
        limit:  LIMIT,
        offset: currentOffset,
      };
      if (statusFilter !== "all") params.status = statusFilter;

      const { data } = await sellerApi.get(
        "/api/seller-dashboard/orders",
        params
      );
      if (data.success) {
        const rows = data.orders ?? [];
        setOrders(rows);
        setHasMore(rows.length === LIMIT);

        /* Compute simple stats */
        if (reset) {
          setStats({
            total:      data.total ?? rows.length,
            pending:    rows.filter((o) => o.status === "pending").length,
            processing: rows.filter((o) => o.status === "processing").length,
          });
        }
      }
    } catch (err) {
      console.error("[Orders] Load failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset]);

  /* Load when filter changes */
  useEffect(() => {
    setOffset(0);
    load(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  /* Load when offset changes */
  useEffect(() => {
    if (!loading) load(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  /* Auto-refresh every 30 seconds */
  useEffect(() => {
    const interval = setInterval(() => {
      if (!selected && !loading) load(true);
    }, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loading]);

  /* Client-side search filter */
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter((o) =>
      (o.customer_name ?? "").toLowerCase().includes(q) ||
      (o.tracking_id ?? "").toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={ord.headerRow}>
        <div>
          <h2 style={ord.title}>📦 Orders</h2>
          <p style={ord.subtitle}>
            Manage and fulfil customer orders
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={ord.refreshBtn}
          >
            <span style={{ animation: refreshing ? "spin 0.7s linear infinite" : "none", display: "inline-block" }}>
              ↻
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.total > 0 && (
        <div style={ord.statsRow}>
          <div style={ord.statCard}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <p style={ord.statLabel}>Total Orders</p>
              <p style={ord.statValue}>{stats.total}</p>
            </div>
          </div>
          {stats.pending > 0 && (
            <div style={{ ...ord.statCard, borderColor: "#fde68a", background: "#fffbeb" }}>
              <span style={{ fontSize: 20 }}>⏳</span>
              <div>
                <p style={ord.statLabel}>Pending</p>
                <p style={{ ...ord.statValue, color: "#92400e" }}>{stats.pending}</p>
              </div>
            </div>
          )}
          {stats.processing > 0 && (
            <div style={{ ...ord.statCard, borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div>
                <p style={ord.statLabel}>Processing</p>
                <p style={{ ...ord.statValue, color: "#1e40af" }}>{stats.processing}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div style={ord.searchWrap}>
        <span style={ord.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="Search by customer name, tracking ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={ord.searchInput}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={ord.clearBtn}
          >
            ✕
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div style={ord.filterRow}>
        {FILTERS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            style={{
              ...ord.filterTab,
              background:  statusFilter === key ? "#6366f1" : "white",
              color:       statusFilter === key ? "white"   : "#6b7280",
              borderColor: statusFilter === key ? "#6366f1" : "#e5e7eb",
              fontWeight:  statusFilter === key ? 700       : 500,
            }}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Table / Empty / Loading */}
      <div style={ord.tableCard}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Spin size={30} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={ord.empty}>
            <span style={{ fontSize: 48 }}>
              {searchQuery ? "🔍" : "📭"}
            </span>
            <p style={ord.emptyTitle}>
              {searchQuery
                ? "No matches found"
                : `No ${statusFilter !== "all" ? statusFilter : ""} orders`}
            </p>
            <p style={ord.emptySub}>
              {searchQuery
                ? `No orders match "${searchQuery}"`
                : "Orders will appear here as customers place them"}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={ord.emptyBtn}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={ord.table}>
                <thead>
                  <tr>
                    {["Order", "Customer", "Amount", "Items", "Status", "Date", ""].map((h) => (
                      <th key={h} style={ord.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      style={{ ...ord.tr, animation: "fadeSlide 0.2s ease" }}
                      onClick={() => setSelected(o)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                    >
                      <td style={ord.td}>
                        <p style={ord.orderId}>
                          #{o.tracking_id ?? o.id.slice(0, 8).toUpperCase()}
                        </p>
                        {o.payment_method === "CASH_ON_DELIVERY" && (
                          <PaymentBadge method="CASH_ON_DELIVERY" />
                        )}
                      </td>
                      <td style={ord.td}>
                        <p style={ord.customerName}>
                          {o.customer_name ?? "Guest"}
                        </p>
                      </td>
                      <td style={ord.td}>
                        <span style={ord.amount}>{fmt(o.total)}</span>
                      </td>
                      <td style={ord.td}>
                        <span style={ord.items}>
                          {o.item_count ?? "—"}
                        </span>
                      </td>
                      <td style={ord.td}>
                        <Badge status={o.status} />
                      </td>
                      <td style={ord.td}>
                        <span style={ord.date}>
                          {fmtRelative(o.created_at)}
                        </span>
                      </td>
                      <td style={ord.td}>
                        <span style={ord.chevron}>›</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!searchQuery && (
              <div style={ord.pagBar}>
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                  disabled={offset === 0}
                  style={{ ...ord.pageBtn, opacity: offset === 0 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>
                <span style={ord.pagInfo}>
                  Showing <strong>{offset + 1}–{offset + filteredOrders.length}</strong>
                </span>
                <button
                  onClick={() => setOffset((o) => o + LIMIT)}
                  disabled={!hasMore}
                  style={{ ...ord.pageBtn, opacity: !hasMore ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slide-in panel */}
      {selected && (
        <OrderPanel
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => load(true)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const ord = {
  headerRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    flexWrap:       "wrap",
    gap:            12,
  },
  title: {
    fontWeight: 800,
    fontSize:   22,
    color:      "#1f2937",
    margin:     0,
  },
  subtitle: {
    color:    "#9ca3af",
    fontSize: 14,
    margin:   "3px 0 0",
  },
  refreshBtn: {
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: 10,
    padding:      "10px 16px",
    cursor:       "pointer",
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    color:        "#6b7280",
    fontSize:     14,
    fontWeight:   600,
    transition:   "all 0.15s",
  },

  /* Stats */
  statsRow: {
    display:            "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap:                12,
  },
  statCard: {
    display:      "flex",
    alignItems:   "center",
    gap:          12,
    padding:      14,
    background:   "white",
    border:       "1px solid #f3f4f6",
    borderRadius: 12,
  },
  statLabel: {
    fontSize:  11,
    color:     "#9ca3af",
    margin:    0,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize:   18,
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "2px 0 0",
  },

  /* Search */
  searchWrap: {
    position:     "relative",
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: 10,
    padding:      "0 14px",
    display:      "flex",
    alignItems:   "center",
    gap:          8,
  },
  searchIcon: {
    color:    "#9ca3af",
    fontSize: 14,
  },
  searchInput: {
    flex:       1,
    border:     "none",
    outline:    "none",
    padding:    "12px 0",
    fontSize:   14,
    background: "transparent",
    color:      "#1f2937",
  },
  clearBtn: {
    background:   "#f3f4f6",
    border:       "none",
    borderRadius: "50%",
    width:        24,
    height:       24,
    cursor:       "pointer",
    color:        "#6b7280",
    fontSize:     11,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
  },

  /* Filters */
  filterRow: {
    display:  "flex",
    gap:      6,
    flexWrap: "wrap",
  },
  filterTab: {
    padding:      "8px 14px",
    borderRadius: 100,
    border:       "1px solid",
    cursor:       "pointer",
    fontSize:     13,
    whiteSpace:   "nowrap",
    transition:   "all 0.15s",
    display:      "flex",
    alignItems:   "center",
    gap:          6,
  },

  /* Table */
  tableCard: {
    background:   "white",
    borderRadius: 16,
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  table: {
    width:          "100%",
    borderCollapse: "collapse",
    fontSize:       14,
  },
  th: {
    padding:       "12px 20px",
    textAlign:     "left",
    fontSize:      11,
    fontWeight:    700,
    color:         "#9ca3af",
    background:    "#f9fafb",
    whiteSpace:    "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    borderBottom: "1px solid #f9fafb",
    cursor:       "pointer",
    transition:   "background 0.1s",
  },
  td: {
    padding: "14px 20px",
    color:   "#374151",
    verticalAlign: "middle",
  },
  orderId: {
    fontWeight: 700,
    color:      "#1f2937",
    fontSize:   13,
    margin:     "0 0 4px",
    fontFamily: "monospace",
  },
  customerName: {
    fontWeight: 600,
    margin:     0,
    fontSize:   14,
    color:      "#1f2937",
  },
  amount: {
    fontWeight: 800,
    color:      "#1f2937",
    fontSize:   14,
  },
  items: {
    color:      "#6b7280",
    fontWeight: 600,
    fontSize:   14,
  },
  date: {
    color:      "#9ca3af",
    fontSize:   12,
    whiteSpace: "nowrap",
  },
  chevron: {
    color:    "#d1d5db",
    fontSize: 18,
  },

  /* Empty */
  empty: {
    padding:       "80px 20px",
    textAlign:     "center",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           8,
  },
  emptyTitle: {
    fontWeight: 700,
    color:      "#374151",
    margin:     "12px 0 4px",
    fontSize:   16,
  },
  emptySub: {
    color:    "#9ca3af",
    fontSize: 14,
    margin:   0,
  },
  emptyBtn: {
    marginTop:    16,
    padding:      "10px 20px",
    background:   "#6366f1",
    color:        "white",
    border:       "none",
    borderRadius: 10,
    fontSize:     13,
    fontWeight:   700,
    cursor:       "pointer",
  },

  /* Pagination */
  pagBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "14px 20px",
    borderTop:      "1px solid #f3f4f6",
  },
  pagInfo: {
    fontSize: 13,
    color:    "#6b7280",
  },
  pageBtn: {
    padding:      "8px 16px",
    border:       "1px solid #e5e7eb",
    borderRadius: 8,
    background:   "white",
    cursor:       "pointer",
    fontSize:     13,
    color:        "#374151",
    fontWeight:   600,
    transition:   "opacity 0.15s",
  },
};

/* ═══════════════════════════════════════════════════════════════
   OrderPanel styles
═══════════════════════════════════════════════════════════════ */
const op = {
  overlay: {
    position:   "fixed",
    inset:      0,
    zIndex:     1000,
    display:    "flex",
    justifyContent: "flex-end",
    animation:  "fadeSlide 0.2s ease",
  },
  backdrop: {
    flex:            1,
    background:      "rgba(0,0,0,0.38)",
    backdropFilter:  "blur(2px)",
    cursor:          "pointer",
  },
  panel: {
    width:          "100%",
    maxWidth:       460,
    background:     "white",
    height:         "100%",
    overflowY:      "auto",
    display:        "flex",
    flexDirection:  "column",
    boxShadow:      "-6px 0 32px rgba(0,0,0,0.15)",
    animation:      "fadeSlide 0.3s ease",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    padding:        "18px 22px",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    background:     "white",
    zIndex:         1,
    gap:            12,
  },
  panelTitle: {
    fontWeight: 800,
    color:      "#1f2937",
    margin:     0,
    fontSize:   16,
  },
  headerSub: {
    color:    "#9ca3af",
    fontSize: 12,
    margin:   "3px 0 0",
    fontFamily: "monospace",
  },
  closeBtn: {
    background:   "#f3f4f6",
    border:       "none",
    borderRadius: "50%",
    width:        32,
    height:       32,
    cursor:       "pointer",
    fontSize:     14,
    color:        "#6b7280",
    lineHeight:   1,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    flexShrink:   0,
  },
  body: {
    padding:       22,
    display:       "flex",
    flexDirection: "column",
    gap:           18,
    flex:          1,
  },

  /* Hero */
  hero: {
    background:     "linear-gradient(135deg,#4f46e5,#7c3aed)",
    borderRadius:   16,
    padding:        22,
    color:          "white",
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    flexWrap:       "wrap",
    gap:            12,
  },
  heroLabel: {
    opacity:    0.75,
    fontSize:   12,
    margin:     "0 0 4px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontWeight: 900,
    fontSize:   32,
    margin:     0,
    lineHeight: 1.1,
  },
  heroSub: {
    opacity:  0.8,
    fontSize: 13,
    margin:   "6px 0 0",
  },

  /* Status hint */
  hint: {
    display:      "flex",
    alignItems:   "center",
    gap:          10,
    padding:      "10px 14px",
    background:   "#f0f9ff",
    border:       "1px solid #bae6fd",
    borderRadius: 10,
    color:        "#0369a1",
    fontSize:     13,
    fontWeight:   600,
  },

  /* Section */
  section: {
    background:   "#f8fafc",
    borderRadius: 14,
    padding:      "14px 16px",
    border:       "1px solid #e5e7eb",
  },
  secLabel: {
    fontSize:      11,
    fontWeight:    700,
    color:         "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    margin:        "0 0 8px",
  },
  secVal: {
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    fontSize:   14,
  },
  secMeta: {
    color:    "#6b7280",
    fontSize: 13,
    margin:   "2px 0 0",
  },

  /* Order Items */
  itemRow: {
    display:      "flex",
    gap:          10,
    padding:      "8px 0",
    borderTop:    "1px solid #e5e7eb",
    alignItems:   "center",
  },
  itemImg: {
    width:        48,
    height:       48,
    borderRadius: 8,
    objectFit:    "cover",
    background:   "#f3f4f6",
    flexShrink:   0,
    border:       "1px solid #e5e7eb",
  },
  itemImgPh: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       20,
  },
  itemName: {
    fontSize:   13,
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    lineHeight: 1.3,
  },
  itemMeta: {
    fontSize: 11,
    color:    "#6b7280",
    margin:   "2px 0 0",
  },
  itemPrice: {
    fontSize:   13,
    fontWeight: 800,
    color:      "#1f2937",
    whiteSpace: "nowrap",
  },

  /* Totals */
  totalRow: {
    display:        "flex",
    justifyContent: "space-between",
    fontSize:       15,
    fontWeight:     900,
    color:          "#1f2937",
    borderTop:      "2px solid #e5e7eb",
    marginTop:      6,
    paddingTop:     10,
  },

  /* Status grid */
  statusGrid: {
    display:            "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap:                8,
  },

  /* Update button */
  updateBtn: {
    display:      "block",
    width:        "100%",
    padding:      12,
    background:   "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:        "white",
    border:       "none",
    borderRadius: 12,
    fontWeight:   700,
    fontSize:     14,
    textAlign:    "center",
    marginTop:    12,
    transition:   "opacity 0.15s",
  },
};