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
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins  / 60);
  const days  = Math.floor(hours / 24);

  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return fmtDate(d);
};

/* ═══════════════════════════════════════════════════════════════
   STATUS CONFIG  — includes "confirmed" ✅
═══════════════════════════════════════════════════════════════ */

/**
 * Mirrors VALID_TRANSITIONS from routes/seller/order.js:
 *   pending → confirmed → processing → shipped → delivered
 *   any stage → cancelled
 */
const VALID_TRANSITIONS = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped",   "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],
  cancelled:  [],
};

const STATUS_CFG = {
  pending: {
    bg: "#fffbeb", color: "#92400e", border: "#fde68a",
    label: "Pending",    icon: "⏳",
    hint: "Waiting for you to confirm",
  },
  confirmed: {
    bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff",
    label: "Confirmed",  icon: "✔️",
    hint: "Order confirmed — start preparing",
  },
  processing: {
    bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe",
    label: "Processing", icon: "📦",
    hint: "Being prepared for shipment",
  },
  shipped: {
    bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd",
    label: "Shipped",    icon: "🚚",
    hint: "In transit to customer",
  },
  delivered: {
    bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0",
    label: "Delivered",  icon: "✅",
    hint: "Successfully delivered",
  },
  cancelled: {
    bg: "#fef2f2", color: "#991b1b", border: "#fecaca",
    label: "Cancelled",  icon: "❌",
    hint: "Order cancelled",
  },
};

const PAYMENT_CFG = {
  paid:    { color: "#16a34a", bg: "#f0fdf4", icon: "💳", label: "Paid"     },
  pending: { color: "#f59e0b", bg: "#fffbeb", icon: "⏳", label: "Pending"  },
  cod:     { color: "#f97316", bg: "#fff7ed", icon: "💵", label: "COD"      },
  refunded:{ color: "#6b7280", bg: "#f9fafb", icon: "↩️", label: "Refunded" },
  failed:  { color: "#dc2626", bg: "#fef2f2", icon: "❌", label: "Failed"   },
};

/* ═══════════════════════════════════════════════════════════════
   STATUS FILTER TABS
═══════════════════════════════════════════════════════════════ */
const FILTERS = [
  { key: "all",        label: "All",        icon: "📋" },
  { key: "pending",    label: "Pending",    icon: "⏳" },
  { key: "confirmed",  label: "Confirmed",  icon: "✔️" },
  { key: "processing", label: "Processing", icon: "📦" },
  { key: "shipped",    label: "Shipped",    icon: "🚚" },
  { key: "delivered",  label: "Delivered",  icon: "✅" },
  { key: "cancelled",  label: "Cancelled",  icon: "❌" },
];

