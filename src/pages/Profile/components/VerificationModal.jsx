// src/pages/Profile/components/VerificationModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authH = () => ({
  Authorization : `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/* ── Icons ── */
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6"  y1="6" x2="18" y2="18"/>
  </svg>
);
const IconMail = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polyline points="22,4 12,13 2,4"/>
  </svg>
);
const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconLoader = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
    style={{ animation: "spin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>
);

export default function VerificationModal({
  isOpen,
  userEmail,
  onClose,
  onSuccess,
}) {
  const [step,        setStep]        = useState("send");   // "send" | "verify" | "done"
  const [otp,         setOtp]         = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRef    = useRef(null);
  const timerRef    = useRef(null);
  const mountedRef  = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
    };
  }, []);

  /* Auto-focus OTP input when step changes to verify */
  useEffect(() => {
    if (step === "verify") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step]);

  /* Reset when modal opens */
  useEffect(() => {
    if (isOpen) {
      setStep("send");
      setOtp("");
      setError(null);
      setResendTimer(0);
    }
  }, [isOpen]);

  /* Countdown timer for resend */
  const startResendTimer = useCallback(() => {
    setResendTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1_000);
  }, []);

  /* ── Send OTP ── */
  const sendOtp = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/auth/send-verification`, {
        method : "POST",
        headers: authH(),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "ALREADY_VERIFIED") {
          /* Edge case: already verified (e.g. another tab) */
          onSuccess?.();
          return;
        }
        throw new Error(data.message || "Failed to send code.");
      }

      if (mountedRef.current) {
        setStep("verify");
        startResendTimer();
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [startResendTimer, onSuccess]);

  /* ── Verify OTP ── */
  const verifyOtp = useCallback(async () => {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/auth/verify-email`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({ otp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
          (data.remaining != null
            ? `Wrong code. ${data.remaining} attempt(s) left.`
            : "Verification failed.")
        );
      }

      /* ✓ Verified */
      if (mountedRef.current) {
        setStep("done");
        clearInterval(timerRef.current);
        /* Auto-close and notify parent after 1.5s */
        setTimeout(() => {
          if (mountedRef.current) onSuccess?.();
        }, 1_500);
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [otp, onSuccess]);

  /* OTP input — digits only, auto-submit at 6 */
  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(val);
    setError(null);
    if (val.length === 6) {
      /* slight delay so user sees full input before submit */
      setTimeout(() => verifyOtp(), 120);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="vm-overlay" role="dialog" aria-modal="true"
         aria-label="Email verification">

      <div className="vm-sheet">

        {/* Close */}
        <button className="vm-close" onClick={onClose} aria-label="Close">
          <IconX />
        </button>

        {/* ── STEP: send ── */}
        {step === "send" && (
          <>
            <div className="vm-icon-wrap">
              <IconMail />
            </div>
            <h2 className="vm-title">Verify your email</h2>
            <p className="vm-sub">
              We'll send a 6-digit code to
              <br />
              <strong>{userEmail}</strong>
            </p>
            {error && <p className="vm-error">{error}</p>}
            <button
              className="vm-btn vm-btn--primary"
              onClick={sendOtp}
              disabled={loading}
            >
              {loading ? <><IconLoader /> Sending…</> : "Send verification code"}
            </button>
            <button className="vm-btn vm-btn--ghost" onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {/* ── STEP: verify ── */}
        {step === "verify" && (
          <>
            <div className="vm-icon-wrap vm-icon-wrap--sent">
              <IconMail />
            </div>
            <h2 className="vm-title">Enter the code</h2>
            <p className="vm-sub">
              Sent to <strong>{userEmail}</strong>.<br/>
              Check your spam folder if you don't see it.
            </p>

            <input
              ref={inputRef}
              className="vm-otp-input"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={handleOtpChange}
              disabled={loading}
              autoComplete="one-time-code"
            />

            {error && <p className="vm-error">{error}</p>}

            <button
              className="vm-btn vm-btn--primary"
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? <><IconLoader /> Verifying…</> : "Verify email"}
            </button>

            {/* Resend */}
            <button
              className="vm-btn vm-btn--ghost"
              onClick={() => {
                setOtp("");
                setError(null);
                sendOtp();
              }}
              disabled={resendTimer > 0 || loading}
            >
              {resendTimer > 0
                ? `Resend in ${resendTimer}s`
                : "Resend code"}
            </button>
          </>
        )}

        {/* ── STEP: done ── */}
        {step === "done" && (
          <>
            <div className="vm-icon-wrap vm-icon-wrap--done">
              <IconCheck />
            </div>
            <h2 className="vm-title">Email verified!</h2>
            <p className="vm-sub">
              Opening airtime claim…
            </p>
          </>
        )}

      </div>
    </div>
  );
}