/**
 * src/pages/ForgotPassword.jsx
 * Route: /forgot-password
 *
 * Flow:
 *   1. email → enter email, send OTP
 *   2. otp   → verify 6-digit code
 *
 * On success → navigate to /reset-password with { reset_token, email }
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/ForgotPassword.css";

/* ── Config ─────────────────────────────────────────────────── */
const API = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const ATTEMPTS_WARN_THRESHOLD = 4;
const LOCKOUT_REDIRECT_DELAY = 1000;

/* ── Utilities ──────────────────────────────────────────────── */

/**
 * Masks an email for privacy display.
 * "johndoe@gmail.com" → "jo****e@gmail.com"
 * "ab@test.co"        → "a***b@test.co"
 */
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

/* ── Icons ──────────────────────────────────────────────────── */
const Icons = {
  Mail: ({ size = 17, color = "currentColor" }) => (
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
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
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

  Refresh: ({ size = 14 }) => (
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
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
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

  Lock: ({ size = 12, color = "currentColor" }) => (
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

  Check: ({ size = 12, color = "currentColor" }) => (
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

  Key: ({ size = 80 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF5C00"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  ),
};

/* ── Spinner ────────────────────────────────────────────────── */
function Spinner({ color = "#fff" }) {
  return (
    <svg
      className="fp-spinner"
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
    { icon: <Icons.Lock size={12} color="#7a756f" />, label: "Encrypted" },
    { icon: <Icons.Check size={12} color="#7a756f" />, label: "GDPR" },
  ];

  return (
    <div className="fp-badges" aria-label="Security certifications">
      {badges.map((badge) => (
        <span key={badge.label} className="fp-badge">
          {badge.icon}
          {badge.label}
        </span>
      ))}
    </div>
  );
}

/* ── Countdown Timer ────────────────────────────────────────── */
function Countdown({ seconds, resendKey, onDone }) {
  const [remaining, setRemaining] = useState(seconds);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    setRemaining(seconds);
    if (seconds <= 0) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDoneRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, resendKey]);

  const isWarning = remaining <= 10;

  return (
    <span
      className={`fp-countdown ${isWarning ? "fp-countdown--warn" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {remaining}s
    </span>
  );
}

/* ── OTP Input Cells ────────────────────────────────────────── */
function OtpCells({ value, onChange, disabled, hasError, resetKey }) {
  const inputRefs = useRef([]);

  useEffect(() => {
    const timeout = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(timeout);
  }, [resetKey]);

  const getChar = (index) => value[index] ?? "";

  const updateChar = (index, char) => {
    const chars = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");
    chars[index] = char;
    onChange(chars.join(""));
  };

  const handleChange = (index, e) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    updateChar(index, digit);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    switch (e.key) {
      case "Backspace":
        e.preventDefault();
        if (getChar(index)) {
          updateChar(index, "");
        } else if (index > 0) {
          updateChar(index - 1, "");
          inputRefs.current[index - 1]?.focus();
        }
        break;
      case "ArrowLeft":
        if (index > 0) inputRefs.current[index - 1]?.focus();
        break;
      case "ArrowRight":
        if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
        break;
      default:
        break;
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    const result = Array.from(
      { length: OTP_LENGTH },
      (_, i) => digits[i] ?? ""
    ).join("");
    onChange(result);
    const focusIndex = Math.min(digits.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div
      className={`fp-otp-group ${hasError ? "fp-otp-group--error" : ""}`}
      role="group"
      aria-label="Reset code input"
    >
      {Array.from({ length: OTP_LENGTH }).map((_, index) => {
        const filled = Boolean(getChar(index));
        const cellClass = [
          "fp-otp-cell",
          filled ? "fp-otp-cell--filled" : "",
          hasError ? "fp-otp-cell--error" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={getChar(index)}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            aria-invalid={hasError}
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={cellClass}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            onPaste={handlePaste}
          />
        );
      })}
    </div>
  );
}

/* ── Left Panel (Branding) ──────────────────────────────────── */
function LeftPanel({ currentStep }) {
  const steps = [
    { number: "1", label: "Enter your email" },
    { number: "2", label: "Verify the OTP code" },
    { number: "3", label: "Set a new password" },
  ];

  const getStepStatus = (stepNumber) => {
    const stepMap = { email: 1, otp: 2 };
    const current = stepMap[currentStep] || 1;
    const num = parseInt(stepNumber, 10);
    if (num < current) return "completed";
    if (num === current) return "active";
    return "upcoming";
  };

  return (
    <div className="fp-left" aria-hidden="true">
      <div className="fp-blob fp-blob--1" />
      <div className="fp-blob fp-blob--2" />

      <div className="fp-left__inner">
        {/* Logo */}
        <Link to="/auth" className="fp-logo" tabIndex={-1}>
          <div className="fp-logo__icon">
            <div className="fp-logo__ring" />
            <div className="fp-logo__bag">
              <div className="fp-logo__pin" />
            </div>
          </div>
          <span className="fp-logo__name">
            Loe<b>mart</b>
          </span>
        </Link>

        {/* Illustration */}
        <div className="fp-illustration">
          <div className="fp-illustration__circle">
            <Icons.Key size={80} />
          </div>
          <h2 className="fp-illustration__title">
            Reset your
            <br />
            <em>password</em>
          </h2>
          <p className="fp-illustration__text">
            Enter the email linked to your Loemart account. We'll send a secure
            6-digit code to verify it's really you.
          </p>
        </div>

        {/* Progress Steps */}
        <nav className="fp-progress" aria-label="Password reset steps">
          {steps.map((step) => {
            const status = getStepStatus(step.number);
            return (
              <div
                key={step.number}
                className={`fp-progress__step fp-progress__step--${status}`}
              >
                <div className="fp-progress__number">
                  {status === "completed" ? (
                    <Icons.Check size={12} color="#fff" />
                  ) : (
                    step.number
                  )}
                </div>
                <div className="fp-progress__label">{step.label}</div>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ── Error Message ──────────────────────────────────────────── */
function ErrorMessage({ message, attemptsLeft }) {
  if (!message) return null;

  return (
    <div className="fp-error" role="alert" aria-live="assertive">
      <span className="fp-error__text">{message}</span>
      {attemptsLeft !== null && attemptsLeft <= ATTEMPTS_WARN_THRESHOLD && (
        <span className="fp-error__attempts">
          {attemptsLeft === 0
            ? "No attempts remaining — request a new code."
            : `${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining`}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function ForgotPassword() {
  const navigate = useNavigate();

  /* State */
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpHasError, setOtpHasError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [resendKey, setResendKey] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);

  const verifyingRef = useRef(false);
  const lockoutTimerRef = useRef(null);

  /* Cleanup lockout timer on unmount */
  useEffect(() => {
    return () => {
      if (lockoutTimerRef.current) {
        clearTimeout(lockoutTimerRef.current);
        lockoutTimerRef.current = null;
      }
    };
  }, []);

  /* Masked email for display */
  const maskedEmail = maskEmail(email);

  /* ── Verify OTP ───────────────────────────────────────────── */
  const handleVerifyOtp = useCallback(
    async (code) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setError("");
      setLoading(true);

      try {
        const { data } = await axios.post(`${API}/forgot-password/verify`, {
          email,
          otp: code,
        });

        toast.success("Code verified successfully!");

        navigate("/reset-password", {
          state: {
            reset_token: data.reset_token,
            email,
          },
        });
      } catch (err) {
        const msg = err.response?.data?.message || "Incorrect code. Try again.";
        const remaining = err.response?.data?.attemptsLeft;
        const errorCode = err.response?.data?.code;

        setOtpHasError(true);
        setError(msg);
        setOtp("");

        if (typeof remaining === "number") {
          setAttemptsLeft(remaining);
        }

        setTimeout(() => setOtpHasError(false), 700);

        if (errorCode === "OTP_LOCKED") {
          lockoutTimerRef.current = setTimeout(() => {
            lockoutTimerRef.current = null;
            verifyingRef.current = false;
            setStep("email");
            setError("Too many incorrect attempts. Please request a new code.");
            setDevOtp("");
            setLoading(false);
            setAttemptsLeft(null);
            setCanResend(false);
          }, LOCKOUT_REDIRECT_DELAY);
          return;
        }
      } finally {
        if (verifyingRef.current) {
          verifyingRef.current = false;
          setLoading(false);
        }
      }
    },
    [email, navigate]
  );

  /* Auto-submit when all 6 digits entered */
  useEffect(() => {
    if (
      otp.length === OTP_LENGTH &&
      step === "otp" &&
      !verifyingRef.current
    ) {
      handleVerifyOtp(otp);
    }
  }, [otp, step, handleVerifyOtp]);

  /* ── Send OTP ─────────────────────────────────────────────── */
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError("");

    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setError("Please enter your email address.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(cleaned)) {
      setError("Please enter a valid email address.");
      return;
    }

    setEmail(cleaned);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/forgot-password`, {
        email: cleaned,
      });

      if (data.dev_otp) {
        setDevOtp(String(data.dev_otp));
        toast(`Dev OTP: ${data.dev_otp}`, { icon: "🔑", duration: 30000 });
      }

      toast.success("Verification code sent to your email.");

      setStep("otp");
      setCanResend(false);
      setResendKey((k) => k + 1);
      setOtp("");
      setOtpHasError(false);
      setAttemptsLeft(null);
      setError("");
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Too many requests. Please wait before trying again.");
      } else {
        setError(err.response?.data?.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend OTP ───────────────────────────────────────────── */
  const handleResend = async () => {
    setOtp("");
    setOtpHasError(false);
    setError("");
    setDevOtp("");
    setAttemptsLeft(null);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/forgot-password`, { email });

      if (data.dev_otp) {
        setDevOtp(String(data.dev_otp));
        toast(`Dev OTP: ${data.dev_otp}`, { icon: "🔑", duration: 30000 });
      }

      toast.success("New verification code sent!");
      setCanResend(false);
      setResendKey((k) => k + 1);
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Too many requests. Please wait before trying again.");
      } else {
        setError(err.response?.data?.message || "Failed to resend code.");
      }
      setCanResend(true);
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset to email step ──────────────────────────────────── */
  const handleBackToEmail = () => {
    /* Clear lockout timer if active */
    if (lockoutTimerRef.current) {
      clearTimeout(lockoutTimerRef.current);
      lockoutTimerRef.current = null;
    }

    setStep("email");
    setOtp("");
    setOtpHasError(false);
    setError("");
    setDevOtp("");
    setAttemptsLeft(null);
    setCanResend(false);
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER — OTP STEP
  ═══════════════════════════════════════════════════════════ */
  if (step === "otp") {
    return (
      <div className="fp">
        <LeftPanel currentStep="otp" />

        <main className="fp-right">
          <div className="fp-right__scroll">
            <div className="fp-card">
              {/* Header */}
              <header className="fp-otp-header">
                <div className="fp-otp-header__icon">
                  <Icons.Mail size={28} color="#fff" />
                </div>

                <h1 className="fp-otp-header__title">Enter reset code</h1>

                <p className="fp-otp-header__subtitle">
                  We sent a 6-digit code to{" "}
                  <strong className="fp-masked-email" title="Masked for privacy">
                    {maskedEmail}
                  </strong>
                  <br />
                  Enter it below to continue.
                </p>
              </header>

              {/* Dev OTP Banner */}
              {devOtp && (
                <div className="fp-dev-banner" role="status">
                  Dev mode — code: <strong>{devOtp}</strong>
                </div>
              )}

              {/* OTP Input */}
              <OtpCells
                key={resendKey}
                value={otp}
                onChange={setOtp}
                disabled={loading}
                hasError={otpHasError}
                resetKey={resendKey}
              />

              <p className="fp-otp-hint" id="otp-hint">
                Auto-submits when all {OTP_LENGTH} digits are entered
              </p>

              {/* Error */}
              <ErrorMessage message={error} attemptsLeft={attemptsLeft} />

              {/* Loading */}
              {loading && (
                <div className="fp-verifying" role="status" aria-live="polite">
                  <Spinner color="#FF5C00" />
                  <span>Verifying…</span>
                </div>
              )}

              {/* Resend / Back */}
              <div className="fp-otp-actions">
                <div className="fp-otp-actions__resend">
                  {canResend ? (
                    <button
                      type="button"
                      className="fp-link-btn"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      <Icons.Refresh size={13} />
                      Resend code
                    </button>
                  ) : (
                    <span className="fp-resend-timer">
                      Resend in{" "}
                      <Countdown
                        key={resendKey}
                        seconds={RESEND_SECONDS}
                        resendKey={resendKey}
                        onDone={() => setCanResend(true)}
                      />
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="fp-link-btn fp-link-btn--muted"
                  onClick={handleBackToEmail}
                >
                  <Icons.ArrowLeft size={14} />
                  Change email
                </button>
              </div>

              <SecurityBadges />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER — EMAIL STEP
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="fp">
      <LeftPanel currentStep="email" />

      <main className="fp-right">
        <div className="fp-right__scroll">
          <div className="fp-card">
            {/* Header */}
            <header className="fp-email-header">
              <Link to="/auth" className="fp-link-btn fp-link-btn--muted">
                <Icons.ArrowLeft size={15} />
                Back to login
              </Link>

              <h1 className="fp-email-header__title">
                Forgot your password?
              </h1>

              <p className="fp-email-header__subtitle">
                Enter your account email and we'll send you a{" "}
                <strong>6-digit reset code</strong>.
              </p>
            </header>

            {/* Error */}
            <ErrorMessage message={error} attemptsLeft={null} />

            {/* Form */}
            <form
              onSubmit={handleSendOtp}
              className="fp-form"
              noValidate
            >
              <div className="fp-field">
                <label className="fp-field__label" htmlFor="fp-email">
                  Email address
                </label>

                <div className="fp-field__input-wrap">
                  <span className="fp-field__icon" aria-hidden="true">
                    <Icons.Mail />
                  </span>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    required
                    aria-required="true"
                    aria-describedby={error ? "fp-email-error" : undefined}
                    className="fp-field__input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="fp-submit"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Sending code…
                  </>
                ) : (
                  <>
                    Send reset code
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