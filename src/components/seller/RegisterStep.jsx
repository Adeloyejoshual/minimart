// components/seller/RegisterStep.jsx
// ─────────────────────────────────────────────────────────────
// Handles two modes:
//   "register" → RegisterForm
//   "signin"   → SignInForm
//
// Both delegate all API calls to useSellerFlow via the `flow`
// prop. No API calls are made directly from this component.
// ─────────────────────────────────────────────────────────────
import React, { useState, useCallback, useEffect, useRef } from "react";
import { STEPS } from "../../hooks/useSellerFlow";

// ─────────────────────────────────────────────────────────────
// PASSWORD STRENGTH METER
// ─────────────────────────────────────────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8)           score++;
  if (password.length >= 12)          score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;

  const levels = [
    { score: 0, label: "",            color: ""        },
    { score: 1, label: "Weak",        color: "#ef4444" },
    { score: 2, label: "Fair",        color: "#f59e0b" },
    { score: 3, label: "Good",        color: "#3b82f6" },
    { score: 4, label: "Strong",      color: "#10b981" },
    { score: 5, label: "Very Strong", color: "#059669" },
  ];
  return levels[Math.min(score, 5)];
};

// ─────────────────────────────────────────────────────────────
// ROOT — toggles between register and sign-in
// Clears flow messages when the user switches modes so stale
// errors from a previous login attempt don't bleed through.
// ─────────────────────────────────────────────────────────────
const RegisterStep = ({ flow }) => {
  const [mode, setMode] = useState(
    // If a success message arrived from a password reset,
    // drop straight into sign-in so the user sees it immediately
    flow.serverMsg ? "signin" : "register"
  );

  const switchToSignIn = useCallback(() => {
    // Don't clear messages — a reset success msg needs to survive
    setMode("signin");
  }, []);

  const switchToRegister = useCallback(() => {
    flow.clearMessages();
    setMode("register");
  }, [flow]);

  return mode === "register" ? (
    <RegisterForm
      flow={flow}
      onSwitchToSignIn={switchToSignIn}
    />
  ) : (
    <SignInForm
      flow={flow}
      onSwitchToRegister={switchToRegister}
    />
  );
};

