/**
 * pages/Profile/Verification.jsx
 *
 * 3-step account verification
 * Step 1 — Email OTP
 * Step 2 — Government ID + selfie
 * Step 3 — Store profile
 *
 * Self-contained — no external hook or component imports needed.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Mail, CheckCircle, Store, Loader2,
  XCircle, RefreshCw, Lock, BadgeCheck,
  CreditCard, AlertTriangle, Upload,
  FileText, Camera, Image, User, X, Info,
  ArrowLeft,
} from "lucide-react";

import "../../style/Verification.css";

/* ══════════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════════ */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API      = `${API_BASE}/api`;

const OTP_LENGTH     = 6;
const RESEND_SECS    = 60;
const MAX_DOC_MB     = 5;
const MAX_LOGO_MB    = 2;
const MAX_DOC_BYTES  = MAX_DOC_MB  * 1_048_576;
const MAX_LOGO_BYTES = MAX_LOGO_MB * 1_048_576;

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
    backLabel   : "Passport Data Page",
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

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  localStorage.getItem("authToken")         ||
  "";

const authJson = () => ({
  "Content-Type" : "application/json",
  Authorization  : `Bearer ${getToken()}`,
});

const authMultipart = () => ({
  Authorization: `Bearer ${getToken()}`,
});

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmtBytes = (b) =>
  b < 1_048_576
    ? `${(b / 1_024).toFixed(0)} KB`
    : `${(b / 1_048_576).toFixed(1)} MB`;

/* ══════════════════════════════════════════════════════════════
   TINY SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Alert ── */
function Alert({ type = "error", children }) {
  const icons = {
    error   : <XCircle       size={14} />,
    success : <CheckCircle   size={14} />,
    warning : <AlertTriangle size={14} />,
    info    : <Info          size={14} />,
  };
  return (
    <div className={`v-alert v-alert--${type}`} role="alert">
      <span className="v-alert__icon">{icons[type]}</span>
      <div className="v-alert__body">{children}</div>
    </div>
  );
}

/* ── Chip ── */
const CHIP_MAP = {
  complete  : { label: "Completed", cls: "chip--complete"  },
  in_review : { label: "In Review", cls: "chip--review"    },
  rejected  : { label: "Rejected",  cls: "chip--rejected"  },
  active    : { label: "Active",    cls: "chip--active"    },
  pending   : { label: "Pending",   cls: "chip--pending"   },
};
function Chip({ status = "pending" }) {
  const c = CHIP_MAP[status] ?? CHIP_MAP.pending;
  return <span className={`v-chip ${c.cls}`}>{c.label}</span>;
}

/* ── Countdown ── */
function Countdown({ seconds, resendKey, onDone }) {
  const [left,    setLeft]    = useState(seconds);
  const onDoneRef             = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) { clearInterval(id); onDoneRef.current?.(); return 0; }
        return p - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [seconds, resendKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`v-countdown ${left <= 10 ? "v-countdown--warn" : ""}`}>
      {left}s
    </span>
  );
}

/* ── Progress bar ── */
function ProgressBar({ value, max = 3 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="v-progress" role="progressbar"
         aria-valuenow={value} aria-valuemax={max}>
      <div className="v-progress__header">
        <span className="v-progress__label">Verification Progress</span>
        <span className="v-progress__count">{value} / {max}</span>
      </div>
      <div className="v-progress__track">
        <motion.div
          className="v-progress__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {value === max && (
        <motion.p className="v-progress__done"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}>
          <CheckCircle size={13} /> Account fully verified
        </motion.p>
      )}
    </div>
  );
}

/* ── Trust ring ── */
const TIERS = [
  { min: 80, color: "#22c55e", label: "Excellent" },
  { min: 60, color: "#3b82f6", label: "Good"      },
  { min: 40, color: "#f59e0b", label: "Fair"      },
  { min:  0, color: "#ef4444", label: "Low"       },
];

function ScoreRow({ label, points, done }) {
  return (
    <div className="v-score-row">
      <div className={`v-score-row__dot ${done ? "v-score-row__dot--done" : ""}`}>
        {done && <CheckCircle size={10} />}
      </div>
      <span className={`v-score-row__label ${done ? "v-score-row__label--done" : ""}`}>
        {label}
      </span>
      <span className={`v-score-row__pts ${done ? "v-score-row__pts--done" : ""}`}>
        +{points}
      </span>
    </div>
  );
}

