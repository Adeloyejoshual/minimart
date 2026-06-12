// SuperAdmin/Withdrawals.jsx

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", {
        day:    "2-digit",
        month:  "short",
        year:   "numeric",
        hour:   "2-digit",
        minute: "2-digit",
      })
    : "—";

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS = {
  pending:    { label: "Pending",    color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "⏳" },
  approved:   { label: "Approved",   color: "#0369a1", bg: "#eff6ff", border: "#bae6fd", icon: "👍" },
  processing: { label: "Processing", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", icon: "⚡" },
  success:    { label: "Paid",       color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0", icon: "✅" },
  paid:       { label: "Paid",       color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0", icon: "✅" },
  failed:     { label: "Failed",     color: "#991b1b", bg: "#fef2f2", border: "#fecaca", icon: "❌" },
  rejected:   { label: "Rejected",   color: "#7c2d12", bg: "#fff7ed", border: "#fed7aa", icon: "🚫" },
  cancelled:  { label: "Cancelled",  color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", icon: "✕"  },
};

const STATUS_FILTERS = [
  { key: "",           label: "All"        },
  { key: "pending",    label: "Pending"    },
  { key: "approved",   label: "Approved"   },
  { key: "processing", label: "Processing" },
  { key: "success",    label: "Paid"       },
  { key: "failed",     label: "Failed"     },
  { key: "rejected",   label: "Rejected"   },
];

const BASE_URL = "https://minimart-ivrm.onrender.com/api/admin";

// ─────────────────────────────────────────────────────────────
// SHARED BADGE
// ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span style={{
      padding:      "0.2rem 0.6rem",
      borderRadius: "100px",
      fontSize:     "0.7rem",
      fontWeight:   700,
      background:   s.bg,
      color:        s.color,
      border:       `1px solid ${s.border}`,
      display:      "inline-flex",
      alignItems:   "center",
      gap:          "0.25rem",
      whiteSpace:   "nowrap",
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// SKELETON ROW
// ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 6 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 8 }).map((__, j) => (
        <td key={j} style={{ padding: "0.9rem 1rem" }}>
          <div style={{
            height:          12,
            borderRadius:    6,
            background:      "#f3f4f6",
            backgroundImage: "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
            backgroundSize:  "400px 100%",
            animation:       "shimmer 1.4s infinite",
            width:           j === 0 ? "60%" : "80%",
          }} />
        </td>
      ))}
    </tr>
  ));
}