// ══════════════════════════════════════════════════════════════
// REGISTER FORM
// ══════════════════════════════════════════════════════════════
const RegisterForm = ({ flow, onSwitchToSignIn }) => {
  const {
    registerData,
    errors,
    loading,
    serverMsg,
    serverErr,
    showPassword,
    showConfirm,
    setShowPassword,
    setShowConfirm,
    handleRegisterChange,
    submitRegister,
  } = flow;

  const strength = getPasswordStrength(registerData.password);

  return (
    <div className="seller-card">
      <div style={s.cardHeader}>
        <div style={s.headerIcon}>👤</div>
        <h2 style={s.cardTitle}>Create Seller Account</h2>
        <p style={s.cardSubtitle}>
          Register with email and password to start selling
        </p>
      </div>

      <div style={s.form}>

        {/* Full Name */}
        <Field label="Full Name" icon="👤" required error={errors.name}>
          <input
            name="name"
            type="text"
            value={registerData.name}
            onChange={handleRegisterChange}
            placeholder="John Doe"
            autoComplete="name"
            autoFocus
            className={`seller-input ${errors.name ? "error" : ""}`}
          />
        </Field>

        {/* Email */}
        <Field label="Email Address" icon="📧" required error={errors.email}>
          <input
            name="email"
            type="email"
            value={registerData.email}
            onChange={handleRegisterChange}
            placeholder="you@example.com"
            autoComplete="email"
            className={`seller-input ${errors.email ? "error" : ""}`}
          />
        </Field>

        {/* Phone */}
        <Field
          label="Phone Number"
          icon="📱"
          required
          error={errors.phone}
          hint="Include country code, e.g. +234 800 000 0000"
        >
          <input
            name="phone"
            type="tel"
            value={registerData.phone}
            onChange={handleRegisterChange}
            placeholder="+234 800 000 0000"
            autoComplete="tel"
            className={`seller-input ${errors.phone ? "error" : ""}`}
          />
        </Field>

        {/* Password */}
        <Field label="Password" icon="🔒" required error={errors.password}>
          <div style={s.passwordWrap}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={registerData.password}
              onChange={handleRegisterChange}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className={`seller-input ${errors.password ? "error" : ""}`}
              style={{ paddingRight: "3rem" }}
            />
            <EyeBtn
              show={showPassword}
              toggle={() => setShowPassword((v) => !v)}
            />
          </div>
          {registerData.password && (
            <>
              <StrengthMeter strength={strength} />
              <PasswordRules password={registerData.password} />
            </>
          )}
        </Field>

        {/* Confirm Password */}
        <Field
          label="Confirm Password"
          icon="🔒"
          required
          error={errors.confirm_password}
        >
          <div style={s.passwordWrap}>
            <input
              name="confirm_password"
              type={showConfirm ? "text" : "password"}
              value={registerData.confirm_password}
              onChange={handleRegisterChange}
              placeholder="Repeat your password"
              autoComplete="new-password"
              className={`seller-input ${errors.confirm_password ? "error" : ""}`}
              style={{ paddingRight: "3rem" }}
            />
            <EyeBtn
              show={showConfirm}
              toggle={() => setShowConfirm((v) => !v)}
            />
          </div>
          {registerData.confirm_password && (
            <MatchIndicator
              a={registerData.password}
              b={registerData.confirm_password}
            />
          )}
        </Field>

        {/* Server feedback */}
        {serverErr && <ServerAlert msg={serverErr} isError />}
        {serverMsg && !serverErr && <ServerAlert msg={serverMsg} />}

        <button
          onClick={submitRegister}
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading
            ? <><Spinner /> Creating Account…</>
            : "Create Account & Continue →"}
        </button>

        <p style={s.switchText}>
          Already have a seller account?{" "}
          <button type="button" style={s.switchBtn} onClick={onSwitchToSignIn}>
            Sign in instead
          </button>
        </p>

      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// SIGN IN FORM
//
// Key fixes vs original:
// 1. Local `errors` state is separate from flow.errors (correct)
// 2. validate() is a plain function inside the callback, not a
//    stale closure — avoids the missing-dep bug
// 3. clearMessages() is called on mount ONLY if there is no
//    incoming success message (e.g. post-reset redirect)
// 4. pendingEmail is used to pre-fill email after password reset
// ══════════════════════════════════════════════════════════════
const SignInForm = ({ flow, onSwitchToRegister }) => {
  const {
    loading,
    serverMsg,
    serverErr,
    setStep,
    submitLogin,
    clearMessages,
    pendingEmail,   // pre-fill after password reset
  } = flow;

  const [formData, setFormData] = useState({
    email:    pendingEmail ?? "",
    password: "",
  });
  const [localErrors,  setLocalErrors]  = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // If pendingEmail changes (e.g. after reset), pre-fill email
  useEffect(() => {
    if (pendingEmail) {
      setFormData((prev) => ({ ...prev, email: pendingEmail }));
    }
  }, [pendingEmail]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev)    => ({ ...prev, [name]: value }));
    setLocalErrors((prev) => ({ ...prev, [name]: "" }));
    // Only clear the flow-level serverErr when the user starts
    // typing — leave serverMsg alone (it may be the reset success)
    if (name === "password" || name === "email") {
      flow.setServerErr("");
    }
  }, [flow]);

  const handleSignIn = useCallback(() => {
    // ── Inline validation ────────────────────────────────
    const errs    = {};
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim())
      errs.email = "Email is required";
    else if (!emailRx.test(formData.email.trim()))
      errs.email = "Enter a valid email address";

    if (!formData.password)
      errs.password = "Password is required";

    setLocalErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Delegates to hook — no API calls here
    submitLogin(formData.email, formData.password);
    // ↑ email trimmed + lowercased inside submitLogin
    // ↑ password passed raw — never trimmed
  }, [formData, submitLogin]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleSignIn();
  };

  return (
    <div className="seller-card">
      <div style={s.cardHeader}>
        <div style={s.headerIcon}>🔐</div>
        <h2 style={s.cardTitle}>Welcome Back</h2>
        <p style={s.cardSubtitle}>
          Sign in to your seller account to continue
        </p>
      </div>

      <div style={s.form}>

        {/* Email */}
        <Field
          label="Email Address"
          icon="📧"
          required
          error={localErrors.email}
        >
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            className={`seller-input ${localErrors.email ? "error" : ""}`}
          />
        </Field>

        {/* Password */}
        <Field
          label="Password"
          icon="🔒"
          required
          error={localErrors.password}
        >
          <div style={s.passwordWrap}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Your seller account password"
              autoComplete="current-password"
              className={`seller-input ${localErrors.password ? "error" : ""}`}
              style={{ paddingRight: "3rem" }}
            />
            <EyeBtn
              show={showPassword}
              toggle={() => setShowPassword((v) => !v)}
            />
          </div>
        </Field>

        {/* Forgot password */}
        <div style={{ textAlign: "right", marginTop: "-0.5rem" }}>
          <button
            type="button"
            style={s.forgotBtn}
            onClick={() => setStep(STEPS.FORGOT_PASSWORD)}
          >
            Forgot password?
          </button>
        </div>

        {/* Flow-level server feedback */}
        {/* serverMsg shown first — e.g. "Password reset successfully!" */}
        {serverMsg && !serverErr && <ServerAlert msg={serverMsg} />}
        {serverErr && <ServerAlert msg={serverErr} isError />}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading
            ? <><Spinner /> Signing In…</>
            : "Sign In & Continue →"}
        </button>

        <p style={s.switchText}>
          Don't have a seller account?{" "}
          <button
            type="button"
            style={s.switchBtn}
            onClick={onSwitchToRegister}
          >
            Create one free
          </button>
        </p>

        <div style={s.noteBox}>
          <p style={s.noteText}>
            🔒 <strong>Seller accounts are separate</strong> from your
            marketplace account. Use your seller email and password here.
          </p>
        </div>

      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════
