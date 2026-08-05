// components/seller/OtpStep.jsx
import React, {
  useState, useRef, useEffect, useCallback,
} from "react";
import { STEPS } from "../../hooks/useSellerFlow";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const OTP_LENGTH     = 6;
const RESEND_SECONDS = 60;

// ─────────────────────────────────────────────────────────────
// OtpStep
// ─────────────────────────────────────────────────────────────
export default function OtpStep({ flow }) {
  const {
    pendingEmail,
    loading,
    serverMsg,
    serverErr,
    submitOtp,
    resendOtp,
    setStep,
    setServerMsg,
    setServerErr,
  } = flow;

  // ── 6 individual digit slots ───────────────────────────
  const [digits,    setDigits]    = useState(Array(OTP_LENGTH).fill(""));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);

  // ── Start countdown on mount ───────────────────────────
  useEffect(() => {
    let t = RESEND_SECONDS;
    const id = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) {
        clearInterval(id);
        setCanResend(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-focus first box on mount ─────────────────────
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ─────────────────────────────────────────────────────
  // Handle each digit box
  // ─────────────────────────────────────────────────────
  const handleChange = useCallback((e, idx) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = val;
    setDigits(next);

    // Auto-advance
    if (val && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (val && idx === OTP_LENGTH - 1) {
      const full = [...next].join("");
      if (full.length === OTP_LENGTH) {
        submitOtp(full);
      }
    }
  }, [digits, submitOtp]);

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        // Clear current
        const next = [...digits];
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        // Move back
        inputRefs.current[idx - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft"  && idx > 0)
      inputRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1)
      inputRefs.current[idx + 1]?.focus();
  }, [digits]);

  // ── Handle paste (e.g. from email copy) ──────────────
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);

    // Focus last filled or last box
    const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastIdx]?.focus();

    // Auto-submit if full
    if (pasted.length === OTP_LENGTH) {
      submitOtp(pasted);
    }
  }, [submitOtp]);

  // ── Resend ─────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (!canResend || loading) return;
    setCanResend(false);
    setCountdown(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();

    await resendOtp();

    // Restart countdown
    let t = RESEND_SECONDS;
    const id = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) {
        clearInterval(id);
        setCanResend(true);
      }
    }, 1000);
  }, [canResend, loading, resendOtp]);

  // ── Manual submit button ──────────────────────────────
  const handleSubmit = () => {
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      flow.setServerErr?.("Please enter all 6 digits.");
      return;
    }
    submitOtp(code);
  };

  const filled   = digits.filter(Boolean).length;
  const complete = filled === OTP_LENGTH;

  // Mask the email for display: j***@gmail.com
  const maskedEmail = maskEmail(pendingEmail);

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.header}>
        <div style={s.icon}>📬</div>
        <h2 style={s.title}>Check Your Email</h2>
        <p style={s.subtitle}>
          We sent a <strong>6-digit verification code</strong> to
        </p>
        <div style={s.emailBadge}>
          <span style={s.emailBadgeIcon}>📧</span>
          <span style={s.emailBadgeText}>{maskedEmail}</span>
        </div>
        <p style={s.subtitleSmall}>
          Enter the code below to verify your account.
        </p>
      </div>

      {/* OTP boxes */}
      <div style={s.otpRow} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            style={{
              ...s.otpBox,
              borderColor: serverErr
                ? "#ef4444"
                : d
                  ? "#6366f1"
                  : "#e5e7eb",
              background: d ? "#eef2ff" : "white",
              color:      d ? "#4338ca" : "#1f2937",
              transform:  d ? "scale(1.05)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* Progress dots */}
      <div style={s.progressRow}>
        {Array(OTP_LENGTH).fill(0).map((_, i) => (
          <div
            key={i}
            style={{
              ...s.dot,
              background: i < filled ? "#6366f1" : "#e5e7eb",
              transform:  i < filled ? "scale(1.2)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* Messages */}
      {serverErr && (
        <div className="seller-alert error">⚠️ {serverErr}</div>
      )}
      {serverMsg && !serverErr && (
        <div className="seller-alert success">✅ {serverMsg}</div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!complete || loading}
        className="btn-seller-primary"
        style={{ opacity: complete && !loading ? 1 : 0.6 }}
      >
        {loading
          ? <><Spinner /> Verifying…</>
          : "Verify & Continue →"}
      </button>

      {/* Resend */}
      <div style={s.resendRow}>
        <span style={s.resendText}>Didn't receive the code?</span>
        {canResend ? (
          <button
            type="button"
            style={s.resendBtn}
            onClick={handleResend}
            disabled={loading}
          >
            🔄 Resend Code
          </button>
        ) : (
          <span style={s.countdown}>
            Resend in <strong>{countdown}s</strong>
          </span>
        )}
      </div>

      {/* Tips */}
      <div style={s.tipsBox}>
        <p style={s.tipsTitle}>💡 Can't find the email?</p>
        <div style={s.tipsList}>
          {[
            "Check your spam or junk folder",
            "Make sure you typed the right email",
            "The code expires in 1 hour",
            "Try resending after the countdown",
          ].map((tip, i) => (
            <div key={i} style={s.tipRow}>
              <span style={{ color: "#6366f1" }}>•</span>
              <span style={s.tipText}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back to register */}
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          style={s.backBtn}
          onClick={() => setStep(STEPS.REGISTER)}
        >
          ← Wrong email? Go back
        </button>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function maskEmail(email = "") {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  const stars   = "*".repeat(Math.max(local.length - 2, 2));
  return `${visible}${stars}@${domain}`;
}

function Spinner() {
  return (
    <span style={{
      width:         "18px",
      height:        "18px",
      border:        "3px solid rgba(255,255,255,0.3)",
      borderTop:     "3px solid white",
      borderRadius:  "50%",
      display:       "inline-block",
      animation:     "spin 0.7s linear infinite",
      marginRight:   "0.4rem",
      verticalAlign: "middle",
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = {
  header: {
    textAlign:    "center",
    marginBottom: "2rem",
  },
  icon: {
    fontSize:     "3.5rem",
    marginBottom: "0.75rem",
  },
  title: {
    fontSize:     "1.5rem",
    fontWeight:   800,
    color:        "#1f2937",
    margin:       "0 0 0.5rem",
  },
  subtitle: {
    color:        "#6b7280",
    margin:       "0 0 0.75rem",
    fontSize:     "0.95rem",
  },
  subtitleSmall: {
    color:        "#9ca3af",
    margin:       "0.5rem 0 0",
    fontSize:     "0.85rem",
  },
  emailBadge: {
    display:         "inline-flex",
    alignItems:      "center",
    gap:             "0.4rem",
    background:      "#eef2ff",
    border:          "1px solid #c7d2fe",
    borderRadius:    "100px",
    padding:         "0.4rem 1rem",
    margin:          "0 auto",
  },
  emailBadgeIcon: { fontSize: "0.9rem" },
  emailBadgeText: {
    color:      "#4338ca",
    fontWeight: 700,
    fontSize:   "0.9rem",
  },
  otpRow: {
    display:        "flex",
    gap:            "0.6rem",
    justifyContent: "center",
    margin:         "0 0 1rem",
  },
  otpBox: {
    width:         "48px",
    height:        "56px",
    borderRadius:  "12px",
    border:        "2px solid",
    textAlign:     "center",
    fontSize:      "1.5rem",
    fontWeight:    800,
    outline:       "none",
    transition:    "all 0.15s ease",
    fontFamily:    "monospace",
    cursor:        "text",
  },
  progressRow: {
    display:        "flex",
    gap:            "6px",
    justifyContent: "center",
    marginBottom:   "1.25rem",
  },
  dot: {
    width:        "8px",
    height:       "8px",
    borderRadius: "50%",
    transition:   "all 0.2s ease",
  },
  resendRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "0.5rem",
    margin:         "1rem 0",
    flexWrap:       "wrap",
  },
  resendText: {
    color:    "#6b7280",
    fontSize: "0.875rem",
  },
  resendBtn: {
    background:     "none",
    border:         "none",
    color:          "#6366f1",
    fontWeight:     700,
    fontSize:       "0.875rem",
    cursor:         "pointer",
    padding:        0,
    fontFamily:     "inherit",
    textDecoration: "underline",
  },
  countdown: {
    color:    "#9ca3af",
    fontSize: "0.875rem",
  },
  tipsBox: {
    background:   "#f8fafc",
    border:       "1px solid #e5e7eb",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
    margin:       "1rem 0",
  },
  tipsTitle: {
    fontWeight:   700,
    color:        "#374151",
    fontSize:     "0.85rem",
    margin:       "0 0 0.6rem",
  },
  tipsList: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.3rem",
  },
  tipRow: {
    display:    "flex",
    gap:        "0.5rem",
    alignItems: "flex-start",
  },
  tipText: {
    color:      "#6b7280",
    fontSize:   "0.82rem",
    lineHeight: 1.5,
  },
  backBtn: {
    background:     "none",
    border:         "none",
    color:          "#9ca3af",
    fontSize:       "0.875rem",
    cursor:         "pointer",
    fontFamily:     "inherit",
    textDecoration: "underline",
    padding:        "0.5rem",
  },
};