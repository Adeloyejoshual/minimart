// components/seller/dashboard/Payouts.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

// ── Seller API — always uses market.users token ───────────────
const sellerApi = {
  get: (url) =>
    axios.get(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      timeout: 15_000,
    }),
  post: (url, data) =>
    axios.post(url, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      timeout: 15_000,
    }),
};

// ── Format Naira ──────────────────────────────────────────────
const fmt = (v, d = 2) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
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
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-NG");
};

const copy = (t) => {
  navigator.clipboard.writeText(t).then(() => alert("Copied!")).catch(() => {});
};

// ── Status config ─────────────────────────────────────────────
const STATUS = {
  pending:    { label: "Pending",    bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  processing: { label: "Processing", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  success:    { label: "Success",    bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
  failed:     { label: "Failed",     bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  cancelled:  { label: "Cancelled",  bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
};

const StatusBadge = ({ status }) => {
  const c = STATUS[status] ?? STATUS.pending;
  return (
    <span style={{
      padding:      "0.2rem 0.65rem",
      borderRadius: "100px",
      fontSize:     "0.72rem",
      fontWeight:   700,
      background:   c.bg,
      color:        c.color,
      border:       `1px solid ${c.border}`,
      display:      "inline-block",
      whiteSpace:   "nowrap",
    }}>
      {c.label}
    </span>
  );
};

// ── Spinner ───────────────────────────────────────────────────
const Spin = ({ size = 20 }) => (
  <span style={{
    width:        size,
    height:       size,
    border:       "2.5px solid #e5e7eb",
    borderTop:    "2.5px solid #6366f1",
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
    flexShrink:   0,
  }} />
);

// ══════════════════════════════════════════════════════════════
// WITHDRAW MODAL
// ══════════════════════════════════════════════════════════════
const WithdrawModal = ({ info, onClose, onSuccess }) => {
  const [amount,    setAmount]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState({ type: "", text: "" });
  const [idemKey]                 = useState(
    `WD-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const { wallet, bank, limits } = info;
  const parsed    = parseFloat(amount) || 0;
  const available = Number(wallet?.available_balance ?? 0);

  // Client-side fee preview (mirrors server logic)
  const feePreview = useMemo(() => {
    if (!parsed || parsed <= 0) return null;
    const today = limits?.withdrawals_today ?? 0;
    let fee = 0;
    if (today >= 3) {
      if (parsed <= 9_999)   fee = 50;
      else if (parsed <= 99_999)  fee = 100;
      else if (parsed <= 500_000) fee = 150;
      else                        fee = 200;
    }
    return { amount: parsed, fee, net: parsed - fee, free: fee === 0 };
  }, [parsed, limits]);

  const handleWithdraw = async () => {
    if (!parsed || parsed < (limits?.min_withdrawal ?? 500)) {
      setMsg({ type: "error", text: `Minimum is ${fmt(limits?.min_withdrawal ?? 500)}` });
      return;
    }
    if (parsed > available) {
      setMsg({ type: "error", text: `Insufficient. Available: ${fmt(available)}` });
      return;
    }

    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      const { data } = await sellerApi.post("/api/seller/payout/withdraw", {
        amount:          parsed,
        idempotency_key: idemKey,
      });

      if (data.success) {
        setMsg({ type: "success", text: data.message ?? "Withdrawal initiated!" });
        setTimeout(() => { onSuccess(); onClose(); }, 1800);
      } else {
        setMsg({ type: "error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Withdrawal failed. Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={ms.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>💸</span>
            <h2 style={ms.title}>Withdraw Funds</h2>
          </div>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Free withdrawal badge */}
        {(limits?.free_remaining ?? 0) > 0 && (
          <div style={ms.freeBadge}>
            🎁 {limits.free_remaining} free withdrawal
            {limits.free_remaining > 1 ? "s" : ""} remaining today — no fees!
          </div>
        )}

        {/* Payout bank */}
        <div style={ms.bankBox}>
          <p style={ms.smallLabel}>Payout to</p>
          {bank?.bank_name ? (
            <>
              <p style={ms.bankName}>{bank.account_name}</p>
              <p style={ms.bankSub}>
                {bank.account_number} · {bank.bank_name}
              </p>
            </>
          ) : (
            <p style={{ color: "#ef4444", fontSize: "0.875rem", margin: 0 }}>
              ⚠️ No bank configured — update in Settings
            </p>
          )}
        </div>

        {/* Available */}
        <div style={ms.availRow}>
          <span style={{ color: "#6b7280" }}>Available balance</span>
          <span style={{ fontWeight: 800, color: "#10b981", fontSize: "1.15rem" }}>
            {fmt(available)}
          </span>
        </div>

        {/* Quick amounts */}
        <div style={ms.quickRow}>
          {[25, 50, 75, 100].map((pct) => {
            const val = Math.min(
              parseFloat(((available * pct) / 100).toFixed(2)),
              limits?.max_withdrawal ?? available
            );
            return (
              <button
                key={pct}
                onClick={() => setAmount(String(val))}
                style={{ ...ms.quickBtn, background: parsed === val ? "#6366f1" : "#f8fafc", color: parsed === val ? "white" : "#374151", borderColor: parsed === val ? "#6366f1" : "#e5e7eb" }}
              >
                {pct}%
              </button>
            );
          })}
        </div>

        {/* Amount input */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <span style={ms.currencySign}>₦</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setMsg({ type: "", text: "" }); }}
            placeholder="0.00"
            style={ms.amtInput}
            autoFocus
          />
        </div>

        {/* Fee preview */}
        {feePreview && (
          <div style={{
            ...ms.feeBox,
            background: feePreview.free ? "#f0fdf4" : "#f0f9ff",
            borderColor: feePreview.free ? "#a7f3d0" : "#bfdbfe",
          }}>
            <div style={ms.feeRow}>
              <span style={{ color: "#6b7280" }}>Amount</span>
              <span style={{ fontWeight: 600 }}>{fmt(feePreview.amount)}</span>
            </div>
            <div style={ms.feeRow}>
              <span style={{ color: "#6b7280" }}>Fee</span>
              <span style={{ fontWeight: 600, color: feePreview.free ? "#10b981" : "#f59e0b" }}>
                {feePreview.free ? "🎁 Free" : `− ${fmt(feePreview.fee)}`}
              </span>
            </div>
            <div style={{ ...ms.feeDivider }} />
            <div style={ms.feeRow}>
              <span style={{ fontWeight: 700, color: "#1f2937" }}>You receive</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: feePreview.free ? "#10b981" : "#6366f1" }}>
                {fmt(feePreview.net)}
              </span>
            </div>
          </div>
        )}

        {/* Message */}
        {msg.text && (
          <div style={{
            padding:      "0.75rem 1rem",
            borderRadius: "10px",
            marginBottom: "1rem",
            background:   msg.type === "error" ? "#fef2f2" : "#ecfdf5",
            color:        msg.type === "error" ? "#991b1b" : "#065f46",
            border:       `1px solid ${msg.type === "error" ? "#fecaca" : "#a7f3d0"}`,
            fontSize:     "0.875rem",
            fontWeight:   500,
          }}>
            {msg.type === "error" ? "⚠️" : "✅"} {msg.text}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleWithdraw}
          disabled={loading || !amount || !bank?.bank_name}
          style={{
            ...ms.submitBtn,
            opacity: loading || !amount || !bank?.bank_name ? 0.6 : 1,
          }}
        >
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Spin size={18} /> Processing...
            </div>
          ) : (
            `💸 Withdraw ${parsed > 0 ? fmt(parsed) : ""}`
          )}
        </button>

        {/* Fee schedule info */}
        <div style={ms.feeInfo}>
          <p style={{ margin: 0, fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
            💡 Fee Schedule
          </p>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.78rem" }}>
            First 3 withdrawals per day: Free
          </p>
          {(limits?.fee_tiers ?? []).map((tier, i) => (
            <p key={i} style={{ margin: "0.15rem 0 0", color: "#6b7280", fontSize: "0.78rem" }}>
              {tier.label}: {tier.fee}
            </p>
          ))}
        </div>

      </div>
    </div>
  );
};

// Modal styles
const ms = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1000,
    padding:        "1rem",
    backdropFilter: "blur(4px)",
  },
  modal: {
    background:    "white",
    borderRadius:  "20px",
    padding:       "0",
    width:         "100%",
    maxWidth:      "420px",
    maxHeight:     "90vh",
    overflowY:     "auto",
    boxShadow:     "0 20px 60px rgba(0,0,0,0.2)",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "1.5rem 1.5rem 1rem",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    background:     "white",
    zIndex:         1,
    borderRadius:   "20px 20px 0 0",
  },
  title:    { fontWeight: 800, fontSize: "1.2rem", color: "#1f2937", margin: 0 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9ca3af", padding: "0.25rem" },
  freeBadge: {
    margin:       "0 1.5rem 1rem",
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "0.65rem 1rem",
    color:        "#065f46",
    fontSize:     "0.85rem",
    fontWeight:   600,
  },
  bankBox: {
    margin:       "0 1.5rem 1rem",
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
  },
  smallLabel: { fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600, margin: "0 0 0.35rem", textTransform: "uppercase" },
  bankName:   { fontWeight: 700, color: "#1f2937", margin: 0, fontSize: "0.95rem" },
  bankSub:    { color: "#6b7280", fontSize: "0.82rem", margin: "0.2rem 0 0" },
  availRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    margin:         "0 1.5rem",
    padding:        "0.75rem 0",
    borderBottom:   "1px solid #f3f4f6",
    marginBottom:   "1rem",
    fontSize:       "0.9rem",
  },
  quickRow: { display: "flex", gap: "0.5rem", margin: "0 1.5rem 1rem", flexWrap: "wrap" },
  quickBtn: {
    padding:      "0.4rem 0.75rem",
    borderRadius: "100px",
    border:       "1px solid",
    cursor:       "pointer",
    fontSize:     "0.82rem",
    fontWeight:   600,
    transition:   "all 0.15s",
    flex:         1,
  },
  currencySign: {
    position:   "absolute",
    left:       "1rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    fontWeight: 800,
    fontSize:   "1.2rem",
    color:      "#374151",
  },
  amtInput: {
    width:        "100%",
    padding:      "1rem 1rem 1rem 2.5rem",
    border:       "2px solid #e5e7eb",
    borderRadius: "12px",
    fontSize:     "1.5rem",
    fontWeight:   800,
    outline:      "none",
    boxSizing:    "border-box",
    margin:       "0 0 0",
  },
  feeBox: {
    borderRadius: "12px",
    padding:      "1rem",
    border:       "1px solid",
    margin:       "0 1.5rem 1rem",
    display:      "flex",
    flexDirection:"column",
    gap:          "0.5rem",
  },
  feeRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem" },
  feeDivider: { height: "1px", background: "rgba(0,0,0,0.06)" },
  submitBtn: {
    display:      "block",
    width:        "calc(100% - 3rem)",
    margin:       "0 1.5rem",
    padding:      "1rem",
    background:   "linear-gradient(135deg,#10b981,#059669)",
    color:        "white",
    border:       "none",
    borderRadius: "14px",
    fontWeight:   700,
    fontSize:     "1rem",
    cursor:       "pointer",
    textAlign:    "center",
  },
  feeInfo: {
    margin:       "1rem 1.5rem 1.5rem",
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    padding:      "0.875rem 1rem",
  },
};

// ══════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ══════════════════════════════════════════════════════════════
const DetailDrawer = ({ id, vendorId, onClose, onCancelled }) => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await sellerApi.get(
        `/api/seller/payout/withdrawal/${id}`
      );
      if (res.success) setData(res);
    } catch (err) {
      console.error("[DetailDrawer]", err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    if (!window.confirm("Cancel this withdrawal and restore your balance?")) return;
    setCancelling(true);
    try {
      const { data: res } = await sellerApi.post(
        `/api/seller/payout/withdrawal/${id}/cancel`
      );
      if (res.success) {
        alert("Cancelled. Balance restored.");
        onCancelled?.();
        onClose();
      } else {
        alert(res.message ?? "Cancellation failed");
      }
    } catch (err) {
      alert(err.response?.data?.message ?? "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  const wd = data?.withdrawal;

  return (
    <div style={dd.overlay}>
      <div style={dd.backdrop} onClick={onClose} />
      <div style={dd.drawer}>

        {/* Header */}
        <div style={dd.header}>
          <h3 style={dd.title}>Withdrawal Details</h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={dd.iconBtn} onClick={load} title="Refresh">↻</button>
            <button style={dd.iconBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <Spin size={28} />
          </div>
        ) : wd ? (
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <StatusBadge status={wd.status} />
              {data.live_status && (
                <span style={{ fontSize: "0.75rem", color: "#9ca3af", background: "#f9fafb", border: "1px solid #e5e7eb", padding: "0.2rem 0.6rem", borderRadius: "100px" }}>
                  FLW: {data.live_status}
                </span>
              )}
            </div>

            {/* Amount hero */}
            <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: "16px", padding: "1.5rem", color: "white", textAlign: "center" }}>
              <p style={{ opacity: 0.75, fontSize: "0.82rem", margin: "0 0 0.35rem" }}>Amount requested</p>
              <p style={{ fontWeight: 800, fontSize: "2.5rem", margin: "0 0 1rem" }}>{fmt(wd.amount)}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", background: "rgba(255,255,255,0.1)", borderRadius: "10px", padding: "0.875rem" }}>
                <div>
                  <p style={{ opacity: 0.7, fontSize: "0.72rem", margin: "0 0 0.2rem" }}>Fee</p>
                  <p style={{ fontWeight: 700, margin: 0 }}>
                    {Number(wd.fee) === 0 ? "🎁 Free" : `−${fmt(wd.fee)}`}
                  </p>
                </div>
                <div>
                  <p style={{ opacity: 0.7, fontSize: "0.72rem", margin: "0 0 0.2rem" }}>You receive</p>
                  <p style={{ fontWeight: 800, color: "#86efac", margin: 0 }}>
                    {fmt(wd.net_amount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Destination */}
            <Section title="Destination">
              {[
                ["Account Name",   wd.account_name],
                ["Account Number", wd.account_number],
                ["Bank",           wd.bank_name],
              ].map(([label, val]) => (
                <InfoRow key={label} label={label} value={val} />
              ))}
            </Section>

            {/* References */}
            <Section title="References">
              <InfoRow
                label="Tx Ref"
                value={wd.tx_ref}
                mono
                onCopy={() => copy(wd.tx_ref)}
              />
              {wd.flw_transfer_id && (
                <InfoRow
                  label="FLW Transfer"
                  value={wd.flw_transfer_id}
                  mono
                  onCopy={() => copy(wd.flw_transfer_id)}
                />
              )}
            </Section>

            {/* Timeline */}
            <Section title="Timeline">
              <InfoRow label="Requested" value={fmtDate(wd.requested_at)} sub={timeAgo(wd.requested_at)} />
              {wd.processed_at && (
                <InfoRow label="Processed" value={fmtDate(wd.processed_at)} sub={timeAgo(wd.processed_at)} />
              )}
            </Section>

            {/* Failure reason */}
            {wd.failure_reason && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "0.875rem 1rem" }}>
                <p style={{ fontWeight: 700, color: "#991b1b", fontSize: "0.82rem", margin: "0 0 0.25rem" }}>
                  Failure Reason
                </p>
                <p style={{ color: "#b91c1c", fontSize: "0.875rem", margin: 0 }}>
                  {wd.failure_reason}
                </p>
              </div>
            )}

            {/* Cancel button */}
            {wd.status === "processing" && !wd.flw_transfer_id && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ padding: "0.875rem", border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", borderRadius: "12px", fontWeight: 600, cursor: "pointer", width: "100%", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {cancelling ? <><Spin size={16} /> Cancelling...</> : "❌ Cancel Withdrawal"}
              </button>
            )}

          </div>
        ) : (
          <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
            Withdrawal not found
          </div>
        )}
      </div>
    </div>
  );
};

// Drawer styles
const dd = {
  overlay:  { position: "fixed", inset: 0, zIndex: 1000, display: "flex" },
  backdrop: { flex: 1, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" },
  drawer: {
    width:        "100%",
    maxWidth:     "440px",
    background:   "white",
    height:       "100%",
    overflowY:    "auto",
    boxShadow:    "-8px 0 40px rgba(0,0,0,0.12)",
    display:      "flex",
    flexDirection:"column",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "1.25rem 1.5rem",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    background:     "white",
    zIndex:         1,
  },
  title:   { fontWeight: 800, color: "#1f2937", margin: 0, fontSize: "1.1rem" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: "0.5rem", color: "#6b7280", fontSize: "1rem", borderRadius: "8px" },
};

// Reusable info row
const Section = ({ title, children }) => (
  <div>
    <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.75rem" }}>
      {title}
    </p>
    <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "0.5rem 0.875rem", border: "1px solid #e5e7eb" }}>
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value, sub, mono, onCopy }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #f3f4f6" }}>
    <span style={{ color: "#6b7280", fontSize: "0.82rem" }}>{label}</span>
    <div style={{ textAlign: "right" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontWeight: 600, color: "#1f2937", fontSize: "0.875rem", fontFamily: mono ? "monospace" : "inherit", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ?? "—"}
        </span>
        {onCopy && (
          <button onClick={onCopy} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "0.1rem", fontSize: "0.85rem" }}>
            📋
          </button>
        )}
      </div>
      {sub && <span style={{ fontSize: "0.72rem", color: "#9ca3af", display: "block", marginTop: "0.1rem" }}>{sub}</span>}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// MAIN PAYOUTS PAGE
// ══════════════════════════════════════════════════════════════
const STATUS_FILTERS = [
  { key: "",           label: "All"        },
  { key: "pending",    label: "Pending"    },
  { key: "processing", label: "Processing" },
  { key: "success",    label: "Success"    },
  { key: "failed",     label: "Failed"     },
  { key: "cancelled",  label: "Cancelled"  },
];

export const Payouts = ({ vendor }) => {
  const [info,         setInfo]         = useState(null);
  const [history,      setHistory]      = useState(null);
  const [loadingInfo,  setLoadingInfo]  = useState(true);
  const [loadingHist,  setLoadingHist]  = useState(true);
  const [error,        setError]        = useState(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedId,   setSelectedId]  = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [refreshing,   setRefreshing]   = useState(false);

  // ── Load wallet info ────────────────────────────────────────
  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    setError(null);
    try {
      const { data } = await sellerApi.get("/api/seller/payout/info");
      if (data.success) setInfo(data);
      else setError(data.message);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load wallet");
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  // ── Load withdrawal history ─────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await sellerApi.get(
        `/api/seller/payout/history?${params}`
      );
      if (data.success) setHistory(data);
    } catch (err) {
      console.error("[loadHistory]", err.message);
    } finally {
      setLoadingHist(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadInfo(); },    [loadInfo]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadInfo(), loadHistory()]);
    setRefreshing(false);
  }, [loadInfo, loadHistory]);

  // ── Loading ─────────────────────────────────────────────────
  if (loadingInfo && !info) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "4rem", color: "#9ca3af" }}>
        <Spin size={24} />
        <span>Loading wallet...</span>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</p>
        <p style={{ fontWeight: 700, color: "#1f2937" }}>Failed to load</p>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>{error}</p>
        <button onClick={loadInfo} style={{ padding: "0.75rem 1.5rem", background: "#6366f1", color: "white", border: "none", borderRadius: "10px", fontWeight: 600, cursor: "pointer" }}>
          🔄 Retry
        </button>
      </div>
    );
  }

  const { wallet, bank, virtual_account, limits } = info ?? {};
  const canWithdraw = Number(wallet?.available_balance ?? 0) >= (limits?.min_withdrawal ?? 500);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: "1.35rem", color: "#1f2937", margin: 0 }}>
            💳 Payouts
          </h2>
          <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: "0.2rem 0 0" }}>
            Manage your earnings and withdrawals
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "0.6rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", color: "#6b7280", fontSize: "0.85rem", fontWeight: 500 }}
        >
          <span style={{ display: "inline-block", animation: refreshing ? "spin 0.7s linear infinite" : "none" }}>↻</span>
          Refresh
        </button>
      </div>

      {/* ── Free withdrawal alert ─────────────────────────────── */}
      {(limits?.free_remaining ?? 0) > 0 && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.5rem" }}>🎁</span>
          <div>
            <p style={{ fontWeight: 700, color: "#065f46", margin: 0 }}>
              {limits.free_remaining} free withdrawal
              {limits.free_remaining > 1 ? "s" : ""} remaining today
            </p>
            <p style={{ color: "#059669", fontSize: "0.82rem", margin: 0 }}>
              Withdraw now with zero fees
            </p>
          </div>
        </div>
      )}

      {/* ── Balance cards ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "1rem" }}>
        {[
          { label: "Available",      value: wallet?.available_balance ?? 0, icon: "💰", primary: true },
          { label: "Pending",        value: wallet?.pending_balance   ?? 0, icon: "⏳" },
          { label: "Total Received", value: wallet?.total_received    ?? 0, icon: "📥" },
          { label: "Total Withdrawn",value: wallet?.total_withdrawn   ?? 0, icon: "📤" },
        ].map((card) => (
          <div key={card.label} style={{
            background:   card.primary ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "white",
            borderRadius: "16px",
            padding:      "1.25rem",
            border:       card.primary ? "none" : "1px solid #f3f4f6",
            boxShadow:    card.primary ? "0 4px 20px rgba(99,102,241,0.3)" : "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>{card.icon}</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: card.primary ? "rgba(255,255,255,0.8)" : "#9ca3af" }}>
                {card.label}
              </span>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: card.primary ? "white" : "#1f2937" }}>
              {fmt(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Virtual account ───────────────────────────────────── */}
      {virtual_account ? (
        <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: "20px", padding: "1.5rem", color: "white" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.75rem" }}>
            🏦 Virtual Account — Receive Payments
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <p style={{ fontSize: "1.75rem", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em", margin: 0 }}>
                {virtual_account.account_number}
              </p>
              <p style={{ opacity: 0.75, fontSize: "0.875rem", margin: "0.35rem 0 0" }}>
                {virtual_account.account_name} · {virtual_account.bank_name}
              </p>
            </div>
            <button
              onClick={() => copy(virtual_account.account_number)}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "10px", padding: "0.6rem 1rem", color: "white", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              📋 Copy
            </button>
          </div>
          <p style={{ background: "rgba(255,255,255,0.1)", borderRadius: "10px", padding: "0.6rem 0.875rem", fontSize: "0.8rem", margin: "1rem 0 0", opacity: 0.85 }}>
            💡 Buyers pay to this account. Funds credit your wallet automatically.
          </p>
        </div>
      ) : (
        <div style={{ background: "white", border: "2px dashed #e5e7eb", borderRadius: "16px", padding: "2rem", textAlign: "center", color: "#9ca3af" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏦</p>
          <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>No Virtual Account Yet</p>
          <p style={{ fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
            Created automatically when your store is activated
          </p>
        </div>
      )}

      {/* ── Withdraw CTA ──────────────────────────────────────── */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontWeight: 700, color: "#1f2937", margin: "0 0 0.25rem" }}>
            Request Withdrawal
          </h3>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bank?.bank_name
              ? `→ ${bank.account_name} · ${bank.account_number} (${bank.bank_name})`
              : "⚠️ No bank configured — update in Settings"}
          </p>
          {limits && (
            <p style={{ color: "#9ca3af", fontSize: "0.78rem", margin: "0.25rem 0 0" }}>
              {limits.fee_schedule_label} · Daily remaining: {fmt(limits.daily_remaining)}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowWithdraw(true)}
          disabled={!canWithdraw || !bank?.bank_name}
          style={{
            flexShrink:   0,
            padding:      "0.875rem 1.75rem",
            background:   "linear-gradient(135deg,#10b981,#059669)",
            color:        "white",
            border:       "none",
            borderRadius: "12px",
            fontWeight:   700,
            fontSize:     "0.95rem",
            cursor:       !canWithdraw || !bank?.bank_name ? "not-allowed" : "pointer",
            opacity:      !canWithdraw || !bank?.bank_name ? 0.5 : 1,
            display:      "flex",
            alignItems:   "center",
            gap:          "0.5rem",
          }}
        >
          💸 Withdraw
          {(limits?.free_remaining ?? 0) > 0 && (
            <span style={{ background: "#16a34a", fontSize: "0.68rem", padding: "0.1rem 0.45rem", borderRadius: "100px", fontWeight: 700 }}>
              Free
            </span>
          )}
        </button>
      </div>

      {/* ── Withdrawal history ────────────────────────────────── */}
      <div style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: "16px", overflow: "hidden" }}>

        {/* Filter bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: "0.75rem" }}>
          <h3 style={{ fontWeight: 700, color: "#1f2937", margin: 0, fontSize: "1rem" }}>
            📤 Withdrawal History
          </h3>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1); }}
                style={{
                  padding:      "0.3rem 0.75rem",
                  borderRadius: "100px",
                  border:       "1px solid",
                  cursor:       "pointer",
                  fontSize:     "0.78rem",
                  fontWeight:   600,
                  background:   statusFilter === key ? "#6366f1" : "white",
                  color:        statusFilter === key ? "white"   : "#6b7280",
                  borderColor:  statusFilter === key ? "#6366f1" : "#e5e7eb",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loadingHist ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <Spin size={24} />
          </div>
        ) : !history?.withdrawals?.length ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#9ca3af" }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</p>
            <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>No withdrawals yet</p>
            <p style={{ fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
              Your withdrawal history will appear here
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {history.withdrawals.map((wd) => (
                <div
                  key={wd.id}
                  onClick={() => setSelectedId(wd.id)}
                  style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "1rem 1.25rem", borderBottom: "1px solid #f9fafb", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#fafafa"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                    💸
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: "#1f2937", margin: 0, fontSize: "0.875rem" }}>
                      To {wd.bank_name}
                    </p>
                    <p style={{ color: "#9ca3af", margin: "0.1rem 0 0", fontSize: "0.75rem" }}>
                      {fmtDate(wd.created_at)} · ••••{wd.account_number?.slice(-4)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontWeight: 800, color: "#ef4444", margin: 0, fontSize: "0.9rem" }}>
                      −{fmt(wd.amount)}
                    </p>
                    {Number(wd.fee) === 0 ? (
                      <span style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 600 }}>🎁 Free</span>
                    ) : (
                      <span style={{ fontSize: "0.7rem", color: "#f59e0b" }}>fee {fmt(wd.fee)}</span>
                    )}
                    <div style={{ marginTop: "0.2rem" }}>
                      <StatusBadge status={wd.status} />
                    </div>
                  </div>
                  <span style={{ color: "#d1d5db", fontSize: "0.85rem", flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>

            {/* Stats bar */}
            {history.stats && (
              <div style={{ display: "flex", gap: "1.5rem", padding: "0.875rem 1.25rem", background: "#f8fafc", borderTop: "1px solid #f3f4f6", flexWrap: "wrap" }}>
                {[
                  { label: "Total requests",  val: history.stats.total },
                  { label: "Total paid out",  val: fmt(history.stats.total_paid_out) },
                  { label: "Fees paid",       val: fmt(history.stats.total_fees_paid) },
                  { label: "Failed",          val: history.stats.failed_count },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>{label}</p>
                    <p style={{ fontWeight: 700, color: "#374151", margin: 0, fontSize: "0.9rem" }}>{val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {history.pagination?.total_pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.875rem 1.25rem", borderTop: "1px solid #f3f4f6" }}>
                <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0 }}>
                  Page {history.pagination.page} of {history.pagination.total_pages} · {history.pagination.total} total
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ padding: "0.4rem 0.875rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "white", cursor: "pointer", disabled: { opacity: 0.4 } }}
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(history.pagination.total_pages, p + 1))}
                    disabled={page === history.pagination.total_pages}
                    style={{ padding: "0.4rem 0.875rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "white", cursor: "pointer" }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      {showWithdraw && info && (
        <WithdrawModal
          info={info}
          onClose={() => setShowWithdraw(false)}
          onSuccess={refresh}
        />
      )}

      {selectedId && (
        <DetailDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onCancelled={refresh}
        />
      )}

    </div>
  );
};

export default Payouts;