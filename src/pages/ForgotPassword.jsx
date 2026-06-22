/**
 * src/pages/ForgotPassword.jsx
 * Route: /forgot-password
 *
 * Step 1 — Enter email → sends reset link
 */

import { useState }        from "react";
import { useNavigate }     from "react-router-dom";
import axios               from "axios";
import "../styles/AuthPage.css";

const API = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;

/* ── icons ── */
function IcMail({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
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
function IcBack({ s = 16 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
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
function IcCheck({ s = 40, c = "#FF5C00" }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
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
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/forgot-password`, {
        email: email.trim().toLowerCase(),
      });
      /* Always show success — API never reveals if email exists */
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── success state ── */
  if (sent) {
    return (
      <div className="fp-page">
        <div className="fp-card">

          <div className="fp-logo">
            <div className="ap-logo-icon" style={{ width: 42, height: 42 }}>
              <div className="ap-logo-ring" />
              <IcBag />
            </div>
            <span className="ap-logo-name">
              Loe<b>mart</b>
            </span>
          </div>

          <div className="fp-success-icon">
            <IcCheck s={44} c="#FF5C00" />
          </div>

          <h2 className="fp-title">Check your inbox</h2>
          <p className="fp-desc">
            If an account exists for <strong>{email}</strong>, we sent a
            password reset link. It expires in <strong>30 minutes</strong>.
          </p>

          <div className="fp-info-box">
            <p>Did not receive it? Check your <strong>spam folder</strong>.</p>
          </div>

          <button
            className="ap-submit"
            style={{ marginTop: 8 }}
            onClick={() => { setSent(false); setEmail(""); }}
          >
            Try a different email
          </button>

          <button
            type="button"
            className="fp-back-btn"
            onClick={() => navigate("/auth")}
          >
            <IcBack /> Back to login
          </button>

        </div>
      </div>
    );
  }

  /* ── request form ── */
  return (
    <div className="fp-page">
      <div className="fp-card">

        {/* Logo */}
        <div className="fp-logo">
          <div className="ap-logo-icon" style={{ width: 42, height: 42 }}>
            <div className="ap-logo-ring" />
            <IcBag />
          </div>
          <span className="ap-logo-name">
            Loe<b>mart</b>
          </span>
        </div>

        {/* Icon */}
        <div className="fp-icon">
          <IcMail s={30} />
        </div>

        <h2 className="fp-title">Forgot your password?</h2>
        <p className="fp-desc">
          Enter the email address linked to your account and we will send
          you a secure reset link.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: "100%", marginTop: 24 }}>
          <div className="ap-form">
            <div className="ap-field">
              <label className="ap-label">Email address</label>
              <div className="ap-iw">
                <span className="ap-icon"><IcMail /></span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="your@email.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="fp-error">{error}</div>
            )}

            <button type="submit" className="ap-submit" disabled={loading}>
              {loading
                ? <><Spinner /> Sending link...</>
                : <>Send Reset Link <IcArrow /></>
              }
            </button>
          </div>
        </form>

        <button
          type="button"
          className="fp-back-btn"
          onClick={() => navigate("/auth")}
        >
          <IcBack /> Back to login
        </button>

      </div>
    </div>
  );
}