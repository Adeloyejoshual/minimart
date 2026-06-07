// pages/seller/Orders.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { sellerApi } from "./SellerDashboard";

const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const VALID_STATUSES = [
  "pending", "processing", "shipped", "delivered", "cancelled",
];

const STATUS_CFG = {
  pending:    { bg:"#fffbeb", color:"#92400e", border:"#fde68a",
    label:"Pending"    },
  processing: { bg:"#eff6ff", color:"#1e40af", border:"#bfdbfe",
    label:"Processing" },
  shipped:    { bg:"#f0f9ff", color:"#0369a1", border:"#bae6fd",
    label:"Shipped"    },
  delivered:  { bg:"#ecfdf5", color:"#065f46", border:"#a7f3d0",
    label:"Delivered"  },
  cancelled:  { bg:"#fef2f2", color:"#991b1b", border:"#fecaca",
    label:"Cancelled"  },
};

const Badge = ({ status }) => {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{
      padding:      "0.22rem 0.65rem",
      borderRadius: "100px",
      fontSize:     "0.72rem",
      fontWeight:   700,
      background:   c.bg,
      color:        c.color,
      border:       `1px solid ${c.border}`,
      whiteSpace:   "nowrap",
      display:      "inline-block",
    }}>
      {c.label}
    </span>
  );
};

const Spin = ({ size = 24 }) => (
  <div style={{
    width:        size,
    height:       size,
    border:       `${Math.ceil(size / 10)}px solid #e5e7eb`,
    borderTop:    `${Math.ceil(size / 10)}px solid #6366f1`,
    borderRadius: "50%",
    animation:    "spin 0.7s linear infinite",
  }} />
);

const FILTERS = [
  { key: "all",        label: "All"        },
  { key: "pending",    label: "Pending"    },
  { key: "processing", label: "Processing" },
  { key: "shipped",    label: "Shipped"    },
  { key: "delivered",  label: "Delivered"  },
  { key: "cancelled",  label: "Cancelled"  },
];

