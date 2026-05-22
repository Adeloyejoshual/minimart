// src/pages/Verification.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Mail, CheckCircle, Store, Loader2, XCircle,
  RefreshCw, Lock, ArrowRight, BadgeCheck, Upload,
  Camera, FileText, User, X, Image,
} from "lucide-react";
import "../../style/Verification.css";

const API = "https://minimart-ivrm.onrender.com/api";

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const formatSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/* ══════════════════════════════════════════════════════════════════════════════
   SUB COMPONENTS
══════════════════════════════════════════════════════════════════════════════ */
function Chip({ status }) {
  const labels = {
    complete: "Completed", active: "Active", in_review: "In Review",
    rejected: "Rejected", pending: "Pending",
  };
  return <span className={`v-chip v-chip--${status}`}>{labels[status] || "Pending"}</span>;
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
  const r = 52, circ = 2 * Math.PI * r;
  const cfg =
    score >= 80 ? { color: "#22c55e", label: "Excellent" } :
    score >= 60 ? { color: "#3b82f6", label: "Good" } :
    score >= 40 ? { color: "#f59e0b", label: "Fair" } :
                  { color: "#ef4444", label: "Low" };
  return (
    <div className="trust-ring-wrap">
      <div className="trust-ring-center">
        <svg width="130" height="130" viewBox="0 0 140 140" className="trust-ring-svg">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
          <motion.circle
            cx="70" cy="70" r={r} fill="none" stroke={cfg.color}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ}
            animate={{ strokeDashoffset: circ - (score / 100) * circ }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
          />
        </svg>
        <div className="trust-ring-score">
          <motion.strong key={score} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
            {score}
          </motion.strong>
          <span>/ 100</span>
        </div>
      </div>
      <span className="trust-ring-label">{cfg.label}</span>
    </div>
  );
}

function OTPInput({ length = 6, value, onChange, disabled, hasError }) {
  const refs = useRef([]);
  useEffect(() => { setTimeout(() => refs.current[0]?.focus(), 200); }, []);
  const set = (i, v) => { const a = value.split(""); a[i] = v; onChange(a.join("")); };
  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, "");
    if (!v) { set(i, ""); if (i > 0) refs.current[i - 1]?.focus(); return; }
    set(i, v.slice(-1));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };
  const handleKey = (i, e) => { if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus(); };
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
          value={value[i] || ""}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`otp-input ${hasError ? "otp-input--error" : value[i] ? "otp-input--filled" : ""}`}
        />
      ))}
    </div>
  );
}

