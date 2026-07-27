// src/pages/Profile/Coupons.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams }              from "react-router-dom";
import "./styles/Coupons.css";
import AirtimeClaimModal from "./components/AirtimeClaimModal";
import VerificationModal from "./components/VerificationModal";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authH = () => ({
  Authorization : `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */
const normalisePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

/* ═══════════════════════════════════════════════════════════════
   FORMATTING
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

/* ═══════════════════════════════════════════════════════════════
   COUPON CONFIG
═══════════════════════════════════════════════════════════════ */
const COUPON_CONFIG = {
  percentage   : { color: "#6366f1", bg: "#eef2ff" },
  fixed        : { color: "#e8630a", bg: "#fff0e6" },
  free_shipping: { color: "#16a34a", bg: "#dcfce7" },
  airtime      : { color: "#0891b2", bg: "#f0f9ff" },
};

const AIRTIME_STATUS = {
  available : { label: "Ready to claim",  color: "#16a34a" },
  pending   : { label: "Pending review",  color: "#f59e0b" },
  redeemed  : { label: "Claim submitted", color: "#f59e0b" },
  processing: { label: "Processing…",     color: "#f59e0b" },
  completed : { label: "Credited ✓",      color: "#6366f1" },
  failed    : { label: "Failed",          color: "#dc2626" },
  expired   : { label: "Expired",         color: "#dc2626" },
  claimed   : { label: "Claim submitted", color: "#f59e0b" },
  credited  : { label: "Credited ✓",      color: "#6366f1" },
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS to identify airtime & availability
═══════════════════════════════════════════════════════════════ */
const isAirtimeCoupon = (c) =>
  c?.coupon_kind === "airtime" || c?.type === "airtime";

const isAirtimeAvailable = (c) =>
  isAirtimeCoupon(c) && c.status === "available" && !c.is_used;

const isDiscountAvailable = (c) =>
  !isAirtimeCoupon(c) && c.usable;

/* ═══════════════════════════════════════════════════════════════
   ICONS
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
    <circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/>
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
    <circle cx="5.5" cy="18.5" r="2.5"/>
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
    <line x1="12" y1="8" x2="12" y2="12"/>
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
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polyline points="22,4 12,13 2,4"/>
  </svg>
);

const CouponIcon = ({ type }) => {
  if (type === "percentage")    return <IconPercent />;
  if (type === "free_shipping") return <IconTruck />;
  if (type === "airtime")       return <IconPhone />;
  return <IconTag />;
};

/* ═══════════════════════════════════════════════════════════════
   AIRTIME CARD
═══════════════════════════════════════════════════════════════ */
function AirtimeCard({ coupon, onCopy, copied, onClaim, claiming }) {
  const cfg    = COUPON_CONFIG.airtime;
  const status = coupon.status ?? "available";
  const st     = AIRTIME_STATUS[status] ?? AIRTIME_STATUS.available;

  const amount = coupon.amount ?? coupon.value ?? 0;

  const isAvailable = status === "available";
  const isPending   = ["pending","redeemed","processing","claimed"].includes(status);
  const isCompleted = ["completed","credited"].includes(status);
  const isFailed    = status === "failed";
  const isCopied    = copied === coupon.code;

  return (
    <div className={`cp-card cp-card--airtime${!isAvailable ? " cp-card--used" : ""}`}>
      <div className="cp-card-strip" style={{ background: cfg.color }} />

      <div className="cp-card-main">
        <div className="cp-card-head">
          <div className="cp-discount-badge"
               style={{ background: cfg.bg, color: cfg.color }}>
            <span className="cp-discount-icon"><IconPhone /></span>
            <span className="cp-discount-text">{naira(amount)} AIRTIME</span>
          </div>
          <span className="cp-status" style={{ color: st.color }}>{st.label}</span>
        </div>

        <p className="cp-desc">
          {coupon.description || `🎡 Spin & Win — ${naira(amount)} Airtime`}
        </p>

        <div className="cp-details">
          <span className="cp-detail">Won on {fmtDate(coupon.created_at)}</span>
          {coupon.claimed_at && (
            <span className="cp-detail">Claimed {fmtDate(coupon.claimed_at)}</span>
          )}
          {coupon.claim_phone && (
            <span className="cp-detail">
              📱 {coupon.claim_network?.toUpperCase()} · {normalisePhone(coupon.claim_phone)}
            </span>
          )}
        </div>

        {isAvailable && (
          <button
            className="cp-airtime-claim-btn"
            onClick={() => onClaim(coupon)}
            disabled={claiming === coupon.code}
          >
            <IconSend />
            {claiming === coupon.code ? "Submitting…" : "Claim Airtime"}
          </button>
        )}

        {isPending && (
          <div className="cp-airtime-pending">
            <IconClock />
            <span>Pending — admin will process within 24 hours</span>
          </div>
        )}

        {isCompleted && (
          <div className="cp-airtime-credited">
            <IconCheckCircle />
            <span>Airtime has been sent to your number</span>
          </div>
        )}

        {isFailed && (
          <div className="cp-airtime-failed">
            <IconAlertCircle />
            <span>{coupon.admin_note || "Claim failed. Please contact support."}</span>
          </div>
        )}
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
          aria-label={`Copy code ${coupon.code}`}
        >
          {isCopied ? <IconCheck /> : <IconCopy />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DISCOUNT CARD
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
          <div className="cp-discount-badge"
               style={{ background: cfg.bg, color: cfg.color }}>
            <span className="cp-discount-icon"><CouponIcon type={coupon.type} /></span>
            <span className="cp-discount-text">{discountText}</span>
          </div>
          <span className="cp-status" style={{ color: statusColor }}>{statusText}</span>
        </div>
        {coupon.description && <p className="cp-desc">{coupon.description}</p>}
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
              <IconClock />{fmtDate(coupon.expires_at)}
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
          aria-label={`Copy code ${coupon.code}`}
        >
          {isCopied ? <IconCheck /> : <IconCopy />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SMART CARD
═══════════════════════════════════════════════════════════════ */
function SmartCard({ coupon, onCopy, copied, onClaim, claiming }) {
  if (isAirtimeCoupon(coupon)) {
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
  return <CouponCard coupon={coupon} onCopy={onCopy} copied={copied} />;
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE PANEL
═══════════════════════════════════════════════════════════════ */
function ValidatePanel() {
  const [code,    setCode]    = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const validate = async () => {
    if (!code.trim()) { setError("Enter a coupon code."); return; }
    setLoading(true); setError(null); setResult(null);
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
      if (!res.ok || !data.success) setError(data.message || "Invalid coupon.");
      else setResult(data);
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
          <p className="cp-validate-sub">Enter your code below to check validity</p>
        </div>
      </div>
      <div className="cp-validate-inputs">
        <input
          className="cp-validate-input"
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setResult(null); }}
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
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)).toString())}
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
          <IconAlertCircle /><span>{error}</span>
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
   AIRTIME BANNER
═══════════════════════════════════════════════════════════════ */
function AirtimeBanner({ emailVerified, userEmail }) {
  return (
    <div className="cp-airtime-banner">
      <span className="cp-airtime-banner-icon">📱</span>
      <div style={{ flex: 1 }}>
        <p className="cp-airtime-banner-title">How airtime credits work</p>
        <p className="cp-airtime-banner-sub">
          {emailVerified ? (
            <>
              Your email <strong>{userEmail}</strong> is verified.
              Tap <strong>Claim Airtime</strong>, confirm your phone,
              and we'll credit you within 24 hours.
            </>
          ) : (
            <>
              Tap <strong>Claim Airtime</strong> on any coupon.
              You'll be asked to verify your email{" "}
              <strong>{userEmail}</strong> first.
            </>
          )}
        </p>
        {emailVerified && (
          <span className="cp-airtime-banner-badge">
            <IconCheckCircle /> Email verified
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
export default function Coupons() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const urlTab     = searchParams.get("tab");
  const VALID_TABS = ["available", "airtime", "used", "history"];
  const initialTab = VALID_TABS.includes(urlTab) ? urlTab : "available";

  /* ── State ── */
  const [coupons,      setCoupons]      = useState([]);
  const [history,      setHistory]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [tab,          setTab]          = useState(initialTab);
  const [copied,       setCopied]       = useState(null);
  const [toast,        setToast]        = useState(null);
  const [claiming,     setClaiming]     = useState(null);

  /* ── Profile ── */
  const [me,           setMe]           = useState(null);
  const [emailVerified,setEmailVerified]= useState(false);
  const [profileReady, setProfileReady] = useState(false);

  /* ── Modals ── */
  const [verifyModal, setVerifyModal] = useState({
    open         : false,
    pendingCoupon: null,
  });
  const [claimModal, setClaimModal] = useState({
    open          : false,
    coupon        : null,
    prefilledPhone: "",
  });

  /* ── Refs ── */
  const toastTimer  = useRef(null);
  const copiedTimer = useRef(null);
  const mounted     = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(toastTimer.current);
      clearTimeout(copiedTimer.current);
    };
  }, []);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/coupons");
  }, [navigate]);

  /* ── Toast ── */
  const showToast = useCallback((msg, isError = false) => {
    if (!mounted.current) return;
    setToast({ msg, isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (mounted.current) setToast(null);
    }, 3_500);
  }, []);

  /* ════════════════════════════════════════════════════════
     LOAD PROFILE
  ════════════════════════════════════════════════════════ */
  const loadProfile = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await fetch(`${API}/users/me`, { headers: authH() });

      if (!res.ok) {
        console.warn("[profile] /users/me returned", res.status);
        return;
      }

      const body = await res.json();
      const user = body?.user ?? body;
      if (!user || !mounted.current) return;

      setMe(user);

      const verified =
        user.email_verified  === true ||
        user.emailVerified   === true ||
        user.is_verified     === true ||
        user.isVerified      === true ||
        user.verified        === true ||
        String(user.email_verified) === "true";

      setEmailVerified(verified);

    } catch (err) {
      console.error("[profile] error:", err.message);
    } finally {
      if (mounted.current) setProfileReady(true);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  /* ════════════════════════════════════════════════════════
     LOAD COUPONS + AIRTIME COUPONS
     We merge both endpoints into a single list.
  ════════════════════════════════════════════════════════ */
  const loadCoupons = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      const [cr, hr, ar] = await Promise.all([
        fetch(`${API}/coupons`,           { headers: authH() }),
        fetch(`${API}/coupons/history`,   { headers: authH() }),
        fetch(`${API}/airtime-coupons`,   { headers: authH() }),
      ]);

      if (!cr.ok) throw new Error("Failed to load coupons");
      if (!hr.ok) throw new Error("Failed to load history");

      const cd = await cr.json();
      const hd = await hr.json();
      const ad = ar.ok ? await ar.json() : { coupons: [] };

      /* Normalise airtime coupons so they use the same shape as discount coupons */
      const airtimeAsCoupons = (ad.coupons || []).map((a) => ({
        id           : a.id,
        code         : a.code,
        type         : "airtime",
        coupon_kind  : "airtime",
        amount       : a.amount,
        value        : a.amount,
        status       : a.status,               // "available" | "pending" | ...
        is_used      : a.status !== "available",
        usable       : a.status === "available",
        claim_phone  : a.phone,
        claim_network: a.network,
        claimed_at   : a.redeemed_at,
        created_at   : a.created_at,
        description  : `🎡 Spin & Win — ₦${a.amount} Airtime`,
      }));

      /* Dedupe by code — prefer the airtime coupon shape if same code appears */
      const baseCoupons = cd.coupons || [];
      const existingCodes = new Set(airtimeAsCoupons.map((c) => c.code));
      const merged = [
        ...airtimeAsCoupons,
        ...baseCoupons.filter((c) => !existingCodes.has(c.code)),
      ];

      if (mounted.current) {
        setCoupons(merged);
        setHistory(hd.history || []);
      }
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  const refreshAll = useCallback(() =>
    Promise.all([loadCoupons(), loadProfile()])
  , [loadCoupons, loadProfile]);

  /* ════════════════════════════════════════════════════════
     PREFILL PHONE
  ════════════════════════════════════════════════════════ */
  const getPrefilledPhone = useCallback(() => {
    if (!me) return "";
    const raw =
      me.best_phone   ||
      me.phone        ||
      me.phone_number ||
      me.phoneNumber  ||
      me.mobile       ||
      "";
    return normalisePhone(raw);
  }, [me]);

  /* ════════════════════════════════════════════════════════
     MODAL HANDLERS
  ════════════════════════════════════════════════════════ */
  const openClaimModal = useCallback((coupon) => {
    setClaimModal({
      open          : true,
      coupon,
      prefilledPhone: getPrefilledPhone(),
    });
  }, [getPrefilledPhone]);

  const handleClaim = useCallback((coupon) => {
    if (!profileReady) {
      showToast("⏳ Loading your profile…");
      return;
    }
    if (emailVerified) {
      openClaimModal(coupon);
    } else {
      setVerifyModal({ open: true, pendingCoupon: coupon });
    }
  }, [profileReady, emailVerified, openClaimModal, showToast]);

  const handleVerifySuccess = useCallback(() => {
    setEmailVerified(true);
    const pending = verifyModal.pendingCoupon;
    setVerifyModal({ open: false, pendingCoupon: null });
    showToast("✅ Email verified!");
    if (pending) {
      setTimeout(() => {
        if (mounted.current) openClaimModal(pending);
      }, 350);
    }
  }, [verifyModal.pendingCoupon, openClaimModal, showToast]);

  const handleClaimSuccess = useCallback((code, data) => {
    setCoupons((prev) =>
      prev.map((c) =>
        c.code === code
          ? {
              ...c,
              status       : data.coupon?.status  || "pending",
              is_used      : true,
              usable       : false,
              claimed_at   : new Date().toISOString(),
              claim_phone  : data.coupon?.phone   ?? c.claim_phone,
              claim_network: data.coupon?.network ?? c.claim_network,
            }
          : c
      )
    );

    showToast("✅ Claim submitted! Airtime credited within 24 hours.");

    setTimeout(() => {
      if (mounted.current) {
        setClaimModal({ open: false, coupon: null, prefilledPhone: "" });
      }
    }, 2_000);
  }, [showToast]);

  /* ── Copy ── */
  const handleCopy = useCallback((code) => {
    const write = () => {
      const el = document.createElement("textarea");
      el.value = code;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    };
    navigator.clipboard
      ? navigator.clipboard.writeText(code).catch(write)
      : write();

    setCopied(code);
    showToast(`Code "${code}" copied!`);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => {
      if (mounted.current) setCopied(null);
    }, 2_500);
  }, [showToast]);

  /* ════════════════════════════════════════════════════════
     DERIVED LISTS
  ════════════════════════════════════════════════════════ */
  const airtimeCoupons   = coupons.filter(isAirtimeCoupon);
  const airtimeAvailable = airtimeCoupons.filter(isAirtimeAvailable);

  /* Available tab — discount coupons + unclaimed airtime */
  const allAvailable = coupons.filter(
    (c) => isDiscountAvailable(c) || isAirtimeAvailable(c)
  );

  /* Used tab — used discounts + claimed airtime */
  const allUsed = coupons.filter((c) => {
    if (isAirtimeCoupon(c)) {
      return c.status !== "available";
    }
    return !c.usable;
  });

  /* Sort — airtime first, newest first */
  const sortByAirtimeFirst = (a, b) => {
    const aAir = isAirtimeCoupon(a) ? 0 : 1;
    const bAir = isAirtimeCoupon(b) ? 0 : 1;
    if (aAir !== bAir) return aAir - bAir;
    return new Date(b.created_at) - new Date(a.created_at);
  };

  const allAvailableSorted = [...allAvailable].sort(sortByAirtimeFirst);
  const allUsedSorted      = [...allUsed].sort(sortByAirtimeFirst);
  const airtimeSorted      = [...airtimeCoupons].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const totalSaved = history.reduce((s, h) => s + Number(h.discount || 0), 0);
  const hasAirtime = airtimeCoupons.length > 0;

  const TABS = [
    { key: "available", label: "Available",  count: allAvailable.length  },
    { key: "airtime",   label: "📱 Airtime",  count: airtimeCoupons.length,
      hide: !hasAirtime && !loading },
    { key: "used",      label: "Used",        count: allUsed.length       },
    { key: "history",   label: "History",     count: history.length       },
  ].filter((t) => !t.hide);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="cp-page">

      {/* Topbar */}
      <div className="cp-topbar">
        <button className="cp-back" onClick={() => navigate(-1)} aria-label="Go back">
          <IconBack />
        </button>
        <div className="cp-topbar-text">
          <h1 className="cp-topbar-title">My Coupons</h1>
          <p className="cp-topbar-sub">
            {allAvailable.length} available
            {airtimeAvailable.length > 0
              ? ` · ${airtimeAvailable.length} airtime`
              : ""}
          </p>
        </div>
        <button
          className="cp-refresh"
          onClick={refreshAll}
          disabled={loading}
          aria-label="Refresh"
        >
          <IconRefresh />
        </button>
      </div>

      <div className="cp-scroll">

        {/* Savings banner */}
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

        <ValidatePanel />

        {error && (
          <div className="cp-error" role="alert">
            <span className="cp-error-icon"><IconAlertCircle /></span>
            <p>{error}</p>
            <button onClick={loadCoupons}>Retry</button>
          </div>
        )}

        {/* Tabs */}
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

        {/* Loading skeleton */}
        {loading && (
          <div className="cp-sk-list" aria-label="Loading">
            {[1, 2, 3].map((i) => <div key={i} className="cp-sk" />)}
          </div>
        )}

        {/* ── AVAILABLE (includes unclaimed airtime + discount) ── */}
        {!loading && tab === "available" && (
          allAvailableSorted.length === 0 ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><IconTag /></span>
              <p>No coupons available right now</p>
              <small>Check back soon!</small>
            </div>
          ) : (
            <div className="cp-list">
              {allAvailableSorted.map((c) => (
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

        {/* ── AIRTIME (all airtime — available + claimed) ── */}
        {!loading && tab === "airtime" && (
          <>
            <AirtimeBanner
              emailVerified={emailVerified}
              userEmail={me?.email}
            />

            {profileReady && !emailVerified && (
              <div className="cp-verify-nudge">
                <IconMail />
                <div>
                  <p className="cp-verify-nudge-title">Email verification required</p>
                  <p className="cp-verify-nudge-sub">
                    Tap "Claim Airtime" on any coupon to verify your email
                    and submit your claim.
                  </p>
                </div>
              </div>
            )}

            {airtimeSorted.length === 0 ? (
              <div className="cp-empty">
                <span className="cp-empty-icon">📱</span>
                <p>No airtime coupons yet</p>
                <small>Spin the wheel to win airtime!</small>
              </div>
            ) : (
              <div className="cp-list">
                {airtimeSorted.map((c) => (
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

        {/* ── USED (used discounts + claimed airtime) ── */}
        {!loading && tab === "used" && (
          allUsedSorted.length === 0 ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><IconCheckCircle /></span>
              <p>No used or expired coupons</p>
            </div>
          ) : (
            <div className="cp-list">
              {allUsedSorted.map((c) => (
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

        {/* ── HISTORY ── */}
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
                    <div className="cp-history-icon"
                         style={{ background: cfg.bg, color: cfg.color }}>
                      <CouponIcon type={h.type} />
                    </div>
                    <div className="cp-history-info">
                      <p className="cp-history-code">{h.code}</p>
                      <p className="cp-history-desc">
                        {h.description || "Coupon applied"}
                      </p>
                      {h.coupon_kind === "airtime" && h.claim_phone && (
                        <p className="cp-history-phone">
                          📱 {h.claim_network?.toUpperCase()} ·{" "}
                          {normalisePhone(h.claim_phone)}
                        </p>
                      )}
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

        {/* Tips */}
        {!loading && (
          <div className="cp-tips">
            <div className="cp-tips-header">
              <IconInfo />
              <h3 className="cp-tips-title">How to use coupons</h3>
            </div>
            {[
              { icon: <IconCopy />,        t: "Copy the coupon code by tapping 'Copy'" },
              { icon: <IconTag />,         t: "Paste the code at checkout to get your discount" },
              { icon: <IconCheckCircle />, t: "Discount is applied automatically"       },
              { icon: <IconMail />,        t: "For airtime, verify your email then confirm your phone" },
              { icon: <IconAlertCircle />, t: "Each coupon can only be used once"       },
            ].map((tip, i) => (
              <div key={i} className="cp-tip">
                <span className="cp-tip-icon">{tip.icon}</span>
                <p>{tip.t}</p>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ════ MODALS ════ */}

      <VerificationModal
        isOpen={verifyModal.open}
        userEmail={me?.email}
        onClose={() => setVerifyModal({ open: false, pendingCoupon: null })}
        onSuccess={handleVerifySuccess}
      />

      <AirtimeClaimModal
        isOpen={claimModal.open}
        coupon={claimModal.coupon}
        prefilledPhone={claimModal.prefilledPhone}
        onClose={() => setClaimModal({ open: false, coupon: null, prefilledPhone: "" })}
        onSuccess={handleClaimSuccess}
      />

      {/* Toast */}
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