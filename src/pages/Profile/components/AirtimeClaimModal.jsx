// src/pages/Profile/components/AirtimeClaimModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/AirtimeClaimModal.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   NIGERIAN NETWORKS
═══════════════════════════════════════════════════════════════ */
const NETWORKS = [
  { value: "mtn",     label: "MTN",     color: "#fbbf24" },
  { value: "airtel",  label: "Airtel",  color: "#dc2626" },
  { value: "glo",     label: "Glo",     color: "#16a34a" },
  { value: "9mobile", label: "9Mobile", color: "#0891b2" },
];

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */

/* Detect network from Nigerian phone prefix */
const detectNetwork = (num) => {
  if (!num) return null;
  const n      = String(num).replace(/\D/g, "");
  const prefix = n.startsWith("0") ? n.slice(1, 4) : n.slice(3, 6);

  const mtn     = ["803","806","703","706","813","816","810","814","903","906","913","704"];
  const airtel  = ["802","808","701","708","812","902","907","901","912"];
  const glo     = ["805","807","705","815","811","905","915"];
  const mobile9 = ["809","818","817","908","909"];

  if (mtn.includes(prefix))     return "mtn";
  if (airtel.includes(prefix))  return "airtel";
  if (glo.includes(prefix))     return "glo";
  if (mobile9.includes(prefix)) return "9mobile";
  return null;
};

/* Normalise anything → 08012345678 */
const normalisePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

/* Format for display: 0812 345 6789 */
const formatPhone = (val) => {
  if (!val) return "";
  const d = String(val).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
};

/* Mask for display: 0812 *** 678 */
const maskPhone = (val) => {
  const d = String(val).replace(/\D/g, "");
  if (d.length < 7) return formatPhone(d);
  return `${d.slice(0, 4)} *** ${d.slice(-3)}`;
};

/* Validate Nigerian phone */
const isValidNgPhone = (num) => {
  const d = normalisePhone(num);
  return d.length === 11 && /^0[789][01]\d{8}$/.test(d);
};

