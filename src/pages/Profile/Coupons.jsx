/**
 * src/pages/Profile/Coupons.jsx
 * Route: /coupons
 *
 * Shows available coupons + history + manual code entry
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const COUPON_CONFIG = {
  percentage   : { color: "#6366f1", bg: "#eef2ff", icon: "%" },
  fixed        : { color: "#e8630a", bg: "#fff0e6", icon: "₦" },
  free_shipping: { color: "#16a34a", bg: "#dcfce7", icon: "🚚" },
};

/* ═══════════════════════════════════════════════════════════════
   COUPON CARD
═══════════════════════════════════════════════════════════════ */
function CouponCard({ coupon, onCopy, copied }) {
  const cfg       = COUPON_CONFIG[coupon.type] || COUPON_CONFIG.percentage;
  const isCopied  = copied === coupon.code;

  const discountText =
    coupon.type === "percentage"
      ? `${coupon.value}% OFF`
      : coupon.type === "fixed"
        ? `${naira(coupon.value)} OFF`
        : "FREE DELIVERY";

  const statusText =
    !coupon.usable
      ? coupon.is_used    ? "Already used"
      : coupon.is_expired ? "Expired"
      : coupon.is_full    ? "Fully redeemed"
      : "Unavailable"
      : coupon.days_left === 0 ? "Expires today!"
      : coupon.days_left <= 3  ? `${coupon.days_left} days left`
      : coupon.days_left != null ? `${coupon.days_left} days left`
      : "No expiry";

  const statusColor =
    !coupon.usable        ? "#dc2626" :
    coupon.days_left <= 3 ? "#f59e0b" :
    "#16a34a";

  return (
    <div className={`cp-card${!coupon.usable ? " cp-card--used" : ""}`}>

      {/* Left strip */}
      <div className="cp-card-strip" style={{ background: cfg.color }} />

      {/* Main */}
      <div className="cp-card-main">

        {/* Header */}
        <div className="cp-card-head">
          <div className="cp-discount-badge" style={{ background: cfg.bg, color: cfg.color }}>
            <span className="cp-discount-icon">{cfg.icon}</span>
            <span className="cp-discount-text">{discountText}</span>
          </div>
          <span className="cp-status" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>

        {/* Description */}
        {coupon.description && (
          <p className="cp-desc">{coupon.description}</p>
        )}

        {/* Details */}
        <div className="cp-details">
          {coupon.min_purchase > 0 && (
            <span className="cp-detail">
              Min: {naira(coupon.min_purchase)}
            </span>
          )}
          {coupon.max_discount && (
            <span className="cp-detail">
              Max: {naira(coupon.max_discount)}
            </span>
          )}
          {coupon.usage_limit && (
            <span className="cp-detail">
              {coupon.usage_count}/{coupon.usage_limit} used
            </span>
          )}
          {coupon.expires_at && (
            <span className="cp-detail">
              Expires {fmtDate(coupon.expires_at)}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="cp-divider">
        <div className="cp-divider-notch cp-divider-notch--top" />
        <div className="cp-divider-line" />
        <div className="cp-divider-notch cp-divider-notch--bottom" />
      </div>

      {/* Code */}
      <div className="cp-card-code">
        <p className="cp-code-label">Code</p>
        <p className="cp-code">{coupon.code}</p>
        <button
          className={`cp-copy-btn${isCopied ? " cp-copy-btn--done" : ""}`}
          onClick={() => onCopy(coupon.code)}
          disabled={!coupon.usable}
        >
          {isCopied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE INPUT
═══════════════════════════════════════════════════════════════ */
function ValidatePanel({ onValidated }) {
  const [code,    setCode]    = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const validate = async () => {
    if (!code.trim()) { setError("Enter a coupon code"); return; }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API}/coupons/validate`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          code         : code.trim().toUpperCase(),
          order_amount : Number(amount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Invalid coupon");
      } else {
        setResult(data);
        onValidated?.(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-validate-panel">
      <h3 className="cp-validate-title">🏷️ Have a coupon code?</h3>
      <p className="cp-validate-sub">Enter your code below to check if it's valid</p>

      <div className="cp-validate-inputs">
        <input
          className="cp-validate-input"
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && validate()}
        />
        <input
          className="cp-validate-input"
          placeholder="Order amount (optional)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && validate()}
        />
      </div>

      <button
        className="cp-validate-btn"
        onClick={validate}
        disabled={loading || !code.trim()}
      >
        {loading ? "Checking…" : "Validate Coupon"}
      </button>

      {error && (
        <div className="cp-validate-error">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="cp-validate-success">
          <div className="cp-validate-success-top">
            <span>✅ Valid coupon!</span>
            <span className="cp-validate-save">
              Save {naira(result.discount)}
            </span>
          </div>
          <p>{result.message}</p>
          {result.final_amount > 0 && (
            <p className="cp-validate-final">
              Final amount: <strong>{naira(result.final_amount)}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Coupons({ user }) {
  const navigate = useNavigate();

  const [coupons,  setCoupons]  = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState("available"); // available | used | history
  const [copied,   setCopied]   = useState(null);
  const [toast,    setToast]    = useState(null);

  /* ── Auth check ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/coupons");
  }, [navigate]);

  /* ── Load coupons ── */
  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [couponRes, historyRes] = await Promise.all([
        fetch(`${API}/coupons`,         { headers: authH() }),
        fetch(`${API}/coupons/history`, { headers: authH() }),
      ]);

      if (couponRes.ok) {
        const d = await couponRes.json();
        setCoupons(d.coupons || []);
      }

      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.history || []);
      }
    } catch {
      setError("Could not load coupons. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  /* ── Copy code ── */
  const handleCopy = useCallback((code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setToast(`Code "${code}" copied!`);
    setTimeout(() => { setCopied(null); setToast(null); }, 2_500);
  }, []);

  /* ── Filtered ── */
  const available = coupons.filter((c) =>  c.usable);
  const used      = coupons.filter((c) => !c.usable);

  /* ── Stats ── */
  const totalSaved = history.reduce((s, h) => s + Number(h.discount || 0), 0);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="cp-page">

      {/* ── Topbar ── */}
      <div className="cp-topbar">
        <button className="cp-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="cp-topbar-title">My Coupons</h1>
          <p className="cp-topbar-sub">{coupons.length} available</p>
        </div>
        <button className="cp-refresh" onClick={loadCoupons} aria-label="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 12a9 9 0 009-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 006.74-2.74L21 16"/>
            <path d="M21 21v-5h-5"/>
          </svg>
        </button>
      </div>

      <div className="cp-scroll">

        {/* ── Savings banner ── */}
        {totalSaved > 0 && (
          <div className="cp-savings-banner">
            <span className="cp-savings-emoji">🎉</span>
            <div>
              <p className="cp-savings-title">Total Saved</p>
              <p className="cp-savings-amount">{naira(totalSaved)}</p>
            </div>
            <span className="cp-savings-count">
              {history.length} coupon{history.length !== 1 ? "s" : ""} used
            </span>
          </div>
        )}

        {/* ── Validate panel ── */}
        <ValidatePanel />

        {/* ── Error ── */}
        {error && (
          <div className="cp-error">
            <p>⚠️ {error}</p>
            <button onClick={loadCoupons}>Retry</button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="cp-tabs">
          {[
            { key: "available", label: "Available", count: available.length },
            { key: "used",      label: "Used",      count: used.length      },
            { key: "history",   label: "History",   count: history.length   },
          ].map((t) => (
            <button
              key={t.key}
              className={`cp-tab${tab === t.key ? " cp-tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="cp-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="cp-sk-list">
            {[1,2,3].map((i) => (
              <div key={i} className="cp-sk" />
            ))}
          </div>
        )}

        {/* ── Available coupons ── */}
        {!loading && tab === "available" && (
          <>
            {available.length === 0 ? (
              <div className="cp-empty">
                <span>🏷️</span>
                <p>No coupons available right now</p>
                <small>Check back soon — new deals drop regularly!</small>
              </div>
            ) : (
              <div className="cp-list">
                {available.map((c) => (
                  <CouponCard
                    key={c.id}
                    coupon={c}
                    onCopy={handleCopy}
                    copied={copied}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Used coupons ── */}
        {!loading && tab === "used" && (
          <>
            {used.length === 0 ? (
              <div className="cp-empty">
                <span>✅</span>
                <p>No used or expired coupons</p>
              </div>
            ) : (
              <div className="cp-list">
                {used.map((c) => (
                  <CouponCard
                    key={c.id}
                    coupon={c}
                    onCopy={handleCopy}
                    copied={copied}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── History ── */}
        {!loading && tab === "history" && (
          <>
            {history.length === 0 ? (
              <div className="cp-empty">
                <span>📋</span>
                <p>No coupon history yet</p>
                <small>Coupons you use will appear here</small>
              </div>
            ) : (
              <div className="cp-history">
                {history.map((h) => {
                  const cfg = COUPON_CONFIG[h.type] || COUPON_CONFIG.percentage;
                  return (
                    <div key={h.id} className="cp-history-item">
                      <div
                        className="cp-history-icon"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon}
                      </div>
                      <div className="cp-history-info">
                        <p className="cp-history-code">{h.code}</p>
                        <p className="cp-history-desc">{h.description || "Coupon applied"}</p>
                        <p className="cp-history-date">{timeAgo(h.redeemed_at)}</p>
                      </div>
                      <div className="cp-history-save">
                        <p className="cp-history-amount">-{naira(h.discount)}</p>
                        <p className="cp-history-label">saved</p>
                      </div>
                    </div>
                  );
                })}

                <div className="cp-history-total">
                  <p>Total saved across {history.length} orders</p>
                  <p className="cp-history-total-amount">{naira(totalSaved)}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tips ── */}
        <div className="cp-tips">
          <h3 className="cp-tips-title">💡 How to use coupons</h3>
          {[
            { i: "1️⃣", t: "Copy the coupon code by tapping 'Copy'" },
            { i: "2️⃣", t: "Go to checkout and paste the code in the coupon field" },
            { i: "3️⃣", t: "Your discount will be applied automatically" },
            { i: "4️⃣", t: "Each coupon can only be used once per account" },
          ].map((tip, idx) => (
            <div key={idx} className="cp-tip">
              <span>{tip.i}</span>
              <p>{tip.t}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="cp-toast">
          ✅ {toast}
        </div>
      )}

      {/* ── Styles ── */}
      <style>{CP_STYLES}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const CP_STYLES = `

/* ── Page ── */
.cp-page {
  max-width: 680px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f7f4ef;
  font-family: 'DM Sans', system-ui, sans-serif;
  padding-bottom: 60px;
}

/* ── Topbar ── */
.cp-topbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: rgba(247,244,239,.96);
  border-bottom: 1px solid #ede9e3;
  backdrop-filter: blur(12px);
}
.cp-back {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1.5px solid #e0d8cc; background: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #333; flex-shrink: 0; transition: all .15s;
}
.cp-back:hover { border-color: #e8630a; color: #e8630a; }
.cp-topbar-title { font-size: 18px; font-weight: 800; color: #111; margin: 0; }
.cp-topbar-sub   { font-size: 11px; color: #aaa; margin: 0; }
.cp-refresh {
  margin-left: auto;
  width: 34px; height: 34px; border-radius: 50%;
  border: 1.5px solid #e0d8cc; background: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #555; transition: all .15s;
}
.cp-refresh:hover { border-color: #e8630a; color: #e8630a; }

/* ── Scroll ── */
.cp-scroll { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }

/* ── Savings banner ── */
.cp-savings-banner {
  background: linear-gradient(135deg, #fff7ed, #fff0dc);
  border: 1px solid #ffd4a8;
  border-radius: 16px; padding: 16px 18px;
  display: flex; align-items: center; gap: 14px;
}
.cp-savings-emoji  { font-size: 32px; flex-shrink: 0; }
.cp-savings-title  { font-size: 11px; color: #a16207; font-weight: 600; margin: 0; }
.cp-savings-amount { font-size: 22px; font-weight: 900; color: #e8630a; margin: 0; }
.cp-savings-count  {
  margin-left: auto; flex-shrink: 0;
  font-size: 11px; font-weight: 700; color: #a16207;
  background: #fef3c7; padding: 4px 10px; border-radius: 20px;
}

/* ── Validate panel ── */
.cp-validate-panel {
  background: #fff; border: 1px solid #ede9e3;
  border-radius: 16px; padding: 18px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}
.cp-validate-title { font-size: 15px; font-weight: 800; color: #111; margin: 0 0 4px; }
.cp-validate-sub   { font-size: 12px; color: #aaa; margin: 0 0 14px; }
.cp-validate-inputs {
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;
}
.cp-validate-input {
  width: 100%; padding: 11px 14px;
  border: 1.5px solid #ede9e3; border-radius: 10px;
  font-size: 14px; background: #faf8f4;
  box-sizing: border-box; outline: none; font-family: inherit;
  transition: border-color .15s; letter-spacing: 0.5px;
}
.cp-validate-input:focus { border-color: #e8630a; background: #fff; }
.cp-validate-btn {
  width: 100%; padding: 12px;
  background: #e8630a; color: #fff; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: opacity .15s;
}
.cp-validate-btn:disabled { opacity: .5; cursor: not-allowed; }
.cp-validate-error {
  display: flex; align-items: center; gap: 8px;
  margin-top: 10px; padding: 10px 12px;
  background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 8px; font-size: 13px; color: #dc2626;
}
.cp-validate-success {
  margin-top: 10px; padding: 12px 14px;
  background: #f0fdf4; border: 1px solid #bbf7d0;
  border-radius: 10px;
}
.cp-validate-success-top {
  display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 4px;
  font-size: 13px; font-weight: 700; color: #16a34a;
}
.cp-validate-save  { font-size: 16px; font-weight: 900; color: #16a34a; }
.cp-validate-success p { font-size: 12px; color: #166534; margin: 3px 0 0; }
.cp-validate-final { font-size: 13px !important; color: #111 !important; margin-top: 6px !important; }

/* ── Error ── */
.cp-error {
  padding: 12px 14px;
  background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; color: #dc2626;
}
.cp-error button {
  padding: 5px 12px; background: #dc2626; color: #fff;
  border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
}

/* ── Tabs ── */
.cp-tabs {
  display: flex; gap: 0;
  background: #fff; border-radius: 12px;
  border: 1px solid #ede9e3; overflow: hidden;
}
.cp-tab {
  flex: 1; padding: 11px 8px;
  border: none; background: none;
  font-size: 13px; font-weight: 600; color: #aaa;
  cursor: pointer; border-bottom: 2.5px solid transparent;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  transition: color .15s;
}
.cp-tab--active { color: #111; border-bottom-color: #e8630a; background: #faf8f4; }
.cp-tab-count {
  background: #f5f3ef; color: #888;
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 20px;
}
.cp-tab--active .cp-tab-count { background: #fff0e6; color: #e8630a; }

/* ── Coupon list ── */
.cp-list { display: flex; flex-direction: column; gap: 12px; }

/* ── Coupon card ── */
.cp-card {
  background: #fff; border: 1px solid #ede9e3;
  border-radius: 16px; overflow: hidden;
  display: flex; align-items: stretch;
  box-shadow: 0 2px 8px rgba(0,0,0,.05);
  transition: transform .15s, box-shadow .15s;
}
.cp-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.cp-card--used { opacity: .6; filter: grayscale(.3); }

/* Left colored strip */
.cp-card-strip { width: 6px; flex-shrink: 0; }

/* Main area */
.cp-card-main { flex: 1; padding: 14px 12px; min-width: 0; }
.cp-card-head {
  display: flex; align-items: center;
  justify-content: space-between; gap: 8px; margin-bottom: 8px;
}
.cp-discount-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 20px;
  font-weight: 800; font-size: 14px;
}
.cp-discount-icon { font-size: 16px; }
.cp-status { font-size: 10px; font-weight: 700; white-space: nowrap; }

.cp-desc {
  font-size: 13px; color: #555; line-height: 1.4; margin-bottom: 8px;
}
.cp-details {
  display: flex; flex-wrap: wrap; gap: 5px;
}
.cp-detail {
  font-size: 10px; font-weight: 600; color: #888;
  background: #f5f3ef; padding: 2px 8px; border-radius: 20px;
}

/* Divider (dotted cut) */
.cp-divider {
  width: 20px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center;
  position: relative; background: #f7f4ef;
}
.cp-divider-line {
  flex: 1; width: 1px;
  background: repeating-linear-gradient(
    to bottom, #ddd 0, #ddd 4px, transparent 4px, transparent 8px
  );
}
.cp-divider-notch {
  width: 16px; height: 16px; border-radius: 50%;
  background: #f7f4ef; flex-shrink: 0;
  border: 1px solid #ede9e3;
}
.cp-divider-notch--top  { margin-top: -8px;  border-top: none; }
.cp-divider-notch--bottom { margin-bottom: -8px; border-bottom: none; }

/* Code area */
.cp-card-code {
  padding: 14px 12px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 6px; min-width: 90px; flex-shrink: 0;
}
.cp-code-label { font-size: 9px; color: #aaa; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.cp-code {
  font-size: 13px; font-weight: 900; color: #111;
  letter-spacing: 1px; text-align: center;
  word-break: break-all;
}
.cp-copy-btn {
  padding: 6px 14px;
  background: #e8630a; color: #fff; border: none;
  border-radius: 20px; font-size: 11px; font-weight: 700;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.cp-copy-btn--done  { background: #16a34a; }
.cp-copy-btn:disabled {
  background: #ddd; color: #aaa; cursor: not-allowed;
}

/* ── Empty ── */
.cp-empty {
  text-align: center; padding: 48px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.cp-empty span  { font-size: 40px; }
.cp-empty p     { font-size: 15px; font-weight: 700; color: #333; margin: 0; }
.cp-empty small { font-size: 12px; color: #aaa; }

/* ── History ── */
.cp-history { display: flex; flex-direction: column; gap: 0; }
.cp-history-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 0; border-bottom: 1px solid #f5f3ef;
}
.cp-history-item:last-of-type { border-bottom: none; }
.cp-history-icon {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; font-weight: 700; flex-shrink: 0;
}
.cp-history-info { flex: 1; min-width: 0; }
.cp-history-code { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 2px; }
.cp-history-desc { font-size: 12px; color: #888; margin: 0 0 2px; }
.cp-history-date { font-size: 11px; color: #bbb; margin: 0; }
.cp-history-save { text-align: right; flex-shrink: 0; }
.cp-history-amount { font-size: 16px; font-weight: 800; color: #16a34a; margin: 0 0 2px; }
.cp-history-label  { font-size: 10px; color: #aaa; margin: 0; }

.cp-history-total {
  margin-top: 14px; padding: 14px 16px;
  background: #f0fdf4; border: 1px solid #bbf7d0;
  border-radius: 12px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: #166534; font-weight: 600;
}
.cp-history-total-amount { font-size: 20px; font-weight: 900; color: #16a34a; }

/* ── Tips ── */
.cp-tips {
  background: #fff; border: 1px solid #ede9e3;
  border-radius: 16px; padding: 16px;
}
.cp-tips-title { font-size: 15px; font-weight: 800; color: #111; margin: 0 0 12px; }
.cp-tip { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.cp-tip:last-child { margin-bottom: 0; }
.cp-tip span:first-child { font-size: 16px; flex-shrink: 0; }
.cp-tip p { font-size: 13px; color: #555; line-height: 1.4; margin: 0; }

/* ── Toast ── */
.cp-toast {
  position: fixed; bottom: 80px; left: 50%;
  transform: translateX(-50%);
  background: #111; color: #fff;
  padding: 12px 20px; border-radius: 20px;
  font-size: 13px; font-weight: 600;
  box-shadow: 0 4px 20px rgba(0,0,0,.25);
  z-index: 999; white-space: nowrap;
  animation: cp-fade .2s ease;
}
@keyframes cp-fade {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ── Skeleton ── */
@keyframes cp-shimmer {
  from { background-position: -400px 0; }
  to   { background-position:  400px 0; }
}
.cp-sk-list { display: flex; flex-direction: column; gap: 12px; }
.cp-sk {
  height: 110px; border-radius: 16px;
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 400px 100%;
  animation: cp-shimmer 1.4s infinite linear;
}

/* ── Responsive ── */
@media (max-width: 380px) {
  .cp-card-code { min-width: 75px; }
  .cp-code      { font-size: 11px; }
}
`;