// ── Order detail panel ─────────────────────────────────────────
const OrderPanel = ({ order: initialOrder, onClose, onUpdated }) => {
  const [order,    setOrder]    = useState(initialOrder);
  const [status,   setStatus]   = useState(initialOrder?.status);
  const [updating, setUpdating] = useState(false);
  const [msg,      setMsg]      = useState(null);

  // PATCH /api/seller-dashboard/orders/:id/status
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
        setMsg({ type: "success",
          text: `Status updated to "${data.order.status}"` });
        onUpdated?.();
      } else {
        setMsg({ type: "error", text: data.message });
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

  return (
    <div style={op.overlay}>
      <div style={op.backdrop} onClick={onClose} />
      <div style={op.panel}>

        {/* Header */}
        <div style={op.header}>
          <div>
            <h3 style={op.panelTitle}>Order Details</h3>
            <p style={{ color: "#9ca3af", fontSize: "0.78rem",
              margin: 0 }}>
              {fmtDate(order.created_at)}
            </p>
          </div>
          <button style={op.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={op.body}>

          {/* Amount + status hero */}
          <div style={op.hero}>
            <div>
              <p style={{ opacity: 0.7, fontSize: "0.78rem",
                margin: "0 0 0.2rem" }}>
                Total Amount
              </p>
              <p style={{ fontWeight: 800, fontSize: "2rem",
                margin: 0 }}>
                {fmt(order.total)}
              </p>
            </div>
            <Badge status={order.status} />
          </div>

          {/* Customer */}
          <div style={op.section}>
            <p style={op.secLabel}>Customer</p>
            <p style={op.secVal}>
              {order.customer_name ?? "Guest Customer"}
            </p>
            <p style={{ color: "#6b7280", fontSize: "0.82rem",
              margin: "0.2rem 0 0" }}>
              {order.item_count ?? "—"} item
              {(order.item_count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Update status */}
          {!["delivered", "cancelled"].includes(order.status) && (
            <div style={op.section}>
              <p style={op.secLabel}>Update Status</p>
              <div style={{ display: "flex", gap: "0.5rem",
                flexWrap: "wrap" }}>
                {VALID_STATUSES.map((s) => {
                  const isActive = status === s;
                  const c = STATUS_CFG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      style={{
                        padding:      "0.5rem 0.875rem",
                        borderRadius: "100px",
                        border:       `2px solid ${isActive
                          ? c.border : "#e5e7eb"}`,
                        background:   isActive ? c.bg : "white",
                        color:        isActive ? c.color : "#6b7280",
                        fontWeight:   isActive ? 700 : 500,
                        cursor:       "pointer",
                        fontSize:     "0.8rem",
                        transition:   "all 0.15s",
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Message */}
              {msg && (
                <div style={{
                  marginTop:    "0.75rem",
                  padding:      "0.7rem 1rem",
                  borderRadius: "10px",
                  background:   msg.type === "success"
                    ? "#ecfdf5" : "#fef2f2",
                  color:        msg.type === "success"
                    ? "#065f46" : "#991b1b",
                  border:       `1px solid ${
                    msg.type === "success" ? "#a7f3d0" : "#fecaca"
                  }`,
                  fontSize:     "0.82rem",
                  fontWeight:   500,
                }}>
                  {msg.type === "success" ? "✅" : "⚠️"} {msg.text}
                </div>
              )}

              <button
                onClick={handleUpdate}
                disabled={updating || status === order.status}
                style={{
                  ...op.updateBtn,
                  opacity: updating || status === order.status
                    ? 0.5 : 1,
                  marginTop: "0.75rem",
                }}
              >
                {updating
                  ? (
                    <span style={{ display: "flex",
                      alignItems: "center", gap: "0.5rem" }}>
                      <Spin size={16} /> Updating...
                    </span>
                  )
                  : "✓ Apply Status Change"
                }
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

const op = {
  overlay:  { position:"fixed", inset:0, zIndex:1000,
    display:"flex", justifyContent:"flex-end" },
  backdrop: { flex:1, background:"rgba(0,0,0,0.38)",
    backdropFilter:"blur(2px)", cursor:"pointer" },
  panel: {
    width:         "100%",
    maxWidth:      "420px",
    background:    "white",
    height:        "100%",
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    boxShadow:     "-6px 0 32px rgba(0,0,0,0.1)",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    padding:        "1.25rem 1.5rem",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    background:     "white",
    zIndex:         1,
  },
  panelTitle: { fontWeight:800, color:"#1f2937", margin:0,
    fontSize:"1rem" },
  closeBtn: { background:"none", border:"none", cursor:"pointer",
    fontSize:"1.1rem", color:"#9ca3af",
    padding:"0.25rem", lineHeight:1 },
  body: {
    padding:       "1.5rem",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
    flex:          1,
  },
  hero: {
    background:     "linear-gradient(135deg,#4f46e5,#7c3aed)",
    borderRadius:   "16px",
    padding:        "1.5rem",
    color:          "white",
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    flexWrap:       "wrap",
    gap:            "0.75rem",
  },
  section: {
    background:   "#f8fafc",
    borderRadius: "14px",
    padding:      "1rem 1.1rem",
    border:       "1px solid #e5e7eb",
  },
  secLabel: {
    fontSize:      "0.7rem",
    fontWeight:    700,
    color:         "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin:        "0 0 0.4rem",
  },
  secVal: {
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    fontSize:   "0.95rem",
  },
  updateBtn: {
    display:      "block",
    width:        "100%",
    padding:      "0.875rem",
    background:   "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    cursor:       "pointer",
    fontSize:     "0.9rem",
    textAlign:    "center",
  },
};

// ── Main Orders page ───────────────────────────────────────────
export default function Orders() {
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset,       setOffset]       = useState(0);
  const [hasMore,      setHasMore]      = useState(false);
  const [total,        setTotal]        = useState(0);
  const [selected,     setSelected]     = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const LIMIT = 15;

  // GET /api/seller-dashboard/orders
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
        "/api/seller-dashboard/orders", params
      );
      if (data.success) {
        const rows = data.orders ?? [];
        setOrders(rows);
        // Infer hasMore from returned count
        setHasMore(rows.length === LIMIT);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [statusFilter, offset]);

  useEffect(() => {
    setOffset(0);
    load(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!loading) load(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column",
      gap:"1.25rem" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", flexWrap:"wrap", gap:"0.75rem" }}>
        <div>
          <h2 style={{ fontWeight:800, fontSize:"1.35rem",
            color:"#1f2937", margin:0 }}>
            📦 Orders
          </h2>
          <p style={{ color:"#9ca3af", fontSize:"0.85rem",
            margin:"0.2rem 0 0" }}>
            Manage and fulfil customer orders
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          style={ord.refreshBtn}
        >
          <span style={{ display:"inline-block",
            animation: refreshing
              ? "spin 0.7s linear infinite" : "none" }}>
            ↻
          </span>{" "}
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={ord.filterRow}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            style={{
              ...ord.filterTab,
              background:  statusFilter === key ? "#6366f1" : "white",
              color:       statusFilter === key ? "white" : "#6b7280",
              borderColor: statusFilter === key ? "#6366f1" : "#e5e7eb",
              fontWeight:  statusFilter === key ? 700 : 500,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={ord.tableCard}>
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center",
            padding:"4rem" }}>
            <Spin size={30} />
          </div>
        ) : orders.length === 0 ? (
          <div style={ord.empty}>
            <span style={{ fontSize:"2.5rem" }}>📭</span>
            <p style={{ fontWeight:700, color:"#374151",
              margin:"0.75rem 0 0" }}>
              No {statusFilter !== "all" ? statusFilter : ""} orders
            </p>
            <p style={{ color:"#9ca3af", fontSize:"0.85rem",
              margin:"0.3rem 0 0" }}>
              Orders will appear here as customers place them
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX:"auto" }}>
              <table style={ord.table}>
                <thead>
                  <tr>
                    {[
                      "Customer","Amount","Items",
                      "Status","Date",""
                    ].map((h) => (
                      <th key={h} style={ord.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      style={ord.tr}
                      onClick={() => setSelected(o)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "";
                      }}
                    >
                      <td style={ord.td}>
                        <p style={{ fontWeight:600, margin:0,
                          fontSize:"0.875rem", color:"#1f2937" }}>
                          {o.customer_name ?? "Guest"}
                        </p>
                      </td>
                      <td style={ord.td}>
                        <span style={{ fontWeight:700,
                          color:"#1f2937" }}>
                          {fmt(o.total)}
                        </span>
                      </td>
                      <td style={ord.td}>
                        <span style={{ color:"#6b7280",
                          fontWeight:600 }}>
                          {o.item_count ?? "—"}
                        </span>
                      </td>
                      <td style={ord.td}>
                        <Badge status={o.status} />
                      </td>
                      <td style={ord.td}>
                        <span style={{ color:"#9ca3af",
                          fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                          {fmtDate(o.created_at)}
                        </span>
                      </td>
                      <td style={ord.td}>
                        <span style={{ color:"#d1d5db" }}>›</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={ord.pagBar}>
              <button
                onClick={() => setOffset((o) =>
                  Math.max(0, o - LIMIT))}
                disabled={offset === 0}
                style={{ ...ord.pageBtn,
                  opacity: offset === 0 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize:"0.78rem",
                color:"#9ca3af" }}>
                Showing {offset + 1}–
                {offset + orders.length}
              </span>
              <button
                onClick={() => setOffset((o) => o + LIMIT)}
                disabled={!hasMore}
                style={{ ...ord.pageBtn,
                  opacity: !hasMore ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
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

const ord = {
  refreshBtn: {
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    padding:      "0.6rem 1rem",
    cursor:       "pointer",
    display:      "flex",
    alignItems:   "center",
    gap:          "0.5rem",
    color:        "#6b7280",
    fontSize:     "0.85rem",
    fontWeight:   500,
  },
  filterRow: {
    display:  "flex",
    gap:      "0.35rem",
    flexWrap: "wrap",
  },
  filterTab: {
    padding:      "0.4rem 0.875rem",
    borderRadius: "100px",
    border:       "1px solid",
    cursor:       "pointer",
    fontSize:     "0.78rem",
    whiteSpace:   "nowrap",
    transition:   "all 0.15s",
  },
  tableCard: {
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  table: {
    width:          "100%",
    borderCollapse: "collapse",
    fontSize:       "0.875rem",
  },
  th: {
    padding:       "0.75rem 1.25rem",
    textAlign:     "left",
    fontSize:      "0.68rem",
    fontWeight:    700,
    color:         "#9ca3af",
    background:    "#f9fafb",
    whiteSpace:    "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tr: {
    borderBottom: "1px solid #f9fafb",
    cursor:       "pointer",
    transition:   "background 0.1s",
  },
  td: {
    padding:  "0.875rem 1.25rem",
    color:    "#374151",
  },
  empty: {
    padding:       "4rem 2rem",
    textAlign:     "center",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
  },
  pagBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0.875rem 1.25rem",
    borderTop:      "1px solid #f3f4f6",
  },
  pageBtn: {
    padding:      "0.4rem 0.875rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "8px",
    background:   "white",
    cursor:       "pointer",
    fontSize:     "0.8rem",
    color:        "#374151",
    fontWeight:   500,
    transition:   "opacity 0.15s",
  },
};