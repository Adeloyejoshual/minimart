// pages/seller/Payouts.jsx
import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { sellerApi } from "./SellerDashboard";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
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
  const s  = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const copyText = (t) => {
  navigator.clipboard.writeText(t).catch(() => {});
};

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
const Spin = ({ size = 22, color = "#6366f1" }) => (
  <span style={{
    width:        size,
    height:       size,
    border:       `${Math.max(2, Math.round(size / 9))}px solid #e5e7eb`,
    borderTop:    `${Math.max(2, Math.round(size / 9))}px solid ${color}`,
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
    flexShrink:   0,
  }} />
);

const STATUS_CFG = {
  pending:    { label:"Pending",    bg:"#fffbeb", color:"#92400e", border:"#fde68a", icon:"⏳" },
  processing: { label:"Processing", bg:"#eff6ff", color:"#1e40af", border:"#bfdbfe", icon:"⚡" },
  success:    { label:"Success",    bg:"#ecfdf5", color:"#065f46", border:"#a7f3d0", icon:"✅" },
  failed:     { label:"Failed",     bg:"#fef2f2", color:"#991b1b", border:"#fecaca", icon:"❌" },
  cancelled:  { label:"Cancelled",  bg:"#f9fafb", color:"#6b7280", border:"#e5e7eb", icon:"🚫" },
};

const StatusBadge = ({ status }) => {
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
      display:      "inline-flex",
      alignItems:   "center",
      gap:          "0.3rem",
      whiteSpace:   "nowrap",
    }}>
      {c.icon} {c.label}
    </span>
  );
};