/* ═══════════════════════════════════════════════════════════════
   SHARED ATOMS
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
  const key   = isCOD ? "cod" : (status ?? "pending");
  const c     = PAYMENT_CFG[key] ?? PAYMENT_CFG.pending;
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
    flexShrink:   0,
  }} />
);

/* ═══════════════════════════════════════════════════════════════
   INLINE ALERT
═══════════════════════════════════════════════════════════════ */
const Alert = ({ type, text }) => {
  const isOk = type === "success";
  return (
    <div style={{
      marginTop:    12,
      padding:      "10px 14px",
      borderRadius: 10,
      background:   isOk ? "#ecfdf5" : "#fef2f2",
      color:        isOk ? "#065f46" : "#991b1b",
      border:       `1px solid ${isOk ? "#a7f3d0" : "#fecaca"}`,
      fontSize:     13,
      fontWeight:   500,
      display:      "flex",
      alignItems:   "center",
      gap:          8,
    }}>
      <span>{isOk ? "✅" : "⚠️"}</span>
      {text}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   ORDER DETAIL PANEL (slide-in)
═══════════════════════════════════════════════════════════════ */
const OrderPanel = ({ order: initialOrder, onClose, onUpdated }) => {
  const [currentOrder, setCurrentOrder] = useState(initialOrder);
  const [newStatus,    setNewStatus]    = useState(initialOrder.status);
  const [updating,     setUpdating]     = useState(false);
  const [msg,          setMsg]          = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [details,      setDetails]      = useState(null);

  /* ── Fetch full order detail ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    sellerApi
      /* ✅ FIX: was missing /api/seller/orders prefix — align with your mount point */
      .get(`/api/seller/orders/${initialOrder.id}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data.success) {
          /* API returns data.data (from routes/seller/order.js) */
          setDetails(data.data ?? data.order ?? null);
        }
      })
      .catch((err) =>
        console.warn("[OrderPanel] fetch failed:", err.message)
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [initialOrder.id]);

  /* ── Close on Escape ── */
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  /* ── Apply status change ── */
  const handleUpdate = async () => {
    if (!newStatus || newStatus === currentOrder.status) return;

    /* Client-side transition guard */
    const allowed = VALID_TRANSITIONS[currentOrder.status] ?? [];
    if (!allowed.includes(newStatus)) {
      setMsg({
        type: "error",
        text: `Cannot move from "${currentOrder.status}" to "${newStatus}".`,
      });
      return;
    }

    setUpdating(true);
    setMsg(null);

    try {
      const { data } = await sellerApi.patch(
        `/api/seller/orders/${currentOrder.id}/status`,
        { status: newStatus }
      );

      if (data.success) {
        /*
         * ✅ FIX: your API response shape is:
         *   { success, message, data: { orderId, previousStatus, newStatus, ... } }
         * NOT data.order.status
         */
        const updatedStatus = data.data?.newStatus ?? newStatus;

        setCurrentOrder((o) => ({ ...o, status: updatedStatus }));
        setNewStatus(updatedStatus);
        setMsg({
          type: "success",
          text: `Order moved to "${STATUS_CFG[updatedStatus]?.label ?? updatedStatus}" ✓`,
        });
        onUpdated?.();
        setTimeout(() => setMsg(null), 4000);
      } else {
        setMsg({ type: "error", text: data.message ?? "Update failed" });
      }
    } catch (err) {
      const serverMsg =
        err.response?.data?.message ??
        err.response?.data?.debug?.message ??
        err.message;
      setMsg({ type: "error", text: serverMsg });
    } finally {
      setUpdating(false);
    }
  };

  /* ── Derived values ── */
  const d          = details;
  const items      = d?.items ?? [];
  const totalItems = items.reduce(
    (s, i) => s + Number(i.quantity ?? i.qty ?? 0), 0
  );

  /*
   * ✅ FIX: was using order.total which doesn't exist.
   * API returns subtotal on the order row, grand_total on the group.
   */
  const displayTotal = d?.grand_total ?? currentOrder.subtotal ?? 0;
  const displaySub   = d?.subtotal    ?? currentOrder.subtotal ?? 0;

  /* Statuses this order can transition to */
  const allowedNext  = VALID_TRANSITIONS[currentOrder.status] ?? [];
  const isTerminal   = allowedNext.length === 0;

  return (
    <div style={op.overlay}>
      {/* Dimmed backdrop */}
      <div style={op.backdrop} onClick={onClose} />

      {/* Panel */}
      <div style={op.panel} role="dialog" aria-modal="true">

        {/* ── Sticky header ── */}
        <div style={op.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={op.panelTitle}>Order Details</h3>
            <p style={op.headerSub}>
              {d?.tracking_id
                ? `#${d.tracking_id}`
                : `#${initialOrder.id.slice(0, 8).toUpperCase()}`}
              <span style={{ color: "#d1d5db", margin: "0 6px" }}>·</span>
              {fmtRelative(initialOrder.created_at)}
            </p>
          </div>
          <button style={op.closeBtn} onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        {loading ? (
          <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
            <Spin size={30} />
          </div>
        ) : (
          <div style={op.body}>

            {/* Hero — amount + badges */}
            <div style={op.hero}>
              <div>
                <p style={op.heroLabel}>Order Total</p>
                <p style={op.heroAmount}>{fmt(displayTotal)}</p>
                <p style={op.heroSub}>
                  {totalItems} item{totalItems !== 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge status={currentOrder.status} />
                <div style={{ marginTop: 8 }}>
                  <PaymentBadge
                    status={d?.payment_status}
                    method={d?.payment_method}
                  />
                </div>
              </div>
            </div>

            {/* Status hint */}
            <div style={op.hint}>
              <span style={{ fontSize: 16 }}>
                {STATUS_CFG[currentOrder.status]?.icon}
              </span>
              <span>{STATUS_CFG[currentOrder.status]?.hint}</span>
            </div>

            {/* ── Order Items ── */}
            {items.length > 0 && (
              <div style={op.section}>
                <p style={op.secLabel}>📦 Items ({items.length})</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((item) => {
                    const qty      = Number(item.quantity ?? item.qty ?? 0);
                    const price    = Number(item.price ?? item.unit_price ?? 0);
                    const imgSrc   = item.image ?? item.image_url;
                    const itemName = item.product_name ?? item.name ?? "Product";
                    return (
                      <div key={item.id} style={op.itemRow}>
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={itemName}
                            style={op.itemImg}
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        ) : (
                          <div style={{ ...op.itemImg, ...op.itemImgPh }}>📦</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={op.itemName}>{itemName}</p>
                          {item.variant_name && (
                            <p style={op.itemMeta}>{item.variant_name}</p>
                          )}
                          {item.sku && (
                            <p style={{ ...op.itemMeta, fontFamily: "monospace" }}>
                              SKU: {item.sku}
                            </p>
                          )}
                          <p style={op.itemMeta}>
                            {fmt(price)} × {qty}
                          </p>
                        </div>
                        <div style={op.itemPrice}>
                          {fmt(price * qty)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Customer ── */}
            <div style={op.section}>
              <p style={op.secLabel}>👤 Customer</p>
              <p style={op.secVal}>
                {d?.buyer_name ?? initialOrder.customer_name ?? "Guest Customer"}
              </p>
              {d?.buyer_email && (
                <p style={op.secMeta}>✉️ {d.buyer_email}</p>
              )}
            </div>

            {/* ── Delivery Address ── */}
            {(d?.address_line || d?.city) && (
              <div style={op.section}>
                <p style={op.secLabel}>📍 Delivery Address</p>
                {d.recipient_name && (
                  <p style={op.secVal}>{d.recipient_name}</p>
                )}
                {d.phone && (
                  <p style={op.secMeta}>📞 {d.phone}</p>
                )}
                {d.address_line && (
                  <p style={{ ...op.secMeta, marginTop: 4 }}>{d.address_line}</p>
                )}
                {(d.city || d.state) && (
                  <p style={op.secMeta}>
                    {[d.city, d.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {d.landmark && (
                  <p style={{ ...op.secMeta, fontStyle: "italic" }}>
                    Landmark: {d.landmark}
                  </p>
                )}
                {d.call_before_delivery && (
                  <p style={{ ...op.secMeta, color: "#f59e0b", marginTop: 4 }}>
                    📞 Call before delivery
                  </p>
                )}
              </div>
            )}

            {/* ── Payment Summary ── */}
            <div style={op.section}>
              <p style={op.secLabel}>💰 Payment Summary</p>
              <div style={op.summaryRow}>
                <span style={op.secMeta}>Subtotal</span>
                <span style={op.secVal}>{fmt(displaySub)}</span>
              </div>
              {Number(d?.delivery_fee) > 0 && (
                <div style={op.summaryRow}>
                  <span style={op.secMeta}>Delivery Fee</span>
                  <span style={op.secVal}>{fmt(d.delivery_fee)}</span>
                </div>
              )}
              {Number(d?.discount) > 0 && (
                <div style={{ ...op.summaryRow, color: "#16a34a" }}>
                  <span>Discount</span>
                  <span>-{fmt(d.discount)}</span>
                </div>
              )}
              {d?.coupon_code && (
                <div style={op.summaryRow}>
                  <span style={op.secMeta}>Coupon</span>
                  <code style={{ fontSize: 12, color: "#7c3aed" }}>
                    {d.coupon_code}
                  </code>
                </div>
              )}
              <div style={op.totalRow}>
                <span>Grand Total</span>
                <span>{fmt(displayTotal)}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <PaymentBadge
                  status={d?.payment_status}
                  method={d?.payment_method}
                />
              </div>
            </div>

            {/* ── Customer Notes ── */}
            {d?.notes && (
              <div style={op.section}>
                <p style={op.secLabel}>📝 Customer Notes</p>
                <p style={{ ...op.secVal, fontWeight: 400, fontStyle: "italic" }}>
                  "{d.notes}"
                </p>
              </div>
            )}

            {/* ── Status Update ── */}
            {!isTerminal ? (
              <div style={op.section}>
                <p style={op.secLabel}>🔄 Update Status</p>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 10px" }}>
                  Current: <strong>{STATUS_CFG[currentOrder.status]?.label}</strong>
                  {" → "}
                  Available: {allowedNext.map((s) => STATUS_CFG[s]?.label).join(", ")}
                </p>

                {/* Only show ALLOWED next statuses — prevents invalid transitions */}
                <div style={op.statusGrid}>
                  {allowedNext.map((s) => {
                    const isActive = newStatus === s;
                    const c = STATUS_CFG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setNewStatus(s)}
                        style={{
                          padding:        "10px 12px",
                          borderRadius:   10,
                          border:         `2px solid ${isActive ? c.border : "#e5e7eb"}`,
                          background:     isActive ? c.bg    : "white",
                          color:          isActive ? c.color : "#6b7280",
                          fontWeight:     isActive ? 700     : 500,
                          cursor:         "pointer",
                          fontSize:       13,
                          transition:     "all 0.15s",
                          display:        "flex",
                          alignItems:     "center",
                          gap:            6,
                          justifyContent: "center",
                        }}
                      >
                        <span>{c.icon}</span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                {msg && <Alert type={msg.type} text={msg.text} />}

                <button
                  onClick={handleUpdate}
                  disabled={updating || newStatus === currentOrder.status}
                  style={{
                    ...op.updateBtn,
                    opacity: (updating || newStatus === currentOrder.status) ? 0.5 : 1,
                    cursor:  (updating || newStatus === currentOrder.status)
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {updating ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <Spin size={16} color="white" /> Updating…
                    </span>
                  ) : (
                    `✓ Move to "${STATUS_CFG[newStatus]?.label ?? newStatus}"`
                  )}
                </button>
              </div>
            ) : (
              /* Terminal state — no more actions */
              <div style={{
                ...op.section,
                background:  currentOrder.status === "delivered" ? "#ecfdf5" : "#fef2f2",
                borderColor: currentOrder.status === "delivered" ? "#a7f3d0" : "#fecaca",
                textAlign:   "center",
              }}>
                <p style={{
                  margin:     0,
                  fontWeight: 600,
                  color: currentOrder.status === "delivered" ? "#065f46" : "#991b1b",
                }}>
                  {STATUS_CFG[currentOrder.status]?.icon}{" "}
                  This order is {STATUS_CFG[currentOrder.status]?.label.toLowerCase()} — no further actions available
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
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalItems,   setTotalItems]   = useState(0);
  const [selected,     setSelected]     = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error,        setError]        = useState(null);
  const LIMIT = 15;

  /* ── Fetch dashboard stats (separate endpoint) ── */
  useEffect(() => {
    setStatsLoading(true);
    sellerApi
      .get("/api/seller/orders/stats")
      .then(({ data }) => {
        if (data.success) setStats(data.data);
      })
      .catch((err) => console.warn("[Orders] stats fetch failed:", err.message))
      .finally(() => setStatsLoading(false));
  }, []);

  /* ── Load orders ── */
  const load = useCallback(async (resetPage = false) => {
    const targetPage = resetPage ? 1 : page;
    if (resetPage) {
      setPage(1);
      setLoading(true);
    }
    setError(null);

    try {
      /*
       * ✅ FIX: sellerApi.get() expects (url, config).
       * Pass params inside { params: {} } — axios convention.
       */
      const { data } = await sellerApi.get("/api/seller/orders", {
        params: {
          page:   targetPage,
          limit:  LIMIT,
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(searchQuery.trim()     && { search: searchQuery.trim() }),
        },
      });

      if (data.success) {
        /*
         * API response shape (from routes/seller/order.js):
         *   data.data.orders, data.data.pagination
         */
        const rows       = data.data?.orders      ?? data.orders ?? [];
        const pagination = data.data?.pagination  ?? {};

        setOrders(rows);
        setTotalPages(pagination.totalPages ?? 1);
        setTotalItems(pagination.totalItems ?? rows.length);
      } else {
        setError(data.message ?? "Failed to load orders");
      }
    } catch (err) {
      console.error("[Orders] load failed:", err.message);
      setError(
        err.response?.data?.message ?? "Network error — could not load orders"
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, page]);

  /* Re-fetch when filter or page changes */
  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!loading) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* Debounced search */
  useEffect(() => {
    const t = setTimeout(() => load(true), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /* Auto-refresh every 30 s (only when panel is closed) */
  useEffect(() => {
    const iv = setInterval(() => {
      if (!selected && !loading) load(false);
    }, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loading]);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  /* Client-side search highlight (orders already filtered server-side) */
  const displayedOrders = useMemo(() => orders, [orders]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={ord.headerRow}>
        <div>
          <h2 style={ord.title}>📦 Orders</h2>
          <p style={ord.subtitle}>
            {totalItems > 0
              ? `${totalItems} order${totalItems !== 1 ? "s" : ""} total`
              : "Manage and fulfil customer orders"}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          style={{
            ...ord.refreshBtn,
            opacity: refreshing || loading ? 0.6 : 1,
          }}
        >
          <span style={{
            display:   "inline-block",
            animation: refreshing ? "spin 0.7s linear infinite" : "none",
          }}>
            ↻
          </span>
          <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>

      {/* ── Stats bar (from /api/seller/orders/stats) ── */}
      {!statsLoading && stats && (
        <div style={ord.statsRow}>
          <div style={ord.statCard}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <p style={ord.statLabel}>Total Orders</p>
              <p style={ord.statValue}>{stats.counts?.total ?? 0}</p>
            </div>
          </div>

          {(stats.counts?.pending ?? 0) > 0 && (
            <div style={{ ...ord.statCard, borderColor: "#fde68a", background: "#fffbeb" }}>
              <span style={{ fontSize: 20 }}>⏳</span>
              <div>
                <p style={ord.statLabel}>Pending</p>
                <p style={{ ...ord.statValue, color: "#92400e" }}>
                  {stats.counts.pending}
                </p>
              </div>
            </div>
          )}

          {(stats.counts?.processing ?? 0) > 0 && (
            <div style={{ ...ord.statCard, borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div>
                <p style={ord.statLabel}>Processing</p>
                <p style={{ ...ord.statValue, color: "#1e40af" }}>
                  {stats.counts.processing}
                </p>
              </div>
            </div>
          )}

          <div style={{ ...ord.statCard, borderColor: "#a7f3d0", background: "#ecfdf5" }}>
            <span style={{ fontSize: 20 }}>💰</span>
            <div>
              <p style={ord.statLabel}>Revenue</p>
              <p style={{ ...ord.statValue, color: "#065f46" }}>
                {fmt(stats.revenue?.confirmed ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div style={ord.searchWrap}>
        <span style={ord.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="Search by customer name, tracking ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={ord.searchInput}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={ord.clearBtn}>
            ✕
          </button>
        )}
      </div>

      {/* ── Status filter tabs ── */}
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

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          padding:      "12px 16px",
          background:   "#fef2f2",
          border:       "1px solid #fecaca",
          borderRadius: 10,
          color:        "#991b1b",
          fontSize:     14,
          display:      "flex",
          gap:          10,
          alignItems:   "center",
        }}>
          <span>⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => load(true)}
            style={{
              marginLeft:   "auto",
              padding:      "4px 12px",
              background:   "#dc2626",
              color:        "white",
              border:       "none",
              borderRadius: 6,
              cursor:       "pointer",
              fontSize:     12,
              fontWeight:   700,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Table / Empty / Loading ── */}
      <div style={ord.tableCard}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Spin size={30} />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div style={ord.empty}>
            <span style={{ fontSize: 48 }}>
              {searchQuery ? "🔍" : "📭"}
            </span>
            <p style={ord.emptyTitle}>
              {searchQuery
                ? "No matches found"
                : `No ${statusFilter !== "all" ? statusFilter : ""} orders yet`}
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
                    {[
                      "Order", "Customer", "Amount",
                      "Items", "Status", "Payment", "Date", "",
                    ].map((h) => (
                      <th key={h} style={ord.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedOrders.map((o) => (
                    <tr
                      key={o.id}
                      style={{ ...ord.tr, animation: "fadeSlide 0.2s ease" }}
                      onClick={() => setSelected(o)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "";
                      }}
                    >
                      {/* Order ID */}
                      <td style={ord.td}>
                        <p style={ord.orderId}>
                          #{o.tracking_id ?? o.id.slice(0, 8).toUpperCase()}
                        </p>
                      </td>

                      {/* Customer */}
                      <td style={ord.td}>
                        <p style={ord.customerName}>
                          {/* ✅ FIX: API returns buyer_name, not customer_name */}
                          {o.buyer_name ?? o.customer_name ?? "Guest"}
                        </p>
                        {(o.city || o.state) && (
                          <p style={{ ...ord.date, marginTop: 2 }}>
                            📍 {[o.city, o.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </td>

                      {/* Amount — ✅ FIX: use subtotal, not total */}
                      <td style={ord.td}>
                        <span style={ord.amount}>
                          {fmt(o.subtotal ?? o.total ?? 0)}
                        </span>
                      </td>

                      {/* Items */}
                      <td style={ord.td}>
                        <span style={ord.itemCount}>
                          {o.item_count != null ? `${o.item_count}×` : "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={ord.td}>
                        <Badge status={o.status} />
                      </td>

                      {/* Payment */}
                      <td style={ord.td}>
                        <PaymentBadge
                          status={o.payment_status}
                          method={o.payment_method}
                        />
                      </td>

                      {/* Date */}
                      <td style={ord.td}>
                        <span style={ord.date}>
                          {fmtRelative(o.created_at)}
                        </span>
                      </td>

                      {/* Chevron */}
                      <td style={ord.td}>
                        <span style={ord.chevron}>›</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={ord.pagBar}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ ...ord.pageBtn, opacity: page === 1 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>

                <span style={ord.pagInfo}>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  {totalItems > 0 && (
                    <span style={{ color: "#d1d5db", margin: "0 6px" }}>
                      · {totalItems} total
                    </span>
                  )}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ ...ord.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Slide-in detail panel ── */}
      {selected && (
        <OrderPanel
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES — Orders list
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
  statsRow: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap:                 12,
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
    fontSize:      11,
    color:         "#9ca3af",
    margin:        0,
    fontWeight:    600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize:   18,
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "2px 0 0",
  },
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
  searchIcon:  { color: "#9ca3af", fontSize: 14 },
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
    background:     "#f3f4f6",
    border:         "none",
    borderRadius:   "50%",
    width:          24,
    height:         24,
    cursor:         "pointer",
    color:          "#6b7280",
    fontSize:       11,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
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
    padding:       "14px 20px",
    color:         "#374151",
    verticalAlign: "middle",
  },
  orderId: {
    fontWeight: 700,
    color:      "#1f2937",
    fontSize:   13,
    margin:     "0 0 2px",
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
  itemCount: {
    color:      "#6b7280",
    fontWeight: 600,
    fontSize:   14,
  },
  date: {
    color:      "#9ca3af",
    fontSize:   12,
    whiteSpace: "nowrap",
  },
  chevron: { color: "#d1d5db", fontSize: 18 },
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
  emptySub: { color: "#9ca3af", fontSize: 14, margin: 0 },
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
  pagBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "14px 20px",
    borderTop:      "1px solid #f3f4f6",
  },
  pagInfo: { fontSize: 13, color: "#6b7280" },
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
   STYLES — OrderPanel
═══════════════════════════════════════════════════════════════ */
const op = {
  overlay: {
    position:       "fixed",
    inset:          0,
    zIndex:         1000,
    display:        "flex",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex:           1,
    background:     "rgba(0,0,0,0.38)",
    backdropFilter: "blur(2px)",
    cursor:         "pointer",
  },
  panel: {
    width:         "100%",
    maxWidth:       460,
    background:    "white",
    height:        "100%",
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    boxShadow:     "-6px 0 32px rgba(0,0,0,0.15)",
    animation:     "fadeSlide 0.25s ease",
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
    color:      "#9ca3af",
    fontSize:   12,
    margin:     "3px 0 0",
    fontFamily: "monospace",
  },
  closeBtn: {
    background:     "#f3f4f6",
    border:         "none",
    borderRadius:   "50%",
    width:          32,
    height:         32,
    cursor:         "pointer",
    fontSize:       14,
    color:          "#6b7280",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  body: {
    padding:       22,
    display:       "flex",
    flexDirection: "column",
    gap:           18,
    flex:          1,
  },
  hero: {
    background:     "linear-gradient(135deg, #4f46e5, #7c3aed)",
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
    opacity:       0.75,
    fontSize:      12,
    margin:        "0 0 4px",
    fontWeight:    600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontWeight: 900,
    fontSize:   32,
    margin:     0,
    lineHeight: 1.1,
  },
  heroSub: { opacity: 0.8, fontSize: 13, margin: "6px 0 0" },
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
  secMeta: { color: "#6b7280", fontSize: 13, margin: "2px 0 0" },
  summaryRow: {
    display:        "flex",
    justifyContent: "space-between",
    marginBottom:   6,
  },
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
  itemRow: {
    display:     "flex",
    gap:         10,
    padding:     "8px 0",
    borderTop:   "1px solid #e5e7eb",
    alignItems:  "center",
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
  itemMeta:  { fontSize: 11, color: "#6b7280", margin: "2px 0 0" },
  itemPrice: { fontSize: 13, fontWeight: 800, color: "#1f2937", whiteSpace: "nowrap" },
  statusGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap:                 8,
  },
  updateBtn: {
    display:      "block",
    width:        "100%",
    padding:      12,
    background:   "linear-gradient(135deg, #6366f1, #8b5cf6)",
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