function Countdown({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    let go = true;
    const t = setInterval(() => { if (!go) return; setLeft(p => { if (p <= 1) { clearInterval(t); onComplete?.(); return 0; } return p - 1; }); }, 1000);
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

  if (file) {
    return (
      <div className="upload-area upload-area--has-file">
        <div className="upload-preview">
          {preview && file.type.startsWith("image/")
            ? <img src={preview} alt="" />
            : <div style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#1f2937", borderRadius: 8 }}><FileText size={24} style={{ color: "#6b7280" }} /></div>
          }
          <div className="upload-preview-info">
            <p className="upload-preview-name">{file.name}</p>
            <p className="upload-preview-size">{formatSize(file.size)}</p>
          </div>
          <button className="upload-remove" onClick={onRemove} type="button"><X size={16} /></button>
        </div>
      </div>
    );
  }

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

  const openCamera  = () => { ref.current?.setAttribute("capture", "user"); ref.current?.click(); };
  const openGallery = () => { ref.current?.removeAttribute("capture"); ref.current?.click(); };

  return (
    <div className="selfie-area">
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); e.target.value = ""; }} />
      <div className="selfie-preview">
        {preview
          ? <img src={preview} alt="" />
          : <div className="selfie-placeholder"><User size={36} /><span>No photo</span></div>
        }
      </div>
      <div className="selfie-buttons">
        {file ? (
          <>
            <button className="v-btn v-btn--ghost v-btn--small" onClick={openCamera} type="button"><Camera size={14} /> Retake</button>
            <button className="v-btn v-btn--ghost v-btn--small" onClick={onRemove} type="button"><X size={14} /> Remove</button>
          </>
        ) : (
          <>
            <button className="v-btn v-btn--primary v-btn--small" onClick={openCamera} type="button"><Camera size={14} /> Take Photo</button>
            <button className="v-btn v-btn--ghost v-btn--small" onClick={openGallery} type="button"><Image size={14} /> Gallery</button>
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

  const [status, setStatus]           = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [submitMsg, setSubmitMsg]     = useState("");

  // Email OTP
  const [emailStep, setEmailStep]           = useState("idle"); // idle | sending | otp | done
  const [otp, setOtp]                       = useState("");
  const [sending, setSending]               = useState(false);
  const [verifying, setVerifying]           = useState(false);
  const [canResend, setCanResend]           = useState(false);
  const [error, setError]                   = useState("");
  const [attemptsLeft, setAttemptsLeft]     = useState(5);
  const [hasError, setHasError]             = useState(false);
  const [resendRemaining, setResendRemaining] = useState(2);

  // Documents
  const [idFront, setIdFront]   = useState(null);
  const [idBack, setIdBack]     = useState(null);
  const [selfie, setSelfie]     = useState(null);

  // Store
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [storeLogo, setStoreLogo] = useState(null);

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
        // If email is already verified from backend → skip to done
        if (data.email_verified) setEmailStep("done");
        if (typeof data.resend_remaining === "number") setResendRemaining(data.resend_remaining);
      } else if (res.status === 401) navigate("/login");
    } catch (err) { console.error(err.message); }
    finally { setPageLoading(false); }
  }, [authHeaders, navigate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── Derived ──────────────────────────────────────────────────────────────── */
  const trustScore    = status?.trust_score    || 0;
  const emailVerified = status?.email_verified || false;
  const storeVerified = status?.store_verified || false;
  const storeReview   = status?.store_review   || null;

  const emailDone  = emailVerified;
  const idDone     = !!(idFront && idBack);
  const selfieDone = !!selfie;
  const storeDone  = storeVerified || !!(storeName.trim() && storeLogo);

  const completed = [emailDone, idDone, selfieDone, storeDone].filter(Boolean).length;
  const total     = 4;
  const allDone   = completed === total;

  /* ── Send OTP ─────────────────────────────────────────────────────────────── */
  const sendOTP = useCallback(async () => {
    setEmailStep("sending");
    setSending(true);
    setError("");
    setOtp("");
    setHasError(false);

    try {
      const res = await fetch(`${API}/verification/send-email-otp`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();

      if (res.ok) {
        setEmailStep("otp");
        setCanResend(false);
        if (typeof data.remaining === "number") setResendRemaining(data.remaining);
      } else {
        setError(data.message || "Failed to send code.");
        setEmailStep("idle");
        if (res.status === 429 && data.remaining === 0) setResendRemaining(0);
      }
    } catch {
      setError("Network error.");
      setEmailStep("idle");
    } finally {
      setSending(false);
    }
  }, [authHeaders]);

  /* ── Verify OTP ───────────────────────────────────────────────────────────── */
  const verifyOTP = useCallback(async () => {
    if (otp.length < 6 || verifyingRef.current || verifying) return;
    verifyingRef.current = true;
    setVerifying(true); setError(""); setHasError(false);

    try {
      const res = await fetch(`${API}/verification/verify-email-otp`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ otp }),
      });
      const data = await res.json();

      if (res.ok) {
        setEmailStep("done");
        setStatus(prev => ({
          ...prev,
          email_verified: true,
          trust_score: data.trust_score ?? (prev?.trust_score || 0) + 40,
        }));
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

  useEffect(() => {
    if (otp.length === 6 && emailStep === "otp" && !verifying && !verifyingRef.current) {
      const t = setTimeout(() => verifyOTP(), 150);
      return () => clearTimeout(t);
    }
  }, [otp, emailStep, verifying, verifyOTP]);

  /* ── Submit all ───────────────────────────────────────────────────────────── */
  const handleSubmitAll = async () => {
    setSubmitting(true); setSubmitMsg("");
    try {
      const fd = new FormData();
      if (idFront)   fd.append("id_front", idFront);
      if (idBack)    fd.append("id_back", idBack);
      if (selfie)    fd.append("selfie", selfie);
      if (storeName) fd.append("store_name", storeName.trim());
      if (storeDesc) fd.append("store_desc", storeDesc.trim());
      if (storeLogo) fd.append("store_logo", storeLogo);

      const res = await fetch(`${API}/verification/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      setSubmitMsg(res.ok
        ? "Verification submitted successfully. Under review."
        : (data.message || "Submission failed.")
      );
      if (res.ok) fetchStatus();
    } catch { setSubmitMsg("Network error."); }
    finally { setSubmitting(false); }
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
            <ScoreRow label="Email verified"       points={40} done={emailVerified} />
            <ScoreRow label="Store verified"       points={20} done={storeVerified} />
            <ScoreRow label="Account age 30 days" points={10} done={trustScore >= 60} />
            <ScoreRow label="Account age 90 days" points={10} done={trustScore >= 70} />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 1 — EMAIL
        ════════════════════════════════════════════════════════════════════ */}
        <motion.div
          layout
          className={`step-item ${
            emailDone     ? "step-item--complete" :
            emailStep !== "idle" ? "step-item--active" : ""
          }`}
        >
          <div className="step-item-header">
            <div className={`step-item-icon ${emailDone ? "step-item-icon--complete" : "step-item-icon--email"}`}>
              {emailDone ? <CheckCircle size={20} /> : <Mail size={20} />}
            </div>
            <div className="step-item-info">
              <p className="step-item-title">Email Verification</p>
              {emailDone ? (
                <p className="step-item-verified">
                  <CheckCircle size={12} />
                  Verified
                  {status?.email_verified_at && (
                    <span style={{ color: "#6b7280", marginLeft: 4 }}>
                      · {new Date(status.email_verified_at).toLocaleDateString("en-US", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  )}
                </p>
              ) : (
                <p className="step-item-desc">{status?.email || "Verify your email"}</p>
              )}
            </div>
            <div className="step-item-action">
              {emailDone ? (
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

          {/* ── OTP input area — slides open ───────────────────────────────── */}
          <AnimatePresence>
            {emailStep === "otp" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="step-body otp-section"
              >
                {/* OTP header */}
                <div className="otp-section-header">
                  <div className="otp-section-icon">
                    <Mail size={22} />
                  </div>
                  <p className="otp-section-title">Enter Verification Code</p>
                  <p className="otp-section-subtitle">
                    6-digit code sent to{" "}
                    <span className="otp-section-email">{status?.email}</span>
                  </p>
                </div>

                {/* OTP inputs */}
                <OTPInput
                  length={6} value={otp} onChange={setOtp}
                  disabled={verifying} hasError={hasError}
                />
                <p className="otp-helper">Auto-submit enabled</p>

                {/* Verifying indicator */}
                <AnimatePresence>
                  {verifying && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="verifying-indicator"
                    >
                      <Loader2 size={14} className="v-spin" />
                      <span>Verifying code</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="v-error"
                    >
                      <XCircle size={14} className="v-error-icon" />
                      <div>
                        <p className="v-error-text">{error}</p>
                        {attemptsLeft < 5 && attemptsLeft > 0 && (
                          <p className="v-error-sub">
                            {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                        <Countdown seconds={60} onComplete={() => setCanResend(true)} />
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
            STEP 2 — ID DOCUMENT
        ════════════════════════════════════════════════════════════════════ */}
        <div className={`step-item ${idDone ? "step-item--complete" : ""}`}>
          <div className="step-item-header">
            <div className={`step-item-icon ${idDone ? "step-item-icon--complete" : "step-item-icon--id"}`}>
              {idDone ? <CheckCircle size={20} /> : <FileText size={20} />}
            </div>
            <div className="step-item-info">
              <p className="step-item-title">Identity Document</p>
              <p className="step-item-desc">Government-issued ID (front &amp; back)</p>
            </div>
            <Chip status={idDone ? "complete" : "pending"} />
          </div>
          <div className="step-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FileUpload
                label="Upload front of ID" hint="JPG, PNG or PDF — max 5MB"
                accept="image/*,.pdf" file={idFront}
                onFileChange={setIdFront} onRemove={() => setIdFront(null)}
              />
              <FileUpload
                label="Upload back of ID" hint="JPG, PNG or PDF — max 5MB"
                accept="image/*,.pdf" file={idBack}
                onFileChange={setIdBack} onRemove={() => setIdBack(null)}
              />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 3 — SELFIE
        ════════════════════════════════════════════════════════════════════ */}
        <div className={`step-item ${selfieDone ? "step-item--complete" : ""}`}>
          <div className="step-item-header">
            <div className={`step-item-icon ${selfieDone ? "step-item-icon--complete" : "step-item-icon--selfie"}`}>
              {selfieDone ? <CheckCircle size={20} /> : <Camera size={20} />}
            </div>
            <div className="step-item-info">
              <p className="step-item-title">Selfie Verification</p>
              <p className="step-item-desc">Take a clear photo of yourself</p>
            </div>
            <Chip status={selfieDone ? "complete" : "pending"} />
          </div>
          <div className="step-body">
            <SelfieCapture file={selfie} onFileChange={setSelfie} onRemove={() => setSelfie(null)} />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 4 — STORE
        ════════════════════════════════════════════════════════════════════ */}
        <div className={`step-item ${storeDone ? "step-item--complete" : ""}`}>
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
              : storeReview?.status === "pending" ? "in_review"
              : storeDone ? "complete" : "pending"
            } />
          </div>

          {storeReview?.status === "rejected" && storeReview?.message && (
            <div className="admin-feedback" style={{ margin: "12px 0 0" }}>
              <p className="admin-feedback-title">Review Result</p>
              <p className="admin-feedback-text">{storeReview.message}</p>
            </div>
          )}

          {!storeVerified && (
            <div className="step-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="v-field-label">Store Name</label>
                  <input
                    type="text" className="v-input"
                    value={storeName} onChange={e => setStoreName(e.target.value)}
                    placeholder="Enter your store name" maxLength={60}
                  />
                </div>
                <div>
                  <label className="v-field-label">Store Description</label>
                  <textarea
                    className="v-textarea"
                    value={storeDesc} onChange={e => setStoreDesc(e.target.value)}
                    placeholder="Describe what you sell" maxLength={300} rows={3}
                  />
                </div>
                <FileUpload
                  label="Upload store logo" hint="JPG or PNG — max 2MB"
                  accept="image/*" file={storeLogo}
                  onFileChange={setStoreLogo} onRemove={() => setStoreLogo(null)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SUBMIT BAR
        ════════════════════════════════════════════════════════════════════ */}
        <div className="submit-bar">
          <div className="submit-bar-progress">
            <span className="submit-bar-label">Verification Progress</span>
            <span className="submit-bar-count">{completed}/{total}</span>
          </div>
          <div className="submit-bar-track">
            <motion.div
              className="submit-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(completed / total) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {submitMsg && (
            <div className={submitMsg.includes("success") ? "v-success-msg" : "v-error"} style={{ marginBottom: 12 }}>
              {submitMsg.includes("success")
                ? <CheckCircle size={16} />
                : <XCircle size={14} className="v-error-icon" />
              }
              <span style={{ fontSize: 13 }}>{submitMsg}</span>
            </div>
          )}

          <button
            className={`v-btn v-btn--full ${allDone ? "v-btn--success" : "v-btn--ghost"}`}
            disabled={!allDone || submitting}
            onClick={handleSubmitAll}
          >
            {submitting ? (
              <><Loader2 size={16} className="v-spin" /> Submitting</>
            ) : allDone ? (
              <><BadgeCheck size={16} /> Submit Verification</>
            ) : (
              <><Lock size={16} /> Complete All Steps ({completed}/{total})</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}