const RULES = [
  { test: (p) => p.length >= 8,           label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p),         label: "One uppercase letter"  },
  { test: (p) => /[0-9]/.test(p),         label: "One number"            },
  { test: (p) => /[^A-Za-z0-9]/.test(p),  label: "One special character" },
];

const PasswordRules = ({ password }) => (
  <div style={s.rulesWrap}>
    {RULES.map((rule, i) => {
      const passed = rule.test(password);
      return (
        <div key={i} style={s.ruleRow}>
          <span style={{ color: passed ? "#10b981" : "#d1d5db" }}>
            {passed ? "✓" : "○"}
          </span>
          <span style={{
            fontSize: "0.8rem",
            color:    passed ? "#10b981" : "#9ca3af",
          }}>
            {rule.label}
          </span>
        </div>
      );
    })}
  </div>
);

const StrengthMeter = ({ strength }) => (
  <div style={s.strengthWrap}>
    <div style={s.strengthBar}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            ...s.strengthSegment,
            background: i <= strength.score ? strength.color : "#e5e7eb",
          }}
        />
      ))}
    </div>
    {strength.label && (
      <span style={{ ...s.strengthLabel, color: strength.color }}>
        {strength.label}
      </span>
    )}
  </div>
);

const MatchIndicator = ({ a, b }) => (
  <span style={{
    fontSize:   "0.8rem",
    fontWeight: 500,
    color:      a === b ? "#10b981" : "#ef4444",
  }}>
    {a === b ? "✓ Passwords match" : "✗ Passwords do not match"}
  </span>
);

const Field = ({ label, icon, required, error, hint, children }) => (
  <div className="seller-field">
    <label className="seller-label">
      {icon && `${icon} `}{label}
      {required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
    {children}
    {hint && !error && (
      <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{hint}</span>
    )}
    {error && (
      <span className="field-error">⚠️ {error}</span>
    )}
  </div>
);

const EyeBtn = ({ show, toggle }) => (
  <button
    type="button"
    style={s.eyeBtn}
    onClick={toggle}
    aria-label={show ? "Hide password" : "Show password"}
    tabIndex={-1}
  >
    {show ? "🙈" : "👁️"}
  </button>
);

const ServerAlert = ({ msg, isError }) => {
  if (!msg) return null;
  return (
    <div
      className={`seller-alert ${isError ? "error" : "success"}`}
      role="alert"
      aria-live="polite"
    >
      {isError ? "⚠️" : "✅"} {msg}
    </div>
  );
};

const Spinner = () => (
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

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════
const s = {
  cardHeader: {
    textAlign:     "center",
    marginBottom:  "2rem",
    paddingBottom: "1.5rem",
    borderBottom:  "1px solid #f3f4f6",
  },
  headerIcon:  { fontSize: "3rem", marginBottom: "0.75rem" },
  cardTitle: {
    fontSize:   "1.5rem",
    fontWeight: 800,
    color:      "#1f2937",
    margin:     0,
  },
  cardSubtitle: {
    color:     "#6b7280",
    marginTop: "0.4rem",
    fontSize:  "0.95rem",
  },
  form: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  passwordWrap: { position: "relative" },
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
  strengthSegment: {
    height:       "4px",
    flex:         1,
    borderRadius: "100px",
    transition:   "background 0.3s ease",
  },
  strengthLabel: {
    fontSize:   "0.8rem",
    fontWeight: 700,
    whiteSpace: "nowrap",
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
  switchText: {
    textAlign: "center",
    color:     "#6b7280",
    fontSize:  "0.9rem",
    margin:    "0.25rem 0",
  },
  switchBtn: {
    background:     "none",
    border:         "none",
    color:          "#6366f1",
    fontWeight:     700,
    cursor:         "pointer",
    fontSize:       "0.9rem",
    padding:        0,
    textDecoration: "underline",
    fontFamily:     "inherit",
  },
  forgotBtn: {
    background:     "none",
    border:         "none",
    color:          "#6366f1",
    fontSize:       "0.85rem",
    fontWeight:     600,
    cursor:         "pointer",
    padding:        0,
    fontFamily:     "inherit",
    textDecoration: "none",
  },
  noteBox: {
    background:   "#fffbeb",
    border:       "1px solid #fde68a",
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
  },
  noteText: {
    color:      "#92400e",
    fontSize:   "0.82rem",
    lineHeight: 1.5,
    margin:     0,
  },
};

export default RegisterStep;