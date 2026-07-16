// src/desktop/CouponsDesktop.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/CouponsDesktop.css";

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
  localStorage.getItem("token") ||
  null;

const authH = () => ({
  Authorization : `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n: number | string) => {
  const num = parseFloat(String(n));
  if (isNaN(num)) return "₦0";
  return "₦" + num.toLocaleString("en-NG");
};

const fmtDate = (d: string | null) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const timeAgo = (d: string | null) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1_000);
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface Coupon {
  id          : number;
  code        : string;
  type        : "percentage" | "fixed" | "free_shipping";
  value       : number;
  description : string;
  min_purchase: number;
  max_discount: number | null;
  usage_limit : number | null;
  usage_count : number;
  expires_at  : string | null;
  usable      : boolean;
  is_used     : boolean;
  is_expired  : boolean;
  is_full     : boolean;
  days_left   : number | null;
}

interface HistoryItem {
  id         : number;
  code       : string;
  type       : "percentage" | "fixed" | "free_shipping";
  description: string;
  discount   : number;
  redeemed_at: string;
}

interface ValidateResult {
  success      : boolean;
  message      : string;
  discount     : number;
  final_amount : number;
}

const COUPON_CONFIG = {
  percentage   : { color: "#6366f1", bg: "#eef2ff", label: "% OFF" },
  fixed        : { color: "#e8630a", bg: "#fff0e6", label: "₦ OFF" },
  free_shipping: { color: "#16a34a", bg: "#dcfce7", label: "FREE SHIP" },
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS  (same set, typed)
═══════════════════════════════════════════════════════════════ */
const IconBack       = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const IconRefresh    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>;
const IconPercent    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><path d="M5 19L19 5"/></svg>;
const IconTag        = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const IconTruck      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
const IconCopy       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
const IconCheck      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconSearch     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconAlertCircle= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconCheckCircle= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const IconGift       = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;
const IconClock      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconInfo       = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;

const CouponIcon = ({ type }: { type: string }) => {
  if (type === "percentage")    return <IconPercent />;
  if (type === "free_shipping") return <IconTruck />;
  return <IconTag />;
};

/* ═══════════════════════════════════════════════════════════════
   COUPON CARD  — Desktop variant
═══════════════════════════════════════════════════════════════ */
function CouponCardDesktop({
  coupon,
  onCopy,
  copied,
}: {
  coupon : Coupon;
  onCopy : (code: string) => void;
  copied : string | null;
}) {
  const cfg      = COUPON_CONFIG[coupon.type] || COUPON_CONFIG.percentage;
  const isCopied = copied === coupon.code;

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
      : coupon.days_left === 0   ? "Expires today!"
      : coupon.days_left != null && coupon.days_left <= 3
        ? `${coupon.days_left}d left`
      : coupon.days_left != null ? `${coupon.days_left}d left`
      : "No expiry";

  const statusColor =
    !coupon.usable               ? "#dc2626" :
    (coupon.days_left ?? 99) <= 3? "#f59e0b" :
    "#16a34a";

  return (
    <div className={`cpd-card${!coupon.usable ? " cpd-card--used" : ""}`}>

      {/* Left accent band */}
      <div className="cpd-accent" style={{ background: cfg.color }}>
        <div className="cpd-accent-icon">
          <CouponIcon type={coupon.type} />
        </div>
        <span className="cpd-accent-label">
          {COUPON_CONFIG[coupon.type]?.label ?? "DEAL"}
        </span>
      </div>

      {/* Body */}
      <div className="cpd-body">
        <div className="cpd-body-top">
          <div
            className="cpd-badge"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {discountText}
          </div>
          <span className="cpd-status" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>

        {coupon.description && (
          <p className="cpd-desc">{coupon.description}</p>
        )}

        <div className="cpd-meta">
          {coupon.min_purchase > 0 && (
            <span className="cpd-meta-chip">
              Min spend: {naira(coupon.min_purchase)}
            </span>
          )}
          {coupon.max_discount && (
            <span className="cpd-meta-chip">
              Max discount: {naira(coupon.max_discount)}
            </span>
          )}
          {coupon.usage_limit && (
            <span className="cpd-meta-chip">
              {coupon.usage_count}/{coupon.usage_limit} redeemed
            </span>
          )}
          {coupon.expires_at && (
            <span className="cpd-meta-chip cpd-meta-chip--date">
              <IconClock /> Expires {fmtDate(coupon.expires_at)}
            </span>
          )}
        </div>
      </div>

      {/* Ticket divider */}
      <div className="cpd-divider">
        <div className="cpd-notch cpd-notch--top" />
        <div className="cpd-dashes" />
        <div className="cpd-notch cpd-notch--bottom" />
      </div>

      {/* Code section */}
      <div className="cpd-code-section">
        <p className="cpd-code-label">Coupon Code</p>
        <p className="cpd-code">{coupon.code}</p>
        <button
          className={`cpd-copy${isCopied ? " cpd-copy--done" : ""}`}
          onClick={() => onCopy(coupon.code)}
          disabled={!coupon.usable}
          aria-label={`Copy ${coupon.code}`}
        >
          {isCopied ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy Code</>}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE PANEL  — Desktop
═══════════════════════════════════════════════════════════════ */
function ValidatePanelDesktop({
  onValidated,
}: {
  onValidated?: (data: ValidateResult) => void;
}) {
  const [code,    setCode]    = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ValidateResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const validate = async () => {
    if (!code.trim()) { setError("Please enter a coupon code."); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch(`${API}/coupons/validate`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({
          code        : code.trim().toUpperCase(),
          order_amount: Math.max(0, Number(amount) || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Invalid coupon.");
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
    <div className="cpd-validate">
      <div className="cpd-validate-head">
        <div className="cpd-validate-head-icon"><IconSearch /></div>
        <div>
          <h3 className="cpd-validate-title">Validate a Coupon Code</h3>
          <p className="cpd-validate-sub">
            Enter any code to instantly check its validity and savings
          </p>
        </div>
      </div>

      <div className="cpd-validate-row">
        <input
          className="cpd-validate-input"
          placeholder="Coupon code (e.g. SAVE20)"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
            setResult(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && validate()}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <input
          className="cpd-validate-input"
          placeholder="Order amount (optional)"
          type="number"
          min="0"
          value={amount}
          onChange={(e) =>
            setAmount(Math.max(0, Number(e.target.value)).toString())
          }
          onKeyDown={(e) => e.key === "Enter" && validate()}
        />
        <button
          className="cpd-validate-btn"
          onClick={validate}
          disabled={loading || !code.trim()}
        >
          {loading ? "Checking…" : "Validate"}
        </button>
      </div>

      {error && (
        <div className="cpd-validate-error" role="alert">
          <IconAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="cpd-validate-ok" role="status">
          <span className="cpd-validate-ok-label">
            <IconCheckCircle /> Valid!
          </span>
          <span>{result.message}</span>
          <span className="cpd-validate-ok-save">
            Save {naira(result.discount)}
            {result.final_amount > 0 &&
              ` · Final: ${naira(result.final_amount)}`}
          </span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HISTORY LIST
═══════════════════════════════════════════════════════════════ */
function HistoryList({ history }: { history: HistoryItem[] }) {
  const totalSaved = history.reduce((s, h) => s + Number(h.discount || 0), 0);

  if (history.length === 0) {
    return (
      <div className="cpd-empty">
        <span className="cpd-empty-icon"><IconClock /></span>
        <p>No coupon history yet</p>
        <small>Coupons you use will appear here</small>
      </div>
    );
  }

  return (
    <div className="cpd-history-wrap">
      <div className="cpd-history-list">
        {history.map((h) => {
          const cfg = COUPON_CONFIG[h.type] || COUPON_CONFIG.percentage;
          return (
            <div key={h.id} className="cpd-history-row">
              <div
                className="cpd-history-icon"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                <CouponIcon type={h.type} />
              </div>
              <div className="cpd-history-info">
                <span className="cpd-history-code">{h.code}</span>
                <span className="cpd-history-desc">
                  {h.description || "Coupon applied"}
                </span>
              </div>
              <span className="cpd-history-time">{timeAgo(h.redeemed_at)}</span>
              <span className="cpd-history-save">-{naira(h.discount)}</span>
            </div>
          );
        })}
      </div>

      <div className="cpd-history-footer">
        <span>
          Total saved across {history.length} order
          {history.length !== 1 ? "s" : ""}
        </span>
        <span className="cpd-history-total">{naira(totalSaved)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TIPS SIDEBAR
═══════════════════════════════════════════════════════════════ */
function TipsSidebar() {
  const tips = [
    { icon: <IconCopy />,        text: "Tap 'Copy Code' on any active coupon" },
    { icon: <IconTag />,         text: "Paste it in the checkout coupon field" },
    { icon: <IconCheckCircle />, text: "Discount is applied automatically"     },
    { icon: <IconAlertCircle />, text: "Each coupon is single-use per account" },
  ];

  return (
    <div className="cpd-tips">
      <div className="cpd-tips-head">
        <IconInfo />
        <h3>How to use coupons</h3>
      </div>
      {tips.map((tip, i) => (
        <div key={i} className="cpd-tip">
          <span className="cpd-tip-num">{i + 1}</span>
          <span className="cpd-tip-icon">{tip.icon}</span>
          <p>{tip.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATS SIDEBAR
═══════════════════════════════════════════════════════════════ */
function StatsSidebar({
  available,
  used,
  history,
}: {
  available: Coupon[];
  used     : Coupon[];
  history  : HistoryItem[];
}) {
  const totalSaved = history.reduce((s, h) => s + Number(h.discount || 0), 0);

  return (
    <div className="cpd-stats">
      <h3 className="cpd-stats-title">Summary</h3>

      <div className="cpd-stat">
        <span className="cpd-stat-label">Available</span>
        <span className="cpd-stat-val cpd-stat-val--green">
          {available.length}
        </span>
      </div>
      <div className="cpd-stat">
        <span className="cpd-stat-label">Used / Expired</span>
        <span className="cpd-stat-val">{used.length}</span>
      </div>
      <div className="cpd-stat">
        <span className="cpd-stat-label">Total orders</span>
        <span className="cpd-stat-val">{history.length}</span>
      </div>

      {totalSaved > 0 && (
        <div className="cpd-savings">
          <span className="cpd-savings-icon"><IconGift /></span>
          <div>
            <p className="cpd-savings-label">Total Saved</p>
            <p className="cpd-savings-amount">{naira(totalSaved)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DESKTOP COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CouponsDesktop() {
  const navigate = useNavigate();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<"available" | "used" | "history">(
    "available"
  );
  const [copied,  setCopied]  = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/coupons");
  }, [navigate]);

  /* ── Load data ── */
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

  useEffect(() => {
    loadCoupons();
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, [loadCoupons]);

  /* ── Copy handler ── */
  const handleCopy = useCallback((code: string) => {
    const fallback = () => {
      const el = document.createElement("textarea");
      el.value = code;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(fallback);
    } else {
      fallback();
    }
    setCopied(code);
    setToast(`Code "${code}" copied to clipboard!`);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => {
      setCopied(null);
      setToast(null);
    }, 2_500);
  }, []);

  /* ── Derived ── */
  const available = coupons.filter((c) =>  c.usable);
  const used      = coupons.filter((c) => !c.usable);

  const TABS = [
    { key: "available" as const, label: "Available", count: available.length },
    { key: "used"      as const, label: "Used",      count: used.length      },
    { key: "history"   as const, label: "History",   count: history.length   },
  ];

  const activeList =
    tab === "available" ? available :
    tab === "used"      ? used      : [];

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="cpd-page">

      {/* ── Page header ── */}
      <div className="cpd-header">
        <div className="cpd-header-left">
          <button
            className="cpd-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <IconBack />
          </button>
          <div>
            <h1 className="cpd-title">My Coupons</h1>
            <p className="cpd-subtitle">
              Manage and apply your discount codes
            </p>
          </div>
        </div>

        <button
          className="cpd-refresh-btn"
          onClick={loadCoupons}
          disabled={loading}
          aria-label="Refresh"
        >
          <IconRefresh />
          Refresh
        </button>
      </div>

      {/* ── Validate (full width) ── */}
      <ValidatePanelDesktop />

      {/* ── Main 2-column layout ── */}
      <div className="cpd-layout">

        {/* LEFT — coupon list */}
        <div className="cpd-main">

          {/* Tabs */}
          <div className="cpd-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`cpd-tab${tab === t.key ? " cpd-tab--active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="cpd-tab-badge">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="cpd-error" role="alert">
              <IconAlertCircle />
              <span>{error}</span>
              <button onClick={loadCoupons}>Retry</button>
            </div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="cpd-sk-grid" aria-label="Loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="cpd-sk" />
              ))}
            </div>
          )}

          {/* Coupon grid */}
          {!loading && tab !== "history" && (
            activeList.length === 0 ? (
              <div className="cpd-empty">
                <span className="cpd-empty-icon">
                  {tab === "available" ? <IconTag /> : <IconCheckCircle />}
                </span>
                <p>
                  {tab === "available"
                    ? "No coupons available right now"
                    : "No used or expired coupons"}
                </p>
                {tab === "available" && (
                  <small>Check back soon — new deals drop regularly!</small>
                )}
              </div>
            ) : (
              <div className="cpd-grid">
                {activeList.map((c) => (
                  <CouponCardDesktop
                    key={c.id}
                    coupon={c}
                    onCopy={handleCopy}
                    copied={copied}
                  />
                ))}
              </div>
            )
          )}

          {/* History */}
          {!loading && tab === "history" && (
            <HistoryList history={history} />
          )}
        </div>

        {/* RIGHT — sidebar */}
        <aside className="cpd-sidebar">
          <StatsSidebar
            available={available}
            used={used}
            history={history}
          />
          <TipsSidebar />
        </aside>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="cpd-toast" role="alert" aria-live="assertive">
          <IconCheck />
          {toast}
        </div>
      )}
    </div>
  );
}