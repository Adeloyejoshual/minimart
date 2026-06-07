// components/seller/RegisterStep.jsx
import React, { useState, useCallback } from "react";
import axios from "axios";
import { STEPS, SELLER_TOKEN_KEY } from "../../hooks/useSellerFlow";

// ─────────────────────────────────────────────────────────────
// TOKEN HELPERS — must match useSellerFlow + SellerDashboard
// ─────────────────────────────────────────────────────────────
const getToken   = ()    => localStorage.getItem(SELLER_TOKEN_KEY);
const saveToken  = (t)   => localStorage.setItem(SELLER_TOKEN_KEY, t);

// ─────────────────────────────────────────────────────────────
// Map vendor status → step
// ─────────────────────────────────────────────────────────────
const STATUS_TO_STEP = {
  pending:      STEPS.VERIFICATION,
  under_review: STEPS.REVIEW,
  approved:     STEPS.APPROVED,
  active:       STEPS.APPROVED,
  rejected:     STEPS.STORE_SETUP,
  suspended:    STEPS.APPROVED,
};

// ─────────────────────────────────────────────────────────────
// PASSWORD STRENGTH
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
// ─────────────────────────────────────────────────────────────
const RegisterStep = ({ flow }) => {
  const [mode, setMode] = useState("register");

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
            <>
              <StrengthMeter strength={strength} />
              <PasswordRules password={registerData.password} />
            </>
          )}
        </Field>

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

        {serverErr && <ServerAlert msg={serverErr} isError />}
        {serverMsg && <ServerAlert msg={serverMsg} />}

        <button
          onClick={submitRegister}
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading
            ? <><Spinner /> Creating Account...</>
            : "Create Account & Continue →"}
        </button>

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
  const [isError,      setIsError]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setErrors((p)   => ({ ...p, [name]: ""    }));
    setServerMsg("");
    setIsError(false);
  }, []);

  const validate = () => {
    const errs    = {};
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim())
      errs.email = "Email is required";
    else if (!emailRx.test(formData.email))
      errs.email = "Enter a valid email address";

    if (!formData.password)
      errs.password = "Password is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);
    setServerMsg("");
    setIsError(false);

    try {
      // ── Step 1: Login ──────────────────────────────────
      const { data: loginData } = await axios.post(
        "/api/auth/login",
        {
          email:    formData.email.trim().toLowerCase(),
          password: formData.password,
        }
      );

      if (!loginData.token) {
        setIsError(true);
        setServerMsg("Login failed — no token received.");
        return;
      }

      // ✅ CRITICAL FIX: save as "seller_token" not "token"
      // This is what SellerDashboard reads via getSellerToken()
      saveToken(loginData.token);

      // ── Step 2: Fetch vendor status ────────────────────
      try {
        const { data: statusData } = await axios.get(
          "/api/seller-onboarding/status",
          {
            headers:  { Authorization: `Bearer ${loginData.token}` },
            timeout:  10_000,
          }
        );

        if (statusData?.vendor) {
          const { status } = statusData.vendor;

          // Update vendor data in parent hook
          if (typeof setVendorData === "function") {
            setVendorData(statusData.vendor);
          }

          // Approved / active → navigate to dashboard
          if (["active", "approved"].includes(status)) {
            setServerMsg("Welcome back! Redirecting to dashboard…");
            // Small delay so user sees the message
            setTimeout(() => {
              window.location.replace("/seller/dashboard");
            }, 800);
            return;
          }

          // Other statuses → go to correct step
          const nextStep =
            STATUS_TO_STEP[status] ?? STEPS.STORE_SETUP;
          setStep(nextStep);

        } else {
          // No vendor yet → store setup
          setStep(STEPS.STORE_SETUP);
        }

      } catch (statusErr) {
        const httpStatus = statusErr.response?.status;
        const code       = statusErr.response?.data?.code;

        if (httpStatus === 404) {
          // Logged in, no vendor yet
          setStep(STEPS.STORE_SETUP);
        } else if (httpStatus === 403 && code === "NOT_SELLER_ACCOUNT") {
          // They logged in with a marketplace account
          // Clear the wrong token and show error
          localStorage.removeItem(SELLER_TOKEN_KEY);
          setIsError(true);
          setServerMsg(
            "This is a marketplace account. "
            + "Please create a separate seller account."
          );
        } else {
          // Status check failed — still go to store setup
          console.warn("[SignIn] status check failed:", statusErr.message);
          setStep(STEPS.STORE_SETUP);
        }
      }

    } catch (err) {
      const msg = err.response?.data?.message;
      const status = err.response?.status;

      if (status === 401) {
        setServerMsg("Incorrect email or password.");
      } else if (status === 403) {
        setServerMsg(
          "Access denied. Make sure you are using your seller credentials."
        );
      } else {
        setServerMsg(msg ?? "Sign in failed. Please try again.");
      }
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

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

        <div style={{ textAlign: "right", marginTop: "-0.5rem" }}>
          <a href="/forgot-password" style={s.forgotLink}>
            Forgot password?
          </a>
        </div>

        {serverMsg && (
          <ServerAlert msg={serverMsg} isError={isError} />
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading
            ? <><Spinner /> Signing In...</>
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
            🔒 <strong>Seller accounts are separate</strong> from
            your marketplace account. Use your seller email and
            password here.
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
      {[1,2,3,4,5].map((i) => (
        <div
          key={i}
          style={{
            ...s.strengthSegment,
            background: i <= strength.score
              ? strength.color : "#e5e7eb",
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
    fontSize:  "0.8rem",
    fontWeight:500,
    color:     a === b ? "#10b981" : "#ef4444",
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
      <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
        {hint}
      </span>
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
    verticalAlign:"middle",
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
  cardTitle:    {
    fontSize:  "1.5rem",
    fontWeight:800,
    color:     "#1f2937",
    margin:    0,
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
  strengthBar:     { display: "flex", gap: "3px", flex: 1 },
  strengthSegment: {
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
  forgotLink: {
    color:          "#6366f1",
    fontSize:       "0.85rem",
    fontWeight:     600,
    textDecoration: "none",
  },
  noteBox: {
    background:   "#fffbeb",
    border:       "1px solid #fde68a",
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
  },
  noteText: {
    color:     "#92400e",
    fontSize:  "0.82rem",
    lineHeight:1.5,
    margin:    0,
  },
};

export default RegisterStep;