/* ═══════════════════════════════════════════════════════════════
   STEP INDICATOR
   Steps: 1=Phone  2=Confirm  3=Verify  4=Done
═══════════════════════════════════════════════════════════════ */
function StepIndicator({ step }) {
  const steps = ["Phone", "Confirm", "Verify", "Done"];
  return (
    <div className="acm-steps">
      {steps.map((label, i) => {
        const num      = i + 1;
        const isActive = step === num;
        const isDone   = step > num;
        return (
          <div key={label} className="acm-step-item">
            <div
              className={[
                "acm-step-circle",
                isDone   ? "acm-step-circle--done"   : "",
                isActive ? "acm-step-circle--active" : "",
              ].filter(Boolean).join(" ")}
            >
              {isDone ? "✓" : num}
            </div>
            <span
              className={`acm-step-label${isActive ? " acm-step-label--active" : ""}`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`acm-step-line${isDone ? " acm-step-line--done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OTP INPUT — 6 boxes
═══════════════════════════════════════════════════════════════ */
function OtpInput({ value, onChange, disabled }) {
  const refs   = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

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
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;
    const char = val.slice(-1);
    const next = [...digits];
    next[idx]  = char;
    onChange(next.join(""));
    if (idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
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

/* ═══════════════════════════════════════════════════════════════
   MAIN MODAL
═══════════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  onClose,
  onSuccess,
  prefilledPhone   = "",
  prefilledNetwork = "",
}) {
  /* ── State ── */
  const [step,             setStep]             = useState(1);
  const [phone,            setPhone]            = useState("");
  const [network,          setNetwork]          = useState("");
  const [otp,              setOtp]              = useState("");
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);
  const [countdown,        setCountdown]        = useState(0);
  const [sessionId,        setSessionId]        = useState(null);
  const [isPrefilledPhone, setIsPrefilledPhone] = useState(false);
  const [devOtp,           setDevOtp]           = useState(null); // dev mode only

  const timerRef       = useRef(null);
  const originalPhoneRef = useRef("");

  /* ── Countdown timer ── */
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(
      () => setCountdown((c) => c - 1),
      1_000
    );
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  /* ── Reset when modal opens ── */
  useEffect(() => {
    if (!isOpen) return;

    const clean = normalisePhone(prefilledPhone);
    originalPhoneRef.current = clean;

    setStep(1);
    setPhone(clean);
    setNetwork(prefilledNetwork || detectNetwork(clean) || "");
    setOtp("");
    setError(null);
    setCountdown(0);
    setSessionId(null);
    setDevOtp(null);
    setIsPrefilledPhone(!!clean);
  }, [isOpen, prefilledPhone, prefilledNetwork]);

  /* ── Auto-detect network as user types ── */
  useEffect(() => {
    if (prefilledNetwork) return;
    const detected = detectNetwork(phone);
    if (detected && detected !== network) {
      setNetwork(detected);
    }
  }, [phone, prefilledNetwork]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Backdrop close ── */
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  /* ── ESC to close ── */
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, loading, onClose]);

  /* ════════════════════════════════════════════════════════
     STEP 1 → 2 : local validation then confirm screen
  ════════════════════════════════════════════════════════ */
  const handleProceedToConfirm = () => {
    setError(null);

    if (!isValidNgPhone(phone)) {
      setError("Enter a valid 11-digit Nigerian number (e.g. 08012345678).");
      return;
    }
    if (!network) {
      setError("Please select your network provider.");
      return;
    }

    setStep(2);
  };

  /* ════════════════════════════════════════════════════════
     STEP 2 → 3 : "Send Code" clicked — call API
  ════════════════════════════════════════════════════════ */
  const sendOtp = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/coupons/airtime/send-otp`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          phone   : normalisePhone(phone),
          network,
          code    : coupon?.code,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSessionId(data.session_id);
        if (data.dev_otp) setDevOtp(data.dev_otp);
        setStep(3);
        setCountdown(60);
      } else {
        setError(data.message || "Failed to send OTP. Try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [phone, network, coupon?.code]);

  /* ════════════════════════════════════════════════════════
     STEP 3 : verify OTP + claim
  ════════════════════════════════════════════════════════ */
  const verifyAndClaim = useCallback(async () => {
    if (otp.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/coupons/airtime/verify-claim`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          code       : coupon?.code,
          otp,
          session_id : sessionId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStep(4);
        onSuccess?.(coupon?.code, data);
      } else {
        setError(data.message || "Invalid code. Please try again.");
        setOtp("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [otp, sessionId, coupon?.code, onSuccess]);

  /* ── Resend OTP ── */
  const resendOtp = async () => {
    setOtp("");
    setError(null);
    setSessionId(null);
    setDevOtp(null);
    await sendOtp();
  };

  /* ── Go back to step 1 ── */
  const changeNumber = () => {
    setStep(1);
    setOtp("");
    setError(null);
    setSessionId(null);
    setDevOtp(null);
    setCountdown(0);
  };

  /* ── Nothing to render ── */
  if (!isOpen) return null;

  const netCfg   = NETWORKS.find((n) => n.value === network);
  const phoneRaw = normalisePhone(phone);

  return (
    <div className="acm-backdrop" onClick={handleBackdrop}>
      <div className="acm-modal" role="dialog" aria-modal="true">

        {/* ══════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════ */}
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
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* ══════════════════════════════════════════
            STEP 1 — Enter Phone + Network
        ══════════════════════════════════════════ */}
        {step === 1 && (
          <div className="acm-body">

            <p className="acm-instruction">
              Enter the phone number where you want to receive the airtime.
            </p>

            {/* Prefilled banner */}
            {isPrefilledPhone && (
              <div className="acm-prefill-notice">
                <span className="acm-prefill-icon">📋</span>
                <div>
                  <p className="acm-prefill-title">
                    Using your registered number
                  </p>
                  <p className="acm-prefill-sub">
                    Tap to edit if you want a different number.
                  </p>
                </div>
              </div>
            )}

            {/* Phone field */}
            <div className="acm-field">
              <label className="acm-label">
                Phone Number
                {isPrefilledPhone && (
                  <span className="acm-registered-tag">Registered</span>
                )}
              </label>

              <div
                className={[
                  "acm-phone-row",
                  isPrefilledPhone ? "acm-phone-row--prefilled" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="acm-prefix">🇳🇬 +234</span>
                <input
                  className="acm-phone-input"
                  type="tel"
                  placeholder="0812 345 6789"
                  value={formatPhone(phoneRaw)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setPhone(raw);
                    setError(null);
                    if (raw !== originalPhoneRef.current) {
                      setIsPrefilledPhone(false);
                    } else {
                      setIsPrefilledPhone(true);
                    }
                  }}
                  maxLength={14}
                  autoFocus={!isPrefilledPhone}
                  inputMode="numeric"
                  autoComplete="tel-national"
                />
                {phone && (
                  <button
                    className="acm-phone-clear"
                    type="button"
                    aria-label="Clear number"
                    onClick={() => {
                      setPhone("");
                      setNetwork("");
                      setIsPrefilledPhone(false);
                      setError(null);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {phoneRaw.length >= 4 && (
                <p className="acm-phone-hint">
                  Will send to:{" "}
                  <strong>+234 {formatPhone(phoneRaw).slice(1)}</strong>
                </p>
              )}
            </div>

            {/* Network selector */}
            <div className="acm-field">
              <label className="acm-label">
                Network
                {network && (
                  <span className="acm-auto-detect">
                    {prefilledNetwork ? "✓ Saved" : "✓ Auto-detected"}
                  </span>
                )}
              </label>
              <div className="acm-networks">
                {NETWORKS.map((n) => (
                  <button
                    key={n.value}
                    type="button"
                    className={[
                      "acm-network-btn",
                      network === n.value ? "acm-network-btn--active" : "",
                    ].filter(Boolean).join(" ")}
                    style={
                      network === n.value
                        ? { borderColor: n.color, background: n.color + "18", color: n.color }
                        : {}
                    }
                    onClick={() => {
                      setNetwork(n.value);
                      setError(null);
                    }}
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
                We will send a one-time code to verify this number.
                Airtime is credited within <strong>24 hours</strong>.
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
              type="button"
              onClick={handleProceedToConfirm}
              disabled={!phoneRaw || !network}
            >
              Continue →
            </button>

          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 2 — Confirm before sending OTP
        ══════════════════════════════════════════ */}
        {step === 2 && (
          <div className="acm-body">

            <div className="acm-confirm-card">
              <div className="acm-confirm-icon">📲</div>
              <p className="acm-confirm-title">Send verification code?</p>
              <p className="acm-confirm-sub">
                We'll send a 6-digit SMS code to:
              </p>

              <div className="acm-confirm-number">
                {netCfg && (
                  <span
                    className="acm-network-tag"
                    style={{ background: netCfg.color }}
                  >
                    {netCfg.label}
                  </span>
                )}
                <span className="acm-confirm-phone">
                  {formatPhone(phoneRaw)}
                </span>
              </div>

              <div className="acm-confirm-amount">
                <span className="acm-confirm-amount-label">Claiming</span>
                <span className="acm-confirm-amount-value">
                  ₦{coupon?.value} Airtime
                </span>
              </div>
            </div>

            <div className="acm-confirm-warn">
              <span>⚠️</span>
              <p>
                Make sure this number is correct and active.
                The OTP will expire in <strong>10 minutes</strong>.
              </p>
            </div>

            {error && (
              <div className="acm-error" role="alert">⚠️ {error}</div>
            )}

            <button
              className="acm-primary-btn"
              type="button"
              onClick={sendOtp}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="acm-spinner" />
                  Sending…
                </>
              ) : (
                "📨 Send Code Now"
              )}
            </button>

            <button
              className="acm-ghost-btn"
              type="button"
              onClick={changeNumber}
              disabled={loading}
            >
              ← Change Number
            </button>

          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 3 — Enter OTP
        ══════════════════════════════════════════ */}
        {step === 3 && (
          <div className="acm-body">

            <div className="acm-otp-sent">
              <div className="acm-otp-sent-icon">💬</div>
              <p className="acm-instruction">
                Code sent! Check your SMS.
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
                {maskPhone(phoneRaw)}
              </p>
            </div>

            {/* Dev-mode OTP hint */}
            {devOtp && (
              <div className="acm-dev-otp">
                <span>🔧 Dev Mode</span>
                <p>Your OTP: <strong>{devOtp}</strong></p>
              </div>
            )}

            {/* OTP boxes */}
            <div className="acm-field">
              <label className="acm-label">Enter 6-digit code</label>
              <OtpInput
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  setError(null);
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
                  Resend in <strong>{countdown}s</strong>
                </p>
              ) : (
                <button
                  className="acm-resend-btn"
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                >
                  Resend Code
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="acm-error" role="alert">⚠️ {error}</div>
            )}

            {/* Actions */}
            <button
              className="acm-primary-btn"
              type="button"
              onClick={verifyAndClaim}
              disabled={loading || otp.length < 6}
            >
              {loading ? (
                <>
                  <span className="acm-spinner" />
                  Verifying…
                </>
              ) : (
                "Verify & Claim Airtime ✓"
              )}
            </button>

            <button
              className="acm-ghost-btn"
              type="button"
              onClick={changeNumber}
              disabled={loading}
            >
              ← Change Number
            </button>

          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 4 — Success
        ══════════════════════════════════════════ */}
        {step === 4 && (
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
              {formatPhone(phoneRaw)}
            </p>

            <div className="acm-success-timeline">
              <div className="acm-timeline-item acm-timeline-item--done">
                <span className="acm-tl-dot" />
                <p>Phone number verified ✓</p>
              </div>
              <div className="acm-timeline-item acm-timeline-item--done">
                <span className="acm-tl-dot" />
                <p>Claim submitted ✓</p>
              </div>
              <div className="acm-timeline-item acm-timeline-item--pending">
                <span className="acm-tl-dot" />
                <p>
                  Airtime credited{" "}
                  <em>(within 24 hours)</em>
                </p>
              </div>
            </div>

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