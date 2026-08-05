// components/seller/ForgotPasswordStep.jsx
import React, { useState } from "react";
import { STEPS } from "../../hooks/useSellerFlow";

export default function ForgotPasswordStep({ flow }) {
  const {
    loading,
    serverMsg,
    serverErr,
    submitForgotPassword,
    setStep,
  } = flow;

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const emailRx    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = emailRx.test(email.trim());
  const emailError = touched && !email.trim()
    ? "Email is required"
    : touched && !emailValid
      ? "Enter a valid email address"
      : "";

  const handleSubmit = () => {
    setTouched(true);
    if (!emailValid) return;
    submitForgotPassword(email);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleSubmit();
  };

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.header}>
        <div style={s.icon}>🔐</div>
        <h2 style={s.title}>Forgot Password?</h2>
        <p style={s.subtitle}>
          Enter the email address for your seller account
          and we'll send you a reset code.
        </p>
      </div>

      {/* Email field */}
      <div className="seller-field" style={{ marginBottom: "1.25rem" }}>
        <label className="seller-label">
          📧 Email Address
          <span style={{ color: "#ef4444" }}> *</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTouched(false);
          }}
          onBlur={() => setTouched(true)}
          onKeyDown={handleKeyDown}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          className={`seller-input ${emailError ? "error" : ""}`}
        />
        {emailError && (
          <span className="field-error">⚠️ {emailError}</span>
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
        disabled={loading}
        className="btn-seller-primary"
        style={{ marginBottom: "1rem" }}
      >
        {loading
          ? <><Spinner /> Sending Code…</>
          : "Send Reset Code →"}
      </button>

      {/* Info box */}
      <div style={s.infoBox}>
        <p style={s.infoTitle}>💡 What happens next?</p>
        <div style={s.infoList}>
          {[
            "We'll send a 6-digit code to your email",
            "The code expires in 15 minutes",
            "Enter the code on the next screen",
            "Then set your new password",
          ].map((item, i) => (
            <div key={i} style={s.infoRow}>
              <span style={{ color: "#6366f1", fontWeight: 700 }}>
                {i + 1}.
              </span>
              <span style={s.infoText}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back to sign in */}
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

const s = {
  header: { textAlign: "center", marginBottom: "2rem" },
  icon: {
    fontSize:     "3.5rem",
    marginBottom: "0.75rem",
  },
  title: {
    fontSize:   "1.5rem",
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "0 0 0.5rem",
  },
  subtitle: {
    color:      "#6b7280",
    fontSize:   "0.95rem",
    lineHeight: 1.6,
    margin:     0,
  },
  infoBox: {
    background:   "#eef2ff",
    border:       "1px solid #c7d2fe",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
    margin:       "1rem 0",
  },
  infoTitle: {
    fontWeight:   700,
    color:        "#4338ca",
    fontSize:     "0.875rem",
    margin:       "0 0 0.6rem",
  },
  infoList: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.35rem",
  },
  infoRow: {
    display:    "flex",
    gap:        "0.5rem",
    alignItems: "flex-start",
  },
  infoText: {
    color:      "#4338ca",
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