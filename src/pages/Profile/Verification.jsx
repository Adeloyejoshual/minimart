// src/pages/Verification.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence }                           from "framer-motion";
import { useNavigate }                                       from "react-router-dom";
import {
  Shield, Mail, CheckCircle, Store,
  Loader2, XCircle, RefreshCw, Lock,
  ArrowRight, BadgeCheck,
} from "lucide-react";
import "../../style/Verification.css";

const API = "https://minimart-ivrm.onrender.com/api";

/* ══════════════════════════════════════════════════════════════════════════════
   POLICY ENGINE
══════════════════════════════════════════════════════════════════════════════ */
const policy = {
  canBrowse   : ()  => true,
  canBuy      : ()  => true,
  canChat     : (c) => c.email_verified === true,
  canPost     : (c) => c.email_verified === true && c.role === "seller",
  canWithdraw : (c) =>
    c.email_verified === true &&
    c.store_verified === true &&
    c.seller_type    === "store_owner",
  resolve: (claims = {}) => ({
    can_browse   : policy.canBrowse(),
    can_buy      : policy.canBuy(),
    can_chat     : policy.canChat(claims),
    can_post     : policy.canPost(claims),
    can_withdraw : policy.canWithdraw(claims),
  }),
};

/* ══════════════════════════════════════════════════════════════════════════════
   STATUS HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const CHIP_MAP = {
  complete  : "Completed",
  active    : "Active",
  in_review : "In Review",
  rejected  : "Rejected",
  pending   : "Pending",
};

const buildStatusRows = (status) => {
  if (!status) return [];
  const emailDone = status.email_verified === true;
  const storeDone = status.store_verified === true;
  const isSeller  = status.role === "seller" || status.role === "admin";
  const reviewSt  = status.store_review?.status  || null;
  const reviewMsg = status.store_review?.message || null;

  const storeStatus = storeDone
    ? "complete"
    : reviewSt === "rejected" ? "rejected"
    : reviewSt === "pending"  ? "in_review"
    : "pending";

  return [
    { id: "email",  label: "Email Verification", status: emailDone ? "complete" : "active",                                adminMessage: null                                          },
    { id: "seller", label: "Seller Access",       status: isSeller ? "complete" : emailDone ? "active" : "pending",          adminMessage: null                                          },
    { id: "store",  label: "Store Verification",  status: storeStatus,                                                       adminMessage: storeStatus === "rejected" ? reviewMsg : null  },
    { id: "trust",  label: "Profile Status",      status: emailDone ? "active" : "pending",                                  adminMessage: null                                          },
  ];
};

/* ══════════════════════════════════════════════════════════════════════════════
   CHIP
══════════════════════════════════════════════════════════════════════════════ */
function Chip({ status }) {
  return (
    <span className={`v-chip v-chip--${status}`}>
      {CHIP_MAP[status] || "Pending"}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   STATUS ROW
══════════════════════════════════════════════════════════════════════════════ */
function StatusRow({ label, status, adminMessage }) {
  const isActive = status !== "pending";
  return (
    <div>
      <div className={`status-row status-row--${status}`}>
        <span className={`status-row-label ${
          isActive ? "status-row-label--active" : "status-row-label--pending"
        }`}>
          {label}
        </span>
        <Chip status={status} />
      </div>

      {status === "rejected" && adminMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y:  0 }}
          className="admin-feedback"
        >
          <p className="admin-feedback-title">Review Result</p>
          <p className="admin-feedback-text">{adminMessage}</p>
        </motion.div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SCORE ROW
══════════════════════════════════════════════════════════════════════════════ */
function ScoreRow({ label, points, done }) {
  return (
    <div className="score-row">
      {done
        ? <CheckCircle size={14} className="score-row-dot score-row-dot--done" />
        : <div className="score-row-dot--empty" />
      }
      <span className={`score-row-label ${
        done ? "score-row-label--done" : "score-row-label--pending"
      }`}>
        {label}
      </span>
      <span className={`score-row-points ${
        done ? "score-row-points--done" : "score-row-points--pending"
      }`}>
        +{points}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TRUST RING
══════════════════════════════════════════════════════════════════════════════ */
function TrustRing({ score = 0 }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const cfg  =
    score >= 80 ? { color: "#22c55e", label: "Excellent" } :
    score >= 60 ? { color: "#3b82f6", label: "Good"      } :
    score >= 40 ? { color: "#f59e0b", label: "Fair"      } :
                  { color: "#ef4444", label: "Low"        };

  return (
    <div className="trust-ring-wrapper">
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="130" height="130" viewBox="0 0 140 140" className="trust-ring-svg">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
          <motion.circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={cfg.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            animate={{ strokeDashoffset: circ - (score / 100) * circ }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
          />
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <motion.span
            key={score}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1   }}
            className="trust-ring-score"
          >
            {score}
          </motion.span>
          <span className="trust-ring-max">/ 100</span>
        </div>
      </div>
      <span className="trust-ring-label">{cfg.label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   OTP INPUT
══════════════════════════════════════════════════════════════════════════════ */
function OTPInput({ length = 6, value, onChange, disabled, hasError }) {
  const refs = useRef([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);

  const handleChange = (i, e) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) {
      const arr = value.split(""); arr[i] = "";
      onChange(arr.join(""));
      if (i > 0) refs.current[i - 1]?.focus();
      return;
    }
    const arr = value.split(""); arr[i] = val.slice(-1);
    onChange(arr.join(""));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted.padEnd(length, "").slice(0, length));
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="otp-group">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`otp-input ${
            hasError    ? "otp-input--error"  :
            value[i]    ? "otp-input--filled" : ""
          }`}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COUNTDOWN
══════════════════════════════════════════════════════════════════════════════ */
function Countdown({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    let active = true;
    const t = setInterval(() => {
      if (!active) return;
      setLeft((p) => {
        if (p <= 1) { clearInterval(t); onComplete?.(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { active = false; clearInterval(t); };
  }, []);

  return (
    <span className={`countdown-value ${
      left < 20 ? "countdown-value--warn" : "countdown-value--normal"
    }`}>
      {left}s
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════════ */
export default function Verification() {
  const navigate = useNavigate();

  const [status,          setStatus]          = useState(null);
  const [pageLoading,     setPageLoading]     = useState(true);
  const [step,            setStep]            = useState("overview");
  const [otp,             setOtp]             = useState("");
  const [sending,         setSending]         = useState(false);
  const [verifying,       setVerifying]       = useState(false);
  const [canResend,       setCanResend]       = useState(false);
  const [error,           setError]           = useState("");
  const [attemptsLeft,    setAttemptsLeft]    = useState(5);
  const [hasError,        setHasError]        = useState(false);
  const [resendRemaining, setResendRemaining] = useState(2);

  const verifyingRef = useRef(false);

  const authHeaders = useCallback(() => ({
    "Content-Type" : "application/json",
    Authorization  : `Bearer ${localStorage.getItem("token")}`,
  }), []);

  /* ── Fetch status ─────────────────────────────────────────────────────────── */
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/verification/status`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
        if (typeof data.resend_remaining === "number") setResendRemaining(data.resend_remaining);
      } else if (res.status === 401) {
        navigate("/login");
      }
    } catch (err) {
      console.error("[fetchStatus]", err.message);
    } finally {
      setPageLoading(false);
    }
  }, [authHeaders, navigate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── Derived ──────────────────────────────────────────────────────────────── */
  const permissions = useMemo(() => policy.resolve({
    email_verified : status?.email_verified,
    store_verified : status?.store_verified,
    role           : status?.role,
    seller_type    : status?.seller_type,
  }), [status]);

  const statusRows      = useMemo(() => buildStatusRows(status), [status]);
  const trustScore      = status?.trust_score    || 0;
  const emailVerified   = status?.email_verified || false;
  const storeVerified   = status?.store_verified || false;
  const storeReview     = status?.store_review   || null;
  const isSeller        = status?.role === "seller" || status?.role === "admin";
  const storeChipStatus = storeVerified
    ? "complete"
    : storeReview?.status === "rejected" ? "rejected"
    : storeReview?.status === "pending"  ? "in_review"
    : "pending";

  /* ── Send OTP ─────────────────────────────────────────────────────────────── */
  const sendOTP = useCallback(async () => {
    setSending(true); setError(""); setOtp(""); setHasError(false);
    try {
      const res  = await fetch(`${API}/verification/send-email-otp`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setStep("otp"); setCanResend(false);
        if (typeof data.remaining === "number") setResendRemaining(data.remaining);
      } else {
        setError(data.message || "Failed to send code.");
        if (res.status === 429 && data.remaining === 0) setResendRemaining(0);
      }
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }, [authHeaders]);

  /* ── Verify OTP ───────────────────────────────────────────────────────────── */
  const verifyOTP = useCallback(async () => {
    if (otp.length < 6 || verifyingRef.current || verifying) return;
    verifyingRef.current = true;
    setVerifying(true); setError(""); setHasError(false);
    try {
      const res  = await fetch(`${API}/verification/verify-email-otp`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus((prev) => ({
          ...prev,
          email_verified: true,
          trust_score: data.trust_score ?? (prev?.trust_score || 0) + 40,
        }));
        setStep("success");
        fetchStatus();
      } else {
        setHasError(true); setOtp("");
        setError(data.message || "Invalid code.");
        if (typeof data.attemptsLeft === "number") setAttemptsLeft(data.attemptsLeft);
        setTimeout(() => setHasError(false), 600);
      }
    } catch { setError("Network error."); }
    finally { setVerifying(false); verifyingRef.current = false; }
  }, [otp, verifying, authHeaders, fetchStatus]);

  /* ── Auto-submit ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !verifying && !verifyingRef.current) {
      const t = setTimeout(() => verifyOTP(), 120);
      return () => clearTimeout(t);
    }
  }, [otp, step, verifying, verifyOTP]);

  const goBack = useCallback(() => {
    setStep("overview"); setError(""); setOtp(""); setHasError(false);
  }, []);

  /* ── Loading ──────────────────────────────────────────────────────────────── */
  if (pageLoading) {
    return (
      <div className="v-loading">
        <Loader2 size={26} className="v-spinner" />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="verification-page">
      <div className="verification-container">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y:   0 }}
          className="verification-header"
        >
          <div className="verification-header-icon">
            <Shield size={24} />
          </div>
          <h1 className="verification-title">Account Verification</h1>
          <p className="verification-subtitle">Complete to access seller features</p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════════
              OVERVIEW
          ════════════════════════════════════════════════════════════════ */}
          {step === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 14  }}
              animate={{ opacity: 1, y: 0   }}
              exit={{    opacity: 0, y: -14 }}
              transition={{ duration: 0.2 }}
            >
              {/* Trust Score */}
              <div className="v-card v-card--centered">
                <TrustRing score={trustScore} />
                <div className="score-breakdown">
                  <ScoreRow label="Email verified"       points={40} done={emailVerified}    />
                  <ScoreRow label="Store verified"       points={20} done={storeVerified}    />
                  <ScoreRow label="Account age 30 days" points={10} done={trustScore >= 60} />
                  <ScoreRow label="Account age 90 days" points={10} done={trustScore >= 70} />
                </div>
              </div>

              {/* Verification Status */}
              <div className="v-card">
                <div className="v-section-title">
                  <BadgeCheck size={14} />
                  Verification Status
                </div>
                {statusRows.map((row) => (
                  <StatusRow
                    key={row.id}
                    label={row.label}
                    status={row.status}
                    adminMessage={row.adminMessage}
                  />
                ))}
              </div>

              {/* Email action */}
              {!emailVerified && (
                <div className="v-card">
                  <div className="action-row">
                    <div className="action-row-icon action-row-icon--email">
                      <Mail size={20} />
                    </div>
                    <div className="action-row-info">
                      <p className="action-row-title">Email Verification</p>
                      <p className="action-row-email">{status?.email || "—"}</p>
                    </div>
                    <button
                      onClick={sendOTP}
                      disabled={sending}
                      className="v-btn v-btn--primary"
                    >
                      {sending
                        ? <Loader2 size={13} className="v-spinner" />
                        : <ArrowRight size={13} />
                      }
                      {sending ? "Sending" : "Verify"}
                    </button>
                  </div>
                </div>
              )}

              {/* Store card */}
              <div className={`v-card ${!emailVerified ? "v-card--disabled" : ""}`}>
                <div className="action-row">
                  <div className={`action-row-icon ${
                    storeVerified ? "action-row-icon--store-verified" : "action-row-icon--store"
                  }`}>
                    <Store size={20} />
                  </div>
                  <div className="action-row-info">
                    <p className={`action-row-title ${!storeVerified ? "action-row-title--dim" : ""}`}>
                      Store Verification
                    </p>
                  </div>
                  <Chip status={storeChipStatus} />
                </div>

                {storeChipStatus === "rejected" && storeReview?.message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y:  0 }}
                    className="admin-feedback"
                  >
                    <p className="admin-feedback-title">Review Result</p>
                    <p className="admin-feedback-text">{storeReview.message}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              OTP
          ════════════════════════════════════════════════════════════════ */}
          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20  }}
              animate={{ opacity: 1, x: 0   }}
              exit={{    opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <button onClick={goBack} className="v-btn--back">← Back</button>

              <div className="v-card" style={{ padding: "32px 24px", marginTop: 12 }}>

                <div className="otp-header">
                  <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1,    opacity: 1 }}
                    className="otp-header-icon"
                  >
                    <Mail size={26} />
                  </motion.div>
                  <h2 className="otp-header-title">Enter Verification Code</h2>
                  <p className="otp-header-subtitle">
                    Sent to <span className="otp-header-email">{status?.email}</span>
                  </p>
                </div>

                <OTPInput
                  length={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={verifying}
                  hasError={hasError}
                />
                <p className="otp-helper">Auto-submit enabled</p>

                <AnimatePresence>
                  {verifying && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{    opacity: 0 }}
                      className="verifying-indicator"
                    >
                      <Loader2 size={14} className="v-spinner" />
                      <span>Verifying</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y:  0 }}
                      exit={{    opacity: 0        }}
                      className="v-error"
                    >
                      <XCircle size={14} className="v-error-icon" />
                      <div>
                        <p className="v-error-text">{error}</p>
                        {attemptsLeft < 5 && attemptsLeft > 0 && (
                          <p className="v-error-attempts">
                            {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="resend-row">
                  <div>
                    {resendRemaining <= 0 ? (
                      <span className="resend-limit">Daily limit reached</span>
                    ) : canResend ? (
                      <button onClick={sendOTP} disabled={sending} className="v-btn v-btn--link">
                        <RefreshCw size={12} className={sending ? "v-spinner" : ""} />
                        Resend code
                        {resendRemaining > 0 && (
                          <span className="resend-remaining">({resendRemaining} left)</span>
                        )}
                      </button>
                    ) : (
                      <div className="resend-countdown">
                        <span>Resend in</span>
                        <Countdown seconds={60} onComplete={() => setCanResend(true)} />
                      </div>
                    )}
                  </div>

                  <div className="security-note">
                    <Lock size={11} />
                    <span>Do not share this code</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SUCCESS
          ════════════════════════════════════════════════════════════════ */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1    }}
              exit={{    opacity: 0               }}
              transition={{ duration: 0.22 }}
            >
              <div className="v-card" style={{ padding: "32px 24px" }}>

                <div className="success-header">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, delay: 0.08 }}
                    className="success-icon"
                  >
                    <CheckCircle size={28} />
                  </motion.div>
                  <h2 className="success-title">Email Verified</h2>
                  <p className="success-subtitle">Verification successful</p>
                </div>

                <StatusRow label="Email Verification" status="complete"                                                                                           adminMessage={null}                                                  />
                <StatusRow label="Seller Access"       status={isSeller ? "complete" : "pending"}                                                                  adminMessage={null}                                                  />
                <StatusRow label="Store Verification"  status={storeChipStatus}                                                                                    adminMessage={storeChipStatus === "rejected" ? storeReview?.message : null} />
                <StatusRow label="Profile Status"      status="active"                                                                                             adminMessage={null}                                                  />

                <div className="trust-score-row">
                  <span className="trust-score-label">Trust Score</span>
                  <span className="trust-score-value">{trustScore} / 100</span>
                </div>

                <div className="v-btn-group">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{  scale: 0.98 }}
                    onClick={() => setStep("overview")}
                    className="v-btn v-btn--success v-btn--full"
                  >
                    Continue
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{  scale: 0.98 }}
                    onClick={() => navigate("/dashboard")}
                    className="v-btn v-btn--ghost v-btn--full"
                  >
                    Dashboard
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}