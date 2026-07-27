// src/pages/Profile/components/AirtimeClaimModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/AirtimeClaimModal.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;
const IS_DEV   = import.meta.env.DEV;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

/* ── Phone helpers ── */
const normalise = (raw) => {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.startsWith("234")) return "0" + d.slice(3);
  if (d.startsWith("0"))   return d;
  if (d.length === 10)     return "0" + d;
  return d;
};

const format = (val) => {
  const d = String(val || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0,4)} ${d.slice(4)}`;
  return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`;
};

const mask = (val) => {
  const d = String(val || "").replace(/\D/g, "");
  if (d.length < 7) return format(d);
  return `${d.slice(0,4)} *** ${d.slice(-3)}`;
};

const isValid = (num) => {
  const d = normalise(num);
  return d.length === 11 && /^0[789][01]\d{8}$/.test(d);
};

const detectNetwork = (num) => {
  const d = normalise(num);
  const p = d.slice(0, 4);
  const map = {
    "0703":"MTN","0704":"MTN","0706":"MTN",
    "0803":"MTN","0806":"MTN","0810":"MTN",
    "0813":"MTN","0814":"MTN","0816":"MTN",
    "0903":"MTN","0906":"MTN","0913":"MTN","0916":"MTN",
    "0701":"Airtel","0708":"Airtel","0802":"Airtel",
    "0808":"Airtel","0812":"Airtel","0901":"Airtel",
    "0902":"Airtel","0904":"Airtel","0907":"Airtel","0912":"Airtel",
    "0705":"Glo","0805":"Glo","0807":"Glo",
    "0811":"Glo","0815":"Glo","0905":"Glo","0915":"Glo",
    "0809":"9mobile","0817":"9mobile","0818":"9mobile",
    "0908":"9mobile","0909":"9mobile",
  };
  return map[p] || null;
};

const NETWORK_COLOR = {
  MTN    : "#fbbf24",
  Airtel : "#dc2626",
  Glo    : "#16a34a",
  "9mobile": "#0891b2",
};

/* ── API call ── */
async function api(path, body) {
  const res  = await fetch(`${API}${path}`, {
    method : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization : `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Error ${res.status}`);
  }
  return data;
}

