// components/seller/ResetPasswordStep.jsx
import React, { useState } from "react";
import { STEPS } from "../../hooks/useSellerFlow";

export default function ResetPasswordStep({ flow }) {
  const {
    loading,
    serverMsg,
    serverErr,
    submitNewPassword,
    setStep,
  } = flow;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength   = getStrength(newPassword);
  const pwMatch    = newPassword && confirmPw && newPassword === confirmPw;
  const pwMismatch = confirmPw && newPassword !== confirmPw;

  const canSubmit  =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    pwMatch &&
    !loading;

  const handleSubmit = () => {
    submitNewPassword(newPassword, confirmPw);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canSubmit) handleSubmit();
  };

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.header}>
        <div style={s.icon}>🔑</div>
        <h2 style={s.title}>Set New Password</h2>
        <p style={s.subtitle}>
          Your reset code has been verified. Now create a strong new password.
        </p>
      </div>

      {/* Verified badge */}
      <div style={s.verifiedBadge}>
        <span style={{ fontSize: "1.25rem" }}>✅</span>
        <p style={s.verifiedText}>
          Reset code verified successfully
        </p>
      </div>

      <div style={s.form}>

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
              onKeyDown={handleKeyDown}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              autoFocus
              className="seller-input"
              style={{ paddingRight: "3rem" }}
            />
            <EyeBtn
              show={showNew}
              toggle={() => setShowNew((v) => !v)}
            />
          </div>

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
                          ? strength.color
                          : "#e5e7eb",
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
              onKeyDown={handleKeyDown}
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
              fontSize:   "0.8rem",
              fontWeight: 600,
              color:      pwMatch ? "#10b981" : "#ef4444",
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
        {!canSubmit && !loading && newPassword && (
          <p style={s.hint}>
            {newPassword.length < 8
              ? "⚠️ Password must be at least 8 characters"
              : !/[A-Z]/.test(newPassword)
                ? "⚠️ Add at least one uppercase letter"
                : !/\d/.test(newPassword)
                  ? "⚠️ Add at least one number"
                  : pwMismatch
                    ? "⚠️ Passwords do not match"
                    : ""}
          </p>
        )}

      </div>

      {/* Back */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          type="button"
          style={s.backBtn}
          onClick={() => setStep(STEPS.REGISTER)}
        >
          ← Back to Sign In
        </button>
      </div>

    </div>
  );
}

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
    aria-label={show ? "Hide" : "Show"}
  >
    {show ? "🙈" : "👁️"}
  </button>
);

function Spinner() {
  return (
    <span style={{
      width: "18px", height: "18px",
      border: "3px solid rgba(255,255,255,0.3)",
      borderTop: "3px solid white",
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.7s linear infinite",
      marginRight: "0.4rem",
      verticalAlign: "middle",
    }} />
  );
}

const s = {
  header: { textAlign: "center", marginBottom: "1.5rem" },
  icon:   { fontSize: "3.5rem", marginBottom: "0.75rem" },
  title:  { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: "0 0 0.5rem" },
  subtitle: { color: "#6b7280", fontSize: "0.95rem", lineHeight: 1.6, margin: 0 },
  verifiedBadge: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.75rem",
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "0.875rem 1.25rem",
    marginBottom: "1.5rem",
  },
  verifiedText: {
    color:      "#065f46",
    fontWeight: 600,
    fontSize:   "0.875rem",
    margin:     0,
  },
  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pwWrap: { position: "relative" },
  eyeBtn: {
    position: "absolute", right: "0.875rem", top: "50%",
    transform: "translateY(-50%)", background: "none",
    border: "none", cursor: "pointer", fontSize: "1.1rem",
    padding: "0.25rem", lineHeight: 1,
  },
  strengthWrap: { display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" },
  strengthBar:  { display: "flex", gap: "3px", flex: 1 },
  strengthSeg:  { height: "4px", flex: 1, borderRadius: "100px", transition: "background 0.3s" },
  strengthLabel:{ fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" },
  rulesWrap:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem", marginTop: "0.5rem", padding: "0.75rem", background: "#f8fafc", borderRadius: "10px" },
  ruleRow:      { display: "flex", alignItems: "center", gap: "0.4rem" },
  hint:         { textAlign: "center", color: "#f59e0b", fontSize: "0.85rem", margin: "0.5rem 0 0", fontWeight: 500 },
  backBtn:      { background: "none", border: "none", color: "#9ca3af", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: "0.5rem" },
};