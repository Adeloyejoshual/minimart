/**
 * src/pages/ResetPassword.jsx
 * Route: /reset-password
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

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const API                = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;
const AUTO_LOGIN_SECONDS = 3;
const MIN_STRENGTH_SCORE = 4; // all 4 checks must pass

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2)
    return `${local[0]}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}@${domain}`;
}

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
   Rules must match validatePassword() in resetPassword.js
════════════════════════════════════════════════════════════ */
const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444"     },
  { score: 2, label: "Fair",   color: "#F59E0B"     },
  { score: 3, label: "Good",   color: "#FF8040"     },
  { score: 4, label: "Strong", color: "#15803D"     },
];

const PASSWORD_CHECKS = [
  { label: "8+ characters", test: (p) => p.length >= 8          },
  { label: "Uppercase",     test: (p) => /[A-Z]/.test(p)        },
  { label: "Number",        test: (p) => /[0-9]/.test(p)        },
  { label: "Symbol",        test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(pw) {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = PASSWORD_CHECKS.map((c) => ({ label: c.label, met: c.test(pw) }));
  return { ...STRENGTH_LEVELS[checks.filter((c) => c.met).length], checks };
}

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
const Ic = {
  Lock: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  Eye: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Check: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ArrowRight: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  ArrowLeft: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Key: ({ s = 26, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  ),
  Shield: ({ s = 12, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   ATOMS
════════════════════════════════════════════════════════════ */
function Spinner({ c = "#fff" }) {
  return (
    <svg className="rp-spinner" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"
         role="status" aria-label="Loading">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

function SecurityBadges() {
  return (
    <div className="rp-badges" aria-label="Security certifications">
      {[
        { ic: <Ic.Shield s={12} c="#7a756f" />, label: "SSL Secured" },
        { ic: <Ic.Lock   s={12} c="#7a756f" />, label: "Encrypted"   },
        { ic: <Ic.Check  s={12} c="#7a756f" />, label: "GDPR"        },
      ].map((b) => (
        <span key={b.label} className="rp-badge">{b.ic}{b.label}</span>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STRENGTH METER
════════════════════════════════════════════════════════════ */
function StrengthMeter({ pw }) {
  const strength = useMemo(() => getStrength(pw), [pw]);

  return (
    <div className="rp-strength" role="status" aria-live="polite">
      <div className="rp-strength__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((v) => (
          <div
            key={v}
            className={`rp-strength__bar${strength.score >= v ? " rp-strength__bar--active" : ""}`}
            style={strength.score >= v ? { backgroundColor: strength.color } : {}}
          />
        ))}
      </div>

      {pw && (
        <span className="rp-strength__label" style={{ color: strength.color }}
              aria-label={`Password strength: ${strength.label}`}>
          {strength.label}
        </span>
      )}

      <div className="rp-strength__checks" role="list">
        {(strength.checks.length > 0 ? strength.checks : PASSWORD_CHECKS.map((c) => ({ label: c.label, met: false }))).map((c) => (
          <span
            key={c.label}
            role="listitem"
            className={`rp-strength__check ${c.met ? "rp-strength__check--met" : "rp-strength__check--unmet"}`}
            aria-label={`${c.label}: ${c.met ? "passed" : "not yet"}`}
          >
            {c.met
              ? <Ic.Check s={9} c="#15803D" />
              : <span className="rp-strength__dot" aria-hidden="true" />
            }
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PASSWORD FIELD
════════════════════════════════════════════════════════════ */
function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  showStrength  = false,
  autoComplete  = "new-password",
  placeholder   = "Password",
  matchState    = null,
  describedBy,
  inputRef,
  onEnter,
  autoFocus     = false,
}) {
  return (
    <div className="rp-field">
      <label className="rp-field__label" htmlFor={id}>{label}</label>

      <div className={`rp-field__wrap${matchState === false ? " rp-field__wrap--error" : ""}`}>
        <span className="rp-field__icon"><Ic.Lock /></span>
        <input
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={matchState === false || undefined}
          aria-describedby={describedBy}
          className="rp-field__input"
        />
        <button
          type="button"
          className="rp-field__toggle"
          onClick={onToggleVisible}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <Ic.EyeOff /> : <Ic.Eye />}
        </button>
      </div>

      {matchState === true && (
        <p className="rp-field__match rp-field__match--ok" role="status">
          <Ic.Check s={12} c="#15803D" /> Passwords match
        </p>
      )}
      {matchState === false && (
        <p className="rp-field__match rp-field__match--error" role="alert" id={describedBy}>
          Passwords do not match
        </p>
      )}

      {showStrength && <StrengthMeter pw={value} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LEFT PANEL
════════════════════════════════════════════════════════════ */
function LeftPanel() {
  return (
    <div className="rp-left" aria-hidden="true">
      <div className="rp-blob rp-blob--1" />
      <div className="rp-blob rp-blob--2" />
      <div className="rp-left__inner">
        <Link to="/auth" className="rp-logo" tabIndex={-1}>
          <div className="rp-logo__icon">
            <div className="rp-logo__ring" />
            <div className="rp-logo__bag"><div className="rp-logo__pin" /></div>
          </div>
          <span className="rp-logo__name">Loe<b>mart</b></span>
        </Link>

        <div className="rp-illustration">
          <div className="rp-illustration__circle">
            <Ic.Key s={80} c="#FF5C00" />
          </div>
          <h2 className="rp-illustration__title">Almost<br /><em>there!</em></h2>
          <p className="rp-illustration__text">
            Create a strong new password to secure your Loemart account.
            You'll be logged in automatically when you're done.
          </p>
        </div>

        <div className="rp-tips">
          <p className="rp-tips__heading">Password tips</p>
          <ul className="rp-tips__list">
            {[
              "Use at least 8 characters",
              "Mix uppercase and lowercase",
              "Add numbers and symbols",
              "Avoid common words or phrases",
            ].map((tip) => (
              <li key={tip} className="rp-tips__item">
                <Ic.Check s={12} c="#FF5C00" /><span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function ResetPassword({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const resetToken  = location.state?.reset_token ?? "";
  const emailFromFP = location.state?.email       ?? "";
  const redirectTo  = location.state?.from?.pathname ?? "/";
  const maskedEmail = maskEmail(emailFromFP);

  /* ── State ── */
  const [step,            setStep]            = useState("password");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [errorCode,       setErrorCode]       = useState("");   // ← tracks server error code
  const [loginCountdown,  setLoginCountdown]  = useState(AUTO_LOGIN_SECONDS);
  const [authResult,      setAuthResult]      = useState(null);

  /* ── Refs ── */
  const countdownRef  = useRef(null);
  const confirmRef    = useRef(null);
  const allMetPrevRef = useRef(false);

  /* ── Derived ── */
  const strength     = useMemo(() => getStrength(password), [password]);
  const allChecksMet = strength.checks.length > 0 && strength.checks.every((c) => c.met);
  const matchState   = confirmPassword ? password === confirmPassword : null;

  /* ── Guard: no token → back to forgot-password ── */
  useEffect(() => {
    if (!resetToken) {
      toast.error("Invalid or expired reset link.");
      navigate("/forgot-password", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cleanup countdown on unmount ── */
  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  /* ── Auto-focus confirm when all checks pass ── */
  useEffect(() => {
    if (allChecksMet && !allMetPrevRef.current) confirmRef.current?.focus();
    allMetPrevRef.current = allChecksMet;
  }, [allChecksMet]);

  /* ── Auto-login countdown ── */
  const startLoginCountdown = useCallback((user, token) => {
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
    }, 1_000);
  }, [setUser, navigate, redirectTo]);

  /* ── Skip countdown ── */
  const handleSkipCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (authResult) setUser(authResult.user, authResult.token, navigate, redirectTo);
    else            navigate(redirectTo, { replace: true });
  }, [authResult, setUser, navigate, redirectTo]);

  /* ════════════════════════════════════════════════════════
     SUBMIT
     Key fixes:
       1. Field name: `new_password` (matches backend)
       2. Error code: read `err.response.data.code` to
          distinguish SAME_PASSWORD from TOKEN_EXPIRED
          instead of treating every 400 as "expired"
  ════════════════════════════════════════════════════════ */
  const handleSubmit = useCallback(async () => {
    setError("");
    setErrorCode("");

    /* ── Client-side validation ── */
    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (strength.score < MIN_STRENGTH_SCORE) {
      setError("Password is too weak. Please meet all the requirements.");
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
        reset_token  : resetToken,
        new_password : password,   // ✅ FIX 1 — was `password`, must be `new_password`
      });

      toast.success("Password reset successfully!");
      setStep("done");

      /* Backend returns { success, message } only — auto-login
         not yet implemented server-side, navigate to /auth */
      if (data.user && data.token) {
        startLoginCountdown(data.user, data.token);
      } else {
        /* Redirect to login after short delay */
        setTimeout(() => navigate("/auth", { replace: true }), 2_500);
      }

    } catch (err) {
      const msg  = err.response?.data?.message ?? "Reset failed. Please try again.";
      const code = err.response?.data?.code    ?? "";

      setErrorCode(code);

      /*
        ✅ FIX 2 — Previously every 400 was shown as "Reset link has expired".
        Now we read the `code` field from the server response so each error
        gets the right message:

          SAME_PASSWORD  → "Your new password cannot be the same…"
          TOKEN_EXPIRED  → redirect CTA to /forgot-password
          TOKEN_INVALID  → redirect CTA to /forgot-password
          anything else  → show server message verbatim
      */
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [password, confirmPassword, strength.score, resetToken, startLoginCountdown, navigate]);

  const handleFormSubmit = (e) => { e.preventDefault(); handleSubmit(); };

  /* ════════════════════════════════════════════════════════
     DONE SCREEN
  ════════════════════════════════════════════════════════ */
  if (step === "done") {
    const progress =
      ((AUTO_LOGIN_SECONDS - loginCountdown) / AUTO_LOGIN_SECONDS) * 100;

    return (
      <div className="rp">
        <LeftPanel />
        <main className="rp-right">
          <div className="rp-right__scroll">
            <div className="rp-card">
              <header className="rp-done__header">
                <div className="rp-done__icon" aria-hidden="true">
                  <Ic.Check s={36} c="#fff" />
                </div>
                <h1 className="rp-done__title">Password updated!</h1>
                <p className="rp-done__subtitle">
                  Your password has been reset successfully.
                  {authResult && (
                    <>
                      <br />Logging you in in{" "}
                      <strong aria-live="polite">{loginCountdown}s</strong>…
                    </>
                  )}
                </p>
              </header>

              {authResult && (
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
                    style={{ width: `${progress}%`, transition: "width 1s linear" }}
                  />
                </div>
              )}

              <button
                type="button"
                className="rp-submit"
                onClick={authResult ? handleSkipCountdown : () => navigate("/auth", { replace: true })}
              >
                {authResult ? "Continue to Loemart" : "Go to login"}
                <Ic.ArrowRight s={17} />
              </button>

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

  /* ════════════════════════════════════════════════════════
     PASSWORD STEP
     Error rendering:
       SAME_PASSWORD  → red banner, no redirect CTA (stay on form)
       TOKEN_EXPIRED
       TOKEN_INVALID  → red banner + "Request another reset code" link
       anything else  → red banner only
  ════════════════════════════════════════════════════════ */
  const isExpiredOrInvalid =
    errorCode === "TOKEN_EXPIRED" || errorCode === "TOKEN_INVALID";

  const isSamePassword = errorCode === "SAME_PASSWORD";

  return (
    <div className="rp">
      <LeftPanel />

      <main className="rp-right">
        <div className="rp-right__scroll">
          <div className="rp-card">

            {/* Header */}
            <header className="rp-header">
              <Link to="/forgot-password" className="rp-back-btn">
                <Ic.ArrowLeft s={15} /> Back
              </Link>

              <div className="rp-header__icon" aria-hidden="true">
                <Ic.Key s={26} c="#fff" />
              </div>

              <h1 className="rp-header__title">Set a new password</h1>

              {emailFromFP && (
                <p className="rp-header__subtitle">
                  Setting a new password for{" "}
                  <strong className="rp-header__email" title="Masked for privacy">
                    {maskedEmail}
                  </strong>
                </p>
              )}
            </header>

            {/* Error banner */}
            {error && (
              <div className="rp-error" role="alert" aria-live="assertive">
                <span className="rp-error__text">{error}</span>

                {/*
                  Same-password hint — stay on form, no redirect.
                  User just needs to type a different password.
                */}
                {isSamePassword && (
                  <span className="rp-error__hint">
                    Please choose a password you haven't used before.
                  </span>
                )}

                {/*
                  Expired / invalid token — offer a fresh reset link.
                */}
                {isExpiredOrInvalid && (
                  <Link to="/forgot-password" className="rp-error__cta">
                    Request another reset code
                    <Ic.ArrowRight s={13} />
                  </Link>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="rp-form" noValidate>

              <PasswordField
                id="rp-new-password"
                label="New password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); setErrorCode(""); }}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                showStrength
                placeholder="Enter new password"
                autoFocus
                onEnter={handleSubmit}
              />

              <PasswordField
                id="rp-confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); setErrorCode(""); }}
                visible={showConfirm}
                onToggleVisible={() => setShowConfirm((v) => !v)}
                placeholder="Repeat new password"
                matchState={matchState}
                describedBy="rp-confirm-error"
                inputRef={confirmRef}
                onEnter={handleSubmit}
              />

              <button
                type="submit"
                className="rp-submit"
                disabled={loading || !password || !confirmPassword}
                aria-busy={loading}
              >
                {loading ? (
                  <><Spinner /> Updating password…</>
                ) : (
                  <>Update password <Ic.ArrowRight s={17} /></>
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