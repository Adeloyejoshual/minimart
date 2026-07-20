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
import { useNavigate, Link }                         from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/ForgotPassword.css";

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const API                    = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;
const OTP_LENGTH             = 6;
const RESEND_SECONDS         = 60;
const ATTEMPTS_WARN_THRESHOLD = 4;
const LOCKOUT_REDIRECT_DELAY  = 1_500;

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
/**
 * Masks an email for privacy display.
 * "johndoe@gmail.com" → "j•••e@gmail.com"
 * "ab@test.co"        → "a•b@test.co"
 */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2)
    return `${local[0]}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
  const masked = "•".repeat(Math.min(local.length - 2, 5));
  return `${local[0]}${masked}${local[local.length - 1]}@${domain}`;
}

const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (e) => EMAIL_RE.test(e);

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
const Ic = {
  Mail: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),

  ArrowLeft: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),

  ArrowRight: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),

  Refresh: ({ s = 13 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),

  Shield: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),

  Lock: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),

  Check: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),

  Key: ({ s = 80 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="#FF5C00" strokeWidth="1.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   ATOMS
════════════════════════════════════════════════════════════ */
function Spinner({ c = "#fff" }) {
  return (
    <svg className="fp-spinner" width="18" height="18"
         viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round"
         role="status" aria-label="Loading">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

function SecurityBadges() {
  return (
    <div className="fp-badges" aria-label="Security certifications">
      <span className="fp-badge"><Ic.Shield s={11} c="#7a756f" /> SSL Secured</span>
      <span className="fp-badge"><Ic.Lock   s={11} c="#7a756f" /> Encrypted</span>
      <span className="fp-badge"><Ic.Check  s={11} c="#7a756f" /> GDPR</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COUNTDOWN
════════════════════════════════════════════════════════════ */
function Countdown({ seconds, resendKey, onDone }) {
  const [remaining, setRemaining] = useState(seconds);
  const onDoneRef                 = useRef(onDone);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    setRemaining(seconds);
    if (seconds <= 0) return;

    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(id); onDoneRef.current?.(); return 0; }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(id);
  }, [seconds, resendKey]);

  return (
    <span
      className={`fp-countdown${remaining <= 10 ? " fp-countdown--warn" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {remaining}s
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   OTP CELLS
════════════════════════════════════════════════════════════ */
function OtpCells({ value, onChange, disabled, hasError, resetKey }) {
  const refs = useRef([]);

  /* Focus first cell whenever the OTP panel mounts or resets */
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, [resetKey]);

  const char   = (i) => value[i] ?? "";
  const update = (i, ch) => {
    const arr = Array.from({ length: OTP_LENGTH }, (_, k) => value[k] ?? "");
    arr[i] = ch;
    onChange(arr.join(""));
  };

  return (
    <div
      className={`fp-otp-group${hasError ? " fp-otp-group--error" : ""}`}
      role="group"
      aria-label="Reset code input"
    >
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={char(i)}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          aria-invalid={hasError}
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={[
            "fp-otp-cell",
            char(i)  ? "fp-otp-cell--filled" : "",
            hasError ? "fp-otp-cell--error"  : "",
          ].filter(Boolean).join(" ")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            update(i, d);
            if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (char(i))  { update(i, ""); }
              else if (i > 0) { update(i - 1, ""); refs.current[i - 1]?.focus(); }
            } else if (e.key === "ArrowLeft"  && i > 0)              refs.current[i - 1]?.focus();
            else if   (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e)  => e.target.select()}
          onPaste={(e)  => {
            e.preventDefault();
            const digits = e.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, OTP_LENGTH);
            const result = Array.from(
              { length: OTP_LENGTH },
              (_, k) => digits[k] ?? ""
            ).join("");
            onChange(result);
            refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LEFT PANEL
════════════════════════════════════════════════════════════ */
function LeftPanel({ currentStep }) {
  const STEPS = [
    { n: "1", label: "Enter your email"   },
    { n: "2", label: "Verify the OTP code" },
    { n: "3", label: "Set a new password"  },
  ];

  const stepMap  = { email: 1, otp: 2 };
  const current  = stepMap[currentStep] ?? 1;

  const status = (n) => {
    const num = parseInt(n, 10);
    if (num < current)  return "completed";
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
          <span className="fp-logo__name">Loe<b>mart</b></span>
        </Link>

        {/* Illustration */}
        <div className="fp-illustration">
          <div className="fp-illustration__circle">
            <Ic.Key s={80} />
          </div>
          <h2 className="fp-illustration__title">
            Reset your<br /><em>password</em>
          </h2>
          <p className="fp-illustration__text">
            Enter the email linked to your Loemart account. We'll send a secure
            6-digit code to verify it's really you.
          </p>
        </div>

        {/* Progress */}
        <nav className="fp-progress" aria-label="Password reset steps">
          {STEPS.map((s) => {
            const st = status(s.n);
            return (
              <div
                key={s.n}
                className={`fp-progress__step fp-progress__step--${st}`}
              >
                <div className="fp-progress__number">
                  {st === "completed"
                    ? <Ic.Check s={12} c="#fff" />
                    : s.n
                  }
                </div>
                <div className="fp-progress__label">{s.label}</div>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ERROR MESSAGE
════════════════════════════════════════════════════════════ */
function ErrorMessage({ message, attemptsLeft }) {
  if (!message) return null;
  return (
    <div className="fp-error" role="alert" aria-live="assertive">
      <span className="fp-error__text">{message}</span>
      {typeof attemptsLeft === "number" &&
       attemptsLeft <= ATTEMPTS_WARN_THRESHOLD && (
        <span className="fp-error__attempts">
          {attemptsLeft === 0
            ? "No attempts remaining — request a new code."
            : `${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining`
          }
        </span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function ForgotPassword() {
  const navigate = useNavigate();

  /* ── State ── */
  const [step,         setStep]         = useState("email");
  const [email,        setEmail]        = useState("");
  const [otp,          setOtp]          = useState("");
  const [otpHasError,  setOtpHasError]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [devOtp,       setDevOtp]       = useState("");
  const [resendKey,    setResendKey]    = useState(0);
  const [canResend,    setCanResend]    = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);

  const verifyingRef    = useRef(false);
  const lockoutTimerRef = useRef(null);

  /* Cleanup on unmount */
  useEffect(() => () => {
    if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
  }, []);

  const maskedEmail = maskEmail(email);

  /* ════════════════════════════════════════════════════════
     VERIFY OTP
  ════════════════════════════════════════════════════════ */
  const handleVerifyOtp = useCallback(async (code) => {
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
        state: { reset_token: data.reset_token, email },
      });

    } catch (err) {
      const msg       = err.response?.data?.message || "Incorrect code. Try again.";
      const remaining = err.response?.data?.attemptsLeft;
      const code_     = err.response?.data?.code;

      setOtpHasError(true);
      setError(msg);
      setOtp("");

      if (typeof remaining === "number") setAttemptsLeft(remaining);

      setTimeout(() => setOtpHasError(false), 700);

      /* Lockout — redirect back to email step after short delay */
      if (code_ === "OTP_LOCKED") {
        lockoutTimerRef.current = setTimeout(() => {
          lockoutTimerRef.current  = null;
          verifyingRef.current     = false;
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
  }, [email, navigate]);

  /* Auto-submit when all 6 digits filled */
  useEffect(() => {
    if (otp.length === OTP_LENGTH && step === "otp" && !verifyingRef.current) {
      handleVerifyOtp(otp);
    }
  }, [otp, step, handleVerifyOtp]);

  /* ════════════════════════════════════════════════════════
     SEND OTP
  ════════════════════════════════════════════════════════ */
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError("");

    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(cleaned)) {
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
        toast(`Dev OTP: ${data.dev_otp}`, { icon: "🔑", duration: 30_000 });
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
        const wait = err.response.data?.wait;
        setError(
          wait
            ? `Please wait ${wait}s before trying again.`
            : "Too many requests. Please wait before trying again."
        );
      } else {
        setError(err.response?.data?.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ════════════════════════════════════════════════════════
     RESEND OTP
  ════════════════════════════════════════════════════════ */
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
        toast(`Dev OTP: ${data.dev_otp}`, { icon: "🔑", duration: 30_000 });
      }

      toast.success("New verification code sent!");
      setCanResend(false);
      setResendKey((k) => k + 1);

    } catch (err) {
      if (err.response?.status === 429) {
        const wait = err.response.data?.wait;
        setError(
          wait
            ? `Please wait ${wait}s before trying again.`
            : "Too many requests. Please wait before trying again."
        );
      } else {
        setError(err.response?.data?.message || "Failed to resend code.");
      }
      /* Re-enable button so user can retry when ready */
      setCanResend(true);
    } finally {
      setLoading(false);
    }
  };

  /* ════════════════════════════════════════════════════════
     BACK TO EMAIL
  ════════════════════════════════════════════════════════ */
  const handleBackToEmail = () => {
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

  /* ════════════════════════════════════════════════════════
     RENDER — OTP STEP
  ════════════════════════════════════════════════════════ */
  if (step === "otp") {
    return (
      <div className="fp">
        <LeftPanel currentStep="otp" />

        <main className="fp-right">
          <div className="fp-right__scroll">
            <div className="fp-card">

              {/* Header */}
              <header className="fp-otp-header">
                <div className="fp-otp-header__icon" aria-hidden="true">
                  <Ic.Mail s={28} c="#fff" />
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

              {/* Dev banner */}
              {devOtp && (
                <div className="fp-dev-banner" role="status">
                  Dev mode — code: <strong>{devOtp}</strong>
                </div>
              )}

              {/* OTP cells */}
              <OtpCells
                value={otp}
                onChange={setOtp}
                disabled={loading}
                hasError={otpHasError}
                resetKey={resendKey}
              />

              <p className="fp-otp-hint" aria-live="polite">
                Auto-submits when all {OTP_LENGTH} digits are entered
              </p>

              {/* Error */}
              <ErrorMessage message={error} attemptsLeft={attemptsLeft} />

              {/* Verifying indicator */}
              {loading && (
                <div className="fp-verifying" role="status" aria-live="polite">
                  <Spinner c="#FF5C00" />
                  <span>Verifying…</span>
                </div>
              )}

              {/* Resend / Change email */}
              <div className="fp-otp-actions">
                <div className="fp-otp-actions__resend">
                  {canResend ? (
                    <button
                      type="button"
                      className="fp-resend-btn"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      <Ic.Refresh s={13} />
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
                  aria-label="Change email address"
                >
                  <Ic.ArrowLeft s={14} />
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

  /* ════════════════════════════════════════════════════════
     RENDER — EMAIL STEP
  ════════════════════════════════════════════════════════ */
  return (
    <div className="fp">
      <LeftPanel currentStep="email" />

      <main className="fp-right">
        <div className="fp-right__scroll">
          <div className="fp-card">

            {/* Header */}
            <header className="fp-email-header">
              <Link
                to="/auth"
                className="fp-link-btn fp-link-btn--muted"
                aria-label="Back to login"
              >
                <Ic.ArrowLeft s={14} />
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
            <form onSubmit={handleSendOtp} className="fp-form" noValidate>
              <div className="fp-field">
                <label className="fp-field__label" htmlFor="fp-email">
                  Email address
                </label>
                <div className="fp-field__input-wrap">
                  <span className="fp-field__icon" aria-hidden="true">
                    <Ic.Mail s={17} />
                  </span>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    required
                    aria-required="true"
                    className="fp-field__input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="fp-submit"
                disabled={loading || !email.trim()}
                aria-busy={loading}
              >
                {loading ? (
                  <><Spinner /> Sending code…</>
                ) : (
                  <>Send reset code <Ic.ArrowRight s={17} /></>
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