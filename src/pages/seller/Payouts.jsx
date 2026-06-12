// pages/seller/Payouts.jsx
import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { sellerApi } from "./SellerDashboard";
import "./styles/Payouts.css";

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
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const copyText = (t) =>
  navigator.clipboard.writeText(t).catch(() => {});

// ─────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:    { label: "Pending",    icon: "⏳", cls: "badge--pending"    },
  processing: { label: "Processing", icon: "⚡", cls: "badge--processing" },
  paid:       { label: "Paid",       icon: "✅", cls: "badge--paid"       },
  success:    { label: "Success",    icon: "✅", cls: "badge--paid"       },
  failed:     { label: "Failed",     icon: "❌", cls: "badge--failed"     },
  cancelled:  { label: "Cancelled",  icon: "🚫", cls: "badge--cancelled"  },
  approved:   { label: "Approved",   icon: "👍", cls: "badge--approved"   },
  rejected:   { label: "Rejected",   icon: "👎", cls: "badge--failed"     },
};

const STATUS_FILTERS = [
  { key: "",           label: "All"        },
  { key: "pending",    label: "Pending"    },
  { key: "approved",   label: "Approved"   },
  { key: "processing", label: "Processing" },
  { key: "paid",       label: "Paid"       },
  { key: "failed",     label: "Failed"     },
  { key: "cancelled",  label: "Cancelled"  },
];

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
const Spinner = ({ size = 20, cls = "" }) => (
  <span
    className={`pw-spinner ${cls}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  />
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className={`pw-badge ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const Toast = ({ type, text, onDismiss }) => (
  <div className={`pw-toast pw-toast--${type}`} role="alert">
    <span>{type === "error" ? "⚠️" : "✅"}</span>
    <span>{text}</span>
    {onDismiss && (
      <button className="pw-toast__close" onClick={onDismiss}>
        ✕
      </button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────
const Skeleton = ({ h = 80, radius = 16 }) => (
  <div
    className="pw-skeleton"
    style={{ height: h, borderRadius: radius }}
  />
);

// ─────────────────────────────────────────────────────────────
// INFO ROW
// ─────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, mono, onCopy, copied }) => (
  <div className="pw-info-row">
    <span className="pw-info-row__label">{label}</span>
    <div className="pw-info-row__right">
      <span className={`pw-info-row__value${mono ? " mono" : ""}`}>
        {value ?? "—"}
      </span>
      {onCopy && value && (
        <button
          className="pw-copy-btn"
          onClick={() => onCopy(value)}
          title="Copy"
        >
          {copied ? "✓" : "📋"}
        </button>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// SECTION WRAPPER
// ─────────────────────────────────────────────────────────────
const DrawerSection = ({ title, children }) => (
  <div className="pw-drawer-section">
    <p className="pw-drawer-section__title">{title}</p>
    <div className="pw-drawer-section__body">{children}</div>
  </div>
);

// ═════════════════════════════════════════════════════════════
// WITHDRAW MODAL
// ═════════════════════════════════════════════════════════════
const WithdrawModal = ({ info, onClose, onSuccess }) => {
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);
  const inputRef              = useRef(null);

  // Unique idempotency key per modal session
  const idemKey = useMemo(
    () => `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // Trap focus inside modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const { wallet, bank, limits } = info ?? {};
  const parsed    = parseFloat(amount) || 0;
  const available = Number(wallet?.available_balance ?? 0);
  const min       = limits?.min_withdrawal ?? 500;
  const max       = Math.min(
    available,
    limits?.max_withdrawal ?? available
  );
  const dailyRem  = limits?.daily_remaining ?? 0;

  // Fee preview
  const preview = useMemo(() => {
    if (!parsed || parsed <= 0) return null;
    const today = limits?.withdrawals_today ?? 0;
    let fee = 0;
    if (today >= (limits?.free_per_day ?? 3)) {
      for (const tier of limits?.fee_tiers ?? []) {
        if (parsed <= (tier.max_amount ?? Infinity)) {
          fee = tier.fee_amount ?? 0;
          break;
        }
      }
    }
    return { amount: parsed, fee, net: parsed - fee, free: fee === 0 };
  }, [parsed, limits]);

  // Validation
  const errors = useMemo(() => {
    if (!parsed || parsed <= 0) return null;
    if (parsed < min)      return `Minimum withdrawal is ${fmt(min)}`;
    if (parsed > available) return "Amount exceeds available balance";
    if (parsed > dailyRem)  return `Daily limit reached. Max remaining: ${fmt(dailyRem)}`;
    if (!bank?.bank_name)   return "No bank account configured";
    return null;
  }, [parsed, min, available, dailyRem, bank]);

  const canSubmit = !loading && !errors && parsed > 0 && !!bank?.bank_name;

  const setPercent = (pct) => {
    const val = parseFloat(
      Math.min((available * pct) / 100, max).toFixed(2)
    );
    setAmount(String(val));
    setMsg(null);
  };

  const handleWithdraw = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.post(
        "/api/seller/payout/withdraw",
        { amount: parsed, idempotency_key: idemKey }
      );
      if (data.success) {
        setMsg({ type: "success", text: data.message ?? "Withdrawal request submitted!" });
        setTimeout(() => { onSuccess(); onClose(); }, 1800);
      } else {
        setMsg({ type: "error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Withdrawal failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="pw-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Withdraw funds"
      onClick={onClose}
    >
      <div
        className="pw-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pw-modal__header">
          <div className="pw-modal__header-left">
            <div className="pw-modal__icon">💸</div>
            <div>
              <h2 className="pw-modal__title">Withdraw Funds</h2>
              <p className="pw-modal__subtitle">
                Sent directly to your bank account
              </p>
            </div>
          </div>
          <button
            className="pw-icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Free withdrawals banner */}
        {(limits?.free_remaining ?? 0) > 0 && (
          <div className="pw-free-banner">
            <span>🎁</span>
            <span>
              <strong>
                {limits.free_remaining} free withdrawal
                {limits.free_remaining > 1 ? "s" : ""}
              </strong>{" "}
              remaining today — no fees!
            </span>
          </div>
        )}

        <div className="pw-modal__body">

          {/* Bank destination */}
          <div className="pw-bank-box">
            <p className="pw-bank-box__label">Payout destination</p>
            {bank?.bank_name ? (
              <>
                <p className="pw-bank-box__name">{bank.account_name}</p>
                <p className="pw-bank-box__sub">
                  {bank.account_number} · {bank.bank_name}
                </p>
              </>
            ) : (
              <p className="pw-bank-box__error">
                ⚠️ No bank account configured — update in Settings
              </p>
            )}
          </div>

          {/* Available balance */}
          <div className="pw-avail-row">
            <span className="pw-avail-row__label">Available balance</span>
            <span className="pw-avail-row__value">{fmt(available)}</span>
          </div>

          {/* Quick percent buttons */}
          <div className="pw-quick-row">
            {[25, 50, 75, 100].map((pct) => {
              const val = parseFloat(
                Math.min((available * pct) / 100, max).toFixed(2)
              );
              const active = parsed === val;
              return (
                <button
                  key={pct}
                  className={`pw-quick-btn${active ? " pw-quick-btn--active" : ""}`}
                  onClick={() => setPercent(pct)}
                  disabled={!available}
                >
                  {pct}%
                </button>
              );
            })}
          </div>

          {/* Amount input */}
          <div className="pw-amount-wrap">
            <span className="pw-amount-wrap__sign">₦</span>
            <input
              ref={inputRef}
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setMsg(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleWithdraw(); }}
              placeholder="0.00"
              min={min}
              max={max}
              step="0.01"
              className="pw-amount-input"
              aria-label="Withdrawal amount"
              aria-describedby="pw-amount-hint"
            />
            {amount && (
              <button
                className="pw-amount-clear"
                onClick={() => { setAmount(""); setMsg(null); }}
                aria-label="Clear amount"
              >
                ✕
              </button>
            )}
          </div>

          {/* Validation error */}
          {errors && parsed > 0 && (
            <p className="pw-field-error">⚠️ {errors}</p>
          )}

          {/* Hints */}
          <p id="pw-amount-hint" className="pw-amount-hint">
            Min {fmt(min)} · Max {fmt(max)} · Daily remaining {fmt(dailyRem)}
          </p>

          {/* Fee preview */}
          {preview && !errors && (
            <div className={`pw-fee-box${preview.free ? " pw-fee-box--free" : ""}`}>
              <div className="pw-fee-row">
                <span>Amount</span>
                <span className="fw-600">{fmt(preview.amount)}</span>
              </div>
              <div className="pw-fee-row">
                <span>Transfer fee</span>
                <span className={`fw-700 ${preview.free ? "clr-green" : "clr-amber"}`}>
                  {preview.free ? "🎁 Free" : `−${fmt(preview.fee)}`}
                </span>
              </div>
              <div className="pw-fee-divider" />
              <div className="pw-fee-row">
                <span className="fw-700 clr-dark">You receive</span>
                <span className={`fw-800 fs-lg ${preview.free ? "clr-green" : "clr-indigo"}`}>
                  {fmt(preview.net)}
                </span>
              </div>
            </div>
          )}

          {/* Feedback toast */}
          {msg && (
            <Toast
              type={msg.type}
              text={msg.text}
              onDismiss={() => setMsg(null)}
            />
          )}

          {/* Submit */}
          <button
            className="pw-submit-btn"
            onClick={handleWithdraw}
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading ? (
              <span className="pw-submit-btn__loading">
                <Spinner size={18} cls="pw-spinner--white" />
                Processing…
              </span>
            ) : (
              `💸 Withdraw${parsed > 0 ? ` ${fmt(parsed)}` : ""}`
            )}
          </button>

          {/* Fee schedule */}
          <div className="pw-fee-schedule">
            <p className="pw-fee-schedule__title">💡 Fee Schedule</p>
            <p className="pw-fee-schedule__row">
              First {limits?.free_per_day ?? 3} withdrawals/day:{" "}
              <strong>Free</strong>
            </p>
            {(limits?.fee_tiers ?? []).map((tier, i) => (
              <p key={i} className="pw-fee-schedule__row">
                {tier.label ?? `Tier ${i + 1}`}:{" "}
                <strong>₦{Number(tier.fee_amount ?? 0).toLocaleString()}</strong>
              </p>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═════════════════════════════════════════════════════════════
const DetailDrawer = ({ id, onClose, onCancelled }) => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg,  setCancelMsg]  = useState(null);
  const [copied,     setCopied]     = useState("");

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

  // Auto-refresh when processing
  useEffect(() => {
    const wd = data?.withdrawal;
    if (wd?.status !== "processing") return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [data, load]);

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = (text, key) => {
    copyText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleCancel = async () => {
    if (!window.confirm(
      "Cancel this withdrawal request and restore your balance?"
    )) return;
    setCancelling(true);
    setCancelMsg(null);
    try {
      const { data: res } = await sellerApi.post(
        `/api/seller/payout/withdrawal/${id}/cancel`
      );
      if (res.success) {
        setCancelMsg({ type: "success", text: res.message ?? "Withdrawal cancelled." });
        onCancelled?.();
        setTimeout(onClose, 1800);
      } else {
        setCancelMsg({ type: "error", text: res.message });
      }
    } catch (err) {
      setCancelMsg({
        type: "error",
        text: err.response?.data?.message ?? "Cancellation failed. Try again.",
      });
    } finally {
      setCancelling(false);
    }
  };

  const wd  = data?.withdrawal;
  const cfg = STATUS_CFG[wd?.status] ?? STATUS_CFG.pending;

  const gradientMap = {
    paid:       "135deg, #059669, #10b981",
    success:    "135deg, #059669, #10b981",
    failed:     "135deg, #dc2626, #ef4444",
    rejected:   "135deg, #dc2626, #ef4444",
    processing: "135deg, #4f46e5, #7c3aed",
    approved:   "135deg, #0369a1, #0ea5e9",
    pending:    "135deg, #92400e, #d97706",
    cancelled:  "135deg, #4b5563, #6b7280",
  };

  return (
    <div className="pw-drawer-overlay">
      <div
        className="pw-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="pw-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Withdrawal details"
      >
        {/* Drawer header */}
        <div className="pw-drawer__header">
          <div>
            <h3 className="pw-drawer__title">Withdrawal Details</h3>
            {wd && (
              <p className="pw-drawer__sub">
                {fmtDate(wd.requested_at ?? wd.created_at)}
              </p>
            )}
          </div>
          <div className="pw-drawer__header-actions">
            <button
              className="pw-icon-btn"
              onClick={load}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh"
            >
              <span
                style={{
                  display: "inline-block",
                  animation: loading
                    ? "pw-spin 0.7s linear infinite"
                    : "none",
                }}
              >
                ↻
              </span>
            </button>
            <button
              className="pw-icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && !wd ? (
          <div className="pw-drawer__loading">
            <Spinner size={36} />
          </div>
        ) : !wd ? (
          <div className="pw-drawer__empty">
            <span>❓</span>
            <p>Withdrawal not found</p>
          </div>
        ) : (
          <div className="pw-drawer__body">

            {/* Hero card */}
            <div
              className="pw-hero-card"
              style={{
                background: `linear-gradient(${
                  gradientMap[wd.status] ?? gradientMap.pending
                })`,
              }}
            >
              <p className="pw-hero-card__label">Amount Requested</p>
              <p className="pw-hero-card__amount">{fmt(wd.amount)}</p>

              <div className="pw-hero-card__grid">
                {[
                  {
                    label: "Fee",
                    value: Number(wd.fee) === 0
                      ? "🎁 Free"
                      : `−${fmt(wd.fee)}`,
                    cls: Number(wd.fee) === 0 ? "clr-mint" : "clr-amber",
                  },
                  {
                    label: "You Receive",
                    value: fmt(wd.net_amount ?? (wd.amount - wd.fee)),
                    cls: "clr-mint fw-800",
                  },
                  {
                    label: "Status",
                    value: `${cfg.icon} ${cfg.label}`,
                    cls: "clr-white",
                  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="pw-hero-card__cell">
                    <p className="pw-hero-card__cell-label">{label}</p>
                    <p className={`pw-hero-card__cell-value ${cls}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Destination */}
            <DrawerSection title="Destination">
              <InfoRow label="Account Name"   value={wd.account_name} />
              <InfoRow
                label="Account Number"
                value={wd.account_number}
                mono
                onCopy={(v) => handleCopy(v, "acct")}
                copied={copied === "acct"}
              />
              <InfoRow label="Bank" value={wd.bank_name} />
            </DrawerSection>

            {/* References */}
            <DrawerSection title="References">
              <InfoRow
                label="Transaction Ref"
                value={wd.tx_ref}
                mono
                onCopy={(v) => handleCopy(v, "txref")}
                copied={copied === "txref"}
              />
              {wd.flw_transfer_id && (
                <InfoRow
                  label="Flutterwave ID"
                  value={String(wd.flw_transfer_id)}
                  mono
                  onCopy={(v) => handleCopy(v, "flwid")}
                  copied={copied === "flwid"}
                />
              )}
            </DrawerSection>

            {/* Timeline */}
            <DrawerSection title="Timeline">
              <InfoRow
                label="Requested"
                value={fmtDate(wd.requested_at ?? wd.created_at)}
              />
              {wd.approved_at && (
                <InfoRow
                  label="Approved"
                  value={fmtDate(wd.approved_at)}
                />
              )}
              {wd.processed_at && (
                <InfoRow
                  label="Processed"
                  value={fmtDate(wd.processed_at)}
                />
              )}
            </DrawerSection>

            {/* Admin note */}
            {wd.admin_note && (
              <div className="pw-admin-note">
                <p className="pw-admin-note__label">Admin Note</p>
                <p className="pw-admin-note__text">{wd.admin_note}</p>
              </div>
            )}

            {/* Failure reason */}
            {wd.failure_reason && (
              <div className="pw-failure-box">
                <p className="pw-failure-box__label">Failure Reason</p>
                <p className="pw-failure-box__text">
                  {wd.failure_reason}
                </p>
              </div>
            )}

            {/* Processing indicator */}
            {wd.status === "processing" && (
              <div className="pw-processing-banner">
                <Spinner size={18} cls="pw-spinner--blue" />
                <div>
                  <p className="pw-processing-banner__title">
                    Transfer in progress
                  </p>
                  <p className="pw-processing-banner__sub">
                    Auto-refreshes every 30 seconds
                  </p>
                </div>
              </div>
            )}

            {/* Feedback */}
            {cancelMsg && (
              <Toast type={cancelMsg.type} text={cancelMsg.text} />
            )}

            {/* Cancel button — only when pending + no FLW ID yet */}
            {(wd.status === "pending" || (
              wd.status === "processing" && !wd.flw_transfer_id
            )) && (
              <button
                className="pw-cancel-btn"
                onClick={handleCancel}
                disabled={cancelling}
                aria-busy={cancelling}
              >
                {cancelling ? (
                  <>
                    <Spinner size={16} cls="pw-spinner--red" />
                    Cancelling…
                  </>
                ) : (
                  "❌ Cancel Withdrawal"
                )}
              </button>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// STATS BAR
// ═════════════════════════════════════════════════════════════
const StatsBar = ({ stats }) => {
  if (!stats) return null;
  return (
    <div className="pw-stats-bar">
      {[
        { label: "Total requests",  value: stats.total },
        { label: "Total paid out",  value: fmt(stats.total_paid_out)  },
        { label: "Fees paid",       value: fmt(stats.total_fees_paid) },
        {
          label:  "Failed",
          value:  stats.failed_count,
          danger: stats.failed_count > 0,
        },
      ].map(({ label, value, danger }) => (
        <div key={label} className="pw-stats-bar__item">
          <p className="pw-stats-bar__label">{label}</p>
          <p className={`pw-stats-bar__value${danger ? " pw-stats-bar__value--danger" : ""}`}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN PAYOUTS PAGE
// ═════════════════════════════════════════════════════════════
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
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [vaCopied,     setVaCopied]     = useState(false);

  // ── Fetch wallet info ─────────────────────────────────────
  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    setInfoError(null);
    try {
      const { data } = await sellerApi.get("/api/seller/payout/info");
      if (data.success) {
        setInfo(data);
        setLastUpdated(new Date());
      } else {
        setInfoError(data.message ?? "Failed to load wallet");
      }
    } catch (err) {
      setInfoError(
        err.response?.data?.message ?? "Failed to load wallet info"
      );
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  // ── Fetch withdrawal history ──────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const params = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await sellerApi.get(
        "/api/seller/payout/history",
        { params }
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

  // ── Auto refresh every 30s ────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      loadInfo();
      loadHistory();
    }, 30_000);
    return () => clearInterval(t);
  }, [loadInfo, loadHistory]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadInfo(), loadHistory()]);
    setRefreshing(false);
  }, [loadInfo, loadHistory]);

  const handleCopyVA = useCallback((num) => {
    copyText(num);
    setVaCopied(true);
    setTimeout(() => setVaCopied(false), 2000);
  }, []);

  // ── Loading skeleton ──────────────────────────────────────
  if (loadingInfo && !info) {
    return (
      <div className="pw-skeleton-wrap">
        <Skeleton h={56}  radius={12} />
        <Skeleton h={120} radius={16} />
        <Skeleton h={96}  radius={16} />
        <Skeleton h={220} radius={16} />
        <Skeleton h={400} radius={16} />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (infoError && !info) {
    return (
      <div className="pw-error-state">
        <span className="pw-error-state__icon">⚠️</span>
        <h3 className="pw-error-state__title">Failed to load wallet</h3>
        <p className="pw-error-state__msg">{infoError}</p>
        <button className="pw-retry-btn" onClick={loadInfo}>
          🔄 Try Again
        </button>
      </div>
    );
  }

  const { wallet, bank, virtual_account, limits } = info ?? {};
  const available   = Number(wallet?.available_balance ?? 0);
  const min         = limits?.min_withdrawal ?? 500;
  const canWithdraw = available >= min && !!bank?.bank_name;
  const hasFreeLeft = (limits?.free_remaining ?? 0) > 0;

  return (
    <div className="pw-root">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="pw-page-header">
        <div>
          <h2 className="pw-page-title">Payouts</h2>
          <p className="pw-page-sub">
            Manage your earnings &amp; bank withdrawals
          </p>
          {lastUpdated && (
            <p className="pw-page-updated">
              Updated {timeAgo(lastUpdated)} · Auto-refreshes every 30s
            </p>
          )}
        </div>
        <button
          className="pw-refresh-btn"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh data"
        >
          <span
            style={{
              display: "inline-block",
              animation: refreshing
                ? "pw-spin 0.7s linear infinite"
                : "none",
            }}
          >
            ↻
          </span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Free withdrawal alert ─────────────────────────── */}
      {hasFreeLeft && (
        <div className="pw-free-alert">
          <span className="pw-free-alert__icon">🎁</span>
          <div>
            <p className="pw-free-alert__title">
              {limits.free_remaining} free withdrawal
              {limits.free_remaining > 1 ? "s" : ""} left today
            </p>
            <p className="pw-free-alert__sub">
              Withdraw now — zero fees
            </p>
          </div>
        </div>
      )}

      {/* ── Balance cards ─────────────────────────────────── */}
      <div className="pw-bal-grid">
        {[
          {
            icon:    "💰",
            label:   "Available",
            value:   fmt(wallet?.available_balance),
            sub:     "Ready to withdraw",
            primary: true,
          },
          {
            icon:  "⏳",
            label: "Pending",
            value: fmt(wallet?.pending_balance),
            sub:   "Awaiting release",
          },
          {
            icon:  "📥",
            label: "Total Earned",
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
          <div
            key={c.label}
            className={`pw-bal-card${c.primary ? " pw-bal-card--primary" : ""}`}
          >
            <div className="pw-bal-card__top">
              <span className="pw-bal-card__icon">{c.icon}</span>
              <span className="pw-bal-card__label">{c.label}</span>
            </div>
            <p className="pw-bal-card__value">{c.value}</p>
            {c.sub && (
              <p className="pw-bal-card__sub">{c.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Virtual account ───────────────────────────────── */}
      {virtual_account ? (
        <div className="pw-va-card">
          <div className="pw-va-card__top">
            <div>
              <p className="pw-va-card__label">
                🏦 Virtual Account — Receive Payments
              </p>
              <p className="pw-va-card__number">
                {virtual_account.account_number}
              </p>
              <p className="pw-va-card__name">
                {virtual_account.account_name} ·{" "}
                {virtual_account.bank_name}
              </p>
            </div>
            <button
              className="pw-va-copy-btn"
              onClick={() => handleCopyVA(virtual_account.account_number)}
            >
              {vaCopied ? "✓ Copied!" : "📋 Copy"}
            </button>
          </div>
          <p className="pw-va-note">
            💡 Share this account with buyers. Payments credited here
            update your wallet automatically every 30 seconds.
          </p>
        </div>
      ) : (
        <div className="pw-va-empty">
          <span>🏦</span>
          <div>
            <p className="pw-va-empty__title">No Virtual Account Yet</p>
            <p className="pw-va-empty__sub">
              Created automatically when your store is activated
            </p>
          </div>
        </div>
      )}

      {/* ── Withdraw CTA ──────────────────────────────────── */}
      <div className="pw-withdraw-card">
        <div className="pw-withdraw-card__info">
          <h3 className="pw-withdraw-card__title">
            Request a Withdrawal
          </h3>
          {bank?.bank_name ? (
            <p className="pw-withdraw-card__bank">
              → {bank.account_name} · {bank.account_number} (
              {bank.bank_name})
            </p>
          ) : (
            <p className="pw-withdraw-card__no-bank">
              ⚠️ No bank account — update in Settings
            </p>
          )}
          {limits && (
            <p className="pw-withdraw-card__limits">
              {limits.fee_schedule_label} · Daily remaining:{" "}
              <strong>{fmt(limits.daily_remaining)}</strong>
            </p>
          )}
        </div>

        <button
          className="pw-withdraw-btn"
          onClick={() => setShowWithdraw(true)}
          disabled={!canWithdraw}
          aria-disabled={!canWithdraw}
        >
          💸 Withdraw
          {hasFreeLeft && (
            <span className="pw-withdraw-btn__free-tag">Free</span>
          )}
        </button>
      </div>

      {/* ── Limits row ────────────────────────────────────── */}
      {limits && (
        <div className="pw-limits-row">
          {[
            { label: "Min withdrawal",    value: fmt(limits.min_withdrawal) },
            { label: "Max withdrawal",    value: fmt(limits.max_withdrawal) },
            { label: "Daily limit",       value: fmt(limits.daily_limit)    },
            { label: "Used today",        value: fmt(limits.daily_used)     },
            { label: "Withdrawals today", value: limits.withdrawals_today   },
          ].map(({ label, value }) => (
            <div key={label} className="pw-limits-row__item">
              <p className="pw-limits-row__label">{label}</p>
              <p className="pw-limits-row__value">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Withdrawal history ────────────────────────────── */}
      <div className="pw-history-card">

        {/* History header + filters */}
        <div className="pw-history-card__header">
          <h3 className="pw-history-card__title">
            📤 Withdrawal History
          </h3>
          <div className="pw-filter-row">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className={`pw-filter-btn${
                  statusFilter === key ? " pw-filter-btn--active" : ""
                }`}
                onClick={() => { setStatusFilter(key); setPage(1); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* History list */}
        {loadingHist ? (
          <div className="pw-history-loading">
            <Spinner size={28} />
          </div>
        ) : !history?.withdrawals?.length ? (
          <div className="pw-history-empty">
            <span>📭</span>
            <p className="pw-history-empty__title">
              No {statusFilter || ""} withdrawals yet
            </p>
            <p className="pw-history-empty__sub">
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
                    className="pw-wd-row"
                    onClick={() => setSelectedId(wd.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setSelectedId(wd.id);
                    }}
                    aria-label={`Withdrawal of ${fmt(wd.amount)} — ${sc.label}`}
                  >
                    {/* Icon */}
                    <div className={`pw-wd-row__icon-wrap pw-wd-icon--${wd.status}`}>
                      <span>{sc.icon}</span>
                    </div>

                    {/* Info */}
                    <div className="pw-wd-row__info">
                      <p className="pw-wd-row__bank">{wd.bank_name}</p>
                      <p className="pw-wd-row__sub">
                        ••••{wd.account_number?.slice(-4)} ·{" "}
                        {fmtDate(wd.created_at)}
                      </p>
                    </div>

                    {/* Amount + status */}
                    <div className="pw-wd-row__right">
                      <p className="pw-wd-row__amount">
                        −{fmt(wd.amount)}
                      </p>
                      <p className="pw-wd-row__fee">
                        {Number(wd.fee) === 0 ? (
                          <span className="pw-wd-row__fee--free">
                            🎁 No fee
                          </span>
                        ) : (
                          <span>fee {fmt(wd.fee)}</span>
                        )}
                      </p>
                      <StatusBadge status={wd.status} />
                    </div>

                    <span className="pw-wd-row__chevron">›</span>
                  </div>
                );
              })}
            </div>

            {/* Stats bar */}
            <StatsBar stats={history.stats} />

            {/* Pagination */}
            {history.pagination?.total_pages > 1 && (
              <div className="pw-pagination">
                <p className="pw-pagination__info">
                  Page {history.pagination.page} of{" "}
                  {history.pagination.total_pages} ·{" "}
                  {history.pagination.total} total
                </p>
                <div className="pw-pagination__btns">
                  <button
                    className="pw-page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ← Prev
                  </button>
                  <button
                    className="pw-page-btn"
                    onClick={() =>
                      setPage((p) =>
                        Math.min(history.pagination.total_pages, p + 1)
                      )
                    }
                    disabled={page === history.pagination.total_pages}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
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