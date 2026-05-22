// src/pages/Verification.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Mail, CheckCircle, Store, Loader2, XCircle,
  RefreshCw, Lock, ArrowRight, BadgeCheck, Upload,
  Camera, FileText, User, X, Image, CreditCard,
} from "lucide-react";
import "../../style/Verification.css";

const API = "https://minimart-ivrm.onrender.com/api";

/* ══════════════════════════════════════════════════════════════════════════════
   DOCUMENT TYPES
══════════════════════════════════════════════════════════════════════════════ */
const DOC_TYPES = [
  { value: "nin",             label: "National ID (NIN)",      numberLabel: "NIN Number",      needsBack: false },
  { value: "passport",        label: "International Passport", numberLabel: "Passport Number",  needsBack: false },
  { value: "drivers_license", label: "Driver's License",       numberLabel: "License Number",   needsBack: true  },
  { value: "voters_card",     label: "Voter's Card",           numberLabel: "VIN",              needsBack: false },
];

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const formatSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/* ══════════════════════════════════════════════════════════════════════════════
   SUB COMPONENTS
══════════════════════════════════════════════════════════════════════════════ */
function Chip({ status }) {
  const m = { complete: "Completed", active: "Active", in_review: "In Review", rejected: "Rejected", pending: "Pending" };
  return <span className={`v-chip v-chip--${status}`}>{m[status] || "Pending"}</span>;
}

function ScoreRow({ label, points, done }) {
  return (
    <div className="score-row">
      {done ? <CheckCircle size={14} className="score-dot-done" /> : <div className="score-dot-empty" />}
      <span className={`score-label ${done ? "score-label--done" : "score-label--pending"}`}>{label}</span>
      <span className={`score-points ${done ? "score-points--done" : "score-points--pending"}`}>+{points}</span>
    </div>
  );
}

function TrustRing({ score = 0 }) {
  const r = 52, c = 2 * Math.PI * r;
  const cfg = score >= 80 ? { color: "#22c55e", label: "Excellent" } : score >= 60 ? { color: "#3b82f6", label: "Good" } : score >= 40 ? { color: "#f59e0b", label: "Fair" } : { color: "#ef4444", label: "Low" };
  return (
    <div className="trust-ring-wrap">
      <div className="trust-ring-center">
        <svg width="130" height="130" viewBox="0 0 140 140" className="trust-ring-svg">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
          <motion.circle cx="70" cy="70" r={r} fill="none" stroke={cfg.color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c}
            animate={{ strokeDashoffset: c - (score / 100) * c }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }} />
        </svg>
        <div className="trust-ring-score">
          <motion.strong key={score} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>{score}</motion.strong>
          <span>/ 100</span>
        </div>
      </div>
      <span className="trust-ring-label">{cfg.label}</span>
    </div>
  );
}

function OTPInput({ length = 6, value, onChange, disabled, hasError }) {
  const refs = useRef([]);
  useEffect(() => { setTimeout(() => refs.current[0]?.focus(), 300); }, []);

  const handleChange = (i, e) => {
    const val = e.target.value.replace(/\D/g, "");
    const arr = value.split("");
    if (!val) {
      arr[i] = "";
      onChange(arr.join(""));
      if (i > 0) refs.current[i - 1]?.focus();
      return;
    }
    arr[i] = val.slice(-1);
    onChange(arr.join(""));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(p.padEnd(length, "").slice(0, length));
    refs.current[Math.min(p.length, length - 1)]?.focus();
  };

  return (
    <div className="otp-group">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i} ref={el => (refs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ""} disabled={disabled}
          className={`otp-input ${hasError ? "otp-input--error" : value[i] ? "otp-input--filled" : ""}`}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

function Countdown({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    let go = true;
    const t = setInterval(() => {
      if (!go) return;
      setLeft(p => { if (p <= 1) { clearInterval(t); onComplete?.(); return 0; } return p - 1; });
    }, 1000);
    return () => { go = false; clearInterval(t); };
  }, []);
  return <span className={`countdown-value ${left < 20 ? "countdown-value--warn" : "countdown-value--normal"}`}>{left}s</span>;
}

function FileUpload({ label, hint, accept, file, onFileChange, onRemove }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (file) return (
    <div className="upload-area upload-area--has-file">
      <div className="upload-preview">
        {preview && file.type.startsWith("image/") ? <img src={preview} alt="" /> :
          <div style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#1f2937", borderRadius: 8 }}><FileText size={24} style={{ color: "#6b7280" }} /></div>}
        <div className="upload-preview-info">
          <p className="upload-preview-name">{file.name}</p>
          <p className="upload-preview-size">{formatSize(file.size)}</p>
        </div>
        <button className="upload-remove" onClick={onRemove} type="button"><X size={16} /></button>
      </div>
    </div>
  );

  return (
    <label className="upload-area">
      <input type="file" accept={accept} onChange={e => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); e.target.value = ""; }} />
      <Upload size={24} className="upload-icon" />
      <p className="upload-text">{label}</p>
      <p className="upload-hint">{hint}</p>
    </label>
  );
}

