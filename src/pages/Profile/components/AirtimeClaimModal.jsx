// src/pages/Profile/components/AirtimeClaimModal.jsx
import { useState, useEffect, useCallback } from "react";

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

const normalisePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

const isValidPhone = (p) => /^0[789][01]\d{8}$/.test(p);

const detectNetwork = (phone) => {
  const local  = normalisePhone(phone);
  const prefix = local.slice(0, 4);
  const map = {
    "0703":"MTN","0704":"MTN","0706":"MTN","0803":"MTN","0806":"MTN",
    "0810":"MTN","0813":"MTN","0814":"MTN","0816":"MTN","0903":"MTN",
    "0906":"MTN","0913":"MTN","0916":"MTN",
    "0701":"Airtel","0708":"Airtel","0802":"Airtel","0808":"Airtel",
    "0812":"Airtel","0901":"Airtel","0902":"Airtel","0904":"Airtel",
    "0907":"Airtel","0912":"Airtel",
    "0705":"Glo","0805":"Glo","0807":"Glo","0811":"Glo",
    "0815":"Glo","0905":"Glo","0915":"Glo",
    "0809":"9mobile","0817":"9mobile","0818":"9mobile",
    "0908":"9mobile","0909":"9mobile",
  };
  return map[prefix] || null;
};

const naira = (n) => {
  const num = parseFloat(n);
  return isNaN(num) ? "₦0" : "₦" + num.toLocaleString("en-NG");
};

/* ── Icons ── */
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6"  y1="6" x2="18" y2="18"/>
  </svg>
);
const IconLoader = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
    style={{ animation: "spin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>
);
const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const NETWORK_COLORS = {
  MTN    : { bg: "#fef9c3", color: "#854d0e", emoji: "🟡" },
  Airtel : { bg: "#fee2e2", color: "#991b1b", emoji: "🔴" },
  Glo    : { bg: "#dcfce7", color: "#166534", emoji: "🟢" },
  "9mobile": { bg: "#e0f2fe", color: "#075985", emoji: "🔵" },
};

export default function AirtimeClaimModal({
  isOpen,
  coupon,
  prefilledPhone = "",
  onClose,
  onSuccess,
}) {
  const [phone,     setPhone]     = useState("");
  const [network,   setNetwork]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [submitted, setSubmitted] = useState(false);

  /* Reset when modal opens */
  useEffect(() => {
    if (isOpen) {
      const p = normalisePhone(prefilledPhone);
      setPhone(p);
      setNetwork(p ? detectNetwork(p) : null);
      setError(null);
      setLoading(false);
      setSubmitted(false);
    }
  }, [isOpen, prefilledPhone]);

  /* Live network detection as user types */
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(raw);
    setNetwork(raw.length >= 4 ? detectNetwork(raw) : null);
    setError(null);
  };

  /* ── Submit Redeem ── */
  const handleSubmit = useCallback(async () => {
    const p = normalisePhone(phone);

    if (!p || !isValidPhone(p)) {
      setError("Enter a valid 11-digit Nigerian mobile number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API}/airtime-coupons/redeem`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({
          code : coupon.code,
          phone: p,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        /* EMAIL_NOT_VERIFIED should never reach here
           (Coupons.jsx blocks it) but handle gracefully */
        if (data.code === "EMAIL_NOT_VERIFIED") {
          throw new Error(
            "Your email is not verified. Please close and try again."
          );
        }
        throw new Error(data.message || "Claim failed. Please try again.");
      }

      setSubmitted(true);

      /* Notify parent after short success display */
      setTimeout(() => {
        onSuccess?.(coupon.code, {
          phone  : p,
          network: network || detectNetwork(p),
          coupon : data.coupon,
        });
      }, 1_500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [phone, coupon, network, onSuccess]);

  if (!isOpen || !coupon) return null;

  const netStyle = network ? NETWORK_COLORS[network] : null;

  return (
    <div className="acm-overlay" role="dialog" aria-modal="true"
         aria-label="Claim airtime">

      <div className="acm-sheet">

        <button className="acm-close" onClick={onClose} aria-label="Close">
          <IconX />
        </button>

        {/* ── Success state ── */}
        {submitted ? (
          <div className="acm-success">
            <div className="acm-success-icon"><IconCheck /></div>
            <h2 className="acm-title">Claim submitted!</h2>
            <p className="acm-sub">
              {naira(coupon.value)} airtime will be sent to{" "}
              <strong>{phone}</strong> within 24 hours.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="acm-header">
              <span className="acm-emoji">📱</span>
              <h2 className="acm-title">Claim {naira(coupon.value)} Airtime</h2>
              <p className="acm-sub">
                Confirm the number to receive your airtime.
                You can edit it if needed.
              </p>
            </div>

            {/* Phone input */}
            <div className="acm-field">
              <label className="acm-label">Mobile number</label>
              <div className="acm-phone-wrap">
                <span className="acm-prefix">🇳🇬 +234</span>
                <input
                  className="acm-phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="08012345678"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={11}
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              {/* Network badge */}
              {network && netStyle && (
                <div className="acm-network-badge"
                     style={{ background: netStyle.bg, color: netStyle.color }}>
                  {netStyle.emoji} {network} detected
                </div>
              )}

              {/* Unknown number warning */}
              {phone.length >= 7 && !network && (
                <div className="acm-network-unknown">
                  ⚠️ Network not detected — double-check your number
                </div>
              )}
            </div>

            {error && <p className="acm-error">{error}</p>}

            {/* Info note */}
            <div className="acm-note">
              ℹ️ Our team processes airtime claims within 24 hours.
            </div>

            {/* Actions */}
            <button
              className="acm-btn acm-btn--primary"
              onClick={handleSubmit}
              disabled={loading || phone.length < 10}
            >
              {loading
                ? <><IconLoader /> Submitting…</>
                : `Claim ${naira(coupon.value)} Airtime`}
            </button>

            <button
              className="acm-btn acm-btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </>
        )}

      </div>
    </div>
  );
}