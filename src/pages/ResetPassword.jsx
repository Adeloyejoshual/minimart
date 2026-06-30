/**
 * src/pages/ResetPassword.jsx
 * Route: /reset-password
 *
 * Receives via navigate state:
 *   { reset_token, email }
 *
 * Steps:
 *   password — enter + confirm new password
 *   done     — success screen + auto-login countdown
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/ResetPassword.css";

/* ── Config ─────────────────────────────────────────────────── */
const API = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;
const AUTO_LOGIN_SECONDS = 3;
const MIN_STRENGTH_SCORE = 3;

/* ── Utility: mask email for display ────────────────────────── */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;

  const [local, domain] = email.split("@");

  if (local.length <= 2) {
    return `${local[0]}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }

  const first = local[0];
  const last = local[local.length - 1];
  const masked = "•".repeat(Math.min(local.length - 2, 5));

  return `${first}${masked}${last}@${domain}`;
}

/* ── Password Strength ──────────────────────────────────────── */
const STRENGTH_LEVELS = [
  { score: 0, label: "",        color: "transparent" },
  { score: 1, label: "Weak",    color: "#EF4444"     },
  { score: 2, label: "Fair",    color: "#F59E0B"     },
  { score: 3, label: "Good",    color: "#FF8040"     },
  { score: 4, label: "Strong",  color: "#15803D"     },
];

const PASSWORD_CHECKS = [
  { label: "8+ characters", test: (pw) => pw.length >= 8         },
  { label: "Uppercase",     test: (pw) => /[A-Z]/.test(pw)       },
  { label: "Number",        test: (pw) => /[0-9]/.test(pw)       },
  { label: "Symbol",        test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function getStrength(password) {
  if (!password) return { ...STRENGTH_LEVELS[0], checks: [] };

  const checks = PASSWORD_CHECKS.map((c) => ({
    label: c.label,
    met: c.test(password),
  }));

  const score = checks.filter((c) => c.met).length;
  return { ...STRENGTH_LEVELS[score], checks };
}

/* ── Icons ──────────────────────────────────────────────────── */
const Icons = {
  Lock: ({ size = 17, color = "currentColor" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),

  Eye: ({ size = 17 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),

  EyeOff: ({ size = 17 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),

  Check: ({ size = 14, color = "currentColor" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),

  ArrowRight: ({ size = 17 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),

  ArrowLeft: ({ size = 16 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),

  Key: ({ size = 26, color = "currentColor" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  ),

  Shield: ({ size = 12, color = "currentColor" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

/* ── Spinner ────────────────────────────────────────────────── */
function Spinner({ color = "#fff" }) {
  return (
    <svg
      className="rp-spinner"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      role="status"
      aria-label="Loading"
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

/* ── Security Badges ────────────────────────────────────────── */
function SecurityBadges() {
  const badges = [
    { icon: <Icons.Shield size={12} color="#7a756f" />, label: "SSL Secured" },
    { icon: <Icons.Lock   size={12} color="#7a756f" />, label: "Encrypted"   },
    { icon: <Icons.Check  size={12} color="#7a756f" />, label: "GDPR"        },
  ];

  return (
    <div className="rp-badges" aria-label="Security certifications">
      {badges.map((badge) => (
        <span key={badge.label} className="rp-badge">
          {badge.icon}
          {badge.label}
        </span>
      ))}
    </div>
  );
}

/* ── Strength Meter ─────────────────────────────────────────── */
function StrengthMeter({ password }) {
  const strength = useMemo(() => getStrength(password), [password]);

  return (
    <div className="rp-strength" role="status" aria-live="polite">
      {/* Bar track */}
      <div className="rp-strength__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`rp-strength__bar ${
              strength.score >= level ? "rp-strength__bar--active" : ""
            }`}
            style={
              strength.score >= level
                ? { backgroundColor: strength.color }
                : {}
            }
          />
        ))}
      </div>

      {/* Label — only show when actively typing */}
      {password && (
        <span
          className="rp-strength__label"
          style={{ color: strength.color }}
          aria-label={`Password strength: ${strength.label}`}
        >
          {strength.label}
        </span>
      )}

      {/* Checklist — always visible, items animate as met */}
      <div className="rp-strength__checks" role="list">
        {strength.checks.length > 0
          ? strength.checks.map((check) => (
              <span
                key={check.label}
                role="listitem"
                className={`rp-strength__check ${
                  check.met
                    ? "rp-strength__check--met"
                    : "rp-strength__check--unmet"
                }`}
                aria-label={`${check.label}: ${check.met ? "passed" : "not yet"}`}
              >
                {check.met ? (
                  <Icons.Check size={9} color="#15803D" />
                ) : (
                  <span className="rp-strength__dot" aria-hidden="true" />
                )}
                {check.label}
              </span>
            ))
          : PASSWORD_CHECKS.map((c) => (
              <span
                key={c.label}
                role="listitem"
                className="rp-strength__check rp-strength__check--unmet"
                aria-label={`${c.label}: not yet`}
              >
                <span className="rp-strength__dot" aria-hidden="true" />
                {c.label}
              </span>
            ))}
      </div>
    </div>
  );
}

/* ── Password Field ─────────────────────────────────────────── */
function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  showStrength = false,
  autoComplete = "new-password",
  placeholder  = "Password",
  matchState   = null,   // true | false | null
  describedBy,
  inputRef,
  onSubmit,
}) {
  const hasError = matchState === false;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="rp-field">
      <label className="rp-field__label" htmlFor={id}>
        {label}
      </label>

      <div className={`rp-field__wrap ${hasError ? "rp-field__wrap--error" : ""}`}>
        <span className="rp-field__icon">
          <Icons.Lock />
        </span>

        <input
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className="rp-field__input"
        />

        <button
          type="button"
          className="rp-field__toggle"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <Icons.EyeOff /> : <Icons.Eye />}
        </button>
      </div>

      {/* Match feedback */}
      {matchState === true && (
        <p className="rp-field__match rp-field__match--ok" role="status">
          <Icons.Check size={12} color="#15803D" />
          Passwords match
        </p>
      )}
      {matchState === false && (
        <p
          className="rp-field__match rp-field__match--error"
          role="alert"
          id={describedBy}
        >
          Passwords do not match
        </p>
      )}

      {/* Strength meter — always shows checklist when this is the new-pw field */}
      {showStrength && <StrengthMeter password={value} />}
    </div>
  );
}

/* ── Left Panel ─────────────────────────────────────────────── */
function LeftPanel() {
  const passwordTips = [
    "Use at least 8 characters",
    "Mix uppercase and lowercase",
    "Add numbers and symbols",
    "Avoid common words or phrases",
  ];

  return (
    <div className="rp-left" aria-hidden="true">
      <div className="rp-blob rp-blob--1" />
      <div className="rp-blob rp-blob--2" />

      <div className="rp-left__inner">
        {/* Logo */}
        <Link to="/auth" className="rp-logo" tabIndex={-1}>
          <div className="rp-logo__icon">
            <div className="rp-logo__ring" />
            <div className="rp-logo__bag">
              <div className="rp-logo__pin" />
            </div>
          </div>
          <span className="rp-logo__name">
            Loe<b>mart</b>
          </span>
        </Link>

        {/* Illustration */}
        <div className="rp-illustration">
          <div className="rp-illustration__circle">
            <Icons.Key size={80} color="#FF5C00" />
          </div>
          <h2 className="rp-illustration__title">
            Almost
            <br />
            <em>there!</em>
          </h2>
          <p className="rp-illustration__text">
            Create a strong new password to secure your Loemart account.
            You'll be logged in automatically when you're done.
          </p>
        </div>

        {/* Password Tips */}
        <div className="rp-tips">
          <p className="rp-tips__heading">Password tips</p>
          <ul className="rp-tips__list">
            {passwordTips.map((tip) => (
              <li key={tip} className="rp-tips__item">
                <Icons.Check size={12} color="#FF5C00" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Error Message ──────────────────────────────────────────── */
function ErrorMessage({ message, children }) {
  if (!message && !children) return null;
  return (
    <div className="rp-error" role="alert" aria-live="assertive">
      {message && <span className="rp-error__text">{message}</span>}
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function ResetPassword({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  /* ── Route state ──────────────────────────────────────────── */
  const resetToken  = location.state?.reset_token ?? "";
  const emailFromFP = location.state?.email       ?? "";
  const redirectTo  = location.state?.from?.pathname ?? "/";
  const maskedEmail = maskEmail(emailFromFP);

  /* ── Local state ──────────────────────────────────────────── */
  const [step,            setStep]            = useState("password");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [loginCountdown,  setLoginCountdown]  = useState(AUTO_LOGIN_SECONDS);

  /* Stores user + token after successful reset for skip & countdown */
  const [authResult, setAuthResult] = useState(null);

  /* ── Refs ─────────────────────────────────────────────────── */
  const countdownRef   = useRef(null);
  const confirmRef     = useRef(null);
  const allMetPrevRef  = useRef(false);

  /* ── Derived ──────────────────────────────────────────────── */
  const strength = useMemo(() => getStrength(password), [password]);
  const matchState = confirmPassword
    ? password === confirmPassword
    : null;
  const allChecksMet = strength.checks.length > 0
    && strength.checks.every((c) => c.met);

  /* ── Guard: redirect if no token ─────────────────────────── */
  useEffect(() => {
    if (!resetToken) {
      toast.error("Invalid or expired reset link.");
      navigate("/forgot-password", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cleanup countdown on unmount ────────────────────────── */
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  /* ── Auto-focus confirm field when all checks met ────────── */
  useEffect(() => {
    if (allChecksMet && !allMetPrevRef.current) {
      confirmRef.current?.focus();
    }
    allMetPrevRef.current = allChecksMet;
  }, [allChecksMet]);

  /* ── Auto-login countdown ─────────────────────────────────── */
  const startLoginCountdown = useCallback(
    (user, token) => {
      setAuthResult({ user, token });
      setLoginCountdown(AUTO_LOGIN_SECONDS);

      countdownRef.current = setInterval(() => {
        setLoginCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            setUser(user, token, navigate, redirectTo);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [setUser, navigate, redirectTo]
  );

  /* ── Skip countdown — immediately authenticate ───────────── */
  const handleSkipCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (authResult) {
      setUser(authResult.user, authResult.token, navigate, redirectTo);
    } else {
      navigate(redirectTo, { replace: true });
    }
  }, [authResult, setUser, navigate, redirectTo]);

  /* ── Submit ───────────────────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    setError("");

    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (strength.score < MIN_STRENGTH_SCORE) {
      setError("Password is too weak. Please meet all requirements.");
      return;
    }
    if (!confirmPassword) {
      setError("Please confirm your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/reset-password`, {
        reset_token: resetToken,
        password,
      });

      toast.success("Password reset! Logging you in…");
      setStep("done");
      startLoginCountdown(data.user, data.token);
    } catch (err) {
      if (err.response?.status === 400) {
        setError("Reset link has expired. Please request a new one.");
      } else {
        setError(
          err.response?.data?.message || "Reset failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    password,
    confirmPassword,
    strength.score,
    resetToken,
    startLoginCountdown,
  ]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSubmit();
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER — DONE STEP
  ═══════════════════════════════════════════════════════════ */
  if (step === "done") {
    const progress =
      ((AUTO_LOGIN_SECONDS - loginCountdown) / AUTO_LOGIN_SECONDS) * 100;

    return (
      <div className="rp">
        <LeftPanel />

        <main className="rp-right">
          <div className="rp-right__scroll">
            <div className="rp-card">

              {/* Success Header */}
              <header className="rp-done__header">
                <div className="rp-done__icon" aria-hidden="true">
                  <Icons.Check size={36} color="#fff" />
                </div>

                <h1 className="rp-done__title">Password updated!</h1>

                <p className="rp-done__subtitle">
                  Your password has been reset successfully.
                  <br />
                  Logging you in in{" "}
                  <strong aria-live="polite">{loginCountdown}s</strong>…
                </p>
              </header>

              {/* Auto-login progress bar */}
              <div
                className="rp-progress-bar"
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Auto-login countdown"
              >
                <div
                  className="rp-progress-bar__fill"
                  style={{
                    width:      `${progress}%`,
                    transition: "width 1s linear",
                  }}
                />
              </div>

              {/* Skip button — now properly authenticates */}
              <button
                type="button"
                className="rp-submit"
                onClick={handleSkipCountdown}
              >
                Continue to Loemart
                <Icons.ArrowRight size={17} />
              </button>

              {/* Manual fallback */}
              <p className="rp-done__fallback">
                <Link to="/auth">Or log in manually</Link>
              </p>

              <SecurityBadges />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER — PASSWORD STEP
  ═══════════════════════════════════════════════════════════ */
  const isTokenExpiredError =
    error.toLowerCase().includes("expired") ||
    error.toLowerCase().includes("invalid");

  return (
    <div className="rp">
      <LeftPanel />

      <main className="rp-right">
        <div className="rp-right__scroll">
          <div className="rp-card">

            {/* Header */}
            <header className="rp-header">
              <Link to="/forgot-password" className="rp-back-btn">
                <Icons.ArrowLeft size={15} />
                Back
              </Link>

              <div className="rp-header__icon" aria-hidden="true">
                <Icons.Key size={26} color="#fff" />
              </div>

              <h1 className="rp-header__title">Set a new password</h1>

              {emailFromFP && (
                <p className="rp-header__subtitle">
                  Setting a new password for{" "}
                  <strong
                    className="rp-header__email"
                    title="Masked for privacy"
                  >
                    {maskedEmail}
                  </strong>
                </p>
              )}
            </header>

            {/* Error with optional CTA */}
            {error && (
              <ErrorMessage>
                <span className="rp-error__text">{error}</span>
                {isTokenExpiredError && (
                  <Link
                    to="/forgot-password"
                    className="rp-error__cta"
                  >
                    Request another reset code
                    <Icons.ArrowRight size={13} />
                  </Link>
                )}
              </ErrorMessage>
            )}

            {/* Form */}
            <form
              onSubmit={handleFormSubmit}
              className="rp-form"
              noValidate
            >
              <PasswordField
                id="rp-new-password"
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                showStrength
                placeholder="Enter new password"
                onSubmit={handleSubmit}
              />

              <PasswordField
                id="rp-confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                visible={showConfirm}
                onToggleVisible={() => setShowConfirm((v) => !v)}
                placeholder="Repeat new password"
                matchState={matchState}
                describedBy="rp-confirm-error"
                inputRef={confirmRef}
                onSubmit={handleSubmit}
              />

              <button
                type="submit"
                className="rp-submit"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Updating password…
                  </>
                ) : (
                  <>
                    Update password
                    <Icons.ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            <SecurityBadges />
          </div>
        </div>
      </main>
    </div>
  );
}