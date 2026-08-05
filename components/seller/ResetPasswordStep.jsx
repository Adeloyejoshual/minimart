// components/seller/ResetPasswordStep.jsx
import React, {
  useState, useRef, useEffect, useCallback,
} from "react";
import { STEPS } from "../../hooks/useSellerFlow";

const OTP_LENGTH     = 6;
const RESEND_SECONDS = 60;

export default function ResetPasswordStep({ flow }) {
  const {
    loading,
    serverMsg,
    serverErr,
    pendingEmail,
    submitResetPassword,
    resendResetCode,
    setStep,
  } = flow;

  // ── OTP boxes ─────────────────────────────────────────────
  const [digits,      setDigits]      = useState(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countdown,   setCountdown]   = useState(RESEND_SECONDS);
  const [canResend,   setCanResend]   = useState(false);

  const inputRefs = useRef([]);

  // ── Countdown ──────────────────────────────────────────────
  useEffect(() => {
    let t  = RESEND_SECONDS;
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

  // ── Auto-focus first box ───────────────────────────────────
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── OTP box handlers ───────────────────────────────────────
  const handleDigitChange = useCallback((e, idx) => {
    const val  = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx]  = val;
    setDigits(next);
    if (val && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  }, [digits]);

  const handleDigitKeyDown = useCallback((e, idx) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        const next = [...digits];
        next[idx]  = "";
        setDigits(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft"  && idx > 0)
      inputRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1)
      inputRefs.current[idx + 1]?.focus();
  }, [digits]);

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
    const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastIdx]?.focus();
  }, []);

  // ── Resend ─────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (!canResend || loading) return;
    setCanResend(false);
    setCountdown(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
    await resendResetCode();

    let t  = RESEND_SECONDS;
    const id = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) { clearInterval(id); setCanResend(true); }
    }, 1000);
  }, [canResend, loading, resendResetCode]);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = () => {
    submitResetPassword(
      digits.join(""),
      newPassword,
      confirmPw,
    );
  };

  // ── Derived ────────────────────────────────────────────────
  const code         = digits.join("");
  const codeComplete = code.length === OTP_LENGTH;
  const filled       = digits.filter(Boolean).length;

  const maskedEmail  = maskEmail(pendingEmail);

  // ── Password strength ──────────────────────────────────────
  const strength     = getStrength(newPassword);
  const pwMatch      = newPassword && confirmPw &&
    newPassword === confirmPw;
  const pwMismatch   = confirmPw && newPassword !== confirmPw;

  const canSubmit    = codeComplete && newPassword.length >= 8 &&
    !loading && pwMatch;

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.header}>
        <div style={s.icon}>🔑</div>
        <h2 style={s.title}>Reset Your Password</h2>
        <p style={s.subtitle}>
          Enter the 6-digit code sent to
        </p>
        <div style={s.emailBadge}>
          <span>📧</span>
          <span style={s.emailText}>{maskedEmail}</span>
        </div>
      </div>

      {/* ── SECTION 1: OTP boxes ─────────────────────────── */}
      <div style={s.sectionLabel}>Step 1 — Enter reset code</div>

      <div style={s.otpRow} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigitChange(e, i)}
            onKeyDown={(e) => handleDigitKeyDown(e, i)}
            style={{
              ...s.otpBox,
              borderColor: serverErr
                ? "#ef4444"
                : d ? "#6366f1" : "#e5e7eb",
              background: d ? "#eef2ff" : "white",
              color:      d ? "#4338ca" : "#1f2937",
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
            }}
          />
        ))}
      </div>

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

      {/* ── SECTION 2: New password ───────────────────────── */}
      <div style={s.sectionLabel}>Step 2 — Set new password</div>

      {/* New password */}
      <div className="seller-field">
        <label className="seller-label">
          🔒 New Password
          <span style={{ color: "#ef4444" }}> *</span>
        </label>
        <div style={s.pwWrap}>
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            className="seller-input"
            style={{ paddingRight: "3rem" }}
          />
          <EyeBtn
            show={showNew}
            toggle={() => setShowNew((v) => !v)}
          />
        </div>

        {/* Strength meter */}
        {newPassword && (
          <>
            <div style={s.strengthWrap}>
              <div style={s.strengthBar}>
                {[1,2,3,4,5].map((i) => (
                  <div
                    key={i}
                    style={{
                      ...s.strengthSeg,
                      background: i <= strength.score
                        ? strength.color : "#e5e7eb",
                    }}
                  />
                ))}
              </div>
              {strength.label && (
                <span style={{
                  ...s.strengthLabel,
                  color: strength.color,
                }}>
                  {strength.label}
                </span>
              )}
            </div>
            <PasswordRules password={newPassword} />
          </>
        )}
      </div>

      {/* Confirm password */}
      <div className="seller-field">
        <label className="seller-label">
          🔒 Confirm Password
          <span style={{ color: "#ef4444" }}> *</span>
        </label>
        <div style={s.pwWrap}>
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            className="seller-input"
            style={{ paddingRight: "3rem" }}
          />
          <EyeBtn
            show={showConfirm}
            toggle={() => setShowConfirm((v) => !v)}
          />
        </div>
        {confirmPw && (
          <span style={{
            fontSize:  "0.8rem",
            fontWeight:600,
            color:     pwMatch ? "#10b981" : "#ef4444",
          }}>
            {pwMatch
              ? "✓ Passwords match"
              : "✗ Passwords do not match"}
          </span>
        )}
      </div>

      {/* Messages */}
      {serverErr && (
        <div className="seller-alert error">⚠️ {serverErr}</div>
      )}
      {serverMsg && !serverErr && (
        <div className="seller-alert success">✅ {serverMsg}</div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-seller-primary"
        style={{ opacity: canSubmit ? 1 : 0.6 }}
      >
        {loading
          ? <><Spinner /> Resetting Password…</>
          : "Reset Password →"}
      </button>

      {/* Hint */}
      {!canSubmit && !loading && (
        <p style={s.hint}>
          {!codeComplete
            ? "⚠️ Enter the 6-digit code above"
            : !newPassword
              ? "⚠️ Enter your new password"
              : pwMismatch
                ? "⚠️ Passwords do not match"
                : "⚠️ Password must be at least 8 characters"}
        </p>
      )}

      {/* Back */}
      <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
        <button
          type="button"
          style={s.backBtn}
          onClick={() => setStep(STEPS.FORGOT_PASSWORD)}
        >
          ← Request a new code
        </button>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PASSWORD RULES
// ─────────────────────────────────────────────────────────────
const RULES = [
  { test: (p) => p.length >= 8,          label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p),        label: "One uppercase letter"  },
  { test: (p) => /[0-9]/.test(p),        label: "One number"            },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

const PasswordRules = ({ password }) => (
  <div style={s.rulesWrap}>
    {RULES.map((rule, i) => {
      const ok = rule.test(password);
      return (
        <div key={i} style={s.ruleRow}>
          <span style={{ color: ok ? "#10b981" : "#d1d5db" }}>
            {ok ? "✓" : "○"}
          </span>
          <span style={{
            fontSize: "0.8rem",
            color:    ok ? "#10b981" : "#9ca3af",
          }}>
            {rule.label}
          </span>
        </div>
      );
    })}
  </div>
);

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

function getStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8)          score++;
  if (password.length >= 12)         score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { score: 0, label: "",            color: ""        },
    { score: 1, label: "Weak",        color: "#ef4444" },
    { score: 2, label: "Fair",        color: "#f59e0b" },
    { score: 3, label: "Good",        color: "#3b82f6" },
    { score: 4, label: "Strong",      color: "#10b981" },
    { score: 5, label: "Very Strong", color: "#059669" },
  ];
  return levels[Math.min(score, 5)];
}

