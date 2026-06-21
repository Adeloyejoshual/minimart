/**
 * pages/Profile/Verification.jsx
 *
 * 3-step account verification
 * Step 1 — Email OTP
 * Step 2 — Government ID + selfie
 * Step 3 — Store profile
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { motion }      from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Mail, CheckCircle, Store, Loader2,
  XCircle, RefreshCw, Lock, BadgeCheck,
  CreditCard, AlertTriangle, Info,
} from "lucide-react";

import { useVerification }  from "../../hooks/useVerification";
import { ErrorBoundary }    from "../../components/verification/ErrorBoundary";
import { TrustRing }        from "../../components/verification/TrustRing";
import { OTPInput }         from "../../components/verification/OTPInput";
import { FileUpload }       from "../../components/verification/FileUpload";
import { SelfieCapture }    from "../../components/verification/SelfieCapture";
import { StepShell, Chip }  from "../../components/verification/StepShell";

import "../../style/Verification.css";

/* ─── constants ─────────────────────────────────────────────────────────── */
const OTP_LENGTH  = 6;
const RESEND_SECS = 30;
const MAX_DOC_MB  = 5;
const MAX_LOGO_MB = 2;

const DOC_TYPES = [
  {
    value       : "nin",
    label       : "National ID (NIN)",
    numberLabel : "NIN Number",
    frontLabel  : "NIN Slip — Front",
    backLabel   : "NIN Slip — Back",
  },
  {
    value       : "passport",
    label       : "International Passport",
    numberLabel : "Passport Number",
    frontLabel  : "Passport Photo Page",
    backLabel   : "Passport Back Page",
  },
  {
    value       : "drivers_license",
    label       : "Driver's License",
    numberLabel : "License Number",
    frontLabel  : "License — Front",
    backLabel   : "License — Back",
  },
  {
    value       : "voters_card",
    label       : "Voter's Card",
    numberLabel : "VIN",
    frontLabel  : "Voter's Card — Front",
    backLabel   : "Voter's Card — Back",
  },
];

/* ─── tiny helpers ───────────────────────────────────────────────────────── */
function Alert({ type = "error", icon, children }) {
  return (
    <div className={`v-alert v-alert--${type}`} role="alert">
      <span className="v-alert-icon">{icon}</span>
      <div className="v-alert-body">{children}</div>
    </div>
  );
}

function Countdown({ seconds, resendKey, onComplete }) {
  const [left, setLeft]       = useState(seconds);
  const onCompleteRef         = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;

    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) {
          clearInterval(id);
          onCompleteRef.current?.();
          return 0;
        }
        return p - 1;
      });
    }, 1_000);

    return () => clearInterval(id);
  }, [seconds, resendKey]); // resendKey forces reset

  return (
    <span className={`countdown ${left < 10 ? "countdown--warn" : ""}`}>
      {left}s
    </span>
  );
}

