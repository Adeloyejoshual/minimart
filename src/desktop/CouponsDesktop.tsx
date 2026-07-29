// src/desktop/CouponsDesktop.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const normalisePhone = (raw: string | null) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface Coupon {
  id           : string;
  code         : string;
  type         : string;
  coupon_kind  : string;
  value        : number;
  amount?      : number;
  description  : string;
  min_purchase : number;
  max_discount : number | null;
  usage_limit  : number | null;
  usage_count  : number;
  expires_at   : string | null;
  created_at   : string;
  usable       : boolean;
  is_used      : boolean;
  is_expired   : boolean;
  is_full?     : boolean;
  days_left    : number | null;
  status?      : string;
  claimed_at?  : string | null;
  claim_phone? : string | null;
  claim_network?: string | null;
  admin_note?  : string | null;
}

interface HistoryItem {
  id            : string;
  code          : string;
  type          : string;
  coupon_kind?  : string;
  description   : string;
  discount      : number;
  redeemed_at   : string;
  status?       : string;
  claim_phone?  : string | null;
  claim_network?: string | null;
}

interface SavedPhone {
  has_saved      : boolean;
  phone          : string | null;
  masked         : string | null;
  network        : string | null;
  in_cooldown    : boolean;
  days_left      : number;
  next_change_at : string | null;
}

interface ValidateResult {
  success      : boolean;
  message      : string;
  discount     : number;
  final_amount : number;
}

/* ═══════════════════════════════════════════════════════════════
   COUPON CONFIG
═══════════════════════════════════════════════════════════════ */
const COUPON_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  percentage   : { color: "#6366f1", bg: "#eef2ff", label: "% OFF"     },
  fixed        : { color: "#e8630a", bg: "#fff0e6", label: "₦ OFF"     },
  free_shipping: { color: "#16a34a", bg: "#dcfce7", label: "FREE SHIP" },
  airtime      : { color: "#0891b2", bg: "#f0f9ff", label: "AIRTIME"   },
};

/* ═══════════════════════════════════════════════════════════════
   AIRTIME STATUS MAP
═══════════════════════════════════════════════════════════════ */
const AIRTIME_STATUS: Record<string, { label: string; color: string }> = {
  available : { label: "Ready to claim",  color: "#16a34a" },
  pending   : { label: "Pending",         color: "#f59e0b" },
  claimed   : { label: "Pending",         color: "#f59e0b" },
  redeemed  : { label: "Pending",         color: "#f59e0b" },
  approved  : { label: "Processing",      color: "#2563eb" },
  processing: { label: "Processing",      color: "#2563eb" },
  sent      : { label: "Sending…",        color: "#0891b2" },
  completed : { label: "Credited ✓",      color: "#16a34a" },
  credited  : { label: "Credited ✓",      color: "#16a34a" },
  rejected  : { label: "Rejected",        color: "#dc2626" },
  failed    : { label: "Failed",          color: "#dc2626" },
  expired   : { label: "Expired",         color: "#6b7280" },
};

const PENDING_STATUSES    = ["pending", "claimed", "redeemed"];
const PROCESSING_STATUSES = ["approved", "processing", "sent"];
const COMPLETED_STATUSES  = ["completed", "credited"];
const ACTIVE_STATUSES     = [...PENDING_STATUSES, ...PROCESSING_STATUSES];

const isAirtimeCoupon    = (c: Coupon) => c.coupon_kind === "airtime" || c.type === "airtime";
const isAirtimeAvailable = (c: Coupon) => isAirtimeCoupon(c) && c.status === "available";
const isAirtimeActive    = (c: Coupon) => isAirtimeCoupon(c) && ACTIVE_STATUSES.includes(c.status || "");
const isDiscountAvailable= (c: Coupon) => !isAirtimeCoupon(c) && c.usable;

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const IconBack       = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const IconRefresh    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>;
const IconPercent    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><path d="M5 19L19 5"/></svg>;
const IconTag        = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const IconTruck      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
const IconPhone      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>;
const IconCopy       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
const IconCheck      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconSearch     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconAlertCircle= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconCheckCircle= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const IconGift       = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;
const IconClock      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconInfo       = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IconSend       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconMail       = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,4 12,13 2,4"/></svg>;

