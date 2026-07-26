// src/pages/Profile/Coupons.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Coupons.css";
import AirtimeClaimModal from "./components/AirtimeClaimModal";

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
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return "₦0";
  return "₦" + num.toLocaleString("en-NG");
};

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
  percentage   : { color: "#6366f1", bg: "#eef2ff",  label: "Discount"      },
  fixed        : { color: "#e8630a", bg: "#fff0e6",  label: "Coupon"        },
  free_shipping: { color: "#16a34a", bg: "#dcfce7",  label: "Free Shipping" },
  airtime      : { color: "#0891b2", bg: "#f0f9ff",  label: "Airtime"       },
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);

const IconPercent = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="9"  cy="9"  r="2"/>
    <circle cx="15" cy="15" r="2"/>
    <path d="M5 19L19 5"/>
  </svg>
);

const IconTag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const IconTruck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1"/>
    <path d="M16 8h4l3 5v3h-7V8z"/>
    <circle cx="5.5"  cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconAlertCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8"  x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconGift = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/>
    <rect x="2" y="7" width="20" height="5" rx="1"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
  </svg>
);

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconInfo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8"  x2="12.01" y2="8"/>
  </svg>
);

const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

/* ── Coupon type icon resolver ── */
const CouponIcon = ({ type }) => {
  if (type === "percentage")    return <IconPercent />;
  if (type === "free_shipping") return <IconTruck />;
  if (type === "airtime")       return <IconPhone />;
  return <IconTag />;
};

