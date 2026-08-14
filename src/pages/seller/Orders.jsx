// pages/seller/Orders.jsx
import React, {
  useState, useEffect, useCallback,
  useMemo, useRef,
} from "react";
import { sellerApi } from "./SellerDashboard";
import styles        from "./Orders.module.css";

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
   STATUS CONFIG
═══════════════════════════════════════════════════════════════ */
const VALID_TRANSITIONS = {
  pending:          ["confirmed",        "cancelled"],
  confirmed:        ["processing",       "cancelled"],
  processing:       ["shipped",          "cancelled"],
  shipped:          ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered",        "failed_delivery"],
  delivered:        ["received"],
  failed_delivery:  ["out_for_delivery", "cancelled"],
  received:         [],
  cancelled:        [],
};

/* Statuses a seller can transition to — everything else is admin/buyer */
const SELLER_TARGETS = new Set(["confirmed", "processing", "shipped", "cancelled"]);

const STATUS_CFG = {
  pending: {
    bg: "#fffbeb", color: "#92400e", border: "#fde68a",
    label: "Pending", hint: "Waiting for confirmation",
    gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
  },
  confirmed: {
    bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff",
    label: "Confirmed", hint: "Order confirmed — start preparing",
    gradient: "linear-gradient(135deg,#8b5cf6,#7c3aed)",
  },
  processing: {
    bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe",
    label: "Processing", hint: "Being prepared for shipment",
    gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  },
  shipped: {
    bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd",
    label: "Shipped", hint: "Handed to Loemart Express",
    gradient: "linear-gradient(135deg,#0ea5e9,#0369a1)",
  },
  out_for_delivery: {
    bg: "#fff7ed", color: "#c2410c", border: "#fed7aa",
    label: "Out for Delivery", hint: "Agent heading to customer",
    gradient: "linear-gradient(135deg,#f97316,#ea580c)",
  },
  delivered: {
    bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0",
    label: "Delivered", hint: "Delivered — awaiting buyer confirmation",
    gradient: "linear-gradient(135deg,#10b981,#059669)",
  },
  received: {
    bg: "#f0fdf4", color: "#166534", border: "#bbf7d0",
    label: "Received", hint: "Buyer confirmed receipt",
    gradient: "linear-gradient(135deg,#22c55e,#16a34a)",
  },
  failed_delivery: {
    bg: "#fef2f2", color: "#991b1b", border: "#fecaca",
    label: "Delivery Failed", hint: "Delivery attempt failed — retry needed",
    gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
  },
  cancelled: {
    bg: "#fef2f2", color: "#991b1b", border: "#fecaca",
    label: "Cancelled", hint: "Order cancelled",
    gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
  },
};

const PAYMENT_CFG = {
  paid:     { color: "#16a34a", bg: "#f0fdf4", label: "Paid"     },
  pending:  { color: "#f59e0b", bg: "#fffbeb", label: "Pending"  },
  cod:      { color: "#f97316", bg: "#fff7ed", label: "COD"      },
  refunded: { color: "#6b7280", bg: "#f9fafb", label: "Refunded" },
  failed:   { color: "#dc2626", bg: "#fef2f2", label: "Failed"   },
};

const FILTERS = [
  { key: "all",              label: "All"          },
  { key: "pending",          label: "Pending"      },
  { key: "confirmed",        label: "Confirmed"    },
  { key: "processing",       label: "Processing"   },
  { key: "shipped",          label: "Shipped"      },
  { key: "out_for_delivery", label: "Out for Del." },
  { key: "delivered",        label: "Delivered"    },
  { key: "received",         label: "Received"     },
  { key: "cancelled",        label: "Cancelled"    },
];

/* ═══════════════════════════════════════════════════════════════
   TRANSPARENT SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Package: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  Clock: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Check: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Truck: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  Dollar: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Search: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Refresh: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  X: ({ size = 12, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ChevronRight: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronLeft: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  AlertTriangle: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  User: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  MapPin: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Mail: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Phone: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91A16 16 0 0 0 15 15.91l1-1.06a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  ArrowRight: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  FileText: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Inbox: ({ size = 40, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════════════ */
