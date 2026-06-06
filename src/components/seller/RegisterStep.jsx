// components/seller/RegisterStep.jsx
import React, { useState, useCallback } from "react";
import axios from "axios";
import { STEPS } from "../../hooks/useSellerFlow";

// ─── Password Strength Calculator ────────────────────────────
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

// ── Map vendor status → correct step ─────────────────────────
// ✅ Fixed: pending → VERIFICATION (not REVIEW)
const STATUS_TO_STEP = {
  pending:      STEPS.VERIFICATION,
  under_review: STEPS.REVIEW,
  approved:     STEPS.APPROVED,
  active:       STEPS.APPROVED,
  rejected:     STEPS.STORE_SETUP,
  suspended:    STEPS.APPROVED,
};

// ─── Main Component ───────────────────────────────────────────
const RegisterStep = ({ flow }) => {
  const [mode, setMode] = useState("register"); // "register" | "signin"

  return mode === "register" ? (
    <RegisterForm
      flow={flow}
      onSwitchToSignIn={() => setMode("signin")}
    />
  ) : (
    <SignInForm
      flow={flow}
      onSwitchToRegister={() => setMode("register")}
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
    showPassword,
    showConfirm,
    setShowPassword,
    setShowConfirm,
    handleRegisterChange,
    submitRegister,
    setStep,
  } = flow;

  const strength = getPasswordStrength(registerData.password);

  return (
    <div className="seller-card">

      {/* Header */}
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
              toggle={() => setShowPassword(!showPassword)}
            />
          </div>

          {registerData.password && (
            <StrengthMeter strength={strength} />
          )}
          {registerData.password && (
            <PasswordRules password={registerData.password} />
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
              toggle={() => setShowConfirm(!showConfirm)}
            />
          </div>

          {registerData.confirm_password && (
            <MatchIndicator
              a={registerData.password}
              b={registerData.confirm_password}
            />
          )}
        </Field>

        {/* Server message */}
        <ServerAlert msg={serverMsg} />

        {/* Submit */}
        <button
          onClick={submitRegister}
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading
            ? <><Spinner /> Creating Account...</>
            : "Create Account & Continue →"}
        </button>

        {/* Switch to sign in */}
        <p style={s.switchText}>
          Already have a seller account?{" "}
          <button
            type="button"
            style={s.switchBtn}
            onClick={onSwitchToSignIn}
          >
            Sign in instead
          </button>
        </p>

      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// SIGN IN FORM
// ══════════════════════════════════════════════════════════════
const SignInForm = ({ flow, onSwitchToRegister }) => {
  const { setStep, setVendorData } = flow;

  const [formData,     setFormData]     = useState({ email: "", password: "" });
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [serverMsg,    setServerMsg]    = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setErrors((p)   => ({ ...p, [name]: ""    }));
    setServerMsg("");
  }, []);

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    const errs       = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim())
      errs.email = "Email is required";
    else if (!emailRegex.test(formData.email))
      errs.email = "Enter a valid email address";

    if (!formData.password)
      errs.password = "Password is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);
    setServerMsg("");

    try {
      // ✅ Login via seller auth route (market.users only)
      const { data } = await axios.post("/api/auth/login", {
        email:    formData.email.trim(),
        password: formData.password,
      });

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      // ── Check existing vendor status ──────────────────────
      try {
        const { data: vendorRes } = await axios.get(
          "/api/seller-onboarding/status",
          { headers: { Authorization: `Bearer ${data.token}` } }
        );

        if (vendorRes?.vendor) {
          if (typeof setVendorData === "function") {
            setVendorData(vendorRes.vendor);
          }

          const nextStep =
            STATUS_TO_STEP[vendorRes.vendor.status] ?? STEPS.STORE_SETUP;

          setStep(nextStep);
        } else {
          setStep(STEPS.STORE_SETUP);
        }

      } catch (vendorErr) {
        if (vendorErr.response?.status === 403) {
          // This shouldn't happen since we use seller auth route
          // but just in case — go to store setup
          setServerMsg(
            "This account cannot access the seller system. " +
            "Please create a seller account."
          );
        } else {
          // 404 = no vendor yet
          setStep(STEPS.STORE_SETUP);
        }
      }

    } catch (err) {
      setServerMsg(
        err.response?.data?.message ?? "Sign in failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignIn();
  };

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.cardHeader}>
        <div style={s.headerIcon}>🔐</div>
        <h2 style={s.cardTitle}>Welcome Back</h2>
        <p style={s.cardSubtitle}>
          Sign in to your seller account to continue
        </p>
      </div>

      <div style={s.form}>

        {/* Email */}
        <Field label="Email Address" icon="📧" required error={errors.email}>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            className={`seller-input ${errors.email ? "error" : ""}`}
          />
        </Field>

        {/* Password */}
        <Field label="Password" icon="🔒" required error={errors.password}>
          <div style={s.passwordWrap}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Your seller account password"
              autoComplete="current-password"
              className={`seller-input ${errors.password ? "error" : ""}`}
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
          <a href="/forgot-password" style={s.forgotLink}>
            Forgot password?
          </a>
        </div>

        {/* Server message */}
        <ServerAlert msg={serverMsg} />

        {/* Submit */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading
            ? <><Spinner /> Signing In...</>
            : "Sign In & Continue →"}
        </button>

        {/* Switch to register */}
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

        {/* Important note */}
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
          <span style={{ fontSize: "0.8rem", color: passed ? "#10b981" : "#9ca3af" }}>
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
      {icon} {label}
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
  >
    {show ? "🙈" : "👁️"}
  </button>
);

const ServerAlert = ({ msg }) => {
  if (!msg) return null;
  const isError =
    msg.toLowerCase().includes("fail")    ||
    msg.toLowerCase().includes("error")   ||
    msg.toLowerCase().includes("invalid") ||
    msg.toLowerCase().includes("incorrect") ||
    msg.toLowerCase().includes("already") ||
    msg.toLowerCase().includes("cannot");

  return (
    <div className={`seller-alert ${isError ? "error" : "success"}`}>
      {isError ? "⚠️" : "✅"} {msg}
    </div>
  );
};

const Spinner = () => (
  <span style={{
    width:        "18px",
    height:       "18px",
    border:       "3px solid rgba(255,255,255,0.3)",
    borderTop:    "3px solid white",
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
    marginRight:  "0.4rem",
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
  headerIcon:   { fontSize: "3rem", marginBottom: "0.75rem" },
  cardTitle:    { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: 0 },
  cardSubtitle: { color: "#6b7280", marginTop: "0.4rem", fontSize: "0.95rem" },

  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },

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
  strengthBar:     { display: "flex", gap: "3px", flex: 1 },
  strengthSegment: {
    height:       "4px",
    flex:         1,
    borderRadius: "100px",
    transition:   "background 0.3s ease",
  },
  strengthLabel: { fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" },

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
  },

  forgotLink: {
    color:          "#6366f1",
    fontSize:       "0.85rem",
    fontWeight:     600,
    textDecoration: "none",
  },

  // ✅ Note box — replaces the "skip" button
  // Seller step 0 (REGISTER) should NOT allow skipping
  // without authentication
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