function SelfieCapture({ file, onFileChange, onRemove }) {
  const [preview, setPreview] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className="selfie-area">
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); e.target.value = ""; }} />
      <div className="selfie-preview">
        {preview ? <img src={preview} alt="" /> : <div className="selfie-placeholder"><User size={36} /><span>No photo</span></div>}
      </div>
      <div className="selfie-buttons">
        {file ? (
          <>
            <button className="v-btn v-btn--ghost v-btn--small" onClick={() => { ref.current?.setAttribute("capture", "user"); ref.current?.click(); }} type="button"><Camera size={14} /> Retake</button>
            <button className="v-btn v-btn--ghost v-btn--small" onClick={onRemove} type="button"><X size={14} /> Remove</button>
          </>
        ) : (
          <>
            <button className="v-btn v-btn--primary v-btn--small" onClick={() => { ref.current?.setAttribute("capture", "user"); ref.current?.click(); }} type="button"><Camera size={14} /> Take Photo</button>
            <button className="v-btn v-btn--ghost v-btn--small" onClick={() => { ref.current?.removeAttribute("capture"); ref.current?.click(); }} type="button"><Image size={14} /> Gallery</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════════ */
export default function Verification() {
  const navigate = useNavigate();

  const [status, setStatus]             = useState(null);
  const [pageLoading, setPageLoading]   = useState(true);

  // Email
  const [emailStep, setEmailStep]       = useState("idle"); // idle | sending | otp | done
  const [otp, setOtp]                   = useState("");
  const [sending, setSending]           = useState(false);
  const [verifying, setVerifying]       = useState(false);
  const [canResend, setCanResend]       = useState(false);
  const [emailError, setEmailError]     = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [hasOtpError, setHasOtpError]   = useState(false);
  const [resendRemaining, setResendRemaining] = useState(50);

  // Identity
  const [docType, setDocType]           = useState("");
  const [docNumber, setDocNumber]       = useState("");
  const [docFront, setDocFront]         = useState(null);
  const [docBack, setDocBack]           = useState(null);
  const [selfie, setSelfie]             = useState(null);
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idMsg, setIdMsg]               = useState("");

  // Store
  const [storeName, setStoreName]       = useState("");
  const [storeDesc, setStoreDesc]       = useState("");
  const [storeLogo, setStoreLogo]       = useState(null);
  const [storeSubmitting, setStoreSubmitting] = useState(false);
  const [storeMsg, setStoreMsg]         = useState("");

  const verifyingRef = useRef(false);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  /* ── Fetch status ─────────────────────────────────────────────────────────── */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/verification/status`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
        if (data.email_verified) setEmailStep("done");
        if (typeof data.resend_remaining === "number") setResendRemaining(data.resend_remaining);
      } else if (res.status === 401) {
        navigate("/login");
      }
    } catch (e) { console.error("[fetchStatus]", e.message); }
    finally { setPageLoading(false); }
  }, [authHeaders, navigate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── Derived ──────────────────────────────────────────────────────────────── */
  const trustScore       = status?.trust_score || 0;
  const emailVerified    = status?.email_verified || false;
  const identityVerified = status?.identity_verified || false;
  const storeVerified    = status?.store_verified || false;
  const idReview         = status?.identity_review || null;
  const storeReview      = status?.store_review || null;
  const selectedDoc      = DOC_TYPES.find(d => d.value === docType);

  /* ── Send OTP ─────────────────────────────────────────────────────────────── */
  const sendOTP = useCallback(async () => {
    setSending(true);
    setEmailStep("sending");
    setEmailError("");
    setOtp("");
    setHasOtpError(false);

    try {
      const res = await fetch(`${API}/verification/send-email-otp`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();

      if (res.ok) {
        // SUCCESS — transition to OTP input
        setEmailStep("otp");
        setCanResend(false);
        if (typeof data.remaining === "number") setResendRemaining(data.remaining);
      } else {
        // FAILED — show error but stay on OTP step if already there
        setEmailError(data.message || "Failed to send code.");
        // If we were already on OTP step (resend failed), stay on OTP
        // If we were on idle (first send failed), go back to idle
        if (emailStep !== "otp") {
          setEmailStep("idle");
        }
        if (res.status === 429 && data.remaining === 0) setResendRemaining(0);
      }
    } catch {
      setEmailError("Network error. Check your connection.");
      if (emailStep !== "otp") setEmailStep("idle");
    } finally {
      setSending(false);
    }
  }, [authHeaders, emailStep]);

  /* ── Verify OTP ───────────────────────────────────────────────────────────── */
  const verifyOTP = useCallback(async () => {
    if (otp.length < 6 || verifyingRef.current || verifying) return;
    verifyingRef.current = true;
    setVerifying(true);
    setEmailError("");
    setHasOtpError(false);

    try {
      const res = await fetch(`${API}/verification/verify-email-otp`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();

      if (res.ok) {
        setEmailStep("done");
        setStatus(prev => ({
          ...prev,
          email_verified: true,
          trust_score: data.trust_score ?? (prev?.trust_score || 0) + 30,
        }));
        fetchStatus();
      } else {
        setHasOtpError(true);
        setOtp("");
        setEmailError(data.message || "Invalid code.");
        if (typeof data.attemptsLeft === "number") setAttemptsLeft(data.attemptsLeft);
        setTimeout(() => setHasOtpError(false), 600);
      }
    } catch {
      setEmailError("Network error.");
    } finally {
      setVerifying(false);
      verifyingRef.current = false;
    }
  }, [otp, verifying, authHeaders, fetchStatus]);

  // Auto-submit
  useEffect(() => {
    if (otp.length === 6 && emailStep === "otp" && !verifying && !verifyingRef.current) {
      const t = setTimeout(() => verifyOTP(), 150);
      return () => clearTimeout(t);
    }
  }, [otp, emailStep, verifying, verifyOTP]);

  /* ── Submit Identity ──────────────────────────────────────────────────────── */
  const submitIdentity = async () => {
    setIdSubmitting(true); setIdMsg("");
    const fd = new FormData();
    fd.append("document_type", docType);
    fd.append("document_number", docNumber.trim());
    if (docFront) fd.append("doc_front", docFront);
    if (docBack) fd.append("doc_back", docBack);
    if (selfie) fd.append("selfie", selfie);
    try {
      const res = await fetch(`${API}/verification/submit-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      setIdMsg(data.message || (res.ok ? "Submitted." : "Failed."));
      if (res.ok) fetchStatus();
    } catch { setIdMsg("Network error."); }
    finally { setIdSubmitting(false); }
  };

  /* ── Submit Store ─────────────────────────────────────────────────────────── */
  const submitStore = async () => {
    setStoreSubmitting(true); setStoreMsg("");
    const fd = new FormData();
    fd.append("store_name", storeName.trim());
    fd.append("store_description", storeDesc.trim());
    if (storeLogo) fd.append("store_logo", storeLogo);
    try {
      const res = await fetch(`${API}/verification/submit-store`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      setStoreMsg(data.message || (res.ok ? "Submitted." : "Failed."));
      if (res.ok) fetchStatus();
    } catch { setStoreMsg("Network error."); }
    finally { setStoreSubmitting(false); }
  };

  /* ── Loading ──────────────────────────────────────────────────────────────── */
  if (pageLoading) {
    return <div className="v-loading"><Loader2 size={26} className="v-spin" /></div>;
  }

  /* ════════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="verification-page">
      <div className="verification-container">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="v-header">
          <div className="v-header-icon"><Shield size={24} /></div>
          <h1>Account Verification</h1>
          <p>Complete all steps to verify your account</p>
        </motion.div>

        {/* Trust Score */}
        <div className="v-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <TrustRing score={trustScore} />
          <div className="score-breakdown">
            <ScoreRow label="Email verified" points={30} done={emailVerified} />
            <ScoreRow label="Identity verified" points={30} done={identityVerified} />
            <ScoreRow label="Store verified" points={20} done={storeVerified} />
            <ScoreRow label="Account age 30d" points={10} done={trustScore >= 60} />
            <ScoreRow label="Account age 90d" points={10} done={trustScore >= 70} />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 1 — EMAIL VERIFICATION
        ════════════════════════════════════════════════════════════════════ */}
        <motion.div layout className={`step-item ${emailStep === "done" ? "step-item--complete" : emailStep === "otp" ? "step-item--active" : ""}`}>
          <div className="step-item-header">
            <div className={`step-item-icon ${emailStep === "done" ? "step-item-icon--complete" : "step-item-icon--email"}`}>
              {emailStep === "done" ? <CheckCircle size={20} /> : <Mail size={20} />}
            </div>
            <div className="step-item-info">
              <p className="step-item-title">Email Verification</p>
              {emailStep === "done" ? (
                <p className="step-item-verified">
                  <CheckCircle size={12} /> Verified
                  {status?.email_verified_at && (
                    <span style={{ color: "#6b7280", marginLeft: 4 }}>
                      · {new Date(status.email_verified_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </p>
              ) : (
                <p className="step-item-desc">{status?.email || "Verify your email"}</p>
              )}
            </div>
            <div className="step-item-action">
              {emailStep === "done" ? (
                <Chip status="complete" />
              ) : emailStep === "idle" ? (
                <button className="v-btn v-btn--primary v-btn--small" onClick={sendOTP} disabled={sending}>
                  <Mail size={13} /> Verify Email
                </button>
              ) : emailStep === "sending" ? (
                <button className="v-btn v-btn--primary v-btn--small" disabled>
                  <Loader2 size={13} className="v-spin" /> Sending
                </button>
              ) : (
                <Chip status="active" />
              )}
            </div>
          </div>

          {/* Error shown outside OTP area — for send failures */}
          {emailError && emailStep === "idle" && (
            <div className="v-error" style={{ margin: "12px 0 0" }}>
              <XCircle size={14} className="v-error-icon" />
              <div><p className="v-error-text">{emailError}</p></div>
            </div>
          )}

          {/* OTP ENTRY — expands when step is "otp" */}
          <AnimatePresence>
            {emailStep === "otp" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="step-body otp-section"
              >
                {/* OTP header */}
                <div className="otp-section-header">
                  <div className="otp-section-icon">
                    <Mail size={22} />
                  </div>
                  <p className="otp-section-title">Enter Verification Code</p>
                  <p className="otp-section-subtitle">
                    6-digit code sent to <span className="otp-section-email">{status?.email}</span>
                  </p>
                </div>

                {/* OTP inputs */}
                <OTPInput
                  length={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={verifying}
                  hasError={hasOtpError}
                />
                <p className="otp-helper">Auto-submit enabled</p>

                {/* Verifying spinner */}
                {verifying && (
                  <div className="verifying-indicator">
                    <Loader2 size={14} className="v-spin" />
                    <span>Verifying code</span>
                  </div>
                )}

                {/* Error inside OTP area */}
                {emailError && emailStep === "otp" && (
                  <div className="v-error">
                    <XCircle size={14} className="v-error-icon" />
                    <div>
                      <p className="v-error-text">{emailError}</p>
                      {attemptsLeft < 5 && attemptsLeft > 0 && (
                        <p className="v-error-sub">{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} left</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Resend row */}
                <div className="resend-row">
                  <div>
                    {resendRemaining <= 0 ? (
                      <span style={{ fontSize: 13, color: "#4b5563" }}>Daily limit reached</span>
                    ) : canResend ? (
                      <button className="v-btn v-btn--link" onClick={sendOTP} disabled={sending}>
                        <RefreshCw size={12} className={sending ? "v-spin" : ""} />
                        Resend code ({resendRemaining} left)
                      </button>
                    ) : (
                      <div className="resend-countdown">
                        <span>Resend in</span>
                        <Countdown seconds={30} onComplete={() => setCanResend(true)} />
                      </div>
                    )}
                  </div>
                  <div className="security-note">
                    <Lock size={11} />
                    <span>Do not share</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 2 — IDENTITY VERIFICATION
        ════════════════════════════════════════════════════════════════════ */}
        <div className={`step-item ${identityVerified ? "step-item--complete" : ""}`}>
          <div className="step-item-header">
            <div className={`step-item-icon ${identityVerified ? "step-item-icon--complete" : "step-item-icon--id"}`}>
              {identityVerified ? <CheckCircle size={20} /> : <CreditCard size={20} />}
            </div>
            <div className="step-item-info">
              <p className="step-item-title">Identity Verification</p>
              {identityVerified ? (
                <p className="step-item-verified"><CheckCircle size={12} /> Verified</p>
              ) : idReview?.status === "pending" ? (
                <p className="step-item-desc">Under review</p>
              ) : idReview?.status === "rejected" ? (
                <p className="step-item-desc" style={{ color: "#f87171" }}>Rejected — resubmit</p>
              ) : (
                <p className="step-item-desc">Government-issued ID + selfie</p>
              )}
            </div>
            <Chip status={
              identityVerified ? "complete" :
              idReview?.status === "pending" ? "in_review" :
              idReview?.status === "rejected" ? "rejected" : "pending"
            } />
          </div>

          {idReview?.status === "rejected" && idReview?.rejection_reason && (
            <div className="admin-feedback" style={{ margin: "12px 0 0" }}>
              <p className="admin-feedback-title">Review Result</p>
              <p className="admin-feedback-text">{idReview.rejection_reason}</p>
            </div>
          )}

          {!identityVerified && idReview?.status !== "pending" && (
            <div className="step-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Document type selector */}
                <div>
                  <label className="v-field-label">Choose Identification Type</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {DOC_TYPES.map(dt => (
                      <label
                        key={dt.value}
                        className={`step-item ${docType === dt.value ? "step-item--active" : ""}`}
                        style={{ cursor: "pointer", padding: "12px 14px", marginBottom: 0 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="radio" name="docType" value={dt.value}
                            checked={docType === dt.value}
                            onChange={() => { setDocType(dt.value); setDocFront(null); setDocBack(null); setDocNumber(""); setIdMsg(""); }}
                            style={{ accentColor: "#3b82f6" }}
                          />
                          <span style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{dt.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Dynamic fields */}
                <AnimatePresence>
                  {docType && selectedDoc && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}
                    >
                      {/* Document number */}
                      <div>
                        <label className="v-field-label">{selectedDoc.numberLabel}</label>
                        <input
                          type="text" className="v-input"
                          value={docNumber} onChange={e => setDocNumber(e.target.value)}
                          placeholder={`Enter ${selectedDoc.numberLabel}`} maxLength={30}
                        />
                      </div>

                      {/* Front upload */}
                      <div>
                        <label className="v-field-label">
                          {docType === "nin" ? "Upload NIN Slip" :
                           docType === "passport" ? "Upload Passport Photo Page" :
                           docType === "drivers_license" ? "Upload License (Front)" :
                           "Upload Card (Front)"}
                        </label>
                        <FileUpload
                          label="Tap to upload front" hint="JPG, PNG or PDF — max 5MB"
                          accept="image/*,.pdf" file={docFront}
                          onFileChange={setDocFront} onRemove={() => setDocFront(null)}
                        />
                      </div>

                      {/* Back upload — ONLY for driver's license */}
                      {selectedDoc.needsBack && (
                        <div>
                          <label className="v-field-label">Upload License (Back)</label>
                          <FileUpload
                            label="Tap to upload back" hint="JPG, PNG or PDF — max 5MB"
                            accept="image/*,.pdf" file={docBack}
                            onFileChange={setDocBack} onRemove={() => setDocBack(null)}
                          />
                        </div>
                      )}

                      {/* Selfie */}
                      <div>
                        <label className="v-field-label">Selfie Verification</label>
                        <p style={{ fontSize: 12, color: "#4b5563", marginBottom: 10 }}>
                          Take a clear photo of your face. Must match your ID.
                        </p>
                        <SelfieCapture file={selfie} onFileChange={setSelfie} onRemove={() => setSelfie(null)} />
                      </div>

                      {/* Status message */}
                      {idMsg && (
                        <div className={idMsg.toLowerCase().includes("submit") || idMsg.toLowerCase().includes("review") ? "v-success-msg" : "v-error"}>
                          {idMsg.toLowerCase().includes("submit") || idMsg.toLowerCase().includes("review")
                            ? <CheckCircle size={14} /> : <XCircle size={14} className="v-error-icon" />}
                          <span style={{ fontSize: 13 }}>{idMsg}</span>
                        </div>
                      )}

                      {/* Requirements checklist */}
                      <div style={{ padding: "10px 14px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 10, fontSize: 12, color: "#6b7280" }}>
                        <p style={{ fontWeight: 600, color: "#9ca3af", marginBottom: 6 }}>Required:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ color: docNumber.trim().length >= 4 ? "#4ade80" : "#6b7280" }}>
                            {docNumber.trim().length >= 4 ? "✓" : "○"} {selectedDoc.numberLabel}
                          </span>
                          <span style={{ color: docFront ? "#4ade80" : "#6b7280" }}>
                            {docFront ? "✓" : "○"} Document front
                          </span>
                          {selectedDoc.needsBack && (
                            <span style={{ color: docBack ? "#4ade80" : "#6b7280" }}>
                              {docBack ? "✓" : "○"} Document back
                            </span>
                          )}
                          <span style={{ color: selfie ? "#4ade80" : "#6b7280" }}>
                            {selfie ? "✓" : "○"} Selfie photo
                          </span>
                        </div>
                      </div>

                      {/* Submit button */}
                      <button
                        className={`v-btn v-btn--full ${docFront && selfie && docNumber.trim().length >= 4 && (!selectedDoc.needsBack || docBack) ? "v-btn--primary" : "v-btn--ghost"}`}
                        disabled={!docFront || !selfie || docNumber.trim().length < 4 || (selectedDoc.needsBack && !docBack) || idSubmitting}
                        onClick={submitIdentity}
                      >
                        {idSubmitting
                          ? <><Loader2 size={14} className="v-spin" /> Submitting</>
                          : <><BadgeCheck size={14} /> Submit Identity Verification</>}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 3 — STORE PROFILE
        ════════════════════════════════════════════════════════════════════ */}
        <div className={`step-item ${storeVerified ? "step-item--complete" : ""}`}>
          <div className="step-item-header">
            <div className={`step-item-icon ${storeVerified ? "step-item-icon--complete" : "step-item-icon--store"}`}>
              {storeVerified ? <CheckCircle size={20} /> : <Store size={20} />}
            </div>
            <div className="step-item-info">
              <p className="step-item-title">Store Profile</p>
              <p className="step-item-desc">
                {storeVerified ? "Verified"
                  : storeReview?.status === "rejected" ? "Rejected — resubmit"
                  : storeReview?.status === "pending" ? "Under review"
                  : "Set up your store"}
              </p>
            </div>
            <Chip status={
              storeVerified ? "complete"
              : storeReview?.status === "rejected" ? "rejected"
              : storeReview?.status === "pending" ? "in_review" : "pending"
            } />
          </div>

          {storeReview?.status === "rejected" && storeReview?.message && (
            <div className="admin-feedback" style={{ margin: "12px 0 0" }}>
              <p className="admin-feedback-title">Review Result</p>
              <p className="admin-feedback-text">{storeReview.message}</p>
            </div>
          )}

          {!storeVerified && storeReview?.status !== "pending" && (
            <div className="step-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="v-field-label">Store Name</label>
                  <input type="text" className="v-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Enter store name" maxLength={60} />
                </div>
                <div>
                  <label className="v-field-label">Store Description</label>
                  <textarea className="v-textarea" value={storeDesc} onChange={e => setStoreDesc(e.target.value)} placeholder="What do you sell?" maxLength={300} rows={3} />
                </div>
                <FileUpload label="Upload store logo" hint="JPG or PNG — max 2MB" accept="image/*" file={storeLogo} onFileChange={setStoreLogo} onRemove={() => setStoreLogo(null)} />

                {storeMsg && (
                  <div className={storeMsg.toLowerCase().includes("submit") || storeMsg.toLowerCase().includes("review") ? "v-success-msg" : "v-error"}>
                    {storeMsg.toLowerCase().includes("submit") || storeMsg.toLowerCase().includes("review")
                      ? <CheckCircle size={14} /> : <XCircle size={14} className="v-error-icon" />}
                    <span style={{ fontSize: 13 }}>{storeMsg}</span>
                  </div>
                )}

                <button
                  className={`v-btn v-btn--full ${storeName.trim() ? "v-btn--primary" : "v-btn--ghost"}`}
                  disabled={!storeName.trim() || storeSubmitting}
                  onClick={submitStore}
                >
                  {storeSubmitting
                    ? <><Loader2 size={14} className="v-spin" /> Submitting</>
                    : <><Store size={14} /> Submit Store for Review</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            PROGRESS BAR
        ════════════════════════════════════════════════════════════════════ */}
        <div className="submit-bar">
          <div className="submit-bar-progress">
            <span className="submit-bar-label">Verification Progress</span>
            <span className="submit-bar-count">
              {[emailVerified, identityVerified, storeVerified].filter(Boolean).length}/3
            </span>
          </div>
          <div className="submit-bar-track">
            <motion.div
              className="submit-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${([emailVerified, identityVerified, storeVerified].filter(Boolean).length / 3) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}