const Spin = ({ size = 22, color = "#6366f1" }) => (
  <div
    className={styles.spin}
    style={{
      width:       size,
      height:      size,
      border:      `${Math.ceil(size / 10)}px solid rgba(0,0,0,0.08)`,
      borderTop:   `${Math.ceil(size / 10)}px solid ${color}`,
    }}
  />
);

const Badge = ({ status }) => {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span
      className={styles.badge}
      style={{ background: c.bg, color: c.color, borderColor: c.border }}
    >
      {c.label}
    </span>
  );
};

const PaymentBadge = ({ status, method }) => {
  const isCOD = method === "CASH_ON_DELIVERY";
  const key   = isCOD ? "cod" : (status ?? "pending");
  const c     = PAYMENT_CFG[key] ?? PAYMENT_CFG.pending;
  return (
    <span
      className={styles.payBadge}
      style={{ background: c.bg, color: c.color }}
    >
      {isCOD ? "COD" : c.label}
    </span>
  );
};

const Alert = ({ type, text, onDismiss }) => (
  <div className={`${styles.alert} ${type === "success" ? styles.alertSuccess : styles.alertError}`}>
    {type === "success"
      ? <Icon.Check size={14} color="currentColor" />
      : <Icon.AlertTriangle size={14} color="currentColor" />
    }
    <span style={{ flex: 1, lineHeight: "20px" }}>{text}</span>
    {onDismiss && (
      <button
        onClick={onDismiss}
        style={{ background: "none", border: "none", cursor: "pointer",
                 padding: 0, color: "inherit", opacity: 0.6, display: "flex" }}
      >
        <Icon.X size={12} />
      </button>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════════════════════════ */
const ConfirmModal = ({ from, to, updating, onConfirm, onCancel }) => {
  const fromCfg  = STATUS_CFG[from] ?? STATUS_CFG.pending;
  const toCfg    = STATUS_CFG[to]   ?? STATUS_CFG.pending;
  const isDanger = to === "cancelled";
  const btnRef   = useRef(null);

  useEffect(() => {
    btnRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && !updating && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, updating]);

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBackdrop} onClick={() => !updating && onCancel()} />
      <div className={styles.modalCard}>

        {/* From → To transition */}
        <div className={styles.modalTransition}>
          <span
            className={styles.modalPill}
            style={{ background: fromCfg.bg, color: fromCfg.color, borderColor: fromCfg.border }}
          >
            {fromCfg.label}
          </span>
          <span className={styles.modalArrow}>
            <Icon.ArrowRight size={14} color="#9ca3af" />
          </span>
          <span
            className={styles.modalPill}
            style={{ background: toCfg.bg, color: toCfg.color, borderColor: toCfg.border }}
          >
            {toCfg.label}
          </span>
        </div>

        <h3 className={styles.modalTitle}>
          {isDanger ? "Cancel this order?" : "Confirm status update?"}
        </h3>

        <p className={styles.modalDesc}>
          {isDanger
            ? "This cannot be undone. The buyer will be notified."
            : <>
                Moving from <strong style={{ color: fromCfg.color }}>{fromCfg.label}</strong>
                {" → "}
                <strong style={{ color: toCfg.color }}>{toCfg.label}</strong>.
                The buyer will be notified automatically.
              </>
          }
        </p>

        <div
          className={styles.modalHint}
          style={{ background: toCfg.bg, borderLeft: `3px solid ${toCfg.border}`, color: toCfg.color }}
        >
          {toCfg.hint}
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.modalBack}
            onClick={onCancel}
            disabled={updating}
          >
            Go Back
          </button>
          <button
            ref={btnRef}
            className={styles.modalConfirm}
            style={{
              background: isDanger
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : toCfg.gradient,
            }}
            onClick={onConfirm}
            disabled={updating}
          >
            {updating
              ? <><Spin size={14} color="white" /> Updating…</>
              : isDanger
                ? "Yes, Cancel Order"
                : `Move to ${toCfg.label}`
            }
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   ORDER PANEL
═══════════════════════════════════════════════════════════════ */
const OrderPanel = ({ order: listRow, onClose, onUpdated }) => {
  const [details,       setDetails]       = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [currentStatus, setCurrentStatus] = useState(listRow.status);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [confirming,    setConfirming]    = useState(false);
  const [updating,      setUpdating]      = useState(false);
  const [msg,           setMsg]           = useState(null);

  /* Fetch full order detail */
  useEffect(() => {
    let live = true;
    setLoadingDetail(true);
    sellerApi
      .get(`/api/seller/orders/${listRow.id}`)
      .then(({ data }) => {
        if (!live) return;
        if (data.success) setDetails(data.data ?? null);
      })
      .catch((err) => console.warn("[OrderPanel]", err.message))
      .finally(() => { if (live) setLoadingDetail(false); });
    return () => { live = false; };
  }, [listRow.id]);

  /* Escape closes panel (not when confirm modal open) */
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !confirming) onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, confirming]);

  const requestStatusChange = (status) => {
    setPendingStatus(status);
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (!pendingStatus) return;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(pendingStatus)) {
      setMsg({ type: "error", text: `Invalid transition.` });
      setConfirming(false);
      return;
    }
    setUpdating(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.patch(
        `/api/seller/orders/${listRow.id}/status`,
        { status: pendingStatus }
      );
      if (data.success) {
        const confirmed = data.data?.newStatus ?? pendingStatus;
        setCurrentStatus(confirmed);
        setDetails((prev) => prev ? { ...prev, status: confirmed } : prev);
        setMsg({ type: "success", text: `Moved to "${STATUS_CFG[confirmed]?.label}" ✓` });
        onUpdated?.();
        setTimeout(() => setMsg(null), 5000);
      } else {
        setMsg({ type: "error", text: data.message ?? "Update failed" });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? err.message ?? "Network error",
      });
    } finally {
      setUpdating(false);
      setConfirming(false);
      setPendingStatus(null);
    }
  };

  const d          = details;
  const items      = d?.items ?? [];
  const totalQty   = items.reduce((s, i) => s + Number(i.quantity ?? i.qty ?? 0), 0);
  const subtotal   = Number(d?.subtotal    ?? listRow.subtotal  ?? 0);
  const grandTotal = Number(d?.grand_total ?? listRow.grand_total ?? subtotal);
  const deliveryFee = Number(d?.delivery_fee ?? 0);
  const discount   = Number(d?.discount    ?? 0);

  const allowedNext      = (d?.meta?.allowedNext ?? VALID_TRANSITIONS[currentStatus] ?? [])
                           .filter((s) => SELLER_TARGETS.has(s));
  const progressStatuses = allowedNext.filter((s) => s !== "cancelled");
  const canCancel        = allowedNext.includes("cancelled");
  const isTerminal       = (VALID_TRANSITIONS[currentStatus] ?? [])
                           .filter((s) => SELLER_TARGETS.has(s)).length === 0;

  const displayId = d?.tracking_id ?? listRow.tracking_id
    ?? `#${listRow.id.slice(0, 8).toUpperCase()}`;

  const cfg = STATUS_CFG[currentStatus] ?? STATUS_CFG.pending;

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.backdrop} onClick={onClose} />
        <div className={styles.panel} role="dialog" aria-modal="true">

          {/* Header */}
          <div className={styles.panelHeader}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 className={styles.panelTitle}>Order Details</h3>
                <Badge status={currentStatus} />
              </div>
              <p className={styles.panelSubtitle}>
                {displayId}
                <span style={{ color: "#e5e7eb", margin: "0 5px" }}>·</span>
                {fmtRelative(listRow.created_at)}
              </p>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <Icon.X size={13} />
            </button>
          </div>

          {/* Body */}
          {loadingDetail ? (
            <div className={styles.loadingWrap}>
              <Spin size={28} />
              <p className={styles.loadingText}>Loading order details…</p>
            </div>
          ) : (
            <div className={styles.panelBody}>

              {/* Hero */}
              <div className={styles.hero} style={{ background: cfg.gradient }}>
                <div>
                  <p className={styles.heroLabel}>Order Total</p>
                  <p className={styles.heroAmount}>{fmt(grandTotal)}</p>
                  <p className={styles.heroSub}>
                    {totalQty} item{totalQty !== 1 ? "s" : ""}
                    {subtotal !== grandTotal && (
                      <span style={{ opacity: 0.7 }}> · subtotal {fmt(subtotal)}</span>
                    )}
                  </p>
                </div>
                <div className={styles.heroBadges}>
                  <PaymentBadge status={d?.payment_status} method={d?.payment_method} />
                  {d?.tracking_id && (
                    <span style={{ fontSize: 10, opacity: 0.7, fontFamily: "monospace" }}>
                      {d.tracking_id}
                    </span>
                  )}
                </div>
              </div>

              {/* Alert */}
              {msg && <Alert type={msg.type} text={msg.text} onDismiss={() => setMsg(null)} />}

              {/* Status hint */}
              <div className={styles.hintBar}>
                {cfg.hint}
              </div>

              {/* Items */}
              {items.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.secLabel}>
                    <Icon.Package size={11} color="currentColor" style={{ marginRight: 4 }} />
                    Items ({items.length})
                  </p>
                  {items.map((item, idx) => {
                    const qty      = Number(item.quantity ?? item.qty ?? 0);
                    const price    = Number(item.price    ?? item.unit_price ?? 0);
                    const lineTotal = Number(item.line_total ?? price * qty);
                    const imgSrc   = item.image ?? item.image_url;
                    const name     = item.product_name ?? item.name ?? "Product";
                    return (
                      <div key={item.id ?? idx} className={styles.itemRow}>
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={name}
                            className={styles.itemImg}
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        ) : (
                          <div className={`${styles.itemImg} ${styles.itemImgPh}`}>
                            <Icon.Package size={18} color="#9ca3af" />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className={styles.itemName}>{name}</p>
                          {item.variant_name && (
                            <p className={styles.itemMeta}>{item.variant_name}</p>
                          )}
                          {item.sku && (
                            <p className={styles.itemMeta} style={{ fontFamily: "monospace" }}>
                              SKU: {item.sku}
                            </p>
                          )}
                          <p className={styles.itemMeta}>{fmt(price)} × {qty}</p>
                        </div>
                        <span className={styles.itemPrice}>{fmt(lineTotal)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Customer */}
              <div className={styles.section}>
                <p className={styles.secLabel}>
                  <Icon.User size={11} color="currentColor" style={{ marginRight: 4 }} />
                  Customer
                </p>
                <p className={styles.secVal}>
                  {d?.buyer_name ?? listRow.buyer_name ?? "Guest Customer"}
                </p>
                {(d?.buyer_email ?? listRow.buyer_email) && (
                  <p className={styles.secMeta} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <Icon.Mail size={12} color="#9ca3af" />
                    {d?.buyer_email ?? listRow.buyer_email}
                  </p>
                )}
              </div>

              {/* Delivery address */}
              {(d?.address_line || d?.city || d?.recipient_name) && (
                <div className={styles.section}>
                  <p className={styles.secLabel}>
                    <Icon.MapPin size={11} color="currentColor" style={{ marginRight: 4 }} />
                    Delivery Address
                  </p>
                  {d.recipient_name && <p className={styles.secVal}>{d.recipient_name}</p>}
                  {d.phone && (
                    <p className={styles.secMeta} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <Icon.Phone size={12} color="#9ca3af" />
                      {d.phone}
                    </p>
                  )}
                  {d.address_line && <p className={styles.secMeta} style={{ marginTop: 3 }}>{d.address_line}</p>}
                  {(d.city || d.state) && (
                    <p className={styles.secMeta}>
                      {[d.city, d.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {d.landmark && (
                    <p className={styles.secMeta} style={{ fontStyle: "italic" }}>
                      Landmark: {d.landmark}
                    </p>
                  )}
                </div>
              )}

              {/* Payment summary */}
              <div className={styles.section}>
                <p className={styles.secLabel}>
                  <Icon.Dollar size={11} color="currentColor" style={{ marginRight: 4 }} />
                  Payment Summary
                </p>
                <div className={styles.summaryRow}>
                  <span className={styles.secMeta}>Subtotal</span>
                  <span className={styles.secVal}>{fmt(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className={styles.summaryRow}>
                    <span className={styles.secMeta}>Delivery Fee</span>
                    <span className={styles.secVal}>{fmt(deliveryFee)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className={styles.summaryRow} style={{ color: "#16a34a" }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Discount</span>
                    <span style={{ fontWeight: 700 }}>−{fmt(discount)}</span>
                  </div>
                )}
                {d?.coupon_code && (
                  <div className={styles.summaryRow}>
                    <span className={styles.secMeta}>Coupon</span>
                    <code style={{ fontSize: 11, color: "#7c3aed" }}>{d.coupon_code}</code>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>Grand Total</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <PaymentBadge status={d?.payment_status} method={d?.payment_method} />
                </div>
              </div>

              {/* Notes */}
              {d?.notes && (
                <div className={styles.section}>
                  <p className={styles.secLabel}>
                    <Icon.FileText size={11} color="currentColor" style={{ marginRight: 4 }} />
                    Customer Notes
                  </p>
                  <p className={styles.secVal} style={{ fontWeight: 400, fontStyle: "italic" }}>
                    "{d.notes}"
                  </p>
                </div>
              )}

              {/* Status actions */}
              {!isTerminal ? (
                <div className={styles.section}>
                  <p className={styles.secLabel}>Update Status</p>
                  <p className={styles.secMeta} style={{ marginBottom: 10 }}>
                    Click an action below. A confirmation will appear before saving.
                  </p>

                  {progressStatuses.length > 0 && (
                    <div className={styles.statusGrid}>
                      {progressStatuses.map((s) => {
                        const c = STATUS_CFG[s];
                        return (
                          <button
                            key={s}
                            className={styles.statusBtn}
                            style={{ background: c.bg, color: c.color, borderColor: c.border }}
                            onClick={() => requestStatusChange(s)}
                          >
                            {c.label}
                            <Icon.ChevronRight size={12} color="currentColor" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {canCancel && (
                    <div className={styles.dangerZone}>
                      {progressStatuses.length > 0 && (
                        <p className={styles.dangerLabel}>Danger Zone</p>
                      )}
                      <button
                        className={styles.cancelBtn}
                        onClick={() => requestStatusChange("cancelled")}
                      >
                        <Icon.X size={13} color="currentColor" />
                        Cancel this order
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={styles.terminal}
                  style={{
                    background:  currentStatus === "received" ? "#f0fdf4" : currentStatus === "delivered" ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 10,
                  }}
                >
                  <p className={styles.terminalTitle} style={{ color: cfg.color }}>
                    {cfg.label}
                  </p>
                  <p className={styles.terminalSub}>No further actions available</p>
                </div>
              )}

              {/* Timestamps */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#9ca3af" }}>
                <span style={{ lineHeight: "18px" }}>
                  Placed: {fmtDate(listRow.created_at)}
                </span>
                {listRow.updated_at && listRow.updated_at !== listRow.created_at && (
                  <span style={{ lineHeight: "18px" }}>
                    · Updated: {fmtDate(listRow.updated_at)}
                  </span>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {confirming && pendingStatus && (
        <ConfirmModal
          from={currentStatus}
          to={pendingStatus}
          updating={updating}
          onConfirm={handleConfirm}
          onCancel={() => {
            if (!updating) {
              setConfirming(false);
              setPendingStatus(null);
            }
          }}
        />
      )}
    </>
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

  /* Stats */
  useEffect(() => {
    setStatsLoading(true);
    sellerApi
      .get("/api/seller/orders/stats")
      .then(({ data }) => { if (data.success) setStats(data.data); })
      .catch((err) => console.warn("[Orders] stats:", err.message))
      .finally(() => setStatsLoading(false));
  }, []);

  /* Load orders */
  const load = useCallback(async (resetPage = false) => {
    const targetPage = resetPage ? 1 : page;
    if (resetPage) { setPage(1); setLoading(true); }
    setError(null);
    try {
      const { data } = await sellerApi.get("/api/seller/orders", {
        params: {
          page:  targetPage,
          limit: LIMIT,
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(searchQuery.trim()     && { search: searchQuery.trim() }),
        },
      });
      if (data.success) {
        const rows = data.data?.orders     ?? [];
        const pag  = data.data?.pagination ?? {};
        setOrders(rows);
        setTotalPages(pag.totalPages ?? 1);
        setTotalItems(pag.totalItems ?? rows.length);
      } else {
        setError(data.message ?? "Failed to load orders");
      }
    } catch (err) {
      setError(err.response?.data?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, page]);

  useEffect(() => { load(true); }, [statusFilter]);       // eslint-disable-line
  useEffect(() => { if (!loading) load(false); }, [page]); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(() => load(true), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);                                       // eslint-disable-line
  useEffect(() => {
    const iv = setInterval(() => {
      if (!selected && !loading) load(false);
    }, 30_000);
    return () => clearInterval(iv);
  }, [selected, loading]);                                 // eslint-disable-line

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const displayedOrders = useMemo(() => orders, [orders]);

  /* Stat cards config */
  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        icon: <Icon.Package size={18} color="#6366f1" />,
        label: "Total Orders",
        value: stats.counts?.total ?? 0,
        border: "#e5e7eb", bg: "#fff", color: "#111827",
        show: true,
      },
      {
        icon: <Icon.Clock size={18} color="#92400e" />,
        label: "Pending",
        value: stats.counts?.pending ?? 0,
        border: "#fde68a", bg: "#fffbeb", color: "#92400e",
        show: (stats.counts?.pending ?? 0) > 0,
      },
      {
        icon: <Icon.Package size={18} color="#1e40af" />,
        label: "Processing",
        value: stats.counts?.processing ?? 0,
        border: "#bfdbfe", bg: "#eff6ff", color: "#1e40af",
        show: (stats.counts?.processing ?? 0) > 0,
      },
      {
        icon: <Icon.Truck size={18} color="#0369a1" />,
        label: "Shipped",
        value: stats.counts?.shipped ?? 0,
        border: "#bae6fd", bg: "#f0f9ff", color: "#0369a1",
        show: (stats.counts?.shipped ?? 0) > 0,
      },
      {
        icon: <Icon.Dollar size={18} color="#065f46" />,
        label: "Revenue",
        value: fmt(stats.revenue?.confirmed ?? 0),
        border: "#a7f3d0", bg: "#ecfdf5", color: "#065f46",
        show: true,
      },
    ].filter((c) => c.show);
  }, [stats]);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Orders</h2>
          <p className={styles.subtitle}>
            {totalItems > 0
              ? `${totalItems.toLocaleString()} order${totalItems !== 1 ? "s" : ""}`
              : "Manage and fulfil customer orders"}
          </p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={refresh}
          disabled={refreshing || loading}
        >
          <span className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ""}`}>
            <Icon.Refresh size={14} color="currentColor" />
          </span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Stats */}
      {!statsLoading && statCards.length > 0 && (
        <div className={styles.statsRow}>
          {statCards.map((card) => (
            <div
              key={card.label}
              className={styles.statCard}
              style={{ borderColor: card.border, background: card.bg }}
            >
              <div className={styles.statIcon}>{card.icon}</div>
              <div>
                <p className={styles.statLabel}>{card.label}</p>
                <p className={styles.statValue} style={{ color: card.color }}>
                  {typeof card.value === "number"
                    ? card.value.toLocaleString()
                    : card.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <Icon.Search size={15} color="#9ca3af" />
        <input
          type="text"
          placeholder="Search by tracking ID, customer name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        {searchQuery && (
          <button className={styles.clearBtn} onClick={() => setSearchQuery("")}>
            <Icon.X size={10} />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className={styles.filterRow}>
        {FILTERS.map(({ key, label }) => {
          const count = key !== "all" ? (stats?.counts?.[key] ?? null) : null;
          return (
            <button
              key={key}
              className={`${styles.filterTab} ${statusFilter === key ? styles.active : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
              {count !== null && count > 0 && (
                <span className={styles.filterCount}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorBanner}>
          <Icon.AlertTriangle size={15} color="currentColor" />
          <span>{error}</span>
          <button className={styles.retryBtn} onClick={() => load(true)}>
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <Spin size={28} />
            <p className={styles.loadingText}>Loading orders…</p>
          </div>

        ) : displayedOrders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Icon.Inbox size={40} color="#d1d5db" />
            </div>
            <p className={styles.emptyTitle}>
              {searchQuery
                ? "No orders match your search"
                : statusFilter !== "all"
                  ? `No ${statusFilter} orders`
                  : "No orders yet"}
            </p>
            <p className={styles.emptySub}>
              {searchQuery
                ? `Try a different tracking ID or name`
                : "Orders will appear here as customers place them"}
            </p>
            {(searchQuery || statusFilter !== "all") && (
              <button
                className={styles.emptyBtn}
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
              >
                Clear Filters
              </button>
            )}
          </div>

        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {["Order ID", "Customer", "Amount", "Items", "Status", "Payment", "Date", ""].map((h) => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedOrders.map((o) => (
                    <tr
                      key={o.id}
                      className={styles.tr}
                      onClick={() => setSelected(o)}
                    >
                      <td className={styles.td}>
                        <p className={styles.orderId}>
                          {o.tracking_id ?? `#${o.id.slice(0, 8).toUpperCase()}`}
                        </p>
                        {o.parent_tracking_id && o.parent_tracking_id !== o.tracking_id && (
                          <p className={styles.orderSub}>{o.parent_tracking_id}</p>
                        )}
                      </td>

                      <td className={styles.td}>
                        <p className={styles.customerName}>
                          {o.buyer_name ?? "Guest"}
                        </p>
                        {(o.city || o.state) && (
                          <p className={styles.customerLoc}>
                            {[o.city, o.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </td>

                      <td className={styles.td}>
                        <span className={styles.amount}>
                          {fmt(o.subtotal ?? 0)}
                        </span>
                      </td>

                      <td className={styles.td}>
                        <span className={styles.itemCount}>
                          {o.item_count != null ? `${o.item_count}` : "—"}
                        </span>
                      </td>

                      <td className={styles.td}>
                        <Badge status={o.status} />
                      </td>

                      <td className={styles.td}>
                        <PaymentBadge
                          status={o.payment_status}
                          method={o.payment_method}
                        />
                      </td>

                      <td className={styles.td}>
                        <span className={styles.dateText}>
                          {fmtRelative(o.created_at)}
                        </span>
                      </td>

                      <td className={styles.td}>
                        <div className={styles.chevron}>
                          <Icon.ChevronRight size={13} color="#9ca3af" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagBar}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <Icon.ChevronLeft size={13} />
                  Prev
                </button>

                <span className={styles.pagInfo}>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  {totalItems > 0 && (
                    <span style={{ color: "#d1d5db", margin: "0 5px" }}>
                      · {totalItems.toLocaleString()} total
                    </span>
                  )}
                </span>

                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <Icon.ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail panel */}
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