// components/seller/RegisterStep.jsx
import React from "react";

// ─── Password Strength Calculator ────────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8)          score++;
  if (password.length >= 12)         score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { score: 0, label: "",          color: ""        },
    { score: 1, label: "Weak",      color: "#ef4444" },
    { score: 2, label: "Fair",      color: "#f59e0b" },
    { score: 3, label: "Good",      color: "#3b82f6" },
    { score: 4, label: "Strong",    color: "#10b981" },
    { score: 5, label: "Very Strong", color: "#059669" },
  ];

  return levels[Math.min(score, 5)];
};

// ─── Component ────────────────────────────────────────────────
const RegisterStep = ({ flow }) => {
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

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.cardHeader}>
        <div style={s.headerIcon}>👤</div>
        <h2 style={s.cardTitle}>Create Your Account</h2>
        <p style={s.cardSubtitle}>
          Join thousands of sellers already growing with us
        </p>
      </div>

      {/* ── Form ───────────────────────────────────────────── */}
      <div style={s.form}>

        {/* Full Name */}
        <Field
          label="Full Name"
          icon="👤"
          required
          error={errors.name}
        >
          <input
            name="name"
            type="text"
            value={registerData.name}
            onChange={handleRegisterChange}
            placeholder="John Doe"
            autoComplete="name"
            className={`seller-input ${errors.name ? "error" : ""}`}
          />
        </Field>

        {/* Email */}
        <Field
          label="Email Address"
          icon="📧"
          required
          error={errors.email}
        >
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
          hint="Include country code, e.g. +1 234 567 8900"
        >
          <input
            name="phone"
            type="tel"
            value={registerData.phone}
            onChange={handleRegisterChange}
            placeholder="+1 234 567 8900"
            autoComplete="tel"
            className={`seller-input ${errors.phone ? "error" : ""}`}
          />
        </Field>

        {/* Password */}
        <Field
          label="Password"
          icon="🔒"
          required
          error={errors.password}
        >
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
            <button
              type="button"
              style={s.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Strength meter */}
          {registerData.password && (
            <div style={s.strengthWrap}>
              <div style={s.strengthBar}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      ...s.strengthSegment,
                      background: i <= strength.score
                        ? strength.color
                        : "#e5e7eb",
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
          )}

          {/* Rules checklist */}
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
            <button
              type="button"
              style={s.eyeBtn}
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Match indicator */}
          {registerData.confirm_password && (
            <span style={{
              fontSize:   "0.8rem",
              fontWeight: 500,
              color: registerData.password === registerData.confirm_password
                ? "#10b981"
                : "#ef4444",
            }}>
              {registerData.password === registerData.confirm_password
                ? "✓ Passwords match"
                : "✗ Passwords do not match"}
            </span>
          )}
        </Field>

        {/* Server message */}
        {serverMsg && (
          <div className={`seller-alert ${
            serverMsg.toLowerCase().includes("fail") ||
            serverMsg.toLowerCase().includes("error")
              ? "error" : "success"
          }`}>
            {serverMsg}
          </div>
        )}

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

        {/* Already have account */}
        <p style={s.loginLink}>
          Already have an account?{" "}
          <a href="/login" style={s.link}>Sign in instead</a>
        </p>

        {/* Divider */}
        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <div style={s.dividerLine} />
        </div>

        {/* Skip if already have account */}
        <button
          type="button"
          onClick={() => setStep(1)}
          style={s.skipBtn}
        >
          Already registered? Skip to Store Setup →
        </button>

      </div>
    </div>
  );
};

// ─── Password Rules Checklist ─────────────────────────────────
const RULES = [
  { test: (p) => p.length >= 8,          label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p),        label: "One uppercase letter"  },
  { test: (p) => /[0-9]/.test(p),        label: "One number"            },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
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

// ─── Field Wrapper ────────────────────────────────────────────
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

// ─── Spinner ──────────────────────────────────────────────────
const Spinner = () => (
  <span style={{
    width:        "18px",
    height:       "18px",
    border:       "3px solid rgba(255,255,255,0.3)",
    borderTop:    "3px solid white",
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
  }} />
);

// ─── Styles ───────────────────────────────────────────────────
const s = {
  cardHeader: {
    textAlign:    "center",
    marginBottom: "2rem",
    paddingBottom: "1.5rem",
    borderBottom: "1px solid #f3f4f6",
  },
  headerIcon:  { fontSize: "3rem", marginBottom: "0.75rem" },
  cardTitle:   { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: 0 },
  cardSubtitle:{ color: "#6b7280", marginTop: "0.4rem", fontSize: "0.95rem" },

  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },

  // Password
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

  // Strength meter
  strengthWrap: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.75rem",
    marginTop:  "0.5rem",
  },
  strengthBar: {
    display: "flex",
    gap:     "3px",
    flex:    1,
  },
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

  // Rules checklist
  rulesWrap: {
    display:       "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:           "0.35rem",
    marginTop:     "0.5rem",
    padding:       "0.75rem",
    background:    "#f8fafc",
    borderRadius:  "10px",
  },
  ruleRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.4rem",
  },

  // Footer
  loginLink: {
    textAlign:  "center",
    color:      "#6b7280",
    fontSize:   "0.9rem",
    margin:     "0.5rem 0",
  },
  link: {
    color:          "#6366f1",
    fontWeight:     600,
    textDecoration: "none",
  },
  divider: {
    display:    "flex",
    alignItems: "center",
    gap:        "1rem",
    margin:     "0.5rem 0",
  },
  dividerLine: {
    flex:       1,
    height:     "1px",
    background: "#e5e7eb",
  },
  dividerText: { color: "#9ca3af", fontSize: "0.85rem" },
  skipBtn: {
    background:  "none",
    border:      "2px dashed #e5e7eb",
    borderRadius: "14px",
    color:       "#9ca3af",
    padding:     "0.875rem",
    cursor:      "pointer",
    fontSize:    "0.875rem",
    fontWeight:  500,
    width:       "100%",
    transition:  "all 0.2s ease",
  },
};

export default RegisterStep;