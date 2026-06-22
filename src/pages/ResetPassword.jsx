/**
 * src/pages/ResetPassword.jsx
 * Route: /reset-password?token=xxxx
 *
 * Step 2 — Choose new password
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import "../styles/AuthPage.css";

const API = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;

/* ── password strength (same as AuthPage) ── */
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
    { label: "8+ chars",  met: pw.length >= 8         },
    { label: "Uppercase", met: /[A-Z]/.test(pw)        },
    { label: "Number",    met: /[0-9]/.test(pw)        },
    { label: "Symbol",    met: /[^A-Za-z0-9]/.test(pw) },
  ];
  return { ...STRENGTH_LEVELS[checks.filter((c) => c.met).length], checks };
};

/* ── icons ── */
function IcLock({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  );
}
function IcEye({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IcEyeOff({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function IcCheck({ s = 10, c = "currentColor" }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IcArrow({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function IcBag({ s = 20, c = "#fff" }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function IcSuccess({ s = 44 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="#FF5C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function IcAlert({ s = 44 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="ap-spinner" width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function ResetPassword() {
  const navigate                  = useNavigate();
  const [searchParams]            = useSearchParams();
  const token                     = searchParams.get("token") ?? "";

  /* token validation */
  const [tokenState, setTokenState] = useState("checking"); // checking | valid | invalid
  const [maskedEmail, setMaskedEmail] = useState("");
  const [expiresIn,   setExpiresIn]   = useState(null);

  /* form */
  const [password,    setPassword]    = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [done,        setDone]        = useState(false);

  const pw = useMemo(() => getStrength(password), [password]);

  /* ── validate token on mount ── */
  useEffect(() => {
    if (!token) { setTokenState("invalid"); return; }

    axios
      .get(`${API}/reset-password/${token}`)
      .then(({ data }) => {
        setTokenState("valid");
        setMaskedEmail(data.email ?? "");
        setExpiresIn(data.expiresIn ?? null);
      })
      .catch(() => setTokenState("invalid"));
  }, [token]);

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/reset-password`, { token, password });
      setDone(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Logo ── */
  const Logo = (
    <div className="fp-logo">
      <div className="ap-logo-icon" style={{ width: 42, height: 42 }}>
        <div className="ap-logo-ring" />
        <IcBag />
      </div>
      <span className="ap-logo-name">Loe<b>mart</b></span>
    </div>
  );

  /* ── checking ── */
  if (tokenState === "checking") {
    return (
      <div className="fp-page">
        <div className="fp-card">
          {Logo}
          <div className="fp-spinner-wrap">
            <div className="fp-ring" />
          </div>
          <p className="fp-desc" style={{ textAlign: "center", marginTop: 16 }}>
            Validating your reset link…
          </p>
        </div>
      </div>
    );
  }

  /* ── invalid / expired ── */
  if (tokenState === "invalid") {
    return (
      <div className="fp-page">
        <div className="fp-card">
          {Logo}
          <div className="fp-success-icon">
            <IcAlert s={44} />
          </div>
          <h2 className="fp-title">Link expired or invalid</h2>
          <p className="fp-desc">
            This password reset link has expired or already been used.
            Reset links are only valid for <strong>30 minutes</strong>.
          </p>
          <button
            className="ap-submit"
            style={{ marginTop: 8 }}
            onClick={() => navigate("/forgot-password")}
          >
            Request a new link <IcArrow />
          </button>
          <button
            type="button"
            className="fp-back-btn"
            onClick={() => navigate("/auth")}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  /* ── success ── */
  if (done) {
    return (
      <div className="fp-page">
        <div className="fp-card">
          {Logo}
          <div className="fp-success-icon">
            <IcSuccess s={44} />
          </div>
          <h2 className="fp-title">Password updated!</h2>
          <p className="fp-desc">
            Your password has been reset successfully.
            You can now log in with your new password.
          </p>
          <button
            className="ap-submit"
            style={{ marginTop: 8 }}
            onClick={() => navigate("/auth")}
          >
            Go to login <IcArrow />
          </button>
        </div>
      </div>
    );
  }

  /* ── reset form ── */
  return (
    <div className="fp-page">
      <div className="fp-card">
        {Logo}

        {/* icon */}
        <div className="fp-icon">
          <IcLock s={30} />
        </div>

        <h2 className="fp-title">Create new password</h2>
        <p className="fp-desc">
          {maskedEmail && (
            <>For <strong style={{ color: "#FF5C00" }}>{maskedEmail}</strong>. </>
          )}
          {expiresIn && (
            <span style={{ color: "#DC2626" }}>
              Expires in ~{expiresIn} min.
            </span>
          )}
        </p>

        <form onSubmit={handleSubmit} style={{ width: "100%", marginTop: 24 }}>
          <div className="ap-form">

            {/* new password */}
            <div className="ap-field">
              <label className="ap-label">New Password</label>
              <div className="ap-iw">
                <span className="ap-icon"><IcLock /></span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className="ap-eye"
                        onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
                  {showPw ? <IcEyeOff /> : <IcEye />}
                </button>
              </div>

              {/* strength meter */}
              {password && (
                <div className="ap-pw">
                  <div className="ap-pw-bars">
                    {[1,2,3,4].map((v) => (
                      <div key={v}
                           className={`ap-pw-bar${pw.score >= v ? " ap-pw-bar--on" : ""}`}
                           style={pw.score >= v ? { background: pw.color } : {}} />
                    ))}
                  </div>
                  <div className="ap-pw-label" style={{ color: pw.color }}>{pw.label}</div>
                  <div className="ap-pw-checks">
                    {pw.checks.map((c, i) => (
                      <span key={i}
                            className={`ap-pw-check ${c.met ? "ap-pw-check--met" : "ap-pw-check--no"}`}>
                        {c.met
                          ? <IcCheck s={10} c="#15803D" />
                          : <span style={{ width:10,height:10,display:"inline-block",
                              borderRadius:"50%",border:"1.5px solid #B0AAA3" }} />
                        }
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* confirm password */}
            <div className="ap-field">
              <label className="ap-label">Confirm New Password</label>
              <div className={`ap-iw ${
                confirmPw && confirmPw !== password ? "ap-iw--error" : ""
              }`}>
                <span className="ap-icon"><IcLock /></span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => { setConfirmPw(e.target.value); setError(""); }}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
                <button type="button" className="ap-eye"
                        onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}>
                  {showConfirm ? <IcEyeOff /> : <IcEye />}
                </button>
              </div>
              {confirmPw && confirmPw !== password && (
                <p className="fp-match-error">Passwords do not match</p>
              )}
              {confirmPw && confirmPw === password && password.length >= 8 && (
                <p className="fp-match-ok">
                  <IcCheck s={11} c="#15803D" /> Passwords match
                </p>
              )}
            </div>

            {/* error */}
            {error && <div className="fp-error">{error}</div>}

            {/* submit */}
            <button
              type="submit"
              className="ap-submit"
              disabled={
                loading                   ||
                password.length < 8       ||
                password !== confirmPw    ||
                pw.score < 2
              }
            >
              {loading
                ? <><Spinner /> Updating password...</>
                : <>Set New Password <IcArrow /></>
              }
            </button>

          </div>
        </form>

      </div>
    </div>
  );
}