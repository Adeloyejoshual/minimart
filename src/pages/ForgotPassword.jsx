/**
 * src/pages/ForgotPassword.jsx
 * Route: /forgot-password
 *
 * Steps:
 *   email  — enter email, send OTP
 *   otp    — verify 6-digit code
 *
 * On success → navigate to /reset-password with { reset_token, email }
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link }                    from "react-router-dom";
import axios                                    from "axios";
import toast                                    from "react-hot-toast";
import "../styles/ForgotPassword.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API        = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;
const OTP_LENGTH = 6;
const RESEND_SECS = 60;

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  Mail: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  ArrowLeft: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Arrow: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Refresh: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  Shield: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Lock: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  Check: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════ */
function Spinner({ c = "#fff" }) {
  return (
    <svg className="fp-spinner" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BADGES
═══════════════════════════════════════════════════════════════ */
function Badges() {
  return (
    <div className="fp-badges">
      <span className="fp-badge"><Ic.Shield s={11} c="#6B6560" /> SSL Secured</span>
      <span className="fp-badge"><Ic.Lock   s={11} c="#6B6560" /> Encrypted</span>
      <span className="fp-badge"><Ic.Check  s={11} c="#6B6560" /> GDPR</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN
═══════════════════════════════════════════════════════════════ */
function Countdown({ seconds, resendKey, onDone }) {
  const [left,    setLeft]  = useState(seconds);
  const onDoneRef           = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) { clearInterval(id); onDoneRef.current?.(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, resendKey]); // eslint-disable-line

  return (
    <span className={`fp-countdown${left <= 10 ? " fp-countdown--warn" : ""}`}>
      {left}s
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OTP CELLS
═══════════════════════════════════════════════════════════════ */
function OtpCells({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

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
          aria-label={`Digit ${i + 1}`}
          className={[
            "fp-otp-cell",
            char(i)  ? "fp-otp-cell--filled" : "",
            hasError ? "fp-otp-cell--error"  : "",
          ].join(" ")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            update(i, d);
            if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (char(i)) update(i, "");
              else if (i > 0) {
                update(i - 1, "");
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft"  && i > 0)              refs.current[i - 1]?.focus();
            else if   (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
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

/* ═══════════════════════════════════════════════════════════════
   LEFT PANEL
═══════════════════════════════════════════════════════════════ */
function LeftPanel() {
  return (
    <div className="fp-left">
      <div className="fp-blob fp-blob1" />
      <div className="fp-blob fp-blob2" />
      <div className="fp-left-inner">

        {/* Logo */}
        <Link to="/auth" className="fp-logo">
          <div className="fp-logo-icon">
            <div className="fp-logo-ring" />
            <div className="fp-logo-bag">
              <div className="fp-logo-pin" />
            </div>
          </div>
          <span className="fp-logo-name">Loe<b>mart</b></span>
        </Link>

        {/* Illustration */}
        <div className="fp-illustration">
          <div className="fp-ill-circle">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none"
                 stroke="#FF5C00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5"/>
              <path d="M21 2l-9.6 9.6"/>
              <path d="M15.5 7.5l3 3L22 7l-3-3"/>
            </svg>
          </div>
          <h2>Reset your<br /><em>password</em></h2>
          <p>
            Enter the email linked to your Loemart account.
            We'll send a secure 6-digit code to verify it's really you.
          </p>
        </div>

        {/* Steps */}
        <div className="fp-steps">
          {[
            { n: "1", label: "Enter your email"     },
            { n: "2", label: "Verify the OTP code"  },
            { n: "3", label: "Set a new password"   },
          ].map((s) => (
            <div className="fp-step" key={s.n}>
              <div className="fp-step-n">{s.n}</div>
              <div className="fp-step-label">{s.label}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ForgotPassword() {
  const navigate = useNavigate();

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

  const verifyingRef = useRef(false);

  /* ─────────────────────────────────────────────
     VERIFY OTP — defined before useEffect
  ───────────────────────────────────────────── */
  const handleVerifyOtp = async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setError("");

    try {
      const { data } = await axios.post(`${API}/forgot-password/verify`, {
        email,
        otp: code,
      });

      /* ✅ pass reset_token + email to ResetPassword page */
      navigate("/reset-password", {
        state: {
          reset_token : data.reset_token,
          email,
        },
      });
    } catch (err) {
      const msg   = err.response?.data?.message || "Incorrect code. Try again.";
      const left  = err.response?.data?.attemptsLeft;
      const code_ = err.response?.data?.code;

      setOtpHasError(true);
      setError(msg);
      setOtp("");

      if (typeof left === "number") setAttemptsLeft(left);
      setTimeout(() => setOtpHasError(false), 700);

      if (code_ === "OTP_LOCKED") {
        setTimeout(() => {
          verifyingRef.current = false;
          setStep("email");
          setError("Too many incorrect attempts. Please request a new code.");
          setDevOtp("");
        }, 1000);
      }
    } finally {
      verifyingRef.current = false;
    }
  };

  /* Auto-submit when 6 digits filled */
  useEffect(() => {
    if (
      otp.length === OTP_LENGTH &&
      step === "otp"            &&
      !verifyingRef.current
    ) {
      handleVerifyOtp(otp);
    }
  }, [otp, step]); // eslint-disable-line

  /* ─────────────────────────────────────────────
     SEND OTP
  ───────────────────────────────────────────── */
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError("");

    const cleaned = email.trim().toLowerCase();
    if (!cleaned)
      return setError("Please enter your email address.");
    if (!/\S+@\S+\.\S+/.test(cleaned))
      return setError("Please enter a valid email address.");

    setEmail(cleaned);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/forgot-password`, {
        email: cleaned,
      });

      if (data.dev_otp) {
        setDevOtp(String(data.dev_otp));
        toast(`Dev OTP: ${data.dev_otp}`, {
          icon: "🔑",
          duration: 30000,
        });
      }

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

  /* ─────────────────────────────────────────────
     RESEND OTP
  ───────────────────────────────────────────── */
  const handleResend = async () => {
    setCanResend(false);
    setResendKey((k) => k + 1);
    setOtp("");
    setOtpHasError(false);
    setError("");
    setDevOtp("");
    setAttemptsLeft(null);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/forgot-password`, {
        email,
      });

      if (data.dev_otp) {
        setDevOtp(String(data.dev_otp));
        toast(`Dev OTP: ${data.dev_otp}`, {
          icon: "🔑",
          duration: 30000,
        });
      }

      toast.success("New code sent!");
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Too many requests. Please wait before trying again.");
      } else {
        setError(err.response?.data?.message || "Failed to resend.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════
     RENDER — OTP STEP
  ═══════════════════════════════════════════ */
  if (step === "otp") {
    return (
      <div className="fp">
        <LeftPanel />
        <div className="fp-right">
          <div className="fp-right-scroll">
            <div className="fp-box">

              <div className="fp-otp-header">
                <div className="fp-otp-icon-wrap">
                  <Ic.Mail s={28} c="#fff" />
                </div>
                <h3 className="fp-otp-title">Enter reset code</h3>
                <p className="fp-otp-sub">
                  We sent a 6-digit code to{" "}
                  <strong>{email}</strong>.
                  Enter it below to continue.
                </p>
              </div>

              {devOtp && (
                <div className="fp-dev-otp">
                  Dev mode — code: <strong>{devOtp}</strong>
                </div>
              )}

              <OtpCells
                value={otp}
                onChange={setOtp}
                disabled={loading}
                hasError={otpHasError}
              />

              <p className="fp-otp-hint">
                Auto-submits when all 6 digits are entered
              </p>

              {error && (
                <div className="fp-error">
                  {error}
                  {attemptsLeft !== null &&
                   attemptsLeft > 0      &&
                   attemptsLeft <= 4     && (
                    <span className="fp-error__sub">
                      {attemptsLeft} attempt
                      {attemptsLeft !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                </div>
              )}

              {loading && (
                <p className="fp-verifying">Verifying…</p>
              )}

              <div className="fp-otp-resend">
                <div>
                  {canResend ? (
                    <button
                      type="button"
                      className="fp-resend-btn"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      <Ic.Refresh s={13} /> Resend code
                    </button>
                  ) : (
                    <span className="fp-resend-timer">
                      Resend in{" "}
                      <Countdown
                        key={resendKey}
                        seconds={RESEND_SECS}
                        resendKey={resendKey}
                        onDone={() => setCanResend(true)}
                      />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="fp-back-btn"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setOtpHasError(false);
                    setError("");
                    setDevOtp("");
                  }}
                >
                  <Ic.ArrowLeft s={14} /> Change email
                </button>
              </div>

              <Badges />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER — EMAIL STEP
  ═══════════════════════════════════════════ */
  return (
    <div className="fp">
      <LeftPanel />
      <div className="fp-right">
        <div className="fp-right-scroll">
          <div className="fp-box">

            <div className="fp-heading">
              <Link to="/auth" className="fp-back-btn">
                <Ic.ArrowLeft s={15} /> Back to login
              </Link>
              <h3 style={{ marginTop: 14 }}>Forgot your password?</h3>
              <p>
                Enter your account email and we'll send you a{" "}
                <strong>6-digit reset code</strong>.
              </p>
            </div>

            {error && <div className="fp-error">{error}</div>}

            <form onSubmit={handleSendOtp}>
              <div className="fp-form">
                <div className="fp-field">
                  <label className="fp-label">Email address</label>
                  <div className="fp-iw">
                    <span className="fp-icon"><Ic.Mail /></span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="fp-submit"
                  disabled={loading || !email.trim()}
                >
                  {loading
                    ? <><Spinner /> Sending code…</>
                    : <>Send reset code <Ic.Arrow s={17} /></>
                  }
                </button>
              </div>
            </form>

            <Badges />
          </div>
        </div>
      </div>
    </div>
  );
}