const EyeBtn = ({ show, toggle }) => (
  <button
    type="button"
    style={s.eyeBtn}
    onClick={toggle}
    tabIndex={-1}
    aria-label={show ? "Hide password" : "Show password"}
  >
    {show ? "🙈" : "👁️"}
  </button>
);

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
  header: { textAlign: "center", marginBottom: "1.5rem" },
  icon: { fontSize: "3.5rem", marginBottom: "0.75rem" },
  title: {
    fontSize:   "1.5rem",
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "0 0 0.5rem",
  },
  subtitle: {
    color:    "#6b7280",
    fontSize: "0.95rem",
    margin:   "0 0 0.5rem",
  },
  emailBadge: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          "0.4rem",
    background:   "#eef2ff",
    border:       "1px solid #c7d2fe",
    borderRadius: "100px",
    padding:      "0.4rem 1rem",
  },
  emailText: {
    color:      "#4338ca",
    fontWeight: 700,
    fontSize:   "0.9rem",
  },
  sectionLabel: {
    fontWeight:    700,
    fontSize:      "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color:         "#6366f1",
    marginBottom:  "0.75rem",
    marginTop:     "0.5rem",
    paddingLeft:   "0.25rem",
    borderLeft:    "3px solid #6366f1",
    paddingLeft:   "0.6rem",
  },
  otpRow: {
    display:        "flex",
    gap:            "0.6rem",
    justifyContent: "center",
    marginBottom:   "0.75rem",
  },
  otpBox: {
    width:        "48px",
    height:       "56px",
    borderRadius: "12px",
    border:       "2px solid",
    textAlign:    "center",
    fontSize:     "1.5rem",
    fontWeight:   800,
    outline:      "none",
    transition:   "all 0.15s ease",
    fontFamily:   "monospace",
    cursor:       "text",
  },
  progressRow: {
    display:        "flex",
    gap:            "6px",
    justifyContent: "center",
    marginBottom:   "0.75rem",
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
    marginBottom:   "1.5rem",
    flexWrap:       "wrap",
  },
  resendText: { color: "#6b7280", fontSize: "0.875rem" },
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
  countdown: { color: "#9ca3af", fontSize: "0.875rem" },
  pwWrap: { position: "relative" },
  eyeBtn: {
    position:   "absolute",
    right:      "0.875rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    fontSize:   "1.1rem",
    padding:    "0.25rem",
    lineHeight: 1,
  },
  strengthWrap: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.75rem",
    marginTop:  "0.5rem",
  },
  strengthBar:    { display: "flex", gap: "3px", flex: 1 },
  strengthSeg: {
    height:       "4px",
    flex:         1,
    borderRadius: "100px",
    transition:   "background 0.3s ease",
  },
  strengthLabel: {
    fontSize:  "0.8rem",
    fontWeight:700,
    whiteSpace:"nowrap",
  },
  rulesWrap: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "0.35rem",
    marginTop:           "0.5rem",
    padding:             "0.75rem",
    background:          "#f8fafc",
    borderRadius:        "10px",
  },
  ruleRow: { display: "flex", alignItems: "center", gap: "0.4rem" },
  hint: {
    textAlign:  "center",
    color:      "#f59e0b",
    fontSize:   "0.85rem",
    margin:     "0.5rem 0 0",
    fontWeight: 500,
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