const InfoRow = ({ label, value, mono, onCopy, sub }) => (
  <div style={{
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0.55rem 0",
    borderBottom:   "1px solid #f3f4f6",
    gap:            "0.5rem",
  }}>
    <span style={{ color:"#6b7280", fontSize:"0.8rem",
      flexShrink:0 }}>
      {label}
    </span>
    <div style={{ textAlign:"right", minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center",
        gap:"0.35rem", justifyContent:"flex-end" }}>
        <span style={{
          fontWeight:   600,
          color:        "#1f2937",
          fontSize:     "0.82rem",
          fontFamily:   mono ? "monospace" : "inherit",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
          maxWidth:     "200px",
        }}>
          {value ?? "—"}
        </span>
        {onCopy && value && (
          <button
            onClick={() => { copyText(value);
              /* tiny toast would go here */ }}
            style={{ background:"none", border:"none",
              cursor:"pointer", color:"#9ca3af",
              padding:"0.1rem", fontSize:"0.82rem",
              lineHeight:1 }}
            title="Copy"
          >
            📋
          </button>
        )}
      </div>
      {sub && (
        <span style={{ fontSize:"0.68rem", color:"#9ca3af",
          display:"block", marginTop:"0.1rem" }}>
          {sub}
        </span>
      )}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div>
    <p style={{
      fontSize:      "0.68rem",
      fontWeight:    700,
      color:         "#9ca3af",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      margin:        "0 0 0.6rem",
    }}>
      {title}
    </p>
    <div style={{
      background:   "#f8fafc",
      borderRadius: "12px",
      padding:      "0.25rem 1rem",
      border:       "1px solid #e5e7eb",
    }}>
      {children}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// WITHDRAW MODAL
// Calls: POST /api/seller/payout/withdraw
// ─────────────────────────────────────────────────────────────
const WithdrawModal = ({ info, onClose, onSuccess }) => {
  const [amount,   setAmount]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState({ type:"", text:"" });
  const inputRef               = useRef(null);

  // Idempotency key — generated once per modal open
  const idemKey = useMemo(
    () => `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const { wallet, bank, limits } = info;
  const parsed    = parseFloat(amount) || 0;
  const available = Number(wallet?.available_balance ?? 0);

  // Mirror server fee logic for preview
  const preview = useMemo(() => {
    if (!parsed || parsed <= 0) return null;
    const today = limits?.withdrawals_today ?? 0;
    let fee = 0;
    if (today >= 3) {
      const tiers = limits?.fee_tiers ?? [];
      // match tier by amount
      for (const tier of tiers) {
        if (parsed <= (tier.max_amount ?? Infinity)) {
          fee = tier.fee_amount ?? 0;
          break;
        }
      }
    }
    return { amount: parsed, fee, net: parsed - fee, free: fee === 0 };
  }, [parsed, limits]);

  const canSubmit =
    !loading &&
    parsed > 0 &&
    !!bank?.bank_name &&
    parsed >= (limits?.min_withdrawal ?? 500) &&
    parsed <= available;

  const handleWithdraw = async () => {
    if (!canSubmit) return;

    // Extra guard
    if (parsed < (limits?.min_withdrawal ?? 500)) {
      setMsg({ type:"error",
        text:`Minimum is ${fmt(limits?.min_withdrawal ?? 500)}` });
      return;
    }
    if (parsed > available) {
      setMsg({ type:"error",
        text:`Insufficient balance. Available: ${fmt(available)}` });
      return;
    }
    if (parsed > (limits?.daily_remaining ?? Infinity)) {
      setMsg({ type:"error",
        text:`Exceeds daily limit. Remaining: ${fmt(limits?.daily_remaining)}` });
      return;
    }

    setLoading(true);
    setMsg({ type:"", text:"" });

    try {
      const { data } = await sellerApi.post(
        "/api/seller/payout/withdraw",
        { amount: parsed, idempotency_key: idemKey }
      );

      if (data.success) {
        setMsg({ type:"success",
          text: data.message ?? "Withdrawal initiated!" });
        setTimeout(() => { onSuccess(); onClose(); }, 1600);
      } else {
        setMsg({ type:"error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message
          ?? "Withdrawal failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickPcts = [25, 50, 75, 100];

  return (
    <div style={wm.overlay} onClick={onClose}>
      <div style={wm.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ───────────────────────────── */}
        <div style={wm.header}>
          <div style={{ display:"flex", alignItems:"center",
            gap:"0.75rem" }}>
            <div style={wm.headerIcon}>💸</div>
            <div>
              <h2 style={wm.title}>Withdraw Funds</h2>
              <p style={wm.headerSub}>
                Funds sent to your bank account
              </p>
            </div>
          </div>
          <button style={wm.closeBtn} onClick={onClose}
            aria-label="Close">✕</button>
        </div>

        {/* ── Free withdrawal banner ────────────── */}
        {(limits?.free_remaining ?? 0) > 0 && (
          <div style={wm.freeBanner}>
            <span style={{ fontSize:"1.1rem" }}>🎁</span>
            <span>
              <strong>
                {limits.free_remaining} free withdrawal
                {limits.free_remaining > 1 ? "s" : ""}
              </strong>{" "}
              remaining today — no fees!
            </span>
          </div>
        )}

        <div style={wm.body}>

          {/* ── Payout destination ───────────────── */}
          <div style={wm.bankBox}>
            <p style={wm.bankLabel}>Payout to</p>
            {bank?.bank_name ? (
              <>
                <p style={wm.bankName}>{bank.account_name}</p>
                <p style={wm.bankSub}>
                  {bank.account_number} · {bank.bank_name}
                </p>
              </>
            ) : (
              <p style={{ color:"#ef4444", fontSize:"0.85rem",
                margin:0, fontWeight:600 }}>
                ⚠️ No bank configured — update in Settings
              </p>
            )}
          </div>

          {/* ── Available balance ─────────────────── */}
          <div style={wm.availRow}>
            <span style={{ color:"#6b7280", fontSize:"0.875rem" }}>
              Available balance
            </span>
            <span style={{ fontWeight:800, color:"#10b981",
              fontSize:"1.2rem" }}>
              {fmt(available)}
            </span>
          </div>

          {/* ── Quick % buttons ───────────────────── */}
          <div style={wm.quickRow}>
            {quickPcts.map((pct) => {
              const val = parseFloat(
                Math.min(
                  (available * pct) / 100,
                  limits?.max_withdrawal ?? available
                ).toFixed(2)
              );
              const active = parsed === val;
              return (
                <button
                  key={pct}
                  onClick={() => {
                    setAmount(String(val));
                    setMsg({ type:"", text:"" });
                  }}
                  style={{
                    ...wm.quickBtn,
                    background:  active ? "#6366f1" : "#f8fafc",
                    color:       active ? "white"   : "#374151",
                    borderColor: active ? "#6366f1" : "#e5e7eb",
                    fontWeight:  active ? 700 : 500,
                  }}
                >
                  {pct}%
                </button>
              );
            })}
          </div>

          {/* ── Amount input ──────────────────────── */}
          <div style={{ position:"relative" }}>
            <span style={wm.currSign}>₦</span>
            <input
              ref={inputRef}
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setMsg({ type:"", text:"" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) handleWithdraw();
              }}
              placeholder="0.00"
              min={limits?.min_withdrawal ?? 500}
              max={available}
              step="0.01"
              style={wm.amtInput}
            />
            {amount && (
              <button
                onClick={() => { setAmount(""); setMsg({ type:"",text:"" }); }}
                style={wm.clearAmt}
              >
                ✕
              </button>
            )}
          </div>

          {/* Limits hint */}
          <p style={wm.limitsHint}>
            Min {fmt(limits?.min_withdrawal ?? 500)} ·
            Daily remaining {fmt(limits?.daily_remaining)}
          </p>

          {/* ── Fee preview ───────────────────────── */}
          {preview && (
            <div style={{
              ...wm.feeBox,
              background:   preview.free ? "#f0fdf4" : "#f0f9ff",
              borderColor:  preview.free ? "#a7f3d0" : "#bfdbfe",
            }}>
              <div style={wm.feeRow}>
                <span style={{ color:"#6b7280" }}>Amount</span>
                <span style={{ fontWeight:600 }}>
                  {fmt(preview.amount)}
                </span>
              </div>
              <div style={wm.feeRow}>
                <span style={{ color:"#6b7280" }}>Fee</span>
                <span style={{
                  fontWeight: 700,
                  color: preview.free ? "#10b981" : "#f59e0b",
                }}>
                  {preview.free
                    ? "🎁 Free"
                    : `− ${fmt(preview.fee)}`}
                </span>
              </div>
              <div style={wm.feeDivider} />
              <div style={wm.feeRow}>
                <span style={{ fontWeight:700, color:"#1f2937" }}>
                  You receive
                </span>
                <span style={{
                  fontWeight: 800,
                  fontSize:   "1.05rem",
                  color:      preview.free ? "#10b981" : "#6366f1",
                }}>
                  {fmt(preview.net)}
                </span>
              </div>
            </div>
          )}

          {/* ── Message ───────────────────────────── */}
          {msg.text && (
            <div style={{
              padding:      "0.75rem 1rem",
              borderRadius: "10px",
              background:   msg.type === "error" ? "#fef2f2" : "#ecfdf5",
              color:        msg.type === "error" ? "#991b1b" : "#065f46",
              border:       `1px solid ${
                msg.type === "error" ? "#fecaca" : "#a7f3d0"
              }`,
              fontSize:     "0.875rem",
              fontWeight:   500,
              display:      "flex",
              alignItems:   "center",
              gap:          "0.5rem",
            }}>
              {msg.type === "error" ? "⚠️" : "✅"} {msg.text}
            </div>
          )}

          {/* ── Submit ────────────────────────────── */}
          <button
            onClick={handleWithdraw}
            disabled={!canSubmit}
            style={{
              ...wm.submitBtn,
              opacity: canSubmit ? 1 : 0.5,
              cursor:  canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {loading ? (
              <span style={{ display:"flex", alignItems:"center",
                gap:"0.6rem", justifyContent:"center" }}>
                <Spin size={18} color="white" /> Processing...
              </span>
            ) : (
              `💸 Withdraw${parsed > 0 ? ` ${fmt(parsed)}` : ""}`
            )}
          </button>

          {/* ── Fee schedule ──────────────────────── */}
          <div style={wm.feeSchedule}>
            <p style={{ fontWeight:700, color:"#374151",
              margin:"0 0 0.4rem", fontSize:"0.82rem" }}>
              💡 Fee Schedule
            </p>
            <p style={{ margin:"0 0 0.2rem", color:"#6b7280",
              fontSize:"0.75rem" }}>
              First 3 withdrawals per day: <strong>Free</strong>
            </p>
            {(limits?.fee_tiers ?? []).map((tier, i) => (
              <p key={i} style={{ margin:"0.15rem 0 0",
                color:"#6b7280", fontSize:"0.75rem" }}>
                {tier.label ?? `Tier ${i+1}`}:{" "}
                <strong>
                  ₦{Number(tier.fee_amount ?? tier.fee ?? 0)
                    .toLocaleString()}
                </strong>
              </p>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

// Withdraw modal styles
const wm = {
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
    background:   "white",
    borderRadius: "22px",
    width:        "100%",
    maxWidth:     "420px",
    maxHeight:    "92vh",
    overflowY:    "auto",
    boxShadow:    "0 24px 64px rgba(0,0,0,0.18)",
    display:      "flex",
    flexDirection:"column",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "1.4rem 1.5rem 1rem",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    background:     "white",
    zIndex:         1,
    borderRadius:   "22px 22px 0 0",
  },
  headerIcon: {
    width:          "44px",
    height:         "44px",
    background:     "linear-gradient(135deg,#10b981,#059669)",
    borderRadius:   "12px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       "1.3rem",
    flexShrink:     0,
  },
  title: {
    fontWeight: 800,
    fontSize:   "1.1rem",
    color:      "#1f2937",
    margin:     0,
  },
  headerSub: {
    color:     "#9ca3af",
    fontSize:  "0.75rem",
    margin:    "0.1rem 0 0",
  },
  closeBtn: {
    background:   "none",
    border:       "none",
    cursor:       "pointer",
    fontSize:     "1.1rem",
    color:        "#9ca3af",
    padding:      "0.3rem",
    borderRadius: "8px",
    lineHeight:   1,
    flexShrink:   0,
  },
  freeBanner: {
    display:     "flex",
    alignItems:  "center",
    gap:         "0.6rem",
    background:  "#ecfdf5",
    borderBottom:"1px solid #a7f3d0",
    padding:     "0.75rem 1.5rem",
    color:       "#065f46",
    fontSize:    "0.85rem",
  },
  body: {
    padding: "1.25rem 1.5rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  bankBox: {
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
  },
  bankLabel: {
    fontSize:      "0.68rem",
    fontWeight:    700,
    color:         "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin:        "0 0 0.35rem",
  },
  bankName: {
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    fontSize:   "0.95rem",
  },
  bankSub: {
    color:     "#6b7280",
    fontSize:  "0.8rem",
    margin:    "0.2rem 0 0",
  },
  availRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0.5rem 0",
    borderBottom:   "1px solid #f3f4f6",
  },
  quickRow: {
    display:  "flex",
    gap:      "0.5rem",
  },
  quickBtn: {
    flex:         1,
    padding:      "0.45rem 0",
    borderRadius: "100px",
    border:       "1px solid",
    cursor:       "pointer",
    fontSize:     "0.8rem",
    transition:   "all 0.15s",
    textAlign:    "center",
  },
  currSign: {
    position:   "absolute",
    left:       "1rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    fontWeight: 800,
    fontSize:   "1.25rem",
    color:      "#374151",
    pointerEvents:"none",
  },
  amtInput: {
    width:        "100%",
    padding:      "1rem 2.75rem 1rem 2.5rem",
    border:       "2px solid #e5e7eb",
    borderRadius: "12px",
    fontSize:     "1.6rem",
    fontWeight:   800,
    color:        "#1f2937",
    boxSizing:    "border-box",
    transition:   "border-color 0.15s",
    background:   "white",
    fontFamily:   "inherit",
  },
  clearAmt: {
    position:   "absolute",
    right:      "0.875rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    color:      "#9ca3af",
    fontSize:   "1rem",
    padding:    "0.2rem",
    lineHeight: 1,
  },
  limitsHint: {
    fontSize: "0.72rem",
    color:    "#9ca3af",
    margin:   "-0.5rem 0 0",
  },
  feeBox: {
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
    border:       "1px solid",
    display:      "flex",
    flexDirection:"column",
    gap:          "0.5rem",
  },
  feeRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    fontSize:       "0.875rem",
  },
  feeDivider: {
    height:     "1px",
    background: "rgba(0,0,0,0.06)",
  },
  submitBtn: {
    display:      "block",
    width:        "100%",
    padding:      "1rem",
    background:   "linear-gradient(135deg,#10b981,#059669)",
    color:        "white",
    border:       "none",
    borderRadius: "14px",
    fontWeight:   700,
    fontSize:     "1rem",
    transition:   "opacity 0.15s",
  },
  feeSchedule: {
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    padding:      "0.875rem 1rem",
  },
};

// ─────────────────────────────────────────────────────────────
// DETAIL DRAWER
// Calls: GET /api/seller/payout/withdrawal/:id
//        POST /api/seller/payout/withdrawal/:id/cancel
// ─────────────────────────────────────────────────────────────
const DetailDrawer = ({ id, onClose, onCancelled }) => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg,  setCancelMsg]  = useState(null);
  const [copied,     setCopied]     = useState("");

  // GET /api/seller/payout/withdrawal/:id
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await sellerApi.get(
        `/api/seller/payout/withdrawal/${id}`
      );
      if (res.success) setData(res);
    } catch (err) {
      console.error("[DetailDrawer load]", err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh if processing
  useEffect(() => {
    if (data?.withdrawal?.status !== "processing") return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [data, load]);

  const handleCopy = (text, key) => {
    copyText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
  };

  // POST /api/seller/payout/withdrawal/:id/cancel
  const handleCancel = async () => {
    if (!window.confirm(
      "Cancel this withdrawal and restore your balance?"
    )) return;
    setCancelling(true);
    setCancelMsg(null);
    try {
      const { data: res } = await sellerApi.post(
        `/api/seller/payout/withdrawal/${id}/cancel`
      );
      if (res.success) {
        setCancelMsg({ type:"success",
          text: res.message ?? "Cancelled. Balance restored." });
        onCancelled?.();
        setTimeout(onClose, 1800);
      } else {
        setCancelMsg({ type:"error", text: res.message });
      }
    } catch (err) {
      setCancelMsg({
        type: "error",
        text: err.response?.data?.message ?? "Cancellation failed",
      });
    } finally {
      setCancelling(false);
    }
  };

  const wd = data?.withdrawal;
  const sc = STATUS_CFG[wd?.status] ?? STATUS_CFG.pending;

  return (
    <div style={dd.overlay}>
      <div style={dd.backdrop} onClick={onClose} />
      <div style={dd.drawer}>

        {/* Header */}
        <div style={dd.header}>
          <div>
            <h3 style={dd.title}>Withdrawal Details</h3>
            {wd && (
              <p style={{ color:"#9ca3af", fontSize:"0.75rem",
                margin:"0.1rem 0 0" }}>
                {fmtDate(wd.requested_at ?? wd.created_at)}
              </p>
            )}
          </div>
          <div style={{ display:"flex", gap:"0.4rem" }}>
            <button
              onClick={load}
              style={dd.iconBtn}
              title="Refresh"
              disabled={loading}
            >
              <span style={{ display:"inline-block",
                animation: loading
                  ? "spin 0.7s linear infinite" : "none",
                fontSize:"1rem" }}>
                ↻
              </span>
            </button>
            <button
              onClick={onClose}
              style={dd.iconBtn}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && !wd ? (
          <div style={{ display:"flex", justifyContent:"center",
            alignItems:"center", flex:1, padding:"4rem" }}>
            <Spin size={32} />
          </div>
        ) : !wd ? (
          <div style={{ padding:"4rem", textAlign:"center",
            color:"#9ca3af" }}>
            <span style={{ fontSize:"2rem" }}>❓</span>
            <p>Withdrawal not found</p>
          </div>
        ) : (
          <div style={dd.body}>

            {/* ── Amount hero ────────────────────── */}
            <div style={{
              background:   `linear-gradient(135deg,${
                wd.status === "success" ? "#059669,#10b981"
                : wd.status === "failed" ? "#dc2626,#ef4444"
                : "#4f46e5,#7c3aed"
              })`,
              borderRadius: "18px",
              padding:      "1.5rem",
              color:        "white",
              textAlign:    "center",
            }}>
              <p style={{ opacity:0.75, fontSize:"0.78rem",
                margin:"0 0 0.25rem" }}>
                Amount Requested
              </p>
              <p style={{ fontWeight:800, fontSize:"2.5rem",
                margin:"0 0 1rem", lineHeight:1 }}>
                {fmt(wd.amount)}
              </p>

              <div style={{
                display:             "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap:                 "0.5rem",
                background:          "rgba(255,255,255,0.12)",
                borderRadius:        "12px",
                padding:             "0.875rem",
              }}>
                {[
                  {
                    label: "Fee",
                    value: Number(wd.fee) === 0
                      ? "🎁 Free"
                      : `−${fmt(wd.fee)}`,
                    color: Number(wd.fee) === 0
                      ? "#86efac" : "#fde68a",
                  },
                  {
                    label: "You Receive",
                    value: fmt(wd.net_amount),
                    color: "#86efac",
                    bold:  true,
                  },
                  {
                    label: "Status",
                    value: sc.icon + " " + sc.label,
                    color: "white",
                  },
                ].map(({ label, value, color, bold }) => (
                  <div key={label}>
                    <p style={{ opacity:0.65, fontSize:"0.65rem",
                      margin:"0 0 0.2rem",
                      textTransform:"uppercase",
                      letterSpacing:"0.05em" }}>
                      {label}
                    </p>
                    <p style={{
                      fontWeight: bold ? 800 : 600,
                      margin:     0,
                      color:      color ?? "white",
                      fontSize:   "0.82rem",
                    }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Live status from FLW */}
              {data?.live_status && (
                <p style={{ marginTop:"0.75rem", opacity:0.75,
                  fontSize:"0.75rem" }}>
                  Live: {data.live_status}
                </p>
              )}
            </div>

            {/* ── Destination bank ───────────────── */}
            <Section title="Destination">
              <InfoRow label="Account Name"
                value={wd.account_name} />
              <InfoRow
                label="Account Number"
                value={wd.account_number}
                mono
                onCopy={() =>
                  handleCopy(wd.account_number, "acct")}
              />
              <InfoRow label="Bank" value={wd.bank_name} />
            </Section>

            {/* ── References ─────────────────────── */}
            <Section title="References">
              <InfoRow
                label="Tx Ref"
                value={wd.tx_ref}
                mono
                onCopy={() => handleCopy(wd.tx_ref, "txref")}
                sub={copied === "txref" ? "✓ Copied!" : undefined}
              />
              {wd.flw_transfer_id && (
                <InfoRow
                  label="FLW Transfer ID"
                  value={String(wd.flw_transfer_id)}
                  mono
                  onCopy={() =>
                    handleCopy(String(wd.flw_transfer_id), "flwid")}
                  sub={copied === "flwid" ? "✓ Copied!" : undefined}
                />
              )}
            </Section>

            {/* ── Timeline ───────────────────────── */}
            <Section title="Timeline">
              <InfoRow
                label="Requested"
                value={fmtDate(wd.requested_at ?? wd.created_at)}
                sub={timeAgo(wd.requested_at ?? wd.created_at)}
              />
              {wd.processed_at && (
                <InfoRow
                  label="Processed"
                  value={fmtDate(wd.processed_at)}
                  sub={timeAgo(wd.processed_at)}
                />
              )}
            </Section>

            {/* ── Failure reason ─────────────────── */}
            {wd.failure_reason && (
              <div style={{
                background:   "#fef2f2",
                border:       "1px solid #fecaca",
                borderRadius: "12px",
                padding:      "0.875rem 1rem",
              }}>
                <p style={{ fontWeight:700, color:"#991b1b",
                  fontSize:"0.78rem", margin:"0 0 0.3rem",
                  textTransform:"uppercase",
                  letterSpacing:"0.05em" }}>
                  Failure Reason
                </p>
                <p style={{ color:"#b91c1c", fontSize:"0.875rem",
                  margin:0 }}>
                  {wd.failure_reason}
                </p>
              </div>
            )}

            {/* ── Processing pulse ───────────────── */}
            {wd.status === "processing" && (
              <div style={{
                display:     "flex",
                alignItems:  "center",
                gap:         "0.75rem",
                background:  "#eff6ff",
                border:      "1px solid #bfdbfe",
                borderRadius:"12px",
                padding:     "0.875rem 1rem",
              }}>
                <Spin size={18} color="#3b82f6" />
                <div>
                  <p style={{ fontWeight:600, color:"#1e40af",
                    margin:0, fontSize:"0.85rem" }}>
                    Transfer in progress
                  </p>
                  <p style={{ color:"#3b82f6", fontSize:"0.72rem",
                    margin:"0.15rem 0 0" }}>
                    Auto-refreshes every 30 seconds
                  </p>
                </div>
              </div>
            )}

            {/* ── Cancel message ─────────────────── */}
            {cancelMsg && (
              <div style={{
                padding:      "0.75rem 1rem",
                borderRadius: "10px",
                background:   cancelMsg.type === "success"
                  ? "#ecfdf5" : "#fef2f2",
                color:        cancelMsg.type === "success"
                  ? "#065f46" : "#991b1b",
                border:       `1px solid ${
                  cancelMsg.type === "success"
                    ? "#a7f3d0" : "#fecaca"
                }`,
                fontSize:     "0.875rem",
                fontWeight:   500,
              }}>
                {cancelMsg.type === "success" ? "✅" : "⚠️"}{" "}
                {cancelMsg.text}
              </div>
            )}

            {/* ── Cancel button ──────────────────── */}
            {/* Only show if: processing AND no FLW id yet */}
            {wd.status === "processing" && !wd.flw_transfer_id && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  width:        "100%",
                  padding:      "0.875rem",
                  border:       "1px solid #fecaca",
                  background:   "#fef2f2",
                  color:        "#ef4444",
                  borderRadius: "12px",
                  fontWeight:   700,
                  cursor:       cancelling ? "not-allowed" : "pointer",
                  fontSize:     "0.9rem",
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent:"center",
                  gap:          "0.5rem",
                  opacity:      cancelling ? 0.7 : 1,
                  transition:   "opacity 0.15s",
                }}
              >
                {cancelling
                  ? <><Spin size={16} color="#ef4444" /> Cancelling...</>
                  : "❌ Cancel Withdrawal"
                }
              </button>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

const dd = {
  overlay:  {
    position:"fixed", inset:0, zIndex:1000,
    display:"flex", justifyContent:"flex-end",
  },
  backdrop: {
    flex:1,
    background:"rgba(0,0,0,0.4)",
    backdropFilter:"blur(3px)",
    cursor:"pointer",
  },
  drawer: {
    width:         "100%",
    maxWidth:      "440px",
    background:    "white",
    height:        "100%",
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    boxShadow:     "-8px 0 40px rgba(0,0,0,0.12)",
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
  title: {
    fontWeight: 800,
    color:      "#1f2937",
    margin:     0,
    fontSize:   "1.05rem",
  },
  iconBtn: {
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    cursor:       "pointer",
    padding:      "0.45rem 0.6rem",
    color:        "#6b7280",
    fontSize:     "0.9rem",
    borderRadius: "8px",
    lineHeight:   1,
  },
  body: {
    padding:       "1.5rem",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
    flex:          1,
  },
};

// ─────────────────────────────────────────────────────────────
// STATS BAR (from history response)
// ─────────────────────────────────────────────────────────────
const StatsBar = ({ stats }) => {
  if (!stats) return null;
  const items = [
    { label:"Total requests",  value: stats.total },
    { label:"Total paid out",  value: fmt(stats.total_paid_out) },
    { label:"Fees paid",       value: fmt(stats.total_fees_paid) },
    { label:"Failed",          value: stats.failed_count,
      danger: stats.failed_count > 0 },
    { label:"Pending",         value: stats.pending_count },
    { label:"Processing",      value: stats.processing_count },
  ];
  return (
    <div style={{
      display:   "flex",
      gap:       "1.5rem",
      padding:   "0.875rem 1.25rem",
      background:"#f8fafc",
      borderTop: "1px solid #f3f4f6",
      flexWrap:  "wrap",
    }}>
      {items.map(({ label, value, danger }) => (
        <div key={label}>
          <p style={{ fontSize:"0.68rem", color:"#9ca3af",
            margin:0, whiteSpace:"nowrap" }}>
            {label}
          </p>
          <p style={{
            fontWeight: 700,
            color:      danger ? "#ef4444" : "#374151",
            margin:     0,
            fontSize:   "0.9rem",
          }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN PAYOUTS PAGE
// Calls:
//   GET  /api/seller/payout/info
//   GET  /api/seller/payout/history?page=&limit=&status=
//   POST /api/seller/payout/withdraw     → via WithdrawModal
//   GET  /api/seller/payout/withdrawal/:id → via DetailDrawer
//   POST /api/seller/payout/withdrawal/:id/cancel → via DetailDrawer
// ─────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key:"",           label:"All"        },
  { key:"pending",    label:"Pending"    },
  { key:"processing", label:"Processing" },
  { key:"success",    label:"Success"    },
  { key:"failed",     label:"Failed"     },
  { key:"cancelled",  label:"Cancelled"  },
];

export default function Payouts() {
  const [info,         setInfo]         = useState(null);
  const [history,      setHistory]      = useState(null);
  const [loadingInfo,  setLoadingInfo]  = useState(true);
  const [loadingHist,  setLoadingHist]  = useState(true);
  const [infoError,    setInfoError]    = useState(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedId,   setSelectedId]   = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [refreshing,   setRefreshing]   = useState(false);

  // ── GET /api/seller/payout/info ────────────────────────
  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    setInfoError(null);
    try {
      const { data } = await sellerApi.get("/api/seller/payout/info");
      if (data.success) setInfo(data);
      else setInfoError(data.message ?? "Failed to load wallet");
    } catch (err) {
      setInfoError(
        err.response?.data?.message ?? "Failed to load wallet"
      );
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  // ── GET /api/seller/payout/history ─────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const params = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await sellerApi.get(
        "/api/seller/payout/history", params
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

  // ── Derived ────────────────────────────────────────────
  const { wallet, bank, virtual_account, limits } = info ?? {};
  const available  = Number(wallet?.available_balance ?? 0);
  const canWithdraw = available >= (limits?.min_withdrawal ?? 500)
    && !!bank?.bank_name;
  const hasFreeLeft = (limits?.free_remaining ?? 0) > 0;

  // ── Loading skeleton ───────────────────────────────────
  if (loadingInfo && !info) {
    return (
      <div style={{ display:"flex", flexDirection:"column",
        gap:"1.25rem" }}>
        {/* Skeleton cards */}
        {[1,2,3].map((i) => (
          <div key={i} style={{
            height:       i === 1 ? "120px" : "80px",
            background:   "white",
            borderRadius: "16px",
            border:       "1px solid #f3f4f6",
            animation:    "sdShimmer 1.4s infinite",
            backgroundImage:
              "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
            backgroundSize:"400px 100%",
          }} />
        ))}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────
  if (infoError && !info) {
    return (
      <div style={{ textAlign:"center", padding:"4rem 2rem" }}>
        <span style={{ fontSize:"2.5rem" }}>⚠️</span>
        <h3 style={{ fontWeight:700, color:"#1f2937",
          margin:"0.75rem 0 0.4rem" }}>
          Failed to load wallet
        </h3>
        <p style={{ color:"#6b7280", marginBottom:"1.5rem",
          fontSize:"0.875rem" }}>
          {infoError}
        </p>
        <button onClick={loadInfo} style={{
          padding:"0.75rem 1.75rem",
          background:"#6366f1", color:"white",
          border:"none", borderRadius:"10px",
          fontWeight:700, cursor:"pointer",
        }}>
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div style={pg.root}>

      {/* ── Page header ──────────────────────────────── */}
      <div style={pg.pageHeader}>
        <div>
          <h2 style={pg.pageTitle}>💳 Payouts</h2>
          <p style={pg.pageSub}>
            Manage your earnings and bank withdrawals
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          style={pg.refreshBtn}
        >
          <span style={{ display:"inline-block",
            animation: refreshing
              ? "spin 0.7s linear infinite" : "none" }}>
            ↻
          </span>
          Refresh
        </button>
      </div>

      {/* ── Free withdrawal alert ─────────────────────── */}
      {hasFreeLeft && (
        <div style={pg.freeAlert}>
          <span style={{ fontSize:"1.4rem" }}>🎁</span>
          <div>
            <p style={{ fontWeight:700, color:"#065f46",
              margin:0, fontSize:"0.95rem" }}>
              {limits.free_remaining} free withdrawal
              {limits.free_remaining > 1 ? "s" : ""} left today
            </p>
            <p style={{ color:"#059669", fontSize:"0.8rem",
              margin:"0.1rem 0 0" }}>
              Withdraw now with zero fees
            </p>
          </div>
        </div>
      )}

      {/* ── Wallet balance cards ──────────────────────── */}
      <div style={pg.balGrid}>
        {[
          {
            icon:    "💰",
            label:   "Available",
            value:   fmt(wallet?.available_balance),
            primary: true,
            sub:     "Ready to withdraw",
          },
          {
            icon:  "⏳",
            label: "Pending",
            value: fmt(wallet?.pending_balance),
            sub:   "Being processed",
          },
          {
            icon:  "📥",
            label: "Total Received",
            value: fmt(wallet?.total_received),
            sub:   "All time",
          },
          {
            icon:  "📤",
            label: "Total Withdrawn",
            value: fmt(wallet?.total_withdrawn),
            sub:   "All time",
          },
        ].map((c) => (
          <div key={c.label} style={{
            ...pg.balCard,
            background:   c.primary
              ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
              : "white",
            border:       c.primary ? "none" : "1px solid #f3f4f6",
            boxShadow:    c.primary
              ? "0 4px 20px rgba(99,102,241,0.28)"
              : "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display:"flex", alignItems:"center",
              gap:"0.5rem", marginBottom:"0.75rem" }}>
              <span style={{ fontSize:"1.15rem" }}>{c.icon}</span>
              <span style={{
                fontSize:  "0.78rem",
                fontWeight:500,
                color:     c.primary
                  ? "rgba(255,255,255,0.75)" : "#9ca3af",
              }}>
                {c.label}
              </span>
            </div>
            <p style={{
              fontSize:  "1.45rem",
              fontWeight:800,
              color:     c.primary ? "white" : "#1f2937",
              margin:    0,
              lineHeight:1,
            }}>
              {c.value}
            </p>
            {c.sub && (
              <p style={{
                fontSize: "0.7rem",
                color:    c.primary
                  ? "rgba(255,255,255,0.55)" : "#9ca3af",
                margin:   "0.3rem 0 0",
              }}>
                {c.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Virtual account ───────────────────────────── */}
      {virtual_account ? (
        <div style={pg.vaCard}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"flex-start", flexWrap:"wrap", gap:"1rem" }}>
            <div>
              <p style={pg.vaLabel}>
                🏦 Virtual Account — Receive Payments
              </p>
              <p style={pg.vaAccNumber}>
                {virtual_account.account_number}
              </p>
              <p style={pg.vaAccName}>
                {virtual_account.account_name} ·{" "}
                {virtual_account.bank_name}
              </p>
            </div>
            <div style={{ display:"flex", gap:"0.5rem",
              flexWrap:"wrap" }}>
              <button
                onClick={() => {
                  copyText(virtual_account.account_number);
                }}
                style={pg.vaCopyBtn}
              >
                📋 Copy Number
              </button>
            </div>
          </div>
          <p style={pg.vaNote}>
            💡 Share this account number with buyers. Payments
            credited here instantly update your wallet.
          </p>
        </div>
      ) : (
        <div style={pg.vaEmpty}>
          <span style={{ fontSize:"2rem" }}>🏦</span>
          <div>
            <p style={{ fontWeight:600, color:"#374151", margin:0 }}>
              No Virtual Account Yet
            </p>
            <p style={{ color:"#9ca3af", fontSize:"0.82rem",
              margin:"0.2rem 0 0" }}>
              Created automatically when your store is activated
            </p>
          </div>
        </div>
      )}

      {/* ── Withdraw CTA card ─────────────────────────── */}
      <div style={pg.withdrawCard}>
        <div style={{ minWidth:0 }}>
          <h3 style={{ fontWeight:700, color:"#1f2937",
            margin:"0 0 0.25rem", fontSize:"1rem" }}>
            Request Withdrawal
          </h3>
          {bank?.bank_name ? (
            <p style={{ color:"#6b7280", fontSize:"0.82rem",
              margin:0, overflow:"hidden",
              textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              → {bank.account_name} ·{" "}
              {bank.account_number} ({bank.bank_name})
            </p>
          ) : (
            <p style={{ color:"#ef4444", fontSize:"0.82rem",
              margin:0, fontWeight:500 }}>
              ⚠️ No bank configured — update in Settings
            </p>
          )}
          {limits && (
            <p style={{ color:"#9ca3af", fontSize:"0.72rem",
              margin:"0.3rem 0 0" }}>
              {limits.fee_schedule_label} ·
              Daily remaining:{" "}
              <strong>{fmt(limits.daily_remaining)}</strong>
            </p>
          )}
        </div>

        <button
          onClick={() => setShowWithdraw(true)}
          disabled={!canWithdraw}
          style={{
            ...pg.withdrawBtn,
            opacity:  canWithdraw ? 1 : 0.45,
            cursor:   canWithdraw ? "pointer" : "not-allowed",
          }}
        >
          💸 Withdraw
          {hasFreeLeft && (
            <span style={{
              background:   "rgba(255,255,255,0.25)",
              fontSize:     "0.65rem",
              padding:      "0.1rem 0.45rem",
              borderRadius: "100px",
              fontWeight:   700,
              border:       "1px solid rgba(255,255,255,0.3)",
            }}>
              Free
            </span>
          )}
        </button>
      </div>

      {/* ── Limits info row ───────────────────────────── */}
      {limits && (
        <div style={pg.limitsRow}>
          {[
            { label:"Min withdrawal",   value: fmt(limits.min_withdrawal) },
            { label:"Max withdrawal",   value: fmt(limits.max_withdrawal) },
            { label:"Daily limit",      value: fmt(limits.daily_limit) },
            { label:"Used today",       value: fmt(limits.daily_used) },
            { label:"Withdrawals today",value: limits.withdrawals_today },
          ].map(({ label, value }) => (
            <div key={label} style={pg.limitItem}>
              <p style={{ fontSize:"0.68rem", color:"#9ca3af",
                margin:0, whiteSpace:"nowrap" }}>
                {label}
              </p>
              <p style={{ fontWeight:700, color:"#374151",
                margin:0, fontSize:"0.85rem" }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Withdrawal history ────────────────────────── */}
      <div style={pg.historyCard}>

        {/* History header + filter */}
        <div style={pg.histHeader}>
          <h3 style={pg.histTitle}>📤 Withdrawal History</h3>
          <div style={{ display:"flex", gap:"0.3rem", flexWrap:"wrap" }}>
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
                  transition:   "all 0.15s",
                  whiteSpace:   "nowrap",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Withdrawal list */}
        {loadingHist ? (
          <div style={{ display:"flex", justifyContent:"center",
            padding:"3rem" }}>
            <Spin size={28} />
          </div>
        ) : !history?.withdrawals?.length ? (
          <div style={{ padding:"4rem 2rem", textAlign:"center" }}>
            <span style={{ fontSize:"2.5rem" }}>📭</span>
            <p style={{ fontWeight:700, color:"#374151",
              margin:"0.75rem 0 0" }}>
              No {statusFilter ? statusFilter : ""} withdrawals yet
            </p>
            <p style={{ color:"#9ca3af", fontSize:"0.85rem",
              margin:"0.3rem 0 0" }}>
              Your withdrawal history will appear here
            </p>
          </div>
        ) : (
          <>
            <div>
              {history.withdrawals.map((wd) => {
                const sc = STATUS_CFG[wd.status] ?? STATUS_CFG.pending;
                return (
                  <div
                    key={wd.id}
                    onClick={() => setSelectedId(wd.id)}
                    style={pg.wdRow}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fafafa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "";
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width:          "42px",
                      height:         "42px",
                      borderRadius:   "12px",
                      background:     sc.bg,
                      border:         `1px solid ${sc.border}`,
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      fontSize:       "1.1rem",
                      flexShrink:     0,
                    }}>
                      {sc.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:600, color:"#1f2937",
                        margin:0, fontSize:"0.875rem" }}>
                        {wd.bank_name}
                      </p>
                      <p style={{ color:"#9ca3af", fontSize:"0.72rem",
                        margin:"0.1rem 0 0" }}>
                        ••••{wd.account_number?.slice(-4)} ·{" "}
                        {fmtDate(wd.created_at)}
                      </p>
                      {wd.tx_ref && (
                        <p style={{ color:"#c7d2fe",
                          fontSize:"0.65rem", margin:"0.1rem 0 0",
                          fontFamily:"monospace",
                          overflow:"hidden",
                          textOverflow:"ellipsis",
                          whiteSpace:"nowrap",
                          maxWidth:"200px" }}>
                          {wd.tx_ref}
                        </p>
                      )}
                    </div>

                    {/* Amount + status */}
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <p style={{ fontWeight:800, color:"#ef4444",
                        margin:0, fontSize:"0.95rem" }}>
                        −{fmt(wd.amount)}
                      </p>
                      <div style={{ marginTop:"0.2rem" }}>
                        {Number(wd.fee) === 0 ? (
                          <span style={{ fontSize:"0.68rem",
                            color:"#10b981", fontWeight:600 }}>
                            🎁 No fee
                          </span>
                        ) : (
                          <span style={{ fontSize:"0.68rem",
                            color:"#9ca3af" }}>
                            fee {fmt(wd.fee)}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop:"0.25rem" }}>
                        <StatusBadge status={wd.status} />
                      </div>
                    </div>

                    <span style={{ color:"#d1d5db",
                      flexShrink:0 }}>›</span>
                  </div>
                );
              })}
            </div>

            {/* Aggregate stats */}
            <StatsBar stats={history.stats} />

            {/* Pagination */}
            {history.pagination?.total_pages > 1 && (
              <div style={pg.pagBar}>
                <p style={{ fontSize:"0.78rem", color:"#9ca3af",
                  margin:0 }}>
                  Page {history.pagination.page} of{" "}
                  {history.pagination.total_pages} ·{" "}
                  {history.pagination.total} total
                </p>
                <div style={{ display:"flex", gap:"0.4rem" }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p-1))}
                    disabled={page === 1}
                    style={{ ...pg.pageBtn,
                      opacity: page === 1 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>

                  {/* Page number pills */}
                  {Array.from(
                    { length: Math.min(
                      history.pagination.total_pages, 5) },
                    (_, i) => {
                      const tp = history.pagination.total_pages;
                      let p2;
                      if (tp <= 5) {
                        p2 = i + 1;
                      } else if (page <= 3) {
                        p2 = i + 1;
                      } else if (page >= tp - 2) {
                        p2 = tp - 4 + i;
                      } else {
                        p2 = page - 2 + i;
                      }
                      return (
                        <button
                          key={p2}
                          onClick={() => setPage(p2)}
                          style={{
                            ...pg.pageBtn,
                            background:  page === p2
                              ? "#6366f1" : "white",
                            color:       page === p2
                              ? "white" : "#374151",
                            borderColor: page === p2
                              ? "#6366f1" : "#e5e7eb",
                            fontWeight:  page === p2 ? 700 : 500,
                            minWidth:    "36px",
                          }}
                        >
                          {p2}
                        </button>
                      );
                    }
                  )}

                  <button
                    onClick={() => setPage((p) => Math.min(
                      history.pagination.total_pages, p+1))}
                    disabled={
                      page === history.pagination.total_pages}
                    style={{
                      ...pg.pageBtn,
                      opacity: page === history.pagination.total_pages
                        ? 0.4 : 1,
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modals / Drawers ──────────────────────────── */}
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
}

// ─────────────────────────────────────────────────────────────
// PAGE STYLES
// ─────────────────────────────────────────────────────────────
const pg = {
  root: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  pageHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    flexWrap:       "wrap",
    gap:            "0.75rem",
  },
  pageTitle: {
    fontWeight: 800,
    fontSize:   "1.35rem",
    color:      "#1f2937",
    margin:     0,
  },
  pageSub: {
    color:    "#9ca3af",
    fontSize: "0.85rem",
    margin:   "0.2rem 0 0",
  },
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
  freeAlert: {
    background:  "#ecfdf5",
    border:      "1px solid #a7f3d0",
    borderRadius:"14px",
    padding:     "1rem 1.25rem",
    display:     "flex",
    alignItems:  "center",
    gap:         "0.75rem",
  },
  balGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(185px,1fr))",
    gap:                 "1rem",
  },
  balCard: {
    borderRadius: "16px",
    padding:      "1.25rem",
    transition:   "box-shadow 0.2s",
  },
  vaCard: {
    background:     "linear-gradient(135deg,#4f46e5,#7c3aed)",
    borderRadius:   "20px",
    padding:        "1.5rem",
    color:          "white",
  },
  vaLabel: {
    fontSize:      "0.7rem",
    fontWeight:    700,
    opacity:       0.7,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin:        "0 0 0.6rem",
  },
  vaAccNumber: {
    fontWeight:   800,
    fontSize:     "1.85rem",
    fontFamily:   "monospace",
    letterSpacing:"0.08em",
    margin:       0,
  },
  vaAccName: {
    opacity:   0.75,
    fontSize:  "0.85rem",
    margin:    "0.35rem 0 0",
  },
  vaCopyBtn: {
    background:   "rgba(255,255,255,0.2)",
    border:       "1px solid rgba(255,255,255,0.3)",
    borderRadius: "10px",
    padding:      "0.55rem 1rem",
    color:        "white",
    cursor:       "pointer",
    fontWeight:   600,
    fontSize:     "0.82rem",
  },
  vaNote: {
    background:   "rgba(255,255,255,0.12)",
    borderRadius: "10px",
    padding:      "0.65rem 0.875rem",
    fontSize:     "0.78rem",
    margin:       "1rem 0 0",
    opacity:      0.85,
    lineHeight:   1.5,
  },
  vaEmpty: {
    background:   "white",
    border:       "2px dashed #e5e7eb",
    borderRadius: "16px",
    padding:      "1.5rem",
    display:      "flex",
    alignItems:   "center",
    gap:          "1rem",
    color:        "#9ca3af",
  },
  withdrawCard: {
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: "16px",
    padding:      "1.25rem 1.5rem",
    display:      "flex",
    justifyContent:"space-between",
    alignItems:   "center",
    flexWrap:     "wrap",
    gap:          "1rem",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  withdrawBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.5rem",
    flexShrink:   0,
    padding:      "0.875rem 1.75rem",
    background:   "linear-gradient(135deg,#10b981,#059669)",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    fontSize:     "0.95rem",
    transition:   "opacity 0.15s",
  },
  limitsRow: {
    display:      "flex",
    gap:          "0",
    background:   "white",
    borderRadius: "14px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  limitItem: {
    flex:          1,
    padding:       "0.875rem 1rem",
    borderRight:   "1px solid #f3f4f6",
    minWidth:      0,
  },
  historyCard: {
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  histHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "1rem 1.25rem",
    borderBottom:   "1px solid #f3f4f6",
    flexWrap:       "wrap",
    gap:            "0.75rem",
  },
  histTitle: {
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    fontSize:   "0.95rem",
  },
  wdRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         "0.875rem",
    padding:     "1rem 1.25rem",
    borderBottom:"1px solid #f9fafb",
    cursor:      "pointer",
    transition:  "background 0.1s",
  },
  pagBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0.875rem 1.25rem",
    borderTop:      "1px solid #f3f4f6",
    flexWrap:       "wrap",
    gap:            "0.5rem",
  },
  pageBtn: {
    padding:      "0.4rem 0.75rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "8px",
    background:   "white",
    cursor:       "pointer",
    fontSize:     "0.78rem",
    color:        "#374151",
    fontWeight:   500,
    transition:   "all 0.15s",
  },
};