function TrustRing({ score = 0, emailVerified, identityVerified, storeVerified }) {
  const R   = 52;
  const C   = 2 * Math.PI * R;
  const cfg = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];

  return (
    <div className="v-trust-ring">
      <div className="v-trust-ring__graphic">
        <svg width="140" height="140" viewBox="0 0 140 140"
             role="img" aria-label={`Trust score ${score} out of 100`}>
          <circle cx="70" cy="70" r={R} fill="none"
                  stroke="#1f2937" strokeWidth="10" />
          <motion.circle
            cx="70" cy="70" r={R} fill="none"
            stroke={cfg.color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C}
            animate={{ strokeDashoffset: C - (score / 100) * C }}
            transition={{ duration: 1.6, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
            style={{
              transformOrigin : "center",
              transform       : "rotate(-90deg)",
              filter          : `drop-shadow(0 0 6px ${cfg.color}55)`,
            }}
          />
        </svg>
        <div className="v-trust-ring__center">
          <motion.span
            key={score}
            className="v-trust-ring__number"
            style={{ color: cfg.color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {score}
          </motion.span>
          <span className="v-trust-ring__denom">/ 100</span>
          <span className="v-trust-ring__tier" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
      </div>

      <div className="v-score-breakdown">
        <p className="v-score-breakdown__title">Trust Breakdown</p>
        <ScoreRow label="Email verified"    points={30} done={emailVerified}    />
        <ScoreRow label="Identity verified" points={30} done={identityVerified} />
        <ScoreRow label="Store verified"    points={20} done={storeVerified}    />
        <ScoreRow label="Account age 30d"   points={10} done={score >= 60}      />
        <ScoreRow label="Account age 90d"   points={10} done={score >= 70}      />
      </div>
    </div>
  );
}

/* ── Step shell ── */
function StepShell({
  stepNum, icon, title, subtitle,
  chipStatus, headerBtn,
  open = false, complete = false,
  children,
}) {
  return (
    <motion.div layout className={[
      "v-step",
      complete ? "v-step--complete" : "",
      open     ? "v-step--open"     : "",
    ].join(" ")}>

      <div className={`v-step__badge ${complete ? "v-step__badge--done" : ""}`}>
        {complete ? <CheckCircle size={12} /> : stepNum}
      </div>

      <div className="v-step__header">
        <div className={`v-step__icon ${complete ? "v-step__icon--done" : ""}`}>
          {icon}
        </div>
        <div className="v-step__info">
          <p className="v-step__title">{title}</p>
          {subtitle && <p className="v-step__sub">{subtitle}</p>}
        </div>
        <div className="v-step__aside">
          {headerBtn ?? <Chip status={chipStatus ?? (complete ? "complete" : "pending")} />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="v-step__body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── OTP Input ── */
function OtpInput({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hasError) return;
    const t = setTimeout(() => {
      const idx = refs.current.findIndex((r) => !r?.value);
      refs.current[Math.max(0, idx)]?.focus();
    }, 700);
    return () => clearTimeout(t);
  }, [hasError]);

  const char   = (i) => value[i] ?? "";
  const update = (i, ch) => {
    const arr = Array.from({ length: OTP_LENGTH }, (_, k) => value[k] ?? "");
    arr[i]    = ch;
    onChange(arr.join(""));
  };

  return (
    <div className={`v-otp-group ${hasError ? "v-otp-group--error" : ""}`}
         role="group" aria-label="One-time password">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={char(i)}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          className={[
            "v-otp-cell",
            char(i)  ? "v-otp-cell--filled" : "",
            hasError ? "v-otp-cell--error"  : "",
          ].join(" ")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            update(i, d);
            if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (char(i))  update(i, "");
              else if (i > 0) { update(i - 1, ""); refs.current[i - 1]?.focus(); }
            } else if (e.key === "ArrowLeft"  && i > 0)              refs.current[i - 1]?.focus();
            else if   (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData("text")
              .replace(/\D/g, "").slice(0, OTP_LENGTH);
            const result = Array.from(
              { length: OTP_LENGTH }, (_, k) => digits[k] ?? ""
            ).join("");
            onChange(result);
            refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}

/* ── File upload ── */
function FileUpload({ label, hint, accept, file, onFile, onRemove, maxBytes }) {
  const inputRef              = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileErr, setFileErr] = useState("");
  const [drag,    setDrag]    = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f) => {
    if (!f) return;
    setFileErr("");
    if (maxBytes && f.size > maxBytes) {
      setFileErr(`Too large — max ${fmtBytes(maxBytes)}, yours is ${fmtBytes(f.size)}.`);
      return;
    }
    onFile(f);
  };

  if (file) {
    return (
      <div className="v-upload v-upload--filled">
        <div className="v-upload__preview">
          {preview
            ? <img src={preview} alt="" className="v-upload__thumb" />
            : <div className="v-upload__doc"><FileText size={20} /></div>
          }
          <div className="v-upload__meta">
            <p className="v-upload__name">{file.name}</p>
            <p className="v-upload__size">{fmtBytes(file.size)}</p>
          </div>
          <button type="button" className="v-upload__remove"
                  onClick={onRemove} aria-label="Remove file">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label
        className={[
          "v-upload",
          drag    ? "v-upload--drag"  : "",
          fileErr ? "v-upload--error" : "",
        ].join(" ")}
        onDragOver={(e)  => { e.preventDefault(); setDrag(true);  }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e)      => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      >
        <input ref={inputRef} type="file" accept={accept}
               className="v-upload__hidden"
               onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <Upload size={22} className="v-upload__icon" />
        <p className="v-upload__label">{drag ? "Drop to upload" : label}</p>
        <p className="v-upload__hint">{hint}</p>
      </label>
      {fileErr && (
        <p className="v-upload__error">
          <AlertTriangle size={12} /> {fileErr}
        </p>
      )}
    </div>
  );
}

/* ── Selfie capture ── */
function SelfieCapture({ file, onFile, onRemove }) {
  const inputRef              = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const trigger = (capture) => {
    if (capture) inputRef.current?.setAttribute("capture", "user");
    else          inputRef.current?.removeAttribute("capture");
    inputRef.current?.click();
  };

  return (
    <div className="v-selfie">
      <input ref={inputRef} type="file" accept="image/*"
             className="v-upload__hidden"
             onChange={(e) => {
               if (e.target.files?.[0]) onFile(e.target.files[0]);
               e.target.value = "";
             }} />
      <div className="v-selfie__circle">
        {preview
          ? <img src={preview} alt="Selfie preview" />
          : <div className="v-selfie__empty"><User size={36} /><span>No photo</span></div>
        }
      </div>
      <p className="v-selfie__guide">
        Face must be clearly visible, well-lit, and match your ID.
      </p>
      <div className="v-selfie__actions">
        {file ? (
          <>
            <button type="button" className="v-btn v-btn--ghost v-btn--sm"
                    onClick={() => trigger(true)}>
              <RefreshCw size={12} /> Retake
            </button>
            <button type="button" className="v-btn v-btn--ghost v-btn--sm"
                    onClick={onRemove}>
              <X size={12} /> Remove
            </button>
          </>
        ) : (
          <>
            <button type="button" className="v-btn v-btn--primary v-btn--sm"
                    onClick={() => trigger(true)}>
              <Camera size={12} /> Camera
            </button>
            <button type="button" className="v-btn v-btn--ghost v-btn--sm"
                    onClick={() => trigger(false)}>
              <Image size={12} /> Gallery
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 1 — EMAIL OTP
══════════════════════════════════════════════════════════════ */
function EmailStep({ status, onRefresh }) {
  const [phase,        setPhase]        = useState(
    status?.email_verified ? "done" : "idle"
  );
  const [otp,          setOtp]          = useState("");
  const [otpError,     setOtpError]     = useState(false);
  const [errMsg,       setErrMsg]       = useState("");
  const [canResend,    setCanResend]    = useState(false);
  const [resendKey,    setResendKey]    = useState(0);
  const [remaining,    setRemaining]    = useState(status?.resend_remaining ?? null);
  const [maskedEmail,  setMaskedEmail]  = useState(status?.email ?? "");
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [devOtp,       setDevOtp]       = useState("");

  const verifyingRef = useRef(false);
  const autoRef      = useRef(false);

  useEffect(() => {
    if (status?.email_verified) setPhase("done");
    if (status?.email)          setMaskedEmail(status.email);
    if (typeof status?.resend_remaining === "number") {
      setRemaining(status.resend_remaining);
    }
  }, [status]);

  const sendOtp = useCallback(async () => {
    setPhase("sending");
    setErrMsg("");
    setOtp("");
    setOtpError(false);
    setCanResend(false);
    setDevOtp("");
    setResendKey((k) => k + 1);

    try {
      const res  = await fetch(`${API}/verification/send-email-otp`, {
        method: "POST", headers: authJson(),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPhase("otp");
        if (data.email)                         setMaskedEmail(data.email);
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        if (data.dev_otp)                       setDevOtp(data.dev_otp);
        return;
      }

      if (res.status === 429) {
        setPhase("otp");
        setErrMsg(data.message || "Too many requests. Please wait.");
        if (data.remaining === 0) setRemaining(0);
        return;
      }

      setPhase("idle");
      setErrMsg(data.message || "Failed to send code. Try again.");
    } catch {
      setPhase("idle");
      setErrMsg("Network error — check your connection.");
    }
  }, []);

  const verifyOtp = useCallback(async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setPhase("verifying");
    setErrMsg("");

    try {
      const res  = await fetch(`${API}/verification/verify-email-otp`, {
        method  : "POST",
        headers : authJson(),
        body    : JSON.stringify({ otp: code }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPhase("done");
        setDevOtp("");
        onRefresh();
        return;
      }

      setOtpError(true);
      setOtp("");
      setPhase("otp");
      setErrMsg(data.message || "Incorrect code.");
      if (typeof data.attemptsLeft === "number") setAttemptsLeft(data.attemptsLeft);
      setTimeout(() => setOtpError(false), 700);
    } catch {
      setPhase("otp");
      setErrMsg("Network error — check your connection.");
    } finally {
      verifyingRef.current = false;
    }
  }, [onRefresh]);

  useEffect(() => {
    if (
      otp.length === OTP_LENGTH &&
      phase === "otp"           &&
      !autoRef.current          &&
      !verifyingRef.current
    ) {
      autoRef.current = true;
      const t = setTimeout(async () => {
        await verifyOtp(otp);
        autoRef.current = false;
      }, 180);
      return () => { clearTimeout(t); autoRef.current = false; };
    }
  }, [otp, phase, verifyOtp]);

  const isDone      = phase === "done";
  const isSending   = phase === "sending";
  const isVerifying = phase === "verifying";
  const showOtp     = phase === "otp" || phase === "verifying";

  const verifiedAt = status?.email_verified_at
    ? new Date(status.email_verified_at).toLocaleDateString("en-US", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <StepShell
      stepNum={1}
      icon={isDone ? <CheckCircle size={20} /> : <Mail size={20} />}
      title="Email Verification"
      subtitle={
        isDone
          ? verifiedAt ? `Verified ${verifiedAt}` : "Verified"
          : maskedEmail || "Verify your email address"
      }
      complete={isDone}
      open={showOtp || isSending}
      chipStatus={isDone ? "complete" : showOtp ? "active" : "pending"}
      headerBtn={
        !isDone && phase === "idle"
          ? (
            <button className="v-btn v-btn--primary v-btn--sm" onClick={sendOtp}>
              <Mail size={13} /> Verify Email
            </button>
          )
          : undefined
      }
    >
      <div className="v-otp-panel">

        {isSending && (
          <div className="v-otp-panel__status">
            <Loader2 size={15} className="v-spin" />
            <span>Sending code to {maskedEmail || "your email"}…</span>
          </div>
        )}

        {showOtp && !isSending && maskedEmail && (
          <p className="v-otp-panel__dest">
            Code sent to <strong>{maskedEmail}</strong>
          </p>
        )}

        {devOtp && (
          <Alert type="warning">
            Dev mode — code:{" "}
            <strong style={{ letterSpacing: 4, fontSize: 18, fontFamily: "monospace" }}>
              {devOtp}
            </strong>
          </Alert>
        )}

        {showOtp && (
          <>
            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={isVerifying}
              hasError={otpError}
            />
            <p className="v-otp-panel__hint">
              <Lock size={11} /> Auto-submits when all digits are entered
            </p>
          </>
        )}

        {isVerifying && (
          <div className="v-otp-panel__status">
            <Loader2 size={14} className="v-spin" />
            <span>Verifying…</span>
          </div>
        )}

        {errMsg && (
          <Alert type="error">
            <span>{errMsg}</span>
            {attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft <= 5 && (
              <span style={{ display: "block", fontSize: 12, opacity: 0.75, marginTop: 3 }}>
                {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
              </span>
            )}
          </Alert>
        )}

        {showOtp && (
          <div className="v-resend-row">
            <div>
              {remaining === 0 ? (
                <span className="v-resend-row__limit">
                  Daily limit reached — try tomorrow
                </span>
              ) : canResend ? (
                <button className="v-btn v-btn--link"
                        onClick={sendOtp} disabled={isSending}>
                  <RefreshCw size={12} className={isSending ? "v-spin" : ""} />
                  Resend code
                  {remaining !== null && (
                    <span className="v-resend-row__count">({remaining} left)</span>
                  )}
                </button>
              ) : (
                <span className="v-resend-row__timer">
                  Resend in{" "}
                  <Countdown
                    key={resendKey}
                    seconds={RESEND_SECS}
                    resendKey={resendKey}
                    onDone={() => setCanResend(true)}
                  />
                </span>
              )}
            </div>
            <span className="v-resend-row__note">
              <Lock size={10} /> Never share this code
            </span>
          </div>
        )}
      </div>
    </StepShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 2 — IDENTITY
══════════════════════════════════════════════════════════════ */
function IdentityStep({ status, onRefresh }) {
  const identityVerified = status?.identity_verified ?? false;
  const idReview         = status?.identity_review   ?? null;
  const isPending        = idReview?.status === "pending";
  const isRejected       = idReview?.status === "rejected";

  const [docType,    setDocType]    = useState("");
  const [docNumber,  setDocNumber]  = useState("");
  const [docFront,   setDocFront]   = useState(null);
  const [docBack,    setDocBack]    = useState(null);
  const [selfie,     setSelfie]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState({ text: "", ok: false });

  const selectedDoc = DOC_TYPES.find((d) => d.value === docType);
  const ready =
    Boolean(docType)             &&
    docNumber.trim().length >= 4 &&
    Boolean(docFront)            &&
    Boolean(docBack)             &&
    Boolean(selfie);

  const checklist = selectedDoc
    ? [
        { label: selectedDoc.numberLabel, done: docNumber.trim().length >= 4 },
        { label: "Document front",        done: Boolean(docFront) },
        { label: "Document back",         done: Boolean(docBack)  },
        { label: "Selfie photo",          done: Boolean(selfie)   },
      ]
    : [];

  const handleSubmit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setMsg({ text: "", ok: false });

    const fd = new FormData();
    fd.append("document_type",   docType);
    fd.append("document_number", docNumber.trim());
    fd.append("doc_front",       docFront);
    fd.append("doc_back",        docBack);
    fd.append("selfie",          selfie);

    try {
      const res  = await fetch(`${API}/verification/submit-identity`, {
        method: "POST", headers: authMultipart(), body: fd,
      });
      const data = await res.json();
      setMsg({ text: data.message || (res.ok ? "Submitted." : "Failed."), ok: res.ok });
      if (res.ok) onRefresh();
    } catch {
      setMsg({ text: "Network error.", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepShell
      stepNum={2}
      icon={identityVerified ? <CheckCircle size={20} /> : <CreditCard size={20} />}
      title="Identity Verification"
      subtitle={
        identityVerified ? "Verified"                   :
        isPending        ? "Under review"               :
        isRejected       ? "Rejected — please resubmit" :
        "Government-issued ID + selfie"
      }
      complete={identityVerified}
      chipStatus={
        identityVerified ? "complete"  :
        isPending        ? "in_review" :
        isRejected       ? "rejected"  :
        "pending"
      }
      open={!identityVerified && !isPending}
    >
      <div className="v-id-form">

        {isRejected && idReview?.rejection_reason && (
          <Alert type="error">
            <strong>Reason: </strong>{idReview.rejection_reason}
          </Alert>
        )}

        <fieldset className="v-doc-fieldset">
          <legend className="v-field-label">Select Document Type</legend>
          <div className="v-doc-grid">
            {DOC_TYPES.map((dt) => (
              <label key={dt.value}
                     className={`v-doc-option ${docType === dt.value ? "v-doc-option--selected" : ""}`}>
                <input type="radio" name="docType" value={dt.value}
                       checked={docType === dt.value}
                       onChange={() => {
                         setDocType(dt.value);
                         setDocFront(null); setDocBack(null); setDocNumber("");
                       }} />
                <span className="v-doc-option__label">{dt.label}</span>
                {docType === dt.value && <CheckCircle size={13} className="v-doc-option__check" />}
              </label>
            ))}
          </div>
        </fieldset>

        <AnimatePresence>
          {selectedDoc && (
            <motion.div
              key={docType}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="v-id-fields"
            >
              <div className="v-field">
                <label className="v-field-label">{selectedDoc.numberLabel}</label>
                <input type="text" className="v-input" value={docNumber}
                       onChange={(e) => setDocNumber(e.target.value)}
                       placeholder={`Enter ${selectedDoc.numberLabel}`}
                       maxLength={30} autoCapitalize="characters" />
              </div>

              <div className="v-field">
                <label className="v-field-label">{selectedDoc.frontLabel}</label>
                <FileUpload label="Tap or drag to upload"
                            hint={`JPG, PNG, WebP, PDF — max ${MAX_DOC_MB}MB`}
                            accept="image/*,.pdf"
                            file={docFront} onFile={setDocFront}
                            onRemove={() => setDocFront(null)}
                            maxBytes={MAX_DOC_BYTES} />
              </div>

              <div className="v-field">
                <label className="v-field-label">{selectedDoc.backLabel}</label>
                <FileUpload label="Tap or drag to upload"
                            hint={`JPG, PNG, WebP, PDF — max ${MAX_DOC_MB}MB`}
                            accept="image/*,.pdf"
                            file={docBack} onFile={setDocBack}
                            onRemove={() => setDocBack(null)}
                            maxBytes={MAX_DOC_BYTES} />
              </div>

              <div className="v-field">
                <label className="v-field-label">Selfie Verification</label>
                <SelfieCapture file={selfie} onFile={setSelfie}
                               onRemove={() => setSelfie(null)} />
              </div>

              <div className="v-checklist">
                {checklist.map((item) => (
                  <div key={item.label}
                       className={`v-checklist__row ${item.done ? "v-checklist__row--done" : ""}`}>
                    <div className="v-checklist__dot">
                      {item.done && <CheckCircle size={10} />}
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {msg.text && (
                <Alert type={msg.ok ? "success" : "error"}>{msg.text}</Alert>
              )}

              <button
                className={`v-btn v-btn--full ${ready ? "v-btn--primary" : "v-btn--ghost"}`}
                disabled={!ready || submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? <><Loader2 size={14} className="v-spin" /> Submitting…</>
                  : <><BadgeCheck size={14} /> Submit Identity</>
                }
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StepShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 3 — STORE
══════════════════════════════════════════════════════════════ */
function StoreStep({ status, onRefresh }) {
  const storeVerified = status?.store_verified ?? false;
  const storeReview   = status?.store_review   ?? null;
  const isPending     = storeReview?.status === "pending";
  const isRejected    = storeReview?.status === "rejected";

  const [storeName,  setStoreName]  = useState("");
  const [storeDesc,  setStoreDesc]  = useState("");
  const [storeLogo,  setStoreLogo]  = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState({ text: "", ok: false });

  const MAX_DESC = 300;
  const ready    = storeName.trim().length >= 2;

  const handleSubmit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setMsg({ text: "", ok: false });

    const fd = new FormData();
    fd.append("store_name",        storeName.trim());
    fd.append("store_description", storeDesc.trim());
    if (storeLogo) fd.append("store_logo", storeLogo);

    try {
      const res  = await fetch(`${API}/verification/submit-store`, {
        method: "POST", headers: authMultipart(), body: fd,
      });
      const data = await res.json();
      setMsg({ text: data.message || (res.ok ? "Submitted." : "Failed."), ok: res.ok });
      if (res.ok) onRefresh();
    } catch {
      setMsg({ text: "Network error.", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepShell
      stepNum={3}
      icon={storeVerified ? <CheckCircle size={20} /> : <Store size={20} />}
      title="Store Profile"
      subtitle={
        storeVerified ? "Verified"                   :
        isPending     ? "Under review"               :
        isRejected    ? "Rejected — please resubmit" :
        "Set up your seller store profile"
      }
      complete={storeVerified}
      chipStatus={
        storeVerified ? "complete"  :
        isPending     ? "in_review" :
        isRejected    ? "rejected"  :
        "pending"
      }
      open={!storeVerified && !isPending}
    >
      <div className="v-store-form">

        {isRejected && storeReview?.message && (
          <Alert type="error">
            <strong>Reason: </strong>{storeReview.message}
          </Alert>
        )}

        <div className="v-field">
          <label className="v-field-label">
            Store Name <span className="v-required">*</span>
          </label>
          <input type="text" className="v-input" value={storeName}
                 onChange={(e) => setStoreName(e.target.value)}
                 placeholder="e.g. Lagos Gadget Hub" maxLength={60} />
        </div>

        <div className="v-field">
          <label className="v-field-label">
            Description
            <span className="v-char-count">{storeDesc.length} / {MAX_DESC}</span>
          </label>
          <textarea className="v-textarea" value={storeDesc}
                    onChange={(e) => setStoreDesc(e.target.value)}
                    placeholder="What do you sell? Who are your customers?"
                    maxLength={MAX_DESC} rows={3} />
        </div>

        <div className="v-field">
          <label className="v-field-label">Store Logo (optional)</label>
          <FileUpload label="Upload store logo"
                      hint={`JPG, PNG — max ${MAX_LOGO_MB}MB`}
                      accept="image/*"
                      file={storeLogo} onFile={setStoreLogo}
                      onRemove={() => setStoreLogo(null)}
                      maxBytes={MAX_LOGO_BYTES} />
        </div>

        {msg.text && (
          <Alert type={msg.ok ? "success" : "error"}>{msg.text}</Alert>
        )}

        <button
          className={`v-btn v-btn--full ${ready ? "v-btn--primary" : "v-btn--ghost"}`}
          disabled={!ready || submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? <><Loader2 size={14} className="v-spin" /> Submitting…</>
            : <><Store size={14} /> Submit Store Profile</>
          }
        </button>
      </div>
    </StepShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════ */
export default function Verification() {
  const navigate = useNavigate();

  const [status,    setStatus]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [pageError, setPageError] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/verification/status`, {
        headers: authJson(),
      });

      if (res.status === 401) { navigate("/auth"); return; }

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus(data);
        setPageError("");
      } else {
        setPageError(data.message || "Failed to load status.");
      }
    } catch {
      setPageError("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── loading ── */
  if (loading) {
    return (
      <div className="v-loading">
        <Loader2 size={28} className="v-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  /* ── page error ── */
  if (pageError) {
    return (
      <div className="v-page-error">
        <AlertTriangle size={32} />
        <p>{pageError}</p>
        <button className="v-btn v-btn--primary" onClick={fetchStatus}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const emailVerified    = status?.email_verified    ?? false;
  const identityVerified = status?.identity_verified ?? false;
  const storeVerified    = status?.store_verified    ?? false;
  const trustScore       = Number(status?.trust_score ?? 0);
  const completed        = [emailVerified, identityVerified, storeVerified]
    .filter(Boolean).length;

  return (
    <div className="v-page">
      <div className="v-container">

        {/* ── top nav bar ── */}
        <motion.div
          className="v-topbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            className="v-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="v-topbar__center">
            <div className="v-topbar__shield">
              <Shield size={16} />
            </div>
            <span className="v-topbar__title">Account Verification</span>
          </div>
          {/* spacer keeps title centred */}
          <div className="v-topbar__spacer" aria-hidden="true" />
        </motion.div>

        {/* ── sub-heading ── */}
        <motion.p
          className="v-page-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          Complete all steps to unlock full marketplace access
        </motion.p>

        {/* trust ring */}
        <motion.div className="v-card v-card--trust"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}>
          <TrustRing
            score={trustScore}
            emailVerified={emailVerified}
            identityVerified={identityVerified}
            storeVerified={storeVerified}
          />
        </motion.div>

        {/* steps */}
        <motion.div className="v-steps"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}>
          <EmailStep    status={status} onRefresh={fetchStatus} />
          <IdentityStep status={status} onRefresh={fetchStatus} />
          <StoreStep    status={status} onRefresh={fetchStatus} />
        </motion.div>

        {/* progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.28 }}>
          <ProgressBar value={completed} max={3} />
        </motion.div>

      </div>
    </div>
  );
}
