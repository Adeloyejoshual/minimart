/**
 * src/pages/ResetPassword.jsx
 * Route: /reset-password
 *
 * Receives via navigate state:
 *   { reset_token, email }
 *
 * Steps:
 *   password — enter + confirm new password
 *   done     — success + auto-login countdown
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation, Link }                    from "react-router-dom";
import axios                                                  from "axios";
import toast                                                  from "react-hot-toast";
import "../styles/ResetPassword.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;

const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444"     },
  { score: 2, label: "Fair",   color: "#F59E0B"     },
  { score: 3, label: "Good",   color: "#FF8040"     },
  { score: 4, label: "Strong", color: "#15803D"     },
];

const getStrength = (pw) => {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = [
    { label: "8+ chars",  met: pw.length >= 8          },
    { label: "Uppercase", met: /[A-Z]/.test(pw)         },
    { label: "Number",    met: /[0-9]/.test(pw)         },
    { label: "Symbol",    met: /[^A-Za-z0-9]/.test(pw)  },
  ];
  return {
    ...STRENGTH_LEVELS[checks.filter((c) => c.met).length],
    checks,
  };
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  Lock: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  Eye: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Check: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Arrow: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  ArrowLeft: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Key: ({ s = 26, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  ),
  Shield: ({ s = 11, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════ */