function ProgressBar({ value, max = 3 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="progress-wrap" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="progress-header">
        <span className="progress-label">Verification Progress</span>
        <span className="progress-count">{value} / {max} complete</span>
      </div>
      <div className="progress-track">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {value === max && (
        <motion.p
          className="progress-complete-msg"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle size={14} /> All steps complete — account fully verified
        </motion.p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   STEP 1 — EMAIL OTP
════════════════════════════════════════════════════════════════════════════ */
function EmailStep({ hook, status }) {
  const {
    emailPhase, emailError, otp, setOtp,
    otpError, attemptsLeft, resendRemaining,
    resendKey, canResend, setCanResend,
    devOtp, maskedEmail, sendOtp, verifyOtp,
  } = hook;

  const isVerifying = emailPhase === "verifying";
  const isSending   = emailPhase === "sending";
  const isDone      = emailPhase === "done";

  /* auto-submit when all digits filled */
  const autoRef = useRef(false);
  useEffect(() => {
    if (
      otp.length === OTP_LENGTH &&
      emailPhase === "otp"      &&
      !autoRef.current
    ) {
      autoRef.current = true;
      const t = setTimeout(async () => {
        await verifyOtp(otp);
        autoRef.current = false;
      }, 180);
      return () => { clearTimeout(t); autoRef.current = false; };
    }
  }, [otp, emailPhase, verifyOtp]);

  /* subtitle for step header */
  const subtitle =
    isDone
      ? status?.email_verified_at
          ? `Verified ${new Date(status.email_verified_at).toLocaleDateString("en-US", {
              day: "numeric", month: "short", year: "numeric",
            })}`
          : "Verified"
      : maskedEmail || status?.email || "Verify your email address";

  return (
    <StepShell
      stepNumber={1}
      icon={isDone ? <CheckCircle size={20} /> : <Mail size={20} />}
      title="Email Verification"
      subtitle={subtitle}
      complete={isDone}
      open={!isDone && (emailPhase === "otp" || emailPhase === "sending" || emailPhase === "verifying")}
      chipStatus={isDone ? "complete" : emailPhase === "otp" ? "active" : "pending"}
      headerAction={
        !isDone && emailPhase === "idle" ? (
          <button
            className="v-btn v-btn--primary v-btn--sm"
            onClick={sendOtp}
          >
            <Mail size={13} /> Verify Email
          </button>
        ) : undefined
      }
    >
      {/* ── OTP panel ── */}
      <div className="otp-panel">

        {/* sending spinner */}
        {isSending && (
          <div className="otp-status-row">
            <Loader2 size={15} className="v-spin" />
            <span>Sending code to {maskedEmail || "your email"}…</span>
          </div>
        )}

        {/* destination */}
        {!isSending && maskedEmail && (
          <p className="otp-destination">
            Code sent to <strong>{maskedEmail}</strong>
          </p>
        )}

        {/* dev helper */}
        {devOtp && (
          <Alert type="warning" icon={<Info size={13} />}>
            <span>Dev mode — code: </span>
            <strong style={{ letterSpacing: 3 }}>{devOtp}</strong>
          </Alert>
        )}

        {/* inputs */}
        <OTPInput
          length={OTP_LENGTH}
          value={otp}
          onChange={setOtp}
          disabled={isVerifying}
          hasError={otpError}
        />

        <p className="otp-hint">
          <Lock size={11} /> Auto-submits when all digits are entered
        </p>

        {/* verifying indicator */}
        {isVerifying && (
          <div className="otp-status-row">
            <Loader2 size={14} className="v-spin" />
            <span>Verifying…</span>
          </div>
        )}

        {/* error */}
        {emailError && (
          <Alert type="error" icon={<XCircle size={13} />}>
            <span>{emailError}</span>
            {attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft <= 5 && (
              <span className="v-alert-sub">
                {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
              </span>
            )}
          </Alert>
        )}

        {/* resend row */}
        <div className="resend-row">
          {resendRemaining === 0 ? (
            <span className="resend-limit">Daily limit reached — try tomorrow</span>
          ) : canResend ? (
            <button
              className="v-btn v-btn--link"
              onClick={sendOtp}
              disabled={isSending}
            >
              <RefreshCw size={12} className={isSending ? "v-spin" : ""} />
              Resend code
              {resendRemaining !== null && (
                <span className="resend-count">({resendRemaining} left)</span>
              )}
            </button>
          ) : (
            <span className="resend-timer">
              Resend available in{" "}
              <Countdown
                key={resendKey}
                seconds={RESEND_SECS}
                resendKey={resendKey}
                onComplete={() => setCanResend(true)}
              />
            </span>
          )}

          <span className="security-note">
            <Lock size={10} /> Never share this code
          </span>
        </div>
      </div>
    </StepShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   STEP 2 — IDENTITY
════════════════════════════════════════════════════════════════════════════ */
function IdentityStep({ hook, status }) {
  const { idPhase, idMsg, submitIdentity } = hook;

  const [docType,   setDocType]   = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docFront,  setDocFront]  = useState(null);
  const [docBack,   setDocBack]   = useState(null);
  const [selfie,    setSelfie]    = useState(null);

  const idReview         = status?.identity_review ?? null;
  const identityVerified = status?.identity_verified ?? false;
  const isPending        = idReview?.status === "pending";
  const isRejected       = idReview?.status === "rejected";
  const isSubmitting     = idPhase === "submitting";

  const selectedDoc = DOC_TYPES.find((d) => d.value === docType);

  const ready =
    docType                      &&
    docNumber.trim().length >= 4 &&
    docFront                     &&
    docBack                      &&
    selfie;

  const checklist = [
    { label: selectedDoc?.numberLabel ?? "Document number", done: docNumber.trim().length >= 4 },
    { label: "Document front", done: Boolean(docFront) },
    { label: "Document back",  done: Boolean(docBack)  },
    { label: "Selfie photo",   done: Boolean(selfie)   },
  ];

  const handleSubmit = () => {
    if (!ready || isSubmitting) return;
    submitIdentity({ docType, docNumber, docFront, docBack, selfie });
  };

  /* subtitle */
  const subtitle =
    identityVerified  ? "Verified"               :
    isPending         ? "Under review"            :
    isRejected        ? "Rejected — please resubmit" :
    "Government-issued ID + selfie";

  /* chip */
  const chipStatus =
    identityVerified  ? "complete"  :
    isPending         ? "in_review" :
    isRejected        ? "rejected"  :
    "pending";

  return (
    <StepShell
      stepNumber={2}
      icon={identityVerified ? <CheckCircle size={20} /> : <CreditCard size={20} />}
      title="Identity Verification"
      subtitle={subtitle}
      complete={identityVerified}
      chipStatus={chipStatus}
      open={!identityVerified && !isPending}
    >
      <div className="id-form">

        {/* rejection reason */}
        {isRejected && idReview?.rejection_reason && (
          <Alert type="error" icon={<AlertTriangle size={13} />}>
            <strong>Rejection reason:</strong>
            <span className="v-alert-sub">{idReview.rejection_reason}</span>
          </Alert>
        )}

        {/* doc type picker */}
        <fieldset className="doc-type-fieldset">
          <legend className="v-field-label">Select Document Type</legend>
          <div className="doc-type-grid">
            {DOC_TYPES.map((dt) => (
              <label
                key={dt.value}
                className={`doc-type-option ${docType === dt.value ? "doc-type-option--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="docType"
                  value={dt.value}
                  checked={docType === dt.value}
                  onChange={() => {
                    setDocType(dt.value);
                    setDocFront(null);
                    setDocBack(null);
                    setDocNumber("");
                  }}
                />
                <span className="doc-type-label">{dt.label}</span>
                {docType === dt.value && (
                  <CheckCircle size={14} className="doc-type-check" />
                )}
              </label>
            ))}
          </div>
        </fieldset>

        {/* rest of form — only after type selected */}
        {selectedDoc && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="id-fields"
          >
            {/* document number */}
            <div className="v-field">
              <label className="v-field-label">{selectedDoc.numberLabel}</label>
              <input
                type="text"
                className="v-input"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder={`Enter ${selectedDoc.numberLabel}`}
                maxLength={30}
                autoCapitalize="characters"
              />
            </div>

            {/* front */}
            <div className="v-field">
              <label className="v-field-label">{selectedDoc.frontLabel}</label>
              <FileUpload
                label="Tap or drag to upload"
                hint={`JPG, PNG, WebP, PDF — max ${MAX_DOC_MB}MB`}
                accept="image/*,.pdf"
                file={docFront}
                onFile={setDocFront}
                onRemove={() => setDocFront(null)}
                maxBytes={MAX_DOC_MB * 1_048_576}
                required
              />
            </div>

            {/* back */}
            <div className="v-field">
              <label className="v-field-label">{selectedDoc.backLabel}</label>
              <FileUpload
                label="Tap or drag to upload"
                hint={`JPG, PNG, WebP, PDF — max ${MAX_DOC_MB}MB`}
                accept="image/*,.pdf"
                file={docBack}
                onFile={setDocBack}
                onRemove={() => setDocBack(null)}
                maxBytes={MAX_DOC_MB * 1_048_576}
                required
              />
            </div>

            {/* selfie */}
            <div className="v-field">
              <label className="v-field-label">Selfie Verification</label>
              <SelfieCapture
                file={selfie}
                onFile={setSelfie}
                onRemove={() => setSelfie(null)}
              />
            </div>

            {/* checklist */}
            <div className="checklist">
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className={`checklist-row ${item.done ? "checklist-row--done" : ""}`}
                >
                  <div className="checklist-dot">
                    {item.done && <CheckCircle size={11} />}
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {/* feedback */}
            {idMsg.text && (
              <Alert
                type={idMsg.ok ? "success" : "error"}
                icon={idMsg.ok
                  ? <CheckCircle size={13} />
                  : <XCircle    size={13} />
                }
              >
                {idMsg.text}
              </Alert>
            )}

            {/* submit */}
            <button
              className={`v-btn v-btn--full ${ready ? "v-btn--primary" : "v-btn--ghost"}`}
              disabled={!ready || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <><Loader2 size={14} className="v-spin" /> Submitting…</>
              ) : (
                <><BadgeCheck size={14} /> Submit Identity</>
              )}
            </button>
          </motion.div>
        )}
      </div>
    </StepShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   STEP 3 — STORE
════════════════════════════════════════════════════════════════════════════ */
function StoreStep({ hook, status }) {
  const { storePhase, storeMsg, submitStore } = hook;

  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [storeLogo, setStoreLogo] = useState(null);

  const storeReview    = status?.store_review ?? null;
  const storeVerified  = status?.store_verified ?? false;
  const isPending      = storeReview?.status === "pending";
  const isRejected     = storeReview?.status === "rejected";
  const isSubmitting   = storePhase === "submitting";

  const MAX_DESC = 300;
  const ready    = storeName.trim().length >= 2;

  const handleSubmit = () => {
    if (!ready || isSubmitting) return;
    submitStore({ storeName, storeDesc, storeLogo });
  };

  const subtitle =
    storeVerified ? "Verified"              :
    isPending     ? "Under review"          :
    isRejected    ? "Rejected — resubmit"   :
    "Set up your seller store profile";

  const chipStatus =
    storeVerified ? "complete"  :
    isPending     ? "in_review" :
    isRejected    ? "rejected"  :
    "pending";

  return (
    <StepShell
      stepNumber={3}
      icon={storeVerified ? <CheckCircle size={20} /> : <Store size={20} />}
      title="Store Profile"
      subtitle={subtitle}
      complete={storeVerified}
      chipStatus={chipStatus}
      open={!storeVerified && !isPending}
    >
      <div className="store-form">

        {/* rejection reason */}
        {isRejected && storeReview?.message && (
          <Alert type="error" icon={<AlertTriangle size={13} />}>
            <strong>Rejection reason:</strong>
            <span className="v-alert-sub">{storeReview.message}</span>
          </Alert>
        )}

        {/* store name */}
        <div className="v-field">
          <label className="v-field-label">Store Name <span className="v-required">*</span></label>
          <input
            type="text"
            className="v-input"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="e.g. Lagos Gadget Hub"
            maxLength={60}
          />
        </div>

        {/* description */}
        <div className="v-field">
          <label className="v-field-label">
            Store Description
            <span className="v-char-count">
              {storeDesc.length} / {MAX_DESC}
            </span>
          </label>
          <textarea
            className="v-textarea"
            value={storeDesc}
            onChange={(e) => setStoreDesc(e.target.value)}
            placeholder="What do you sell? Who are your customers?"
            maxLength={MAX_DESC}
            rows={3}
          />
        </div>

        {/* logo */}
        <div className="v-field">
          <label className="v-field-label">Store Logo (optional)</label>
          <FileUpload
            label="Upload store logo"
            hint={`JPG, PNG — max ${MAX_LOGO_MB}MB`}
            accept="image/*"
            file={storeLogo}
            onFile={setStoreLogo}
            onRemove={() => setStoreLogo(null)}
            maxBytes={MAX_LOGO_MB * 1_048_576}
          />
        </div>

        {/* feedback */}
        {storeMsg.text && (
          <Alert
            type={storeMsg.ok ? "success" : "error"}
            icon={storeMsg.ok
              ? <CheckCircle size={13} />
              : <XCircle    size={13} />
            }
          >
            {storeMsg.text}
          </Alert>
        )}

        {/* submit */}
        <button
          className={`v-btn v-btn--full ${ready ? "v-btn--primary" : "v-btn--ghost"}`}
          disabled={!ready || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <><Loader2 size={14} className="v-spin" /> Submitting…</>
          ) : (
            <><Store size={14} /> Submit Store Profile</>
          )}
        </button>
      </div>
    </StepShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════════════════════════════ */
function VerificationInner() {
  const navigate = useNavigate();

  const hook = useVerification({
    onStatusChange: (data) => {
      if (!data) navigate("/auth");
    },
  });

  const { status, loadingPage, pageError, fetchStatus } = hook;

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* loading */
  if (loadingPage) {
    return (
      <div className="v-loading" role="status" aria-label="Loading verification">
        <Loader2 size={28} className="v-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  /* page-level error */
  if (pageError) {
    return (
      <div className="v-page-error">
        <AlertTriangle size={32} />
        <p>{pageError}</p>
        <button
          className="v-btn v-btn--primary"
          onClick={fetchStatus}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const emailVerified    = status?.email_verified    ?? false;
  const identityVerified = status?.identity_verified ?? false;
  const storeVerified    = status?.store_verified    ?? false;
  const trustScore       = status?.trust_score       ?? 0;
  const completedCount   = [emailVerified, identityVerified, storeVerified].filter(Boolean).length;

  return (
    <div className="v-page">
      <div className="v-container">

        {/* ── page header ── */}
        <motion.header
          className="v-page-header"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="v-page-header-icon">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="v-page-title">Account Verification</h1>
            <p className="v-page-sub">
              Complete all steps to unlock full marketplace access
            </p>
          </div>
        </motion.header>

        {/* ── trust ring card ── */}
        <motion.div
          className="v-card v-card--trust"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <TrustRing
            score={trustScore}
            breakdown={{
              emailVerified,
              identityVerified,
              storeVerified,
              trustScore,
            }}
          />
        </motion.div>

        {/* ── steps ── */}
        <motion.div
          className="v-steps"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <EmailStep    hook={hook} status={status} />
          <IdentityStep hook={hook} status={status} />
          <StoreStep    hook={hook} status={status} />
        </motion.div>

        {/* ── progress bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <ProgressBar value={completedCount} max={3} />
        </motion.div>

      </div>
    </div>
  );
}

export default function Verification() {
  return (
    <ErrorBoundary>
      <VerificationInner />
    </ErrorBoundary>
  );
}