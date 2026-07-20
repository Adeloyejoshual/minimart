/**
 * src/pages/ResetPassword.jsx
 * Route: /reset-password
 *
 * Receives { reset_token, email } from ForgotPassword.jsx via
 * navigate state.  Lets the user set a new password.
 *
 * Guards:
 *   • Redirects to /forgot-password if reset_token is missing
 *   • Rejects if new password === old (server-side + UX hint)
 *   • Password strength meter matches backend rules exactly
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate, useLocation, Link }             from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/ResetPassword.css";

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
   Rules mirror validatePassword() in resetPassword.js exactly.
════════════════════════════════════════════════════════════ */
const STRENGTH_RULES = [
  { label: "8+ characters", test: (p) => p.length >= 8          },
  { label: "Uppercase",     test: (p) => /[A-Z]/.test(p)        },
  { label: "Number",        test: (p) => /[0-9]/.test(p)        },
  { label: "Symbol",        test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444"     },
  { score: 2, label: "Fair",   color: "#F59E0B"     },
  { score: 3, label: "Good",   color: "#FF8040"     },
  { score: 4, label: "Strong", color: "#15803D"     },
];

const getStrength = (pw) => {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = STRENGTH_RULES.map((r) => ({
    label : r.label,
    met   : r.test(pw),
  }));
  return {
    ...STRENGTH_LEVELS[checks.filter((c) => c.met).length],
    checks,
  };
};

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
const Ic = {
  Lock: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),

  Eye: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),

  EyeOff: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8
               a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4
               c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07
               a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),

  Check: ({ s = 10, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),

  Arrow: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),

  ArrowLeft: ({ s = 15 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),

  Shield: ({ s = 12, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),

  Key: ({ s = 72 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="#FF5C00" strokeWidth="1.2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   SMALL ATOMS
════════════════════════════════════════════════════════════ */
function Spinner({ c = "#fff" }) {
  return (
    <svg className="rp-spinner" width="18" height="18"
         viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

function Badges() {
  return (
    <div className="rp-badges" aria-label="Security badges">
      <span className="rp-badge"><Ic.Shield s={11} c="#6B6560" /> SSL Secured</span>
      <span className="rp-badge"><Ic.Lock   s={11} c="#6B6560" /> Encrypted</span>
      <span className="rp-badge"><Ic.Check  s={11} c="#6B6560" /> GDPR</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH METER
════════════════════════════════════════════════════════════ */
function StrengthMeter({ pw }) {
  if (!pw) return null;
  const strength = getStrength(pw);
  if (!strength.checks.length) return null;

  return (
    <div className="rp-strength" role="status" aria-live="polite">
      <div className="rp-strength__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((v) => (
          <div
            key={v}
            className={`rp-strength__bar${strength.score >= v ? " rp-strength__bar--on" : ""}`}
            style={strength.score >= v ? { background: strength.color } : {}}
          />
        ))}
      </div>
      <span
        className="rp-strength__label"
        style={{ color: strength.color }}
        aria-label={`Password strength: ${strength.label}`}
      >
        {strength.label}
      </span>
      <div className="rp-strength__checks">
        {strength.checks.map((c) => (
          <span
            key={c.label}
            className={`rp-strength__check ${c.met ? "rp-strength__check--met" : "rp-strength__check--no"}`}
            aria-label={`${c.label}: ${c.met ? "met" : "not met"}`}
          >
            {c.met ? (
              <Ic.Check s={9} c="#15803D" />
            ) : (
              <span aria-hidden="true" style={{
                width: 9, height: 9, display: "inline-block",
                borderRadius: "50%", border: "1.5px solid #B0AAA3",
              }} />
            )}
            {c.label}
          </span>
        ))}
      </div>
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
            <div className="rp-logo__bag">
              <div className="rp-logo__pin" />
            </div>
          </div>
          <span className="rp-logo__name">Loe<b>mart</b></span>
        </Link>

        <div className="rp-illustration">
          <div className="rp-illustration__circle">
            <Ic.Key s={72} />
          </div>
          <h2>Set your<br /><em>new password</em></h2>
          <p>
            Choose a strong password you haven't used before.
            It must include an uppercase letter, a number, and
            a special character.
          </p>
        </div>

        {/* Tips */}
        <div className="rp-tips">
          {[
            "Use a mix of letters, numbers and symbols",
            "Avoid names, birthdays or common words",
            "Make it at least 8 characters long",
            "Don't reuse passwords from other sites",
          ].map((tip) => (
            <div key={tip} className="rp-tip">
              <Ic.Check s={11} c="#FF5C00" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function ResetPassword() {
  const navigate        = useNavigate();
  const { state }       = useLocation();
  const reset_token     = state?.reset_token ?? "";
  const email           = state?.email       ?? "";

  /* Redirect if token is missing */
  useEffect(() => {
    if (!reset_token) {
      toast.error("Reset session expired. Please start again.");
      navigate("/forgot-password", { replace: true });
    }
  }, [reset_token, navigate]);

  /* ── Form state ── */
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);

  const strength = useMemo(() => getStrength(password), [password]);

  /* ── Submit ── */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");

    /* Client-side strength gate */
    if (strength.score < 4) {
      setError("Please choose a stronger password before continuing.");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/reset-password`, {
        reset_token,
        new_password : password,
      });

      setDone(true);
      toast.success("Password reset! Redirecting to login…");

      setTimeout(() => navigate("/auth", { replace: true }), 2_000);

    } catch (err) {
      const msg  = err.response?.data?.message ?? "Something went wrong.";
      const code = err.response?.data?.code;

      setError(msg);

      /*
        If the server says the token is expired, send the user
        back to step 1 after a short delay so they can see why.
      */
      if (code === "TOKEN_EXPIRED") {
        setTimeout(() => {
          navigate("/forgot-password", { replace: true });
        }, 2_500);
      }
    } finally {
      setLoading(false);
    }
  }, [password, reset_token, navigate, strength.score]);

  /* ════════════════════════════════════════════════════════
     SUCCESS SCREEN
  ════════════════════════════════════════════════════════ */
  if (done) {
    return (
      <div className="rp">
        <LeftPanel />
        <main className="rp-right">
          <div className="rp-right__scroll">
            <div className="rp-card rp-card--success">
              <div className="rp-success-icon" aria-hidden="true">
                <Ic.Check s={36} c="#15803D" />
              </div>
              <h2 className="rp-success-title">Password updated!</h2>
              <p className="rp-success-sub">
                Your password has been changed. Redirecting you to login…
              </p>
              <Spinner c="#FF5C00" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     MAIN SCREEN
  ════════════════════════════════════════════════════════ */
  return (
    <div className="rp">
      <LeftPanel />

      <main className="rp-right">
        <div className="rp-right__scroll">
          <div className="rp-card">

            {/* Header */}
            <header className="rp-header">
              <Link to="/forgot-password" className="rp-back">
                <Ic.ArrowLeft s={15} /> Back
              </Link>
              <h1 className="rp-title">Set new password</h1>
              {email && (
                <p className="rp-subtitle">
                  Setting a new password for <strong>{email}</strong>
                </p>
              )}
            </header>

            {/* Error */}
            {error && (
              <div className="rp-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="rp-field">
                <label className="rp-label" htmlFor="rp-password">
                  New password
                </label>
                <div className="rp-iw">
                  <span className="rp-icon" aria-hidden="true">
                    <Ic.Lock />
                  </span>
                  <input
                    id="rp-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    autoFocus
                    required
                    aria-describedby="rp-strength-status"
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    aria-pressed={showPw}
                  >
                    {showPw ? <Ic.EyeOff /> : <Ic.Eye />}
                  </button>
                </div>

                <div id="rp-strength-status">
                  <StrengthMeter pw={password} />
                </div>

                {/*
                  Same-password hint.
                  Shown proactively so users know BEFORE they submit
                  that reusing the old password will be rejected.
                  The server enforces this too — this is just UX.
                */}
                {password.length >= 8 && (
                  <p className="rp-hint">
                    <Ic.Shield s={11} c="#6B7280" />{" "}
                    Your new password must be different from your current one.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="rp-submit"
                disabled={loading || strength.score < 4}
                aria-busy={loading}
              >
                {loading ? (
                  <><Spinner /> Updating…</>
                ) : (
                  <>Reset password <Ic.Arrow s={17} /></>
                )}
              </button>
            </form>

            <Badges />
          </div>
        </div>
      </main>
    </div>
  );
}