function Spinner({ c = "#fff" }) {
  return (
    <svg className="rp-spinner" width="18" height="18" viewBox="0 0 24 24"
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
    <div className="rp-badges">
      <span className="rp-badge"><Ic.Shield s={11} c="#6B6560" /> SSL Secured</span>
      <span className="rp-badge"><Ic.Lock   s={11} c="#6B6560" /> Encrypted</span>
      <span className="rp-badge"><Ic.Check  s={11} c="#6B6560" /> GDPR</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PASSWORD FIELD
═══════════════════════════════════════════════════════════════ */
function PwField({
  label,
  value,
  onChange,
  showPw,
  onToggle,
  showStrength = false,
  autoComplete = "new-password",
  placeholder  = "Password",
  matchState   = null,   // true | false | null
}) {
  const pw = useMemo(() => getStrength(value), [value]);

  return (
    <div className="rp-field">
      <label className="rp-label">{label}</label>
      <div className={`rp-iw${matchState === false ? " rp-iw--error" : ""}`}>
        <span className="rp-icon"><Ic.Lock /></span>
        <input
          type={showPw ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="rp-eye"
          onClick={onToggle}
          tabIndex={-1}
        >
          {showPw ? <Ic.EyeOff /> : <Ic.Eye />}
        </button>
      </div>

      {/* match feedback */}
      {matchState === true && (
        <p className="rp-match-ok">
          <Ic.Check s={12} c="#15803D" /> Passwords match
        </p>
      )}
      {matchState === false && (
        <p className="rp-match-error">Passwords do not match</p>
      )}

      {/* strength meter */}
      {showStrength && value && (
        <div className="rp-pw">
          <div className="rp-pw-bars">
            {[1, 2, 3, 4].map((v) => (
              <div
                key={v}
                className={`rp-pw-bar${pw.score >= v ? " rp-pw-bar--on" : ""}`}
                style={pw.score >= v ? { background: pw.color } : {}}
              />
            ))}
          </div>
          <div className="rp-pw-label" style={{ color: pw.color }}>
            {pw.label}
          </div>
          <div className="rp-pw-checks">
            {pw.checks.map((c, i) => (
              <span
                key={i}
                className={`rp-pw-check ${c.met ? "rp-pw-check--met" : "rp-pw-check--no"}`}
              >
                {c.met
                  ? <Ic.Check s={9} c="#15803D" />
                  : <span className="rp-pw-dot" />
                }
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEFT PANEL
═══════════════════════════════════════════════════════════════ */
function LeftPanel() {
  return (
    <div className="rp-left">
      <div className="rp-blob rp-blob1" />
      <div className="rp-blob rp-blob2" />
      <div className="rp-left-inner">

        <Link to="/auth" className="rp-logo">
          <div className="rp-logo-icon">
            <div className="rp-logo-ring" />
            <div className="rp-logo-bag">
              <div className="rp-logo-pin" />
            </div>
          </div>
          <span className="rp-logo-name">Loe<b>mart</b></span>
        </Link>

        <div className="rp-illustration">
          <div className="rp-ill-circle">
            <Ic.Key s={80} c="#FF5C00" />
          </div>
          <h2>Almost<br /><em>there!</em></h2>
          <p>
            Create a strong new password to secure your Loemart account.
            You'll be logged in automatically when you're done.
          </p>
        </div>

        {/* Tips */}
        <div className="rp-tips">
          <p className="rp-tips-title">Password tips</p>
          {[
            "Use at least 8 characters",
            "Mix uppercase and lowercase",
            "Add numbers and symbols",
            "Avoid common words",
          ].map((tip) => (
            <div className="rp-tip" key={tip}>
              <Ic.Check s={12} c="#FF5C00" />
              <span>{tip}</span>
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
export default function ResetPassword({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from     = location.state?.from?.pathname || "/";

  /* ── get token + email passed from ForgotPassword ── */
  const resetToken  = location.state?.reset_token ?? "";
  const emailFromFP = location.state?.email       ?? "";

  const [step,    setStep]    = useState("password");
  const [pw,      setPw]      = useState("");
  const [pw2,     setPw2]     = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  /* auto-login countdown */
  const [loginCountdown, setLoginCountdown] = useState(3);
  const countdownRef                        = useRef(null);

  /* ── guard: if no token, redirect to forgot-password ── */
  useEffect(() => {
    if (!resetToken) {
      toast.error("Invalid or expired reset link.");
      navigate("/forgot-password", { replace: true });
    }
  }, []); // eslint-disable-line

  /* ── cleanup countdown on unmount ── */
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const strength = useMemo(() => getStrength(pw),  [pw]);
  const match    = pw2 ? pw === pw2 : null;

  /* ─────────────────────────────────────────────
     AUTO-LOGIN COUNTDOWN
  ───────────────────────────────────────────── */
  const startLoginCountdown = useCallback((user, token) => {
    setLoginCountdown(3);

    countdownRef.current = setInterval(() => {
      setLoginCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setUser(user, token, navigate, from); // ✅ login + redirect
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [setUser, navigate, from]);

  /* ─────────────────────────────────────────────
     RESET PASSWORD
  ───────────────────────────────────────────── */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!pw)
      return setError("Please enter a new password.");
    if (strength.score < 2)
      return setError("Password is too weak. Choose a stronger one.");
    if (!pw2)
      return setError("Please confirm your new password.");
    if (pw !== pw2)
      return setError("Passwords do not match.");

    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/reset-password`, {
        reset_token : resetToken,
        password    : pw,
      });

      toast.success("Password reset! Logging you in…");
      setStep("done");
      startLoginCountdown(data.user, data.token); // ✅ auto-login
    } catch (err) {
      if (err.response?.status === 400) {
        setError("Reset link has expired. Please request a new one.");
      } else {
        setError(err.response?.data?.message || "Reset failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════
     RENDER — DONE SCREEN
  ═══════════════════════════════════════════ */
  if (step === "done") {
    return (
      <div className="rp">
        <LeftPanel />
        <div className="rp-right">
          <div className="rp-right-scroll">
            <div className="rp-box">

              <div className="rp-done-header">
                <div className="rp-done-icon">
                  <Ic.Check s={36} c="#fff" />
                </div>
                <h3 className="rp-done-title">Password updated!</h3>
                <p className="rp-done-sub">
                  Your password has been reset successfully.
                  Logging you in in{" "}
                  <strong>{loginCountdown}s</strong>…
                </p>
              </div>

              {/* progress bar */}
              <div className="rp-autologin-bar">
                <div
                  className="rp-autologin-bar__fill"
                  style={{
                    width      : `${((3 - loginCountdown) / 3) * 100}%`,
                    transition : "width 1s linear",
                  }}
                />
              </div>

              {/* skip countdown */}
              <button
                type="button"
                className="rp-submit"
                style={{ marginTop: 24 }}
                onClick={() => {
                  clearInterval(countdownRef.current);
                  navigate(from, { replace: true });
                }}
              >
                Continue to Loemart <Ic.Arrow s={17} />
              </button>

              {/* manual fallback */}
              <p className="rp-switch" style={{ marginTop: 14 }}>
                <Link to="/auth">Or log in manually</Link>
              </p>

              <Badges />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER — PASSWORD STEP
  ═══════════════════════════════════════════ */
  return (
    <div className="rp">
      <LeftPanel />
      <div className="rp-right">
        <div className="rp-right-scroll">
          <div className="rp-box">

            <div className="rp-heading">
              <Link to="/forgot-password" className="rp-back-btn">
                <Ic.ArrowLeft s={15} /> Back
              </Link>
              <div className="rp-heading-icon">
                <Ic.Key s={26} c="#fff" />
              </div>
              <h3>Set a new password</h3>
              {emailFromFP && (
                <p>Setting a new password for <strong>{emailFromFP}</strong></p>
              )}
            </div>

            {error && <div className="rp-error">{error}</div>}

            <form onSubmit={handleResetPassword}>
              <div className="rp-form">

                <PwField
                  label="New password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  showPw={showPw}
                  onToggle={() => setShowPw((v) => !v)}
                  showStrength
                  placeholder="New password"
                />

                <PwField
                  label="Confirm new password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  showPw={showPw2}
                  onToggle={() => setShowPw2((v) => !v)}
                  placeholder="Repeat new password"
                  matchState={match}
                />

                <button
                  type="submit"
                  className="rp-submit"
                  disabled={loading || !pw || !pw2}
                >
                  {loading
                    ? <><Spinner /> Updating…</>
                    : <>Update password <Ic.Arrow s={17} /></>
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