// ─────────────────────────────────────────────────────────────
// APPROVE / REJECT MODAL
// ─────────────────────────────────────────────────────────────
function ActionModal({ withdrawal, action, onClose, onDone, api }) {
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const textRef               = useRef(null);

  const isApprove = action === "approve";

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 100);
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!isApprove && !note.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(
        `/withdrawals/${withdrawal.id}/${action}`,
        { admin_note: note.trim() || null }
      );
      onDone();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ?? `${action} failed. Try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0,0,0,0.55)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        zIndex:         2000,
        padding:        "1rem",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    "white",
          borderRadius:  "20px",
          width:         "100%",
          maxWidth:      "460px",
          boxShadow:     "0 20px 60px rgba(0,0,0,0.15)",
          overflow:      "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding:    "1.25rem 1.5rem",
          borderBottom: "1px solid #f3f4f6",
          display:    "flex",
          alignItems: "center",
          gap:        "0.75rem",
        }}>
          <div style={{
            width:           "42px",
            height:          "42px",
            borderRadius:    "12px",
            background:      isApprove
              ? "linear-gradient(135deg,#10b981,#059669)"
              : "linear-gradient(135deg,#ef4444,#dc2626)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        "1.25rem",
            flexShrink:      0,
          }}>
            {isApprove ? "✅" : "❌"}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontWeight: 800, color: "#1f2937",
              margin: 0, fontSize: "1rem" }}>
              {isApprove ? "Approve Withdrawal" : "Reject Withdrawal"}
            </h3>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem",
              margin: "0.1rem 0 0" }}>
              {withdrawal.store_name ?? withdrawal.vendor_id}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none",
              cursor: "pointer", color: "#9ca3af",
              fontSize: "1.1rem", padding: "0.2rem" }}
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <div style={{
          margin:        "1.25rem 1.5rem 0",
          background:    "#f8fafc",
          borderRadius:  "12px",
          padding:       "0.875rem 1rem",
          border:        "1px solid #e5e7eb",
        }}>
          {[
            { label: "Amount",        value: fmt(withdrawal.amount)     },
            { label: "Fee",           value: Number(withdrawal.fee) === 0
              ? "🎁 Free"
              : fmt(withdrawal.fee)                                      },
            { label: "Seller gets",   value: fmt(withdrawal.net_amount) },
            { label: "Bank",          value: withdrawal.bank_name        },
            { label: "Account",       value: `${withdrawal.account_name} — ${withdrawal.account_number}` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display:         "flex",
              justifyContent:  "space-between",
              padding:         "0.4rem 0",
              borderBottom:    "1px solid #f3f4f6",
              fontSize:        "0.82rem",
            }}>
              <span style={{ color: "#6b7280" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "#1f2937" }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Note textarea */}
        <div style={{ padding: "1rem 1.5rem" }}>
          <label style={{
            fontSize:    "0.78rem",
            fontWeight:  600,
            color:       "#374151",
            display:     "block",
            marginBottom: "0.4rem",
          }}>
            {isApprove ? "Admin Note (optional)" : "Rejection Reason *"}
          </label>
          <textarea
            ref={textRef}
            value={note}
            onChange={(e) => { setNote(e.target.value); setError(null); }}
            placeholder={
              isApprove
                ? "Optional note for your records…"
                : "Reason for rejection (shown to seller)…"
            }
            rows={3}
            style={{
              width:         "100%",
              border:        "1.5px solid #e5e7eb",
              borderRadius:  "10px",
              padding:       "0.65rem 0.875rem",
              fontSize:      "0.85rem",
              fontFamily:    "inherit",
              resize:        "vertical",
              boxSizing:     "border-box",
              outline:       "none",
              transition:    "border-color 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }}
            onBlur={(e)  => { e.target.style.borderColor = "#e5e7eb"; }}
          />

          {error && (
            <p style={{ color: "#ef4444", fontSize: "0.78rem",
              margin: "0.4rem 0 0", fontWeight: 500 }}>
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding:         "0 1.5rem 1.5rem",
          display:         "flex",
          gap:             "0.75rem",
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex:          1,
              padding:       "0.75rem",
              border:        "1px solid #e5e7eb",
              borderRadius:  "10px",
              background:    "white",
              cursor:        "pointer",
              fontWeight:    600,
              fontSize:      "0.875rem",
              color:         "#374151",
              fontFamily:    "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex:          2,
              padding:       "0.75rem",
              border:        "none",
              borderRadius:  "10px",
              background:    isApprove
                ? "linear-gradient(135deg,#10b981,#059669)"
                : "linear-gradient(135deg,#ef4444,#dc2626)",
              color:         "white",
              cursor:        loading ? "not-allowed" : "pointer",
              fontWeight:    700,
              fontSize:      "0.875rem",
              fontFamily:    "inherit",
              opacity:       loading ? 0.7 : 1,
              display:       "flex",
              alignItems:    "center",
              justifyContent: "center",
              gap:           "0.5rem",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width:        16,
                  height:       16,
                  border:       "2px solid rgba(255,255,255,0.4)",
                  borderTop:    "2px solid white",
                  borderRadius: "50%",
                  display:      "inline-block",
                  animation:    "spin 0.7s linear infinite",
                }} />
                {isApprove ? "Approving…" : "Rejecting…"}
              </>
            ) : (
              isApprove ? "✅ Approve & Send" : "❌ Reject"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DETAIL DRAWER
// ─────────────────────────────────────────────────────────────
function DetailDrawer({ withdrawal, onClose, onAction }) {
  if (!withdrawal) return null;

  const canApprove = withdrawal.status === "pending";
  const canReject  = ["pending", "approved"].includes(withdrawal.status);
  const s          = STATUS[withdrawal.status] ?? STATUS.pending;

  const gradients = {
    success:    "135deg,#059669,#10b981",
    paid:       "135deg,#059669,#10b981",
    failed:     "135deg,#dc2626,#ef4444",
    rejected:   "135deg,#7c2d12,#b91c1c",
    processing: "135deg,#4f46e5,#7c3aed",
    approved:   "135deg,#0369a1,#0ea5e9",
    pending:    "135deg,#92400e,#d97706",
    cancelled:  "135deg,#4b5563,#6b7280",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position:        "fixed",
          inset:           0,
          background:      "rgba(0,0,0,0.35)",
          backdropFilter:  "blur(2px)",
          zIndex:          1000,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position:       "fixed",
        top:            0,
        right:          0,
        height:         "100vh",
        width:          "100%",
        maxWidth:       "460px",
        background:     "white",
        zIndex:         1001,
        overflowY:      "auto",
        display:        "flex",
        flexDirection:  "column",
        boxShadow:      "-8px 0 40px rgba(0,0,0,0.1)",
        animation:      "slideIn 0.22s ease",
      }}>

        {/* Header */}
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "flex-start",
          padding:        "1.25rem 1.5rem",
          borderBottom:   "1px solid #f3f4f6",
          position:       "sticky",
          top:            0,
          background:     "white",
          zIndex:         1,
        }}>
          <div>
            <h3 style={{ fontWeight: 800, color: "#1f2937",
              margin: 0, fontSize: "1.05rem" }}>
              Withdrawal Details
            </h3>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem",
              margin: "0.1rem 0 0" }}>
              {fmtDate(withdrawal.requested_at ?? withdrawal.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "#f8fafc", border: "1px solid #e5e7eb",
              borderRadius: "8px", padding: "0.4rem 0.55rem",
              cursor: "pointer", color: "#6b7280", fontSize: "0.9rem",
              lineHeight: 1, fontFamily: "inherit" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding:        "1.5rem",
          display:        "flex",
          flexDirection:  "column",
          gap:            "1.25rem",
          flex:           1,
        }}>

          {/* Hero */}
          <div style={{
            background:    `linear-gradient(${gradients[withdrawal.status] ?? gradients.pending})`,
            borderRadius:  "16px",
            padding:       "1.5rem",
            color:         "white",
            textAlign:     "center",
          }}>
            <p style={{ opacity: 0.75, fontSize: "0.75rem",
              margin: "0 0 0.25rem" }}>
              Withdrawal Amount
            </p>
            <p style={{ fontWeight: 800, fontSize: "2.25rem",
              margin: "0 0 1rem", lineHeight: 1 }}>
              {fmt(withdrawal.amount)}
            </p>
            <div style={{
              display:               "grid",
              gridTemplateColumns:   "1fr 1fr 1fr",
              gap:                   "0.5rem",
              background:            "rgba(255,255,255,0.12)",
              borderRadius:          "10px",
              padding:               "0.75rem",
            }}>
              {[
                { label: "Fee",
                  value: Number(withdrawal.fee) === 0
                    ? "🎁 Free"
                    : fmt(withdrawal.fee) },
                { label: "Seller Gets",
                  value: fmt(withdrawal.net_amount) },
                { label: "Status",
                  value: `${s.icon} ${s.label}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ opacity: 0.65, fontSize: "0.62rem",
                    margin: "0 0 0.15rem", textTransform: "uppercase",
                    letterSpacing: "0.05em" }}>
                    {label}
                  </p>
                  <p style={{ fontWeight: 700, margin: 0,
                    fontSize: "0.8rem" }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Seller info */}
          <Section title="Seller">
            <Row label="Store"   value={withdrawal.store_name    ?? "—"} />
            <Row label="Email"   value={withdrawal.seller_email  ?? "—"} />
            <Row label="Vendor ID" value={withdrawal.vendor_id}
              mono truncate />
          </Section>

          {/* Bank details */}
          <Section title="Bank Details">
            <Row label="Account Name"
              value={withdrawal.account_name}   />
            <Row label="Account Number"
              value={withdrawal.account_number} mono />
            <Row label="Bank"
              value={withdrawal.bank_name}      />
            <Row label="Bank Code"
              value={withdrawal.bank_code}      mono />
          </Section>

          {/* References */}
          <Section title="References">
            <Row label="Tx Ref"
              value={withdrawal.tx_ref}         mono truncate />
            {withdrawal.flw_transfer_id && (
              <Row label="FLW Transfer ID"
                value={String(withdrawal.flw_transfer_id)} mono />
            )}
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            <Row label="Requested"
              value={fmtDate(withdrawal.requested_at ?? withdrawal.created_at)} />
            {withdrawal.approved_at && (
              <Row label="Approved"
                value={fmtDate(withdrawal.approved_at)} />
            )}
            {withdrawal.processed_at && (
              <Row label="Processed"
                value={fmtDate(withdrawal.processed_at)} />
            )}
          </Section>

          {/* Admin note */}
          {withdrawal.admin_note && (
            <div style={{ background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: "10px", padding: "0.875rem 1rem" }}>
              <p style={{ fontWeight: 700, color: "#0369a1",
                fontSize: "0.72rem", margin: "0 0 0.3rem",
                textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Admin Note
              </p>
              <p style={{ color: "#0c4a6e", fontSize: "0.875rem",
                margin: 0 }}>
                {withdrawal.admin_note}
              </p>
            </div>
          )}

          {/* Failure reason */}
          {withdrawal.failure_reason && (
            <div style={{ background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px", padding: "0.875rem 1rem" }}>
              <p style={{ fontWeight: 700, color: "#991b1b",
                fontSize: "0.72rem", margin: "0 0 0.3rem",
                textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Failure Reason
              </p>
              <p style={{ color: "#b91c1c", fontSize: "0.875rem",
                margin: 0 }}>
                {withdrawal.failure_reason}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {(canApprove || canReject) && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {canApprove && (
                <button
                  onClick={() => onAction(withdrawal, "approve")}
                  style={{
                    flex:          1,
                    padding:       "0.875rem",
                    background:    "linear-gradient(135deg,#10b981,#059669)",
                    color:         "white",
                    border:        "none",
                    borderRadius:  "12px",
                    fontWeight:    700,
                    cursor:        "pointer",
                    fontSize:      "0.875rem",
                    fontFamily:    "inherit",
                  }}
                >
                  ✅ Approve
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => onAction(withdrawal, "reject")}
                  style={{
                    flex:          1,
                    padding:       "0.875rem",
                    background:    "white",
                    color:         "#ef4444",
                    border:        "1px solid #fecaca",
                    borderRadius:  "12px",
                    fontWeight:    700,
                    cursor:        "pointer",
                    fontSize:      "0.875rem",
                    fontFamily:    "inherit",
                  }}
                >
                  ❌ Reject
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// Small helpers for the drawer
function Section({ title, children }) {
  return (
    <div>
      <p style={{ fontSize: "0.68rem", fontWeight: 700,
        color: "#9ca3af", textTransform: "uppercase",
        letterSpacing: "0.07em", margin: "0 0 0.5rem" }}>
        {title}
      </p>
      <div style={{ background: "#f8fafc", borderRadius: "10px",
        padding: "0.2rem 1rem", border: "1px solid #e5e7eb" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono, truncate }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "center", padding: "0.5rem 0",
      borderBottom: "1px solid #f3f4f6", gap: "0.5rem" }}>
      <span style={{ color: "#6b7280", fontSize: "0.78rem",
        flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontWeight:   600,
        color:        "#1f2937",
        fontSize:     "0.8rem",
        fontFamily:   mono ? "monospace" : "inherit",
        overflow:     truncate ? "hidden" : undefined,
        textOverflow: truncate ? "ellipsis" : undefined,
        whiteSpace:   truncate ? "nowrap" : undefined,
        maxWidth:     truncate ? "200px" : undefined,
      }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN WITHDRAWALS PAGE
// ═════════════════════════════════════════════════════════════
export default function Withdrawals({ api, confirm, onMutation }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [summary,     setSummary]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [statusFilter,setStatusFilter]= useState("");
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(1);
  const [pagination,  setPagination]  = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [actionModal, setActionModal] = useState(null);
  // actionModal = { withdrawal, action: "approve" | "reject" }

  const limit = 20;

  // ── Load withdrawals ───────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...(statusFilter && { status: statusFilter }),
        ...(search.trim() && { q: search.trim() }),
      });

      const { data } = await api.get(
        `/withdrawals?${params.toString()}`
      );

      setWithdrawals(data.withdrawals ?? data.data ?? []);
      setPagination(data.pagination ?? null);
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(
        err.response?.data?.message ?? "Failed to load withdrawals"
      );
    } finally {
      setLoading(false);
    }
  }, [api, page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  // ── Search debounce ────────────────────────────────────────
  const searchTimer = useRef(null);
  const handleSearch = (val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  // ── After approve / reject ─────────────────────────────────
  const handleActionDone = useCallback(() => {
    load();
    onMutation?.();
  }, [load, onMutation]);

  // ── Summary cards ──────────────────────────────────────────
  const cards = [
    { label: "Total Requests",  value: summary?.total            ?? "—"  },
    { label: "Pending",         value: summary?.pending          ?? "—",
      highlight: (summary?.pending ?? 0) > 0                             },
    { label: "Total Paid Out",  value: fmt(summary?.total_paid_out)      },
    { label: "Total Fees",      value: fmt(summary?.total_fees)          },
    { label: "Failed",          value: summary?.failed           ?? "—",
      danger: (summary?.failed ?? 0) > 0                                 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column",
      gap: "1.25rem" }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: "1.35rem",
            color: "var(--fg, #1f2937)", margin: 0 }}>
            💸 Withdrawals
          </h2>
          <p style={{ color: "var(--muted, #6b7280)",
            fontSize: "0.85rem", margin: "0.2rem 0 0" }}>
            Approve or reject seller payout requests
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ background: "white", border: "1px solid #e5e7eb",
            borderRadius: "10px", padding: "0.55rem 1rem",
            cursor: "pointer", color: "#6b7280", fontSize: "0.85rem",
            fontWeight: 500, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <span style={{ display: "inline-block",
            animation: loading
              ? "spin 0.7s linear infinite" : "none" }}>
            ↻
          </span>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────── */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
        gap: "0.875rem" }}>
        {cards.map((c) => (
          <div key={c.label} style={{
            background:   "white",
            border:       c.highlight || c.danger
              ? `1px solid ${c.danger ? "#fecaca" : "#fde68a"}`
              : "1px solid #f3f4f6",
            borderRadius: "14px",
            padding:      "1.1rem 1.25rem",
            boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <p style={{ fontSize: "0.72rem", color: "#9ca3af",
              margin: "0 0 0.4rem", fontWeight: 500 }}>
              {c.label}
            </p>
            <p style={{ fontSize: "1.3rem", fontWeight: 800,
              margin: 0,
              color: c.danger
                ? "#ef4444"
                : c.highlight
                  ? "#d97706"
                  : "#1f2937" }}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Table card ─────────────────────────────────── */}
      <div style={{ background: "white", borderRadius: "16px",
        border: "1px solid #f3f4f6", overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

        {/* Toolbar */}
        <div style={{ padding: "0.875rem 1.25rem",
          borderBottom: "1px solid #f3f4f6",
          display: "flex", flexWrap: "wrap", gap: "0.75rem",
          alignItems: "center" }}>

          {/* Search */}
          <input
            type="search"
            placeholder="Search store, account, ref…"
            onChange={(e) => handleSearch(e.target.value)}
            style={{ flex: "1 1 200px", padding: "0.55rem 0.875rem",
              border: "1px solid #e5e7eb", borderRadius: "8px",
              fontSize: "0.82rem", fontFamily: "inherit",
              outline: "none", background: "#f8fafc" }}
          />

          {/* Status filter pills */}
          <div style={{ display: "flex", gap: "0.3rem",
            flexWrap: "wrap" }}>
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1); }}
                style={{
                  padding:      "0.3rem 0.75rem",
                  borderRadius: "100px",
                  border:       "1px solid",
                  cursor:       "pointer",
                  fontSize:     "0.72rem",
                  fontWeight:   statusFilter === key ? 700 : 500,
                  background:   statusFilter === key ? "#6366f1" : "white",
                  color:        statusFilter === key ? "white" : "#6b7280",
                  borderColor:  statusFilter === key ? "#6366f1" : "#e5e7eb",
                  fontFamily:   "inherit",
                  whiteSpace:   "nowrap",
                  transition:   "all 0.15s",
                }}
              >
                {label}
                {key === "pending" && (summary?.pending ?? 0) > 0 && (
                  <span style={{
                    marginLeft:   "0.3rem",
                    background:   statusFilter === "pending"
                      ? "rgba(255,255,255,0.3)"
                      : "#ef4444",
                    color:        "white",
                    borderRadius: "100px",
                    padding:      "0 0.35rem",
                    fontSize:     "0.65rem",
                    fontWeight:   700,
                  }}>
                    {summary.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "1rem 1.25rem",
            background: "#fef2f2", color: "#991b1b",
            fontSize: "0.85rem", borderBottom: "1px solid #fecaca" }}>
            ⚠️ {error}
            <button onClick={load} style={{ marginLeft: "1rem",
              textDecoration: "underline", background: "none",
              border: "none", cursor: "pointer", color: "#991b1b",
              fontFamily: "inherit", fontSize: "0.85rem" }}>
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse",
            fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc",
                borderBottom: "1px solid #f3f4f6" }}>
                {[
                  "Seller / Bank",
                  "Amount",
                  "Fee",
                  "Seller Gets",
                  "Status",
                  "Requested",
                  "Ref",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={{
                    padding:    "0.7rem 1rem",
                    textAlign:  "left",
                    fontWeight: 600,
                    color:      "#6b7280",
                    fontSize:   "0.72rem",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "4rem",
                    textAlign: "center", color: "#9ca3af" }}>
                    <div style={{ fontSize: "2rem" }}>📭</div>
                    <p style={{ margin: "0.5rem 0 0",
                      fontWeight: 600, color: "#374151" }}>
                      No {statusFilter || ""} withdrawals found
                    </p>
                  </td>
                </tr>
              ) : (
                withdrawals.map((wd) => {
                  const canApprove = wd.status === "pending";
                  const canReject  = ["pending","approved"].includes(wd.status);

                  return (
                    <tr
                      key={wd.id}
                      onClick={() => setSelected(wd)}
                      style={{
                        borderBottom: "1px solid #f9fafb",
                        cursor:       "pointer",
                        transition:   "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "";
                      }}
                    >
                      {/* Seller / Bank */}
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <p style={{ fontWeight: 600, color: "#1f2937",
                          margin: 0, fontSize: "0.82rem" }}>
                          {wd.store_name ?? wd.vendor_id?.slice(0, 8)}
                        </p>
                        <p style={{ color: "#9ca3af", margin: "0.1rem 0 0",
                          fontSize: "0.72rem" }}>
                          {wd.bank_name} ••••
                          {wd.account_number?.slice(-4)}
                        </p>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: "0.9rem 1rem",
                        fontWeight: 700, color: "#1f2937" }}>
                        {fmt(wd.amount)}
                      </td>

                      {/* Fee */}
                      <td style={{ padding: "0.9rem 1rem" }}>
                        {Number(wd.fee) === 0 ? (
                          <span style={{ color: "#10b981",
                            fontWeight: 600, fontSize: "0.75rem" }}>
                            🎁 Free
                          </span>
                        ) : (
                          <span style={{ color: "#6b7280" }}>
                            {fmt(wd.fee)}
                          </span>
                        )}
                      </td>

                      {/* Seller Gets */}
                      <td style={{ padding: "0.9rem 1rem",
                        fontWeight: 700, color: "#10b981" }}>
                        {fmt(wd.net_amount)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <Badge status={wd.status} />
                      </td>

                      {/* Requested */}
                      <td style={{ padding: "0.9rem 1rem",
                        color: "#6b7280", whiteSpace: "nowrap",
                        fontSize: "0.75rem" }}>
                        {fmtDate(wd.requested_at ?? wd.created_at)}
                        <span style={{ display: "block",
                          fontSize: "0.68rem", color: "#9ca3af" }}>
                          {timeAgo(wd.requested_at ?? wd.created_at)}
                        </span>
                      </td>

                      {/* Ref */}
                      <td style={{ padding: "0.9rem 1rem",
                        fontFamily: "monospace", fontSize: "0.72rem",
                        color: "#9ca3af", maxWidth: "120px",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap" }}>
                        {wd.tx_ref ?? "—"}
                      </td>

                      {/* Actions */}
                      <td
                        style={{ padding: "0.9rem 1rem" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          {canApprove && (
                            <button
                              onClick={() => setActionModal({
                                withdrawal: wd,
                                action: "approve",
                              })}
                              style={{
                                padding:      "0.35rem 0.7rem",
                                background:   "#ecfdf5",
                                color:        "#065f46",
                                border:       "1px solid #a7f3d0",
                                borderRadius: "8px",
                                cursor:       "pointer",
                                fontWeight:   700,
                                fontSize:     "0.72rem",
                                fontFamily:   "inherit",
                                whiteSpace:   "nowrap",
                              }}
                            >
                              ✅ Approve
                            </button>
                          )}
                          {canReject && (
                            <button
                              onClick={() => setActionModal({
                                withdrawal: wd,
                                action: "reject",
                              })}
                              style={{
                                padding:      "0.35rem 0.7rem",
                                background:   "#fef2f2",
                                color:        "#991b1b",
                                border:       "1px solid #fecaca",
                                borderRadius: "8px",
                                cursor:       "pointer",
                                fontWeight:   700,
                                fontSize:     "0.72rem",
                                fontFamily:   "inherit",
                                whiteSpace:   "nowrap",
                              }}
                            >
                              ❌ Reject
                            </button>
                          )}
                          {!canApprove && !canReject && (
                            <span style={{ color: "#d1d5db",
                              fontSize: "0.72rem" }}>
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div style={{
            display:         "flex",
            justifyContent:  "space-between",
            alignItems:      "center",
            padding:         "0.875rem 1.25rem",
            borderTop:       "1px solid #f3f4f6",
            flexWrap:        "wrap",
            gap:             "0.5rem",
          }}>
            <p style={{ fontSize: "0.78rem", color: "#9ca3af",
              margin: 0 }}>
              Page {pagination.page} of {pagination.total_pages} ·{" "}
              {pagination.total} total
            </p>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: "0.4rem 0.75rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px", background: "white",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  fontSize: "0.78rem", color: "#374151",
                  opacity: page === 1 ? 0.4 : 1,
                  fontFamily: "inherit" }}
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  setPage((p) =>
                    Math.min(pagination.total_pages, p + 1)
                  )
                }
                disabled={page === pagination.total_pages}
                style={{ padding: "0.4rem 0.75rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px", background: "white",
                  cursor: page === pagination.total_pages
                    ? "not-allowed" : "pointer",
                  fontSize: "0.78rem", color: "#374151",
                  opacity: page === pagination.total_pages ? 0.4 : 1,
                  fontFamily: "inherit" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ───────────────────────────────── */}
      {selected && (
        <DetailDrawer
          withdrawal={selected}
          onClose={() => setSelected(null)}
          onAction={(wd, action) => {
            setSelected(null);
            setActionModal({ withdrawal: wd, action });
          }}
        />
      )}

      {/* ── Action Modal ────────────────────────────────── */}
      {actionModal && (
        <ActionModal
          withdrawal={actionModal.withdrawal}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onDone={handleActionDone}
          api={api}
        />
      )}

      {/* ── Keyframes ───────────────────────────────────── */}
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0);    }
        }
      `}</style>
    </div>
  );
}