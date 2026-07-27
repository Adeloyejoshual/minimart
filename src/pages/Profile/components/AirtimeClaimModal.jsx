// src/pages/Profile/components/AirtimeClaimModal.jsx
import { useState, useEffect, useCallback } from "react";
import "./styles/AirtimeClaimModal.css";

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
   HELPERS
═══════════════════════════════════════════════════════════════ */
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
  const prefix = normalisePhone(phone).slice(0, 4);
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

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  prefilledPhone = "",
  onClose,
  onSuccess,
}) {
  /* ── LOG every render to confirm modal is mounted ── */
  console.log("[AirtimeClaimModal] render | isOpen:", isOpen, "coupon:", coupon?.code);

  const [phone,     setPhone]     = useState("");
  const [network,   setNetwork]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [submitted, setSubmitted] = useState(false);

  /* Reset when opened */
  useEffect(() => {
    if (isOpen) {
      console.log("[AirtimeClaimModal] OPENED with phone:", prefilledPhone);
      const p = normalisePhone(prefilledPhone);
      setPhone(p);
      setNetwork(p ? detectNetwork(p) : null);
      setError(null);
      setLoading(false);
      setSubmitted(false);
    }
  }, [isOpen, prefilledPhone]);

  /* Lock body scroll */
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(raw);
    setNetwork(raw.length >= 4 ? detectNetwork(raw) : null);
    setError(null);
  };

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
        body   : JSON.stringify({ code: coupon.code, phone: p }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Claim failed. Please try again.");
      }

      setSubmitted(true);

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

  /* ── Early return if not open ── */
  if (!isOpen) return null;
  if (!coupon) {
    console.warn("[AirtimeClaimModal] isOpen=true but coupon is null!");
    return null;
  }

  const amount = coupon.amount ?? coupon.value ?? 0;

  return (
    <div
      className="acm-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="acm-sheet">

        <button
          className="acm-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
        >
          ✕
        </button>

        {submitted ? (
          <div className="acm-success">
            <div className="acm-success-icon">✓</div>
            <h2 className="acm-title">Claim submitted!</h2>
            <p className="acm-sub">
              {naira(amount)} airtime will be sent to{" "}
              <strong>{phone}</strong> within 24 hours.
            </p>
          </div>
        ) : (
          <>
            <div className="acm-header">
              <span className="acm-emoji">📱</span>
              <h2 className="acm-title">Claim {naira(amount)} Airtime</h2>
              <p className="acm-sub">
                Confirm the number to receive your airtime.
                You can edit it if needed.
              </p>
            </div>

            <div className="acm-field">
              <label className="acm-label" htmlFor="acm-phone">
                Mobile number
              </label>
              <div className="acm-phone-wrap">
                <span className="acm-prefix">🇳🇬 +234</span>
                <input
                  id="acm-phone"
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

              {network && (
                <div className="acm-network-badge">
                  {network} detected
                </div>
              )}

              {phone.length >= 7 && !network && (
                <div className="acm-network-unknown">
                  ⚠️ Network not detected — check your number
                </div>
              )}
            </div>

            {error && <p className="acm-error">{error}</p>}

            <div className="acm-note">
              ℹ️ Our team processes claims within 24 hours.
            </div>

            <button
              className="acm-btn acm-btn--primary"
              onClick={handleSubmit}
              disabled={loading || phone.length < 10}
            >
              {loading ? "Submitting…" : `Claim ${naira(amount)} Airtime`}
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