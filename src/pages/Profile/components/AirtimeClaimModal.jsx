// src/pages/Profile/components/AirtimeClaimModal.jsx

import { useState, useEffect, useRef } from "react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ── Nigerian networks ── */
const NETWORKS = [
  { value: "mtn",     label: "MTN",     color: "#fbbf24" },
  { value: "airtel",  label: "Airtel",  color: "#dc2626" },
  { value: "glo",     label: "Glo",     color: "#16a34a" },
  { value: "9mobile", label: "9Mobile", color: "#16a34a" },
];

/* ── Detect network from number ── */
const detectNetwork = (num) => {
  const n = num.replace(/\D/g, "");
  const prefix = n.startsWith("0") ? n.slice(1, 4) : n.slice(3, 6);
  const mtn     = ["803","806","703","706","813","816","810","814","903","906","913"];
  const airtel  = ["802","808","701","708","812","701","902","907","901"];
  const glo     = ["805","807","705","815","811","905","815"];
  const mobile9 = ["809","818","817","908","909"];
  if (mtn.includes(prefix))     return "mtn";
  if (airtel.includes(prefix))  return "airtel";
  if (glo.includes(prefix))     return "glo";
  if (mobile9.includes(prefix)) return "9mobile";
  return null;
};

/* ── Format phone for display ── */
const formatPhone = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4)  return digits;
  if (digits.length <= 7)  return `${digits.slice(0,4)} ${digits.slice(4)}`;
  return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7)}`;
};

/* ══════════════════════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════════════════════ */
function StepIndicator({ step }) {
  const steps = ["Phone", "Verify", "Done"];
  return (
    <div className="acm-steps">
      {steps.map((label, i) => {
        const num      = i + 1;
        const isActive = step === num;
        const isDone   = step > num;
        return (
          <div key={label} className="acm-step-item">
            <div
              className={`acm-step-circle ${
                isDone   ? "acm-step-circle--done"   :
                isActive ? "acm-step-circle--active" : ""
              }`}
            >
              {isDone ? "✓" : num}
            </div>
            <span
              className={`acm-step-label ${
                isActive ? "acm-step-label--active" : ""
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`acm-step-line ${isDone ? "acm-step-line--done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   OTP INPUT — 6 individual boxes
══════════════════════════════════════════════════════════ */
function OtpInput({ value, onChange, disabled }) {
  const refs    = useRef([]);
  const digits  = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKey = (e, idx) => {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (next[idx]) {
        next[idx] = "";
        onChange(next.join(""));
      } else if (idx > 0) {
        next[idx - 1] = "";
        onChange(next.join(""));
        refs.current[idx - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft"  && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleChange = (e, idx) => {
    const val  = e.target.value.replace(/\D/g, "");
    if (!val) return;
    const char = val.slice(-1);
    const next = [...digits];
    next[idx]  = char;
    onChange(next.join(""));
    if (idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="acm-otp-boxes">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`acm-otp-box ${d ? "acm-otp-box--filled" : ""}`}
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

/* ══════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  onClose,
  onSuccess,
  prefilledPhone = "",
  prefilledNetwork = "",
}) {
  const [step,       setStep]       = useState(1); // 1=phone, 2=otp, 3=done
  const [phone,      setPhone]      = useState(prefilledPhone);
  const [network,    setNetwork]    = useState(prefilledNetwork);
  const [otp,        setOtp]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [countdown,  setCountdown]  = useState(0);
  const [sessionId,  setSessionId]  = useState(null);
  const timerRef = useRef(null);

  /* ── Countdown timer ── */
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1_000);
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  /* ── Reset when modal opens ── */
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPhone(prefilledPhone);
      setNetwork(prefilledNetwork || "");
      setOtp("");
      setError(null);
      setCountdown(0);
    }
  }, [isOpen, prefilledPhone, prefilledNetwork]);

  /* ── Auto-detect network ── */
  useEffect(() => {
    if (!prefilledNetwork) {
      const detected = detectNetwork(phone);
      if (detected) setNetwork(detected);
    }
  }, [phone, prefilledNetwork]);

  /* ── Close on backdrop click ── */
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  /* ── Validate Nigerian number ── */
  const isValidPhone = (num) => {
    const digits = num.replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("0");
  };

  /* ────────────────────────────────────────────────────
     STEP 1 — Send OTP
  ──────────────────────────────────────────────────── */
  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!isValidPhone(digits)) {
      setError("Enter a valid 11-digit Nigerian number.");
      return;
    }
    if (!network) {
      setError("Please select your network.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API}/coupons/airtime/send-otp`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          phone  : digits,
          network,
          code   : coupon.code,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSessionId(data.session_id);
        setStep(2);
        setCountdown(60); // 60s resend timer
      } else {
        setError(data.message || "Failed to send OTP. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────────────────────────────────────
     STEP 2 — Verify OTP + Claim
  ──────────────────────────────────────────────────── */
  const verifyAndClaim = async () => {
    if (otp.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API}/coupons/airtime/verify-claim`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          code       : coupon.code,
          otp,
          session_id : sessionId,
          phone      : phone.replace(/\D/g, ""),
          network,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStep(3); // success screen
        onSuccess?.(coupon.code, data);
      } else {
        setError(data.message || "Invalid code. Please try again.");
        setOtp("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend OTP ── */
  const resendOtp = async () => {
    setOtp("");
    setError(null);
    setCountdown(60);
    await sendOtp();
  };

  if (!isOpen) return null;

  const netCfg = NETWORKS.find((n) => n.value === network);

  return (
    <div className="acm-backdrop" onClick={handleBackdrop}>
      <div className="acm-modal" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="acm-header">
          <div className="acm-header-left">
            <div className="acm-header-icon">📱</div>
            <div>
              <h2 className="acm-title">Claim Airtime</h2>
              <p className="acm-subtitle">₦{coupon?.value} · {coupon?.code}</p>
            </div>
          </div>
          <button className="acm-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* ── Step Indicator ── */}
        <StepIndicator step={step} />

        {/* ══════════════════════════════════════════
            STEP 1 — Phone Number
        ══════════════════════════════════════════ */}
        {step === 1 && (
          <div className="acm-body">
            <p className="acm-instruction">
              Enter the phone number where you want to receive the airtime.
            </p>

            {/* Phone input */}
            <div className="acm-field">
              <label className="acm-label">Phone Number</label>
              <div className="acm-phone-row">
                <span className="acm-prefix">🇳🇬 +234</span>
                <input
                  className="acm-phone-input"
                  type="tel"
                  placeholder="0812 345 6789"
                  value={formatPhone(phone)}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  maxLength={14}
                  autoFocus
                />
              </div>
            </div>

            {/* Network selector */}
            <div className="acm-field">
              <label className="acm-label">
                Network
                {network && (
                  <span className="acm-auto-detect">
                    ✓ Auto-detected
                  </span>
                )}
              </label>
              <div className="acm-networks">
                {NETWORKS.map((n) => (
                  <button
                    key={n.value}
                    className={`acm-network-btn ${
                      network === n.value ? "acm-network-btn--active" : ""
                    }`}
                    style={
                      network === n.value
                        ? { borderColor: n.color, background: n.color + "18" }
                        : {}
                    }
                    onClick={() => setNetwork(n.value)}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div className="acm-info-box">
              <span>ℹ️</span>
              <p>
                An OTP will be sent to verify this number.
                Airtime will be credited within <strong>24 hours</strong>.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="acm-error" role="alert">
                ⚠️ {error}
              </div>
            )}

            {/* Action */}
            <button
              className="acm-primary-btn"
              onClick={sendOtp}
              disabled={loading || !phone || !network}
            >
              {loading ? (
                <span className="acm-spinner" />
              ) : (
                "Send Verification Code →"
              )}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 2 — OTP Verification
        ══════════════════════════════════════════ */}
        {step === 2 && (
          <div className="acm-body">
            <div className="acm-otp-sent">
              <div className="acm-otp-sent-icon">💬</div>
              <p className="acm-instruction">
                We sent a 6-digit code to
              </p>
              <p className="acm-phone-display">
                {netCfg && (
                  <span
                    className="acm-network-tag"
                    style={{ background: netCfg.color }}
                  >
                    {netCfg.label}
                  </span>
                )}
                {formatPhone(phone)}
              </p>
            </div>

            {/* OTP Boxes */}
            <div className="acm-field">
              <label className="acm-label">Enter 6-digit code</label>
              <OtpInput
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  setError(null);
                  // Auto-submit when all 6 digits entered
                  if (val.length === 6) {
                    setTimeout(() => verifyAndClaim(), 300);
                  }
                }}
                disabled={loading}
              />
            </div>

            {/* Resend */}
            <div className="acm-resend">
              {countdown > 0 ? (
                <p className="acm-resend-timer">
                  Resend code in <strong>{countdown}s</strong>
                </p>
              ) : (
                <button
                  className="acm-resend-btn"
                  onClick={resendOtp}
                  disabled={loading}
                >
                  Resend Code
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="acm-error" role="alert">
                ⚠️ {error}
              </div>
            )}

            {/* Actions */}
            <button
              className="acm-primary-btn"
              onClick={verifyAndClaim}
              disabled={loading || otp.length < 6}
            >
              {loading ? (
                <span className="acm-spinner" />
              ) : (
                "Verify & Claim Airtime ✓"
              )}
            </button>

            <button
              className="acm-ghost-btn"
              onClick={() => { setStep(1); setOtp(""); setError(null); }}
              disabled={loading}
            >
              ← Change Number
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 3 — Success
        ══════════════════════════════════════════ */}
        {step === 3 && (
          <div className="acm-body acm-body--success">
            <div className="acm-success-animation">
              <div className="acm-success-circle">
                <span className="acm-success-check">✓</span>
              </div>
            </div>

            <h3 className="acm-success-title">Claim Submitted!</h3>
            <p className="acm-success-msg">
              Your ₦{coupon?.value} airtime will be sent to
            </p>
            <p className="acm-success-phone">
              {netCfg && (
                <span
                  className="acm-network-tag"
                  style={{ background: netCfg.color }}
                >
                  {netCfg.label}
                </span>
              )}
              {formatPhone(phone)}
            </p>

            <div className="acm-success-timeline">
              <div className="acm-timeline-item acm-timeline-item--done">
                <span className="acm-tl-dot" />
                <p>Phone number verified</p>
              </div>
              <div className="acm-timeline-item acm-timeline-item--done">
                <span className="acm-tl-dot" />
                <p>Claim submitted</p>
              </div>
              <div className="acm-timeline-item acm-timeline-item--pending">
                <span className="acm-tl-dot" />
                <p>Airtime credited <em>(within 24 hours)</em></p>
              </div>
            </div>

            <button className="acm-primary-btn" onClick={onClose}>
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}