/* ═══════════════════════════════════════════════════════════════
   AIRTIME COUPON CARD
═══════════════════════════════════════════════════════════════ */
function AirtimeCard({ coupon, onCopy, copied, onClaim, claiming }) {
  const cfg      = COUPON_CONFIG.airtime;
  const isCopied = copied === coupon.code;
  const isUsed   = coupon.is_used;

  const statusMap = {
    available : { label: "Ready to claim",  color: "#16a34a" },
    claimed   : { label: "Claim submitted", color: "#f59e0b" },
    credited  : { label: "Credited ✓",      color: "#6366f1" },
    expired   : { label: "Expired",         color: "#dc2626" },
  };

  const effectiveStatus = coupon.status ?? "available";
  const st = statusMap[effectiveStatus] ?? statusMap.available;

  return (
    <div className={`cp-card cp-card--airtime${isUsed ? " cp-card--used" : ""}`}>

      {/* Left strip */}
      <div className="cp-card-strip" style={{ background: cfg.color }} />

      {/* Main body */}
      <div className="cp-card-main">
        <div className="cp-card-head">
          <div
            className="cp-discount-badge"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <span className="cp-discount-icon"><IconPhone /></span>
            <span className="cp-discount-text">{naira(coupon.value)} AIRTIME</span>
          </div>
          <span className="cp-status" style={{ color: st.color }}>{st.label}</span>
        </div>

        <p className="cp-desc">
          {coupon.description || `🎡 Spin & Win — ₦${coupon.value} Airtime`}
        </p>

        <div className="cp-details">
          <span className="cp-detail">Won on {fmtDate(coupon.created_at)}</span>
          {coupon.claimed_at && (
            <span className="cp-detail">Claimed {fmtDate(coupon.claimed_at)}</span>
          )}
        </div>

        {/* Claim button — only when status is available and not used */}
        {!isUsed && effectiveStatus === "available" && (
          <button
            className="cp-airtime-claim-btn"
            onClick={() => onClaim(coupon)}
            disabled={claiming === coupon.code}
          >
            <IconSend />
            {claiming === coupon.code ? "Submitting…" : "Claim Airtime"}
          </button>
        )}

        {/* Pending info */}
        {effectiveStatus === "claimed" && (
          <div className="cp-airtime-pending">
            <IconClock />
            <span>Processing — airtime sent within 24 hours</span>
          </div>
        )}

        {/* Credited info */}
        {effectiveStatus === "credited" && (
          <div className="cp-airtime-credited">
            <IconCheckCircle />
            <span>Airtime has been sent to your number</span>
          </div>
        )}
      </div>

      {/* Ticket divider */}
      <div className="cp-divider">
        <div className="cp-divider-notch cp-divider-notch--top" />
        <div className="cp-divider-line" />
        <div className="cp-divider-notch cp-divider-notch--bottom" />
      </div>

      {/* Code + copy */}
      <div className="cp-card-code">
        <p className="cp-code-label">Code</p>
        <p className="cp-code">{coupon.code}</p>
        <button
          className={`cp-copy-btn${isCopied ? " cp-copy-btn--done" : ""}`}
          onClick={() => onCopy(coupon.code)}
          aria-label={`Copy airtime code ${coupon.code}`}
        >
          {isCopied ? <IconCheck /> : <IconCopy />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DISCOUNT COUPON CARD
═══════════════════════════════════════════════════════════════ */
function CouponCard({ coupon, onCopy, copied }) {
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
      : coupon.days_left <= 3    ? `${coupon.days_left}d left`
      : coupon.days_left != null ? `${coupon.days_left}d left`
      : "No expiry";

  const statusColor =
    !coupon.usable        ? "#dc2626" :
    coupon.days_left <= 3 ? "#f59e0b" :
    "#16a34a";

  return (
    <div className={`cp-card${!coupon.usable ? " cp-card--used" : ""}`}>

      <div className="cp-card-strip" style={{ background: cfg.color }} />

      <div className="cp-card-main">
        <div className="cp-card-head">
          <div
            className="cp-discount-badge"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <span className="cp-discount-icon">
              <CouponIcon type={coupon.type} />
            </span>
            <span className="cp-discount-text">{discountText}</span>
          </div>
          <span className="cp-status" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>

        {coupon.description && (
          <p className="cp-desc">{coupon.description}</p>
        )}

        <div className="cp-details">
          {coupon.min_purchase > 0 && (
            <span className="cp-detail">Min: {naira(coupon.min_purchase)}</span>
          )}
          {coupon.max_discount && (
            <span className="cp-detail">Max: {naira(coupon.max_discount)}</span>
          )}
          {coupon.usage_limit && (
            <span className="cp-detail">
              {coupon.usage_count}/{coupon.usage_limit} used
            </span>
          )}
          {coupon.expires_at && (
            <span className="cp-detail cp-detail--date">
              <IconClock />
              {fmtDate(coupon.expires_at)}
            </span>
          )}
        </div>
      </div>

      <div className="cp-divider">
        <div className="cp-divider-notch cp-divider-notch--top" />
        <div className="cp-divider-line" />
        <div className="cp-divider-notch cp-divider-notch--bottom" />
      </div>

      <div className="cp-card-code">
        <p className="cp-code-label">Code</p>
        <p className="cp-code">{coupon.code}</p>
        <button
          className={`cp-copy-btn${isCopied ? " cp-copy-btn--done" : ""}`}
          onClick={() => onCopy(coupon.code)}
          disabled={!coupon.usable}
          aria-label={`Copy coupon code ${coupon.code}`}
        >
          {isCopied ? <IconCheck /> : <IconCopy />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SMART CARD — routes to AirtimeCard or CouponCard
═══════════════════════════════════════════════════════════════ */
function SmartCard({ coupon, onCopy, copied, onClaim, claiming }) {
  if (coupon.coupon_kind === "airtime" || coupon.type === "airtime") {
    return (
      <AirtimeCard
        coupon={coupon}
        onCopy={onCopy}
        copied={copied}
        onClaim={onClaim}
        claiming={claiming}
      />
    );
  }
  return (
    <CouponCard
      coupon={coupon}
      onCopy={onCopy}
      copied={copied}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE PANEL
═══════════════════════════════════════════════════════════════ */
function ValidatePanel({ onValidated }) {
  const [code,    setCode]    = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const validate = async () => {
    if (!code.trim()) { setError("Enter a coupon code."); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch(`${API}/coupons/validate`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          code         : code.trim().toUpperCase(),
          order_amount : Math.max(0, Number(amount) || 0),
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
    <div className="cp-validate-panel">
      <div className="cp-validate-header">
        <span className="cp-validate-header-icon"><IconSearch /></span>
        <div>
          <h3 className="cp-validate-title">Have a coupon code?</h3>
          <p className="cp-validate-sub">Enter your code below to check if it's valid</p>
        </div>
      </div>

      <div className="cp-validate-inputs">
        <input
          className="cp-validate-input"
          placeholder="Enter coupon code"
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
          className="cp-validate-input"
          placeholder="Order amount (optional)"
          type="number"
          min="0"
          value={amount}
          onChange={(e) =>
            setAmount(Math.max(0, Number(e.target.value)).toString())
          }
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
        <div className="cp-validate-error" role="alert">
          <IconAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="cp-validate-success" role="status">
          <div className="cp-validate-success-top">
            <span className="cp-validate-success-label">
              <IconCheckCircle /> Valid coupon!
            </span>
            <span className="cp-validate-save">{naira(result.discount)} off</span>
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
   AIRTIME INFO BANNER
═══════════════════════════════════════════════════════════════ */
function AirtimeBanner() {
  return (
    <div className="cp-airtime-banner">
      <span className="cp-airtime-banner-icon">📱</span>
      <div>
        <p className="cp-airtime-banner-title">How airtime credits work</p>
        <p className="cp-airtime-banner-sub">
          Tap <strong>Claim Airtime</strong> on any airtime coupon.
          Verify your phone number and our team will credit
          your airtime within 24 hours.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Coupons() {
  const navigate = useNavigate();

  /* ── Core state ── */
  const [coupons,  setCoupons]  = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState("available");
  const [copied,   setCopied]   = useState(null);
  const [toast,    setToast]    = useState(null);
  const [claiming, setClaiming] = useState(null);

  /* ── Modal state ── */
  const [claimModal, setClaimModal] = useState({
    open   : false,
    coupon : null,
  });

  /* ── Refs ── */
  const toastTimerRef  = useRef(null);
  const copiedTimerRef = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/coupons");
  }, [navigate]);

  /* ── Toast helper ── */
  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3_000);
  }, []);

  /* ── Load coupons ── */
  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [couponRes, historyRes] = await Promise.all([
        fetch(`${API}/coupons`,         { headers: authH() }),
        fetch(`${API}/coupons/history`, { headers: authH() }),
      ]);

      if (!couponRes.ok) throw new Error("Failed to load coupons");
      if (!historyRes.ok) throw new Error("Failed to load history");

      const couponData  = await couponRes.json();
      const historyData = await historyRes.json();

      setCoupons(couponData.coupons   || []);
      setHistory(historyData.history  || []);
    } catch (err) {
      setError(err.message || "Could not load coupons. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
    return () => {
      clearTimeout(toastTimerRef.current);
      clearTimeout(copiedTimerRef.current);
    };
  }, [loadCoupons]);

  /* ════════════════════════════════════════════════════════
     CLAIM HANDLER — opens modal
  ════════════════════════════════════════════════════════ */
  const handleClaim = useCallback((coupon) => {
    // Check if phone already verified in this session
    const savedPhone   = localStorage.getItem("verified_phone")   || "";
    const savedNetwork = localStorage.getItem("verified_network")  || "";

    if (savedPhone && savedNetwork) {
      // Phone already verified — skip modal, submit directly
      submitClaim(coupon.code, coupon.value, savedPhone, savedNetwork);
    } else {
      // Open modal to collect + verify phone
      setClaimModal({ open: true, coupon });
    }
  }, []); // eslint-disable-line

  /* ════════════════════════════════════════════════════════
     DIRECT SUBMIT — when phone already verified
  ════════════════════════════════════════════════════════ */
  const submitClaim = useCallback(async (code, value, phone, network) => {
    setClaiming(code);
    try {
      const res  = await fetch(`${API}/coupons/airtime/claim`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({ code, phone, network }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`✅ ₦${value} airtime claim submitted!`);
        setCoupons((prev) =>
          prev.map((c) =>
            c.code === code
              ? { ...c, status: "claimed", is_used: true, usable: false }
              : c
          )
        );
      } else {
        showToast(data.message || "Claim failed. Try again.", true);
      }
    } catch {
      showToast("Network error. Please try again.", true);
    } finally {
      setClaiming(null);
    }
  }, [showToast]);

  /* ════════════════════════════════════════════════════════
     MODAL SUCCESS CALLBACK
  ════════════════════════════════════════════════════════ */
  const handleModalSuccess = useCallback((code, data) => {
    // Save verified phone for future claims
    if (data.phone)   localStorage.setItem("verified_phone",   data.phone);
    if (data.network) localStorage.setItem("verified_network", data.network);

    // Update coupon in list
    setCoupons((prev) =>
      prev.map((c) =>
        c.code === code
          ? {
              ...c,
              status       : "claimed",
              is_used      : true,
              usable       : false,
              claimed_at   : new Date().toISOString(),
            }
          : c
      )
    );

    showToast(`✅ Airtime claim submitted! Credited within 24 hours.`);

    // Close modal after short delay so user sees step 3 (success screen)
    setTimeout(() => {
      setClaimModal({ open: false, coupon: null });
    }, 2_500);
  }, [showToast]);

  /* ── Copy handler ── */
  const handleCopy = useCallback((code) => {
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
    showToast(`Code "${code}" copied!`);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(null), 2_500);
  }, [showToast]);

  /* ── Derived lists ── */
  const allAvailable   = coupons.filter((c) =>  c.usable);
  const allUsed        = coupons.filter((c) => !c.usable);
  const airtimeCoupons = coupons.filter(
    (c) => c.coupon_kind === "airtime" || c.type === "airtime"
  );
  const totalSaved     = history.reduce((s, h) => s + Number(h.discount || 0), 0);
  const hasAirtime     = airtimeCoupons.length > 0;

  const TABS = [
    { key: "available", label: "Available", count: allAvailable.length   },
    {
      key   : "airtime",
      label : "📱 Airtime",
      count : airtimeCoupons.length,
      hide  : !hasAirtime && !loading,
    },
    { key: "used",    label: "Used",    count: allUsed.length    },
    { key: "history", label: "History", count: history.length    },
  ].filter((t) => !t.hide);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="cp-page">

      {/* ── Topbar ── */}
      <div className="cp-topbar">
        <button
          className="cp-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <IconBack />
        </button>
        <div className="cp-topbar-text">
          <h1 className="cp-topbar-title">My Coupons</h1>
          <p className="cp-topbar-sub">
            {allAvailable.length} available
            {hasAirtime
              ? ` · ${airtimeCoupons.filter((c) => !c.is_used).length} airtime`
              : ""}
          </p>
        </div>
        <button
          className="cp-refresh"
          onClick={loadCoupons}
          aria-label="Refresh coupons"
          disabled={loading}
        >
          <IconRefresh />
        </button>
      </div>

      <div className="cp-scroll">

        {/* ── Savings banner ── */}
        {totalSaved > 0 && (
          <div className="cp-savings-banner">
            <span className="cp-savings-icon"><IconGift /></span>
            <div className="cp-savings-text">
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
          <div className="cp-error" role="alert">
            <span className="cp-error-icon"><IconAlertCircle /></span>
            <p>{error}</p>
            <button onClick={loadCoupons}>Retry</button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="cp-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`cp-tab${tab === t.key ? " cp-tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="cp-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── Skeleton ── */}
        {loading && (
          <div className="cp-sk-list" aria-label="Loading coupons">
            {[1, 2, 3].map((i) => <div key={i} className="cp-sk" />)}
          </div>
        )}

        {/* ══════════════════════════════════════════
            AVAILABLE TAB
        ══════════════════════════════════════════ */}
        {!loading && tab === "available" && (
          allAvailable.length === 0 ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><IconTag /></span>
              <p>No coupons available right now</p>
              <small>Check back soon — new deals drop regularly!</small>
            </div>
          ) : (
            <div className="cp-list">
              {allAvailable.map((c) => (
                <SmartCard
                  key={c.id}
                  coupon={c}
                  onCopy={handleCopy}
                  copied={copied}
                  onClaim={handleClaim}
                  claiming={claiming}
                />
              ))}
            </div>
          )
        )}

        {/* ══════════════════════════════════════════
            AIRTIME TAB
        ══════════════════════════════════════════ */}
        {!loading && tab === "airtime" && (
          <>
            <AirtimeBanner />
            {airtimeCoupons.length === 0 ? (
              <div className="cp-empty">
                <span className="cp-empty-icon">📱</span>
                <p>No airtime coupons yet</p>
                <small>Spin the wheel to win airtime!</small>
              </div>
            ) : (
              <div className="cp-list">
                {airtimeCoupons.map((c) => (
                  <AirtimeCard
                    key={c.id}
                    coupon={c}
                    onCopy={handleCopy}
                    copied={copied}
                    onClaim={handleClaim}
                    claiming={claiming}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            USED TAB
        ══════════════════════════════════════════ */}
        {!loading && tab === "used" && (
          allUsed.length === 0 ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><IconCheckCircle /></span>
              <p>No used or expired coupons</p>
            </div>
          ) : (
            <div className="cp-list">
              {allUsed.map((c) => (
                <SmartCard
                  key={c.id}
                  coupon={c}
                  onCopy={handleCopy}
                  copied={copied}
                  onClaim={handleClaim}
                  claiming={claiming}
                />
              ))}
            </div>
          )
        )}

        {/* ══════════════════════════════════════════
            HISTORY TAB
        ══════════════════════════════════════════ */}
        {!loading && tab === "history" && (
          history.length === 0 ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><IconClock /></span>
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
                      <CouponIcon type={h.type} />
                    </div>
                    <div className="cp-history-info">
                      <p className="cp-history-code">{h.code}</p>
                      <p className="cp-history-desc">
                        {h.description || "Coupon applied"}
                      </p>
                      <p className="cp-history-date">{timeAgo(h.redeemed_at)}</p>
                    </div>
                    <div className="cp-history-save">
                      <p className="cp-history-amount">-{naira(h.discount)}</p>
                      <p className="cp-history-label">
                        {h.coupon_kind === "airtime" ? "airtime" : "saved"}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="cp-history-total">
                <p>Total saved across {history.length} orders</p>
                <p className="cp-history-total-amount">{naira(totalSaved)}</p>
              </div>
            </div>
          )
        )}

        {/* ── Tips ── */}
        {!loading && (
          <div className="cp-tips">
            <div className="cp-tips-header">
              <IconInfo />
              <h3 className="cp-tips-title">How to use coupons</h3>
            </div>
            {[
              { icon: <IconCopy />,        t: "Copy the coupon code by tapping 'Copy'" },
              { icon: <IconTag />,         t: "Go to checkout and paste the code in the coupon field" },
              { icon: <IconCheckCircle />, t: "Your discount will be applied automatically" },
              { icon: <IconPhone />,       t: "For airtime, tap 'Claim Airtime' and verify your number" },
              { icon: <IconAlertCircle />, t: "Each coupon can only be used once per account" },
            ].map((tip, idx) => (
              <div key={idx} className="cp-tip">
                <span className="cp-tip-icon">{tip.icon}</span>
                <p>{tip.t}</p>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════
          AIRTIME CLAIM MODAL
      ══════════════════════════════════════════ */}
      <AirtimeClaimModal
        isOpen={claimModal.open}
        coupon={claimModal.coupon}
        prefilledPhone={localStorage.getItem("verified_phone")   || ""}
        prefilledNetwork={localStorage.getItem("verified_network") || ""}
        onClose={() => setClaimModal({ open: false, coupon: null })}
        onSuccess={handleModalSuccess}
      />

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`cp-toast${toast.isError ? " cp-toast--error" : ""}`}
          role="alert"
          aria-live="assertive"
        >
          {toast.isError ? <IconAlertCircle /> : <IconCheck />}
          {toast.msg}
        </div>
      )}

    </div>
  );
}