const CouponIcon = ({ type }: { type: string }) => {
  if (type === "percentage")    return <IconPercent />;
  if (type === "free_shipping") return <IconTruck />;
  if (type === "airtime")       return <IconPhone />;
  return <IconTag />;
};

/* ═══════════════════════════════════════════════════════════════
   AIRTIME CARD — Desktop version
═══════════════════════════════════════════════════════════════ */
function AirtimeCardDesktop({
  coupon,
  onCopy,
  copied,
  onClaim,
  claiming,
}: {
  coupon   : Coupon;
  onCopy   : (code: string) => void;
  copied   : string | null;
  onClaim  : (coupon: Coupon) => void;
  claiming : string | null;
}) {
  const cfg    = COUPON_CONFIG.airtime;
  const status = coupon.status ?? "available";
  const st     = AIRTIME_STATUS[status] ?? AIRTIME_STATUS.available;
  const amount = coupon.amount ?? coupon.value ?? 0;

  const isAvailable  = status === "available";
  const isPending    = PENDING_STATUSES.includes(status);
  const isProcessing = PROCESSING_STATUSES.includes(status);
  const isCompleted  = COMPLETED_STATUSES.includes(status);
  const isRejected   = status === "rejected";
  const isFailed     = status === "failed";
  const isCopied     = copied === coupon.code;

  return (
    <div className={`cpd-card cpd-card--airtime${!isAvailable ? " cpd-card--used" : ""}`}>

      <div className="cpd-accent" style={{ background: cfg.color }}>
        <div className="cpd-accent-icon"><IconPhone /></div>
        <span className="cpd-accent-label">AIRTIME</span>
      </div>

      <div className="cpd-body">
        <div className="cpd-body-top">
          <div className="cpd-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {naira(amount)} AIRTIME
          </div>
          <span className="cpd-status" style={{ color: st.color }}>
            {st.label}
          </span>
        </div>

        <p className="cpd-desc">
          {coupon.description || `🎡 Spin & Win — ${naira(amount)} Airtime`}
        </p>

        <div className="cpd-meta">
          <span className="cpd-meta-chip">Won on {fmtDate(coupon.created_at)}</span>
          {coupon.claimed_at && (
            <span className="cpd-meta-chip">Claimed {fmtDate(coupon.claimed_at)}</span>
          )}
          {coupon.claim_phone && (
            <span className="cpd-meta-chip">
              📱 {coupon.claim_network?.toUpperCase()} · {normalisePhone(coupon.claim_phone)}
            </span>
          )}
        </div>

        {/* Status-specific displays */}
        {isAvailable && (
          <button
            className="cpd-airtime-btn"
            onClick={() => onClaim(coupon)}
            disabled={claiming === coupon.code}
          >
            <IconSend />
            {claiming === coupon.code ? "Submitting…" : "Claim Airtime"}
          </button>
        )}

        {isPending && (
          <div className="cpd-airtime-status cpd-airtime-status--pending">
            <IconClock /> Pending — it will be processed shortly
          </div>
        )}

        {isProcessing && (
          <div className="cpd-airtime-status cpd-airtime-status--processing">
            <IconClock /> Processing — your airtime is being sent
          </div>
        )}

        {isCompleted && (
          <div className="cpd-airtime-status cpd-airtime-status--completed">
            <IconCheckCircle /> Airtime credited to your number ✓
          </div>
        )}

        {isRejected && (
          <div className="cpd-airtime-status cpd-airtime-status--failed">
            <IconAlertCircle /> {coupon.admin_note || "Claim was rejected. You can try again."}
          </div>
        )}

        {isFailed && (
          <div className="cpd-airtime-status cpd-airtime-status--failed">
            <IconAlertCircle /> {coupon.admin_note || "Claim failed. Contact support."}
          </div>
        )}
      </div>

      <div className="cpd-divider">
        <div className="cpd-notch cpd-notch--top" />
        <div className="cpd-dashes" />
        <div className="cpd-notch cpd-notch--bottom" />
      </div>

      <div className="cpd-code-section">
        <p className="cpd-code-label">Code</p>
        <p className="cpd-code">{coupon.code}</p>
        <button
          className={`cpd-copy${isCopied ? " cpd-copy--done" : ""}`}
          onClick={() => onCopy(coupon.code)}
          aria-label={`Copy ${coupon.code}`}
        >
          {isCopied ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy</>}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DISCOUNT CARD — Desktop
═══════════════════════════════════════════════════════════════ */
function CouponCardDesktop({
  coupon, onCopy, copied,
}: {
  coupon: Coupon; onCopy: (code: string) => void; copied: string | null;
}) {
  const cfg      = COUPON_CONFIG[coupon.type] || COUPON_CONFIG.percentage;
  const isCopied = copied === coupon.code;

  const discountText =
    coupon.type === "percentage" ? `${coupon.value}% OFF`
    : coupon.type === "fixed"   ? `${naira(coupon.value)} OFF`
    : "FREE DELIVERY";

  const statusText =
    !coupon.usable
      ? coupon.is_used    ? "Already used"
      : coupon.is_expired ? "Expired"
      : coupon.is_full    ? "Fully redeemed"
      : "Unavailable"
      : coupon.days_left === 0       ? "Expires today!"
      : (coupon.days_left ?? 99) <= 3 ? `${coupon.days_left}d left`
      : coupon.days_left != null     ? `${coupon.days_left}d left`
      : "No expiry";

  const statusColor =
    !coupon.usable               ? "#dc2626" :
    (coupon.days_left ?? 99) <= 3? "#f59e0b" :
    "#16a34a";

  return (
    <div className={`cpd-card${!coupon.usable ? " cpd-card--used" : ""}`}>
      <div className="cpd-accent" style={{ background: cfg.color }}>
        <div className="cpd-accent-icon"><CouponIcon type={coupon.type} /></div>
        <span className="cpd-accent-label">{cfg.label}</span>
      </div>

      <div className="cpd-body">
        <div className="cpd-body-top">
          <div className="cpd-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {discountText}
          </div>
          <span className="cpd-status" style={{ color: statusColor }}>{statusText}</span>
        </div>
        {coupon.description && <p className="cpd-desc">{coupon.description}</p>}
        <div className="cpd-meta">
          {coupon.min_purchase > 0 && (
            <span className="cpd-meta-chip">Min: {naira(coupon.min_purchase)}</span>
          )}
          {coupon.max_discount && (
            <span className="cpd-meta-chip">Max: {naira(coupon.max_discount)}</span>
          )}
          {coupon.usage_limit && (
            <span className="cpd-meta-chip">{coupon.usage_count}/{coupon.usage_limit} used</span>
          )}
          {coupon.expires_at && (
            <span className="cpd-meta-chip cpd-meta-chip--date">
              <IconClock /> {fmtDate(coupon.expires_at)}
            </span>
          )}
        </div>
      </div>

      <div className="cpd-divider">
        <div className="cpd-notch cpd-notch--top" />
        <div className="cpd-dashes" />
        <div className="cpd-notch cpd-notch--bottom" />
      </div>

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
   SMART CARD — routes to correct component
═══════════════════════════════════════════════════════════════ */
function SmartCardDesktop({
  coupon, onCopy, copied, onClaim, claiming,
}: {
  coupon: Coupon; onCopy: (code: string) => void; copied: string | null;
  onClaim: (c: Coupon) => void; claiming: string | null;
}) {
  if (isAirtimeCoupon(coupon)) {
    return <AirtimeCardDesktop coupon={coupon} onCopy={onCopy} copied={copied} onClaim={onClaim} claiming={claiming} />;
  }
  return <CouponCardDesktop coupon={coupon} onCopy={onCopy} copied={copied} />;
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE PANEL
═══════════════════════════════════════════════════════════════ */
function ValidatePanelDesktop() {
  const [code,    setCode]    = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ValidateResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const validate = async () => {
    if (!code.trim()) { setError("Enter a coupon code."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res  = await fetch(`${API}/coupons/validate`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ code: code.trim().toUpperCase(), order_amount: Math.max(0, Number(amount) || 0) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) setError(data.message || "Invalid coupon.");
      else setResult(data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <div className="cpd-validate">
      <div className="cpd-validate-head">
        <div className="cpd-validate-head-icon"><IconSearch /></div>
        <div>
          <h3 className="cpd-validate-title">Validate a Coupon Code</h3>
          <p className="cpd-validate-sub">Check validity and savings instantly</p>
        </div>
      </div>
      <div className="cpd-validate-row">
        <input className="cpd-validate-input" placeholder="Coupon code" value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && validate()} />
        <input className="cpd-validate-input" placeholder="Order amount (optional)" type="number" min="0"
          value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)).toString())}
          onKeyDown={(e) => e.key === "Enter" && validate()} />
        <button className="cpd-validate-btn" onClick={validate} disabled={loading || !code.trim()}>
          {loading ? "Checking…" : "Validate"}
        </button>
      </div>
      {error && <div className="cpd-validate-error"><IconAlertCircle /><span>{error}</span></div>}
      {result && (
        <div className="cpd-validate-ok">
          <span className="cpd-validate-ok-label"><IconCheckCircle /> Valid!</span>
          <span>{result.message}</span>
          <span className="cpd-validate-ok-save">
            Save {naira(result.discount)}
            {result.final_amount > 0 && ` · Final: ${naira(result.final_amount)}`}
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

  if (!history.length) return (
    <div className="cpd-empty">
      <span className="cpd-empty-icon"><IconClock /></span>
      <p>No coupon history yet</p>
      <small>Coupons you use will appear here</small>
    </div>
  );

  return (
    <div className="cpd-history-wrap">
      <div className="cpd-history-list">
        {history.map((h) => {
          const cfg = COUPON_CONFIG[h.type] || COUPON_CONFIG.percentage;
          return (
            <div key={h.id} className="cpd-history-row">
              <div className="cpd-history-icon" style={{ background: cfg.bg, color: cfg.color }}>
                <CouponIcon type={h.type} />
              </div>
              <div className="cpd-history-info">
                <span className="cpd-history-code">{h.code}</span>
                <span className="cpd-history-desc">{h.description || "Coupon applied"}</span>
                {h.coupon_kind === "airtime" && h.claim_phone && (
                  <span className="cpd-history-phone">
                    📱 {h.claim_network?.toUpperCase()} · {normalisePhone(h.claim_phone)}
                  </span>
                )}
              </div>
              <span className="cpd-history-time">{timeAgo(h.redeemed_at)}</span>
              <span className="cpd-history-save">-{naira(h.discount)}</span>
            </div>
          );
        })}
      </div>
      <div className="cpd-history-footer">
        <span>Total saved across {history.length} order{history.length !== 1 ? "s" : ""}</span>
        <span className="cpd-history-total">{naira(totalSaved)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR COMPONENTS
═══════════════════════════════════════════════════════════════ */
function StatsSidebar({ coupons, history, savedPhone }: {
  coupons: Coupon[]; history: HistoryItem[]; savedPhone: SavedPhone | null;
}) {
  const available     = coupons.filter((c) => isDiscountAvailable(c) || isAirtimeAvailable(c));
  const airtimeTotal  = coupons.filter(isAirtimeCoupon);
  const airtimeActive = coupons.filter(isAirtimeActive);
  const used          = coupons.filter((c) => !c.usable && !isAirtimeAvailable(c));
  const totalSaved    = history.reduce((s, h) => s + Number(h.discount || 0), 0);

  return (
    <div className="cpd-stats">
      <h3 className="cpd-stats-title">Summary</h3>
      <div className="cpd-stat">
        <span className="cpd-stat-label">Available</span>
        <span className="cpd-stat-val cpd-stat-val--green">{available.length}</span>
      </div>
      <div className="cpd-stat">
        <span className="cpd-stat-label">Airtime coupons</span>
        <span className="cpd-stat-val cpd-stat-val--blue">{airtimeTotal.length}</span>
      </div>
      {airtimeActive.length > 0 && (
        <div className="cpd-stat">
          <span className="cpd-stat-label">Active claims</span>
          <span className="cpd-stat-val cpd-stat-val--amber">{airtimeActive.length}</span>
        </div>
      )}
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

      {savedPhone?.has_saved && (
        <div className="cpd-saved-phone">
          <p className="cpd-saved-phone-label">📱 Default airtime number</p>
          <p className="cpd-saved-phone-number">{savedPhone.masked || savedPhone.phone}</p>
          {savedPhone.network && (
            <p className="cpd-saved-phone-net">{savedPhone.network}</p>
          )}
          {savedPhone.in_cooldown && (
            <p className="cpd-saved-phone-cool">
              🔒 Locked for {savedPhone.days_left} day{savedPhone.days_left !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TipsSidebar() {
  const tips = [
    { icon: <IconCopy />,        text: "Tap 'Copy Code' on any active coupon" },
    { icon: <IconTag />,         text: "Paste it in the checkout coupon field" },
    { icon: <IconCheckCircle />, text: "Discount is applied automatically"     },
    { icon: <IconPhone />,       text: "For airtime, verify email then claim"  },
    { icon: <IconClock />,       text: "Airtime status auto-updates every 15s" },
    { icon: <IconAlertCircle />, text: "Each coupon is single-use per account" },
  ];

  return (
    <div className="cpd-tips">
      <div className="cpd-tips-head"><IconInfo /><h3>How to use coupons</h3></div>
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
   MAIN DESKTOP COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CouponsDesktop() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const urlTab     = searchParams.get("tab");
  const VALID_TABS = ["available", "airtime", "used", "history"] as const;
  type TabKey = typeof VALID_TABS[number];
  const initialTab: TabKey = VALID_TABS.includes(urlTab as TabKey) ? (urlTab as TabKey) : "available";

  const [coupons,       setCoupons]       = useState<Coupon[]>([]);
  const [history,       setHistory]       = useState<HistoryItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [tab,           setTab]           = useState<TabKey>(initialTab);
  const [copied,        setCopied]        = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; isError?: boolean } | null>(null);
  const [claiming,      setClaiming]      = useState<string | null>(null);
  const [savedPhone,    setSavedPhone]    = useState<SavedPhone | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [profileReady,  setProfileReady]  = useState(false);
  const [me,            setMe]            = useState<any>(null);

  const toastRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted   = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(toastRef.current!); clearInterval(pollTimer.current!); };
  }, []);

  useEffect(() => { if (!getToken()) navigate("/auth?redirect=/coupons"); }, [navigate]);

  const showToast = useCallback((msg: string, isError = false) => {
    setToast({ msg, isError });
    clearTimeout(toastRef.current!);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* Load profile */
  const loadProfile = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await fetch(`${API}/users/me`, { headers: authH() });
      if (!res.ok) return;
      const body = await res.json();
      const user = body?.user ?? body;
      if (!user || !mounted.current) return;
      setMe(user);
      setEmailVerified(
        user.email_verified === true || user.emailVerified === true ||
        user.is_verified === true || String(user.email_verified) === "true"
      );
    } catch {} finally { if (mounted.current) setProfileReady(true); }
  }, []);

  /* Load saved phone */
  const loadSavedPhone = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await fetch(`${API}/airtime-coupons/airtime-phone`, { headers: authH() });
      if (!res.ok) return;
      const data = await res.json();
      if (mounted.current) setSavedPhone(data.success && data.airtime?.has_saved ? data.airtime : null);
    } catch {}
  }, []);

  /* Load coupons */
  const loadCoupons = useCallback(async (opts: { silent?: boolean; fresh?: boolean } = {}) => {
    if (!getToken()) return;
    if (!opts.silent) setLoading(true);
    setError(null);
    try {
      const q = opts.fresh ? "?fresh=1" : "";
      const [cr, hr, ar] = await Promise.all([
        fetch(`${API}/coupons${q}`, { headers: authH() }),
        fetch(`${API}/coupons/history${q}`, { headers: authH() }),
        fetch(`${API}/airtime-coupons`, { headers: authH() }),
      ]);
      if (!cr.ok) throw new Error("Failed to load coupons");
      if (!hr.ok) throw new Error("Failed to load history");
      const cd = await cr.json();
      const hd = await hr.json();
      const ad = ar.ok ? await ar.json() : { coupons: [] };

      const airtimeAsCoupons = (ad.coupons || []).map((a: any) => ({
        id: a.id, code: a.code, type: "airtime", coupon_kind: "airtime",
        amount: a.amount, value: a.amount, status: a.status,
        is_used: a.status !== "available", usable: a.status === "available",
        claim_phone: a.phone, claim_network: a.network,
        claimed_at: a.redeemed_at, created_at: a.created_at,
        description: `🎡 Spin & Win — ₦${a.amount} Airtime`,
        admin_note: a.admin_note || null,
        min_purchase: 0, max_discount: null, usage_count: 0, usage_limit: 1,
        expires_at: null, is_expired: false, is_full: false, days_left: null,
      }));

      const base = cd.coupons || [];
      const codes = new Set(airtimeAsCoupons.map((c: any) => c.code));
      const merged = [...airtimeAsCoupons, ...base.filter((c: any) => !codes.has(c.code))];

      if (mounted.current) {
        setCoupons(merged);
        setHistory(hd.history || []);
      }
    } catch (err: any) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current && !opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { loadSavedPhone(); }, [loadSavedPhone]);
  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  /* Auto-refresh when active claims exist */
  useEffect(() => {
    const hasActive = coupons.some(isAirtimeActive);
    clearInterval(pollTimer.current!);
    if (!hasActive) return;
    pollTimer.current = setInterval(() => {
      if (mounted.current) loadCoupons({ silent: true, fresh: true });
    }, 15_000);
    return () => clearInterval(pollTimer.current!);
  }, [coupons, loadCoupons]);

  /* Tab visibility refresh */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && mounted.current) {
        loadCoupons({ silent: true, fresh: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadCoupons]);

  const refreshAll = useCallback(() =>
    Promise.all([loadCoupons(), loadProfile(), loadSavedPhone()])
  , [loadCoupons, loadProfile, loadSavedPhone]);

  /* Claim handler */
  const handleClaim = useCallback((coupon: Coupon) => {
    if (!profileReady) { showToast("⏳ Loading…"); return; }
    if (!emailVerified) {
      try {
        sessionStorage.setItem("pending_airtime_claim",
          JSON.stringify({ code: coupon.code, savedAt: Date.now() }));
      } catch {}
      showToast("📧 Redirecting to verify email…");
      setTimeout(() => navigate("/verification?return=" + encodeURIComponent("/coupons?tab=airtime")), 600);
      return;
    }
    /* TODO: Open AirtimeClaimModal for desktop */
    showToast("Opening claim modal…");
  }, [profileReady, emailVerified, navigate, showToast]);

  /* Copy handler */
  const handleCopy = useCallback((code: string) => {
    const fallback = () => {
      const el = document.createElement("textarea");
      el.value = code; el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    };
    navigator.clipboard ? navigator.clipboard.writeText(code).catch(fallback) : fallback();
    setCopied(code);
    showToast(`Code "${code}" copied!`);
    setTimeout(() => { if (mounted.current) setCopied(null); }, 2500);
  }, [showToast]);

  /* Derived lists */
  const airtimeCoupons   = coupons.filter(isAirtimeCoupon);
  const airtimeAvailable = airtimeCoupons.filter(isAirtimeAvailable);
  const airtimeActive    = coupons.filter(isAirtimeActive);

  const allAvailable = coupons.filter((c) => isDiscountAvailable(c) || isAirtimeAvailable(c));
  const allUsed      = coupons.filter((c) => {
    if (isAirtimeCoupon(c)) return c.status !== "available";
    return !c.usable;
  });

  const sortByAirtime = (a: Coupon, b: Coupon) => {
    const aAir = isAirtimeCoupon(a) ? 0 : 1;
    const bAir = isAirtimeCoupon(b) ? 0 : 1;
    if (aAir !== bAir) return aAir - bAir;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  };

  const hasAirtime = airtimeCoupons.length > 0;

  const TABS: { key: TabKey; label: string; count: number; hide?: boolean }[] = [
    { key: "available", label: "Available",  count: allAvailable.length },
    { key: "airtime",   label: "📱 Airtime",  count: airtimeCoupons.length, hide: !hasAirtime && !loading },
    { key: "used",      label: "Used",        count: allUsed.length },
    { key: "history",   label: "History",     count: history.length },
  ];

  const activeList =
    tab === "available" ? [...allAvailable].sort(sortByAirtime)
    : tab === "airtime" ? [...airtimeCoupons].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : tab === "used"    ? [...allUsed].sort(sortByAirtime)
    : [];

  return (
    <div className="cpd-page">

      <div className="cpd-header">
        <div className="cpd-header-left">
          <button className="cpd-back" onClick={() => navigate(-1)} aria-label="Go back">
            <IconBack />
          </button>
          <div>
            <h1 className="cpd-title">My Coupons</h1>
            <p className="cpd-subtitle">
              {allAvailable.length} available
              {airtimeAvailable.length > 0 ? ` · ${airtimeAvailable.length} airtime` : ""}
              {airtimeActive.length > 0 ? ` · ${airtimeActive.length} pending` : ""}
            </p>
          </div>
        </div>
        <button className="cpd-refresh-btn" onClick={refreshAll} disabled={loading}>
          <IconRefresh /> Refresh
        </button>
      </div>

      <ValidatePanelDesktop />

      <div className="cpd-layout">

        <div className="cpd-main">

          <div className="cpd-tabs" role="tablist">
            {TABS.filter((t) => !t.hide).map((t) => (
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

          {error && (
            <div className="cpd-error">
              <IconAlertCircle /><span>{error}</span>
              <button onClick={() => loadCoupons()}>Retry</button>
            </div>
          )}

          {loading && (
            <div className="cpd-sk-grid">
              {[1, 2, 3, 4].map((i) => <div key={i} className="cpd-sk" />)}
            </div>
          )}

          {!loading && tab !== "history" && (
            activeList.length === 0 ? (
              <div className="cpd-empty">
                <span className="cpd-empty-icon">
                  {tab === "airtime" ? "📱" : tab === "available" ? <IconTag /> : <IconCheckCircle />}
                </span>
                <p>{tab === "available" ? "No coupons available"
                   : tab === "airtime"  ? "No airtime coupons yet"
                   : "No used or expired coupons"}</p>
                {tab === "available" && <small>Check back soon!</small>}
                {tab === "airtime"  && <small>Spin the wheel to win airtime!</small>}
              </div>
            ) : (
              <div className="cpd-grid">
                {activeList.map((c) => (
                  <SmartCardDesktop
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

          {!loading && tab === "history" && <HistoryList history={history} />}
        </div>

        <aside className="cpd-sidebar">
          <StatsSidebar coupons={coupons} history={history} savedPhone={savedPhone} />
          <TipsSidebar />
        </aside>
      </div>

      {toast && (
        <div className={`cpd-toast${toast.isError ? " cpd-toast--error" : ""}`}>
          {toast.isError ? <IconAlertCircle /> : <IconCheck />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}