/* ── OTP boxes ── */
function OtpInput({ value, onChange, disabled }) {
  const refs   = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleChange = (e, i) => {
    const v = e.target.value.replace(/\D/g, "");
    if (!v) return;
    const next = [...digits];
    next[i] = v.slice(-1);
    onChange(next.join(""));
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (e, i) => {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        onChange(next.join(""));
      } else if (i > 0) {
        next[i - 1] = "";
        onChange(next.join(""));
        refs.current[i - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft"  && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text")
      .replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="acm-otp-boxes">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`acm-otp-box${d ? " acm-otp-box--filled" : ""}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN MODAL
   Step 1 — Enter phone
   Step 2 — Enter OTP
   Step 3 — Done
══════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  onClose,
  onSuccess,
  prefilledPhone = "",
}) {
  const [step,        setStep]        = useState(1);
  const [phone,       setPhone]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [countdown,   setCountdown]   = useState(0);
  const [devOtp,      setDevOtp]      = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Reset on open */
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setPhone(normalise(prefilledPhone));
    setOtp("");
    setError("");
    setCountdown(0);
    setDevOtp(null);
    setLoading(false);
  }, [isOpen, prefilledPhone]);

  /* Countdown */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => {
      if (mountedRef.current) setCountdown((c) => c - 1);
    }, 1_000);
    return () => clearTimeout(t);
  }, [countdown]);

  /* Auto-submit when all 6 digits entered */
  useEffect(() => {
    if (otp.length === 6 && step === 2 && !loading) {
      verify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  /* ESC to close */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === "Escape" && !loading) onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isOpen, loading, onClose]);

  /* Backdrop */
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  const phoneRaw = normalise(phone);
  const network  = detectNetwork(phoneRaw);
  const netColor = NETWORK_COLOR[network] || "#6b7280";

  /* ── Step 1: Send OTP ── */
  const sendOtp = useCallback(async () => {
    if (!isValid(phone)) {
      setError("Enter a valid 11-digit Nigerian number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api("/airtime-coupons/send-otp", {
        phone: phoneRaw,
      });

      if (IS_DEV && data.dev_otp) setDevOtp(data.dev_otp);
      setCountdown(data.resend_after || 60);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [phone, phoneRaw]);

  /* ── Step 2: Verify OTP ── */
  const verify = useCallback(async () => {
    if (otp.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api("/airtime-coupons/verify-otp", {
        phone: phoneRaw,
        otp,
      });

      /* Now redeem the coupon */
      await api("/airtime-coupons/redeem", {
        code: coupon?.code,
      });

      setStep(3);
      onSuccess?.(coupon?.code, { phone: phoneRaw, network });

    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        /* Clear OTP on wrong code so user can re-enter */
        if (
          err.message.toLowerCase().includes("wrong") ||
          err.message.toLowerCase().includes("incorrect") ||
          err.message.toLowerCase().includes("invalid")
        ) {
          setOtp("");
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [otp, phoneRaw, network, coupon?.code, onSuccess]);

  const resend = useCallback(async () => {
    setOtp("");
    setError("");
    setDevOtp(null);
    await sendOtp();
  }, [sendOtp]);

  if (!isOpen) return null;

  return (
    <div className="acm-backdrop" onClick={handleBackdrop}>
      <div className="acm-modal" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="acm-header">
          <div className="acm-header-left">
            <div className="acm-header-icon">📱</div>
            <div>
              <h2 className="acm-title">Claim Airtime</h2>
              <p className="acm-subtitle">
                ₦{coupon?.value} · {coupon?.code}
              </p>
            </div>
          </div>
          <button
            className="acm-close"
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="acm-steps">
          {["Phone", "Verify", "Done"].map((label, i) => {
            const num      = i + 1;
            const isActive = step === num;
            const isDone   = step > num;
            return (
              <div key={label} className="acm-step-item">
                <div className={[
                  "acm-step-circle",
                  isDone   ? "acm-step-circle--done"   : "",
                  isActive ? "acm-step-circle--active" : "",
                ].filter(Boolean).join(" ")}>
                  {isDone ? "✓" : num}
                </div>
                <span className={[
                  "acm-step-label",
                  isActive ? "acm-step-label--active" : "",
                ].filter(Boolean).join(" ")}>
                  {label}
                </span>
                {i < 2 && (
                  <div className={[
                    "acm-step-line",
                    isDone ? "acm-step-line--done" : "",
                  ].filter(Boolean).join(" ")} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Phone input ── */}
        {step === 1 && (
          <div className="acm-body">
            <p className="acm-instruction">
              Enter the phone number to receive airtime.
            </p>

            <div className="acm-field">
              <label className="acm-label">Phone Number</label>
              <div className="acm-phone-row">
                <span className="acm-prefix">🇳🇬 +234</span>
                <input
                  className="acm-phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="0812 345 6789"
                  value={format(phoneRaw)}
                  autoFocus
                  autoComplete="tel-national"
                  maxLength={14}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isValid(phone)) sendOtp();
                  }}
                />
                {phone && (
                  <button
                    className="acm-phone-clear"
                    type="button"
                    onClick={() => { setPhone(""); setError(""); }}
                  >✕</button>
                )}
              </div>

              {/* Network badge */}
              {network && (
                <p className="acm-phone-hint">
                  <span
                    className="acm-network-tag"
                    style={{ background: netColor }}
                  >
                    {network}
                  </span>
                  +234 {format(phoneRaw).slice(1)}
                </p>
              )}
            </div>

            {error && (
              <div className="acm-error-simple" role="alert">
                ⚠️ {error}
              </div>
            )}

            <button
              className="acm-primary-btn"
              type="button"
              onClick={sendOtp}
              disabled={loading || !isValid(phone)}
            >
              {loading
                ? <><span className="acm-spinner" /> Sending…</>
                : "Send Verification Code →"
              }
            </button>
          </div>
        )}

        {/* ── Step 2: OTP input ── */}
        {step === 2 && (
          <div className="acm-body">
            <div className="acm-otp-sent">
              <p className="acm-instruction">
                Enter the 6-digit code sent to
              </p>
              <p className="acm-phone-display">
                <span
                  className="acm-network-tag"
                  style={{ background: netColor }}
                >
                  {network}
                </span>
                {mask(phoneRaw)}
              </p>
            </div>

            {/* Dev OTP — only in development */}
            {IS_DEV && devOtp && (
              <div className="acm-dev-otp">
                🔧 Dev OTP: <strong>{devOtp}</strong>
              </div>
            )}

            <div className="acm-field">
              <label className="acm-label">Verification Code</label>
              <OtpInput
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  setError("");
                }}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="acm-error-simple" role="alert">
                ⚠️ {error}
              </div>
            )}

            {/* Resend */}
            <div className="acm-resend">
              {countdown > 0 ? (
                <p className="acm-resend-timer">
                  Resend in <strong>{countdown}s</strong>
                </p>
              ) : (
                <button
                  className="acm-resend-btn"
                  type="button"
                  onClick={resend}
                  disabled={loading}
                >
                  Resend Code
                </button>
              )}
            </div>

            <button
              className="acm-primary-btn"
              type="button"
              onClick={verify}
              disabled={loading || otp.length < 6}
            >
              {loading
                ? <><span className="acm-spinner" /> Verifying…</>
                : "Verify & Claim ✓"
              }
            </button>

            <button
              className="acm-ghost-btn"
              type="button"
              onClick={() => {
                setStep(1);
                setOtp("");
                setError("");
              }}
              disabled={loading}
            >
              ← Change Number
            </button>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <div className="acm-body acm-body--success">
            <div className="acm-success-animation">
              <div className="acm-success-circle">
                <span className="acm-success-check">✓</span>
              </div>
            </div>

            <h3 className="acm-success-title">Claim Submitted!</h3>
            <p className="acm-success-msg">
              ₦{coupon?.value} airtime will be sent to
            </p>
            <p className="acm-success-phone">
              <span
                className="acm-network-tag"
                style={{ background: netColor }}
              >
                {network}
              </span>
              {format(phoneRaw)}
            </p>
            <p className="acm-success-note">
              Processing within <strong>24 hours</strong>
            </p>

            <button
              className="acm-primary-btn"
              type="button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}