// ════════════════════════════════════════════════════════════
// FILE: Verification.jsx — v5
// Matches: routes/verification.js v5 + Verification.css v2
// ════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from "react";
import { useNavigate } from "react-router-dom";
import "../../style/Verification.css";

// ── Icons (inline SVG to avoid extra deps) ──────────────────
const Icon = {
  Shield: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Mail: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  User: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  Store: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9l1-5h16l1 5"/>
      <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/>
      <path d="M5 9v11h14V9"/>
    </svg>
  ),
  Camera: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  ),
  Upload: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  File: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Check: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  AlertCircle: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  Info: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="8"/>
    </svg>
  ),
  Clock: (p) => (
    <svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  ArrowLeft: (p) => (
    <svg width={p.s||18} height={p.s||18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Loader: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="v-spin" {...p}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  Refresh: (p) => (
    <svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  Star: (p) => (
    <svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="currentColor"
      stroke="currentColor" strokeWidth="1" {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};

// ── API helpers ──────────────────────────────────────────────
const API_BASE = "/api/verification";

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const apiUpload = async (path, formData) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

// ── Utility ──────────────────────────────────────────────────
const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
};

const VALID_DOC_TYPES = [
  { value: "nin",            label: "National ID (NIN)" },
  { value: "passport",       label: "International Passport" },
  { value: "drivers_license",label: "Driver's License" },
  { value: "voters_card",    label: "Voter's Card" },
];

const DOC_VALIDATORS = {
  nin:             (v) => /^\d{11}$/.test(v.replace(/\s/g, "")),
  passport:        (v) => /^[A-Za-z]\d{8}$/.test(v.replace(/\s/g, "")),
  drivers_license: (v) => /^[A-Za-z]{3}\d{6}[A-Za-z]{2}$/.test(v.replace(/[\s-]/g, "")),
  voters_card:     (v) => /^[A-Za-z0-9]{19}$/.test(v.replace(/\s/g, "")),
};

const DOC_HINTS = {
  nin:             "11 digits — e.g. 12345678901",
  passport:        "1 letter + 8 digits — e.g. A12345678",
  drivers_license: "3 letters + 6 digits + 2 letters — e.g. ABC123456DE",
  voters_card:     "19 alphanumeric characters",
};

const ACCEPT_DOC  = ".jpg,.jpeg,.png,.webp,.pdf";
const ACCEPT_IMG  = ".jpg,.jpeg,.png,.webp";
const MAX_DOC_MB  = 5;
const MAX_LOGO_MB = 2;

// ── Trust ring SVG ──────────────────────────────────────────
const TIER_LABELS = [
  [80, "Elite"],
  [60, "Trusted"],
  [35, "Growing"],
  [0,  "Starter"],
];

const getTier = (score) => TIER_LABELS.find(([min]) => score >= min)[1];

function TrustRing({ score }) {
  const R = 54, C = 2 * Math.PI * R;
  const offset = C - (score / 100) * C;
  return (
    <div className="v-trust-ring">
      <div className="v-trust-ring__graphic">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--v-border)" strokeWidth="10"/>
          <circle
            cx="70" cy="70" r={R} fill="none"
            stroke="var(--v-orange)" strokeWidth="10"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset .6s ease" }}
          />
        </svg>
        <div className="v-trust-ring__center">
          <span className="v-trust-ring__number">{score}</span>
          <span className="v-trust-ring__denom">/100</span>
          <span className="v-trust-ring__tier">{getTier(score)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Alert ───────────────────────────────────────────────────
function Alert({ type = "info", children }) {
  const icons = {
    error:   <Icon.AlertCircle className="v-alert__icon" />,
    success: <Icon.Check className="v-alert__icon" />,
    warning: <Icon.AlertCircle className="v-alert__icon" />,
    info:    <Icon.Info className="v-alert__icon" />,
  };
  return (
    <div className={`v-alert v-alert--${type}`}>
      {icons[type]}
      <div className="v-alert__body">{children}</div>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────
function ProgressBar({ steps, done }) {
  const pct = Math.round((done / steps) * 100);
  return (
    <div className="v-progress">
      <div className="v-progress__header">
        <span className="v-progress__label">Verification Progress</span>
        <span className="v-progress__count">{done}/{steps} steps</span>
      </div>
      <div className="v-progress__track">
        <div className="v-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      {done === steps && (
        <div className="v-progress__done">
          <Icon.Check s={14} /> All steps complete!
        </div>
      )}
    </div>
  );
}

// ── FileUpload ───────────────────────────────────────────────
function FileUpload({ label, name, accept, maxMB, required, value, onChange, error }) {
  const [drag, setDrag]         = useState(false);
  const inputRef                = useRef(null);
  const maxBytes                = maxMB * 1_048_576;
  const ALLOWED_MIME            = accept.includes(".pdf")
    ? new Set(["image/jpeg","image/png","image/webp","application/pdf"])
    : new Set(["image/jpeg","image/png","image/webp"]);

  const handleFile = (file) => {
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) { onChange(null, `Invalid type: ${file.type}`); return; }
    if (file.size > maxBytes)         { onChange(null, `Max ${maxMB} MB allowed.`); return; }
    onChange(file, null);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const isImg = value && value.type.startsWith("image/");
  const isPdf = value && value.type === "application/pdf";

  return (
    <div className="v-field">
      <label className="v-field-label">
        {label}{required && <span className="v-required"> *</span>}
      </label>

      <input
        ref={inputRef}
        type="file"
        className="v-upload__hidden"
        accept={accept}
        onChange={(e) => handleFile(e.target.files[0])}
        aria-label={label}
      />

      {value ? (
        <div className={`v-upload v-upload--filled${error?" v-upload--error":""}`}>
          <div className="v-upload__preview">
            {isImg
              ? <img className="v-upload__thumb" src={URL.createObjectURL(value)} alt="preview" />
              : <div className="v-upload__doc"><Icon.File s={22}/></div>
            }
            <div className="v-upload__meta">
              <div className="v-upload__name">{value.name}</div>
              <div className="v-upload__size">{fmtBytes(value.size)}</div>
            </div>
            <button
              type="button"
              className="v-upload__remove"
              onClick={() => { onChange(null, null); if (inputRef.current) inputRef.current.value = ""; }}
              aria-label="Remove file"
            >
              <Icon.X s={14}/>
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`v-upload${drag?" v-upload--drag":""}${error?" v-upload--error":""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key==="Enter" && inputRef.current?.click()}
          aria-label={`Upload ${label}`}
        >
          <Icon.Upload className="v-upload__icon" s={22}/>
          <span className="v-upload__label">
            {drag ? "Drop here" : "Click or drag to upload"}
          </span>
          <span className="v-upload__hint">
            {accept.replace(/\./g,"").toUpperCase().split(",").join(", ")} · max {maxMB} MB
          </span>
        </div>
      )}

      {error && (
        <div className="v-upload__error">
          <Icon.AlertCircle s={12}/> {error}
        </div>
      )}
    </div>
  );
}

// ── SelfieCapture ────────────────────────────────────────────
function SelfieCapture({ value, onChange }) {
  const fileRef = useRef(null);
  const preview = value ? URL.createObjectURL(value) : null;

  return (
    <div className="v-selfie">
      <div className="v-selfie__circle">
        {preview
          ? <img src={preview} alt="Selfie" />
          : (
            <div className="v-selfie__empty">
              <Icon.Camera s={28}/>
              <span>No photo</span>
            </div>
          )
        }
      </div>

      <p className="v-selfie__guide">
        Face forward in good lighting. Remove glasses, hats, and masks.
      </p>

      <div className="v-selfie__actions">
        <input
          ref={fileRef} type="file" className="v-upload__hidden"
          accept={ACCEPT_IMG}
          onChange={(e) => {
            const f = e.target.files[0];
            if (f && f.size <= 5*1_048_576) onChange(f);
          }}
        />
        <button type="button" className="v-btn v-btn--ghost v-btn--sm"
          onClick={() => fileRef.current?.click()}>
          <Icon.Upload s={14}/> {value ? "Replace" : "Upload selfie"}
        </button>
        {value && (
          <button type="button" className="v-btn v-btn--ghost v-btn--sm"
            onClick={() => { onChange(null); if(fileRef.current) fileRef.current.value=""; }}>
            <Icon.X s={14}/> Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── OTP cells ─────────────────────────────────────────────────
const OTP_LEN = 6;

function OtpInput({ value, onChange, disabled, hasError }) {
  const cells   = useRef([]);
  const digits  = value.split("");

  const focusCell = (i) => cells.current[i]?.focus();

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits]; next[i] = ""; onChange(next.join(""));
      } else if (i > 0) {
        focusCell(i - 1);
      }
    } else if (e.key === "ArrowLeft"  && i > 0)            focusCell(i - 1);
    else if   (e.key === "ArrowRight" && i < OTP_LEN - 1)  focusCell(i + 1);
  };

  const handleChange = (i, raw) => {
    const ch = raw.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    const next = [...digits]; next[i] = ch; onChange(next.join(""));
    if (i < OTP_LEN - 1) focusCell(i + 1);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    onChange(pasted.padEnd(OTP_LEN, "").slice(0, OTP_LEN));
    focusCell(Math.min(pasted.length, OTP_LEN - 1));
  };

  return (
    <div className={`v-otp-group${hasError?" v-otp-group--error":""}`}>
      {Array.from({ length: OTP_LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => (cells.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1}
          className={`v-otp-cell${digits[i]?" v-otp-cell--filled":""}${hasError?" v-otp-cell--error":""}`}
          value={digits[i] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? "one-time-code" : "off"}
        />
      ))}
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────
function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (!seconds) return;
    const id = setInterval(() => setLeft((p) => { if (p <= 1) { clearInterval(id); onExpire?.(); return 0; } return p - 1; }), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return <span className={`v-countdown${left < 30?" v-countdown--warn":""}`}>{m}:{s}</span>;
}

// ── EmailGate ─────────────────────────────────────────────────
function EmailGate({ status, onVerified }) {
  const [phase, setPhase]       = useState("idle"); // idle | sending | sent | verifying | done
  const [otp, setOtp]           = useState("");
  const [otpError, setOtpError] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [remaining, setRemaining] = useState(status.resend_remaining ?? 0);
  const [msg, setMsg]           = useState(null);  // { type, text }
  const [expiresIn, setExpiresIn] = useState(0);

  const sendOtp = async () => {
    setPhase("sending"); setMsg(null);
    const { ok, data } = await apiFetch("/send-email-otp", { method: "POST" });
    if (ok) {
      setPhase("sent");
      setRemaining(data.remaining ?? 0);
      setCooldown(60);
      setExpiresIn(data.expiresIn ?? 600);
      setMsg({ type: "success", text: `Code sent to ${data.email}. Expires in ${data.expiresIn / 60} min.` });
    } else {
      setPhase("idle");
      setMsg({ type: "error", text: data.message ?? "Failed to send code." });
      if (data.retryAfter) setCooldown(data.retryAfter);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < OTP_LEN) { setOtpError(true); return; }
    setPhase("verifying"); setMsg(null);
    const { ok, data } = await apiFetch("/verify-email-otp", {
      method: "POST",
      body: JSON.stringify({ otp }),
    });
    if (ok) {
      setPhase("done");
      setMsg({ type: "success", text: "Email verified successfully!" });
      setTimeout(() => onVerified(data.trust_score), 1000);
    } else {
      setPhase("sent"); setOtpError(true);
      setMsg({ type: "error", text: data.message ?? "Incorrect code." });
      setOtp("");
    }
  };

  const busy = phase === "sending" || phase === "verifying" || phase === "done";

  return (
    <div className="v-email-gate">
      <div className="v-email-gate__icon">
        <Icon.Mail s={28}/>
      </div>

      <h2 className="v-email-gate__title">Verify Your Email</h2>

      <p className="v-email-gate__sub">
        We need to confirm your email address before you can submit identity documents.
        {status.email && <> Your address: <strong>{status.email}</strong></>}
      </p>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {phase === "idle" && (
        <button className="v-btn v-btn--primary v-btn--lg"
          onClick={sendOtp} disabled={remaining === 0}>
          <Icon.Mail s={16}/> Send verification code
        </button>
      )}

      {phase === "sending" && (
        <div className="v-otp-panel__status">
          <Icon.Loader s={16}/> Sending…
        </div>
      )}

      {(phase === "sent" || phase === "verifying") && (
        <div className="v-otp-panel">
          <p className="v-otp-panel__dest">
            Enter the 6-digit code sent to <strong>{status.email}</strong>
          </p>

          <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(false); }}
            disabled={phase === "verifying"} hasError={otpError} />

          {expiresIn > 0 && (
            <div className="v-otp-panel__hint">
              <Icon.Clock s={12}/> Expires in <Countdown seconds={expiresIn} onExpire={() => setExpiresIn(0)}/>
            </div>
          )}

          <button className="v-btn v-btn--primary v-btn--lg"
            onClick={verifyOtp}
            disabled={otp.length < OTP_LEN || phase === "verifying"}>
            {phase === "verifying" ? <><Icon.Loader s={16}/> Verifying…</> : "Confirm code"}
          </button>

          <div className="v-resend-row">
            <span className="v-resend-row__limit">
              {remaining} send{remaining !== 1 ? "s" : ""} left today
            </span>
            {cooldown > 0 ? (
              <div className="v-resend-row__timer">
                <Icon.Clock s={12}/>
                Resend in <Countdown seconds={cooldown} onExpire={() => setCooldown(0)}/>
              </div>
            ) : remaining > 0 ? (
              <button className="v-btn v-btn--link v-btn--sm" onClick={sendOtp}>
                <Icon.Refresh s={12}/> Resend code
              </button>
            ) : (
              <span className="v-resend-row__note">
                <Icon.AlertCircle s={12}/> Daily limit reached
              </span>
            )}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="v-otp-panel__status">
          <Icon.Check s={16}/> Redirecting…
        </div>
      )}
    </div>
  );
}

// ── StatusCard ────────────────────────────────────────────────
function StatusCard({ identityReview, storeReview, onResubmit }) {
  const idStatus    = identityReview?.status    ?? "pending";
  const storeStatus = storeReview?.status       ?? "pending";
  const combined    = idStatus === "approved" && storeStatus === "approved" ? "approved"
    : idStatus === "rejected" || storeStatus === "rejected"                 ? "rejected"
    : "pending";

  const ICONS = {
    pending:  <Icon.Clock s={32}/>,
    approved: <Icon.Check s={32}/>,
    rejected: <Icon.X     s={32}/>,
  };

  const TITLES = {
    pending:  "Under Review",
    approved: "Verified!",
    rejected: "Verification Failed",
  };

  const BODIES = {
    pending:  "Our team is reviewing your documents. This usually takes up to 24 hours.",
    approved: "Your identity and store have been verified. You now have full seller access.",
    rejected: identityReview?.rejection_reason ?? storeReview?.message ?? "Please review the reason below and resubmit.",
  };

  return (
    <div className={`v-status-card v-status-card--${combined}`}>
      <div className="v-status-card__icon">{ICONS[combined]}</div>
      <h2 className="v-status-card__title">{TITLES[combined]}</h2>
      <p  className="v-status-card__body">{BODIES[combined]}</p>

      {combined === "pending" && (
        <div className="v-status-card__steps">
          {[
            { label: "Documents uploaded",   done: true },
            { label: "Under review",         active: true },
            { label: "Decision made",        done: false },
          ].map(({ label, done, active }) => (
            <div key={label}
              className={`v-status-step${done?" v-status-step--done":active?" v-status-step--active":""}`}>
              {done   ? <Icon.Check s={14}/>
               :active ? <Icon.Loader s={14}/>
               :          <Icon.Clock s={14}/>
              }
              {label}
            </div>
          ))}
        </div>
      )}

      {combined === "rejected" && (
        <button className="v-btn v-btn--primary" onClick={onResubmit}>
          Resubmit documents
        </button>
      )}
    </div>
  );
}

// ── Checklist ─────────────────────────────────────────────────
function Checklist({ items }) {
  return (
    <div className="v-checklist">
      {items.map(({ label, done }) => (
        <div key={label} className={`v-checklist__row${done?" v-checklist__row--done":""}`}>
          <div className="v-checklist__dot">
            {done && <Icon.Check s={9}/>}
          </div>
          {label}
        </div>
      ))}
    </div>
  );
}

// ── Main form state ──────────────────────────────────────────
const INITIAL_FORM = {
  docType:   "",
  docNumber: "",
  storeName: "",
  storeDesc: "",
  front:     null,
  back:      null,
  selfie:    null,
  logo:      null,
};

const INITIAL_ERRORS = {
  docType: "", docNumber: "", storeName: "", storeDesc: "",
  front: "", back: "", selfie: "", logo: "",
};

function formReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":  return { ...state, [action.field]: action.value };
    case "SET_FILE":   return { ...state, [action.field]: action.file };
    case "RESET":      return INITIAL_FORM;
    default:           return state;
  }
}

// ── VerificationForm ─────────────────────────────────────────
function VerificationForm({ onSuccess }) {
  const [form,     dispatchForm] = useReducer(formReducer, INITIAL_FORM);
  const [errors,   setErrors]    = useState(INITIAL_ERRORS);
  const [fileErrs, setFileErrs]  = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalMsg,  setGlobalMsg]  = useState(null);
  const [faceResult, setFaceResult] = useState(null);
  const [faceChecking, setFaceChecking] = useState(false);

  // ── Derived checklist ──
  const checklist = [
    { label: "Document type selected",     done: !!form.docType },
    { label: "Document number entered",    done: !!(form.docNumber && DOC_VALIDATORS[form.docType]?.(form.docNumber)) },
    { label: "Front image uploaded",       done: !!form.front },
    { label: "Back image uploaded",        done: !!form.back },
    { label: "Selfie uploaded",            done: !!form.selfie },
    { label: "Store name entered",         done: form.storeName.length >= 2 },
  ];
  const doneCnt   = checklist.filter((c) => c.done).length;
  const allDone   = doneCnt === checklist.length;

  // ── Face check (auto after both selfie + front present) ──
  const prevFaceKey = useRef(null);
  useEffect(() => {
    if (!form.selfie || !form.front) { setFaceResult(null); return; }
    const key = `${form.selfie.name}_${form.front.name}`;
    if (key === prevFaceKey.current) return;
    prevFaceKey.current = key;

    const run = async () => {
      setFaceChecking(true); setFaceResult(null);
      const fd = new FormData();
      fd.append("selfie",    form.selfie);
      fd.append("doc_front", form.front);
      const { ok, data } = await apiUpload("/face-check", fd);
      setFaceChecking(false);
      if (ok) setFaceResult(data);
    };
    run();
  }, [form.selfie, form.front]);

  // ── Validate ──
  const validate = () => {
    const errs = { ...INITIAL_ERRORS };
    let ok = true;

    if (!form.docType)                                        { errs.docType   = "Select a document type."; ok = false; }
    if (!form.docNumber.trim())                               { errs.docNumber = "Enter your document number."; ok = false; }
    else if (form.docType && !DOC_VALIDATORS[form.docType]?.(form.docNumber))
                                                              { errs.docNumber = `Invalid ${form.docType.replace(/_/g," ")} number.`; ok = false; }
    if (!form.front)                                          { errs.front     = "Document front is required."; ok = false; }
    if (!form.back)                                           { errs.back      = "Document back is required."; ok = false; }
    if (!form.selfie)                                         { errs.selfie    = "Selfie is required."; ok = false; }
    if (form.storeName.trim().length < 2)                     { errs.storeName = "Store name must be at least 2 characters."; ok = false; }
    if (form.storeName.trim().length > 60)                    { errs.storeName = "Store name must be 60 characters or fewer."; ok = false; }
    if (form.storeDesc.length > 300)                          { errs.storeDesc = "Description must be 300 characters or fewer."; ok = false; }

    setErrors(errs);
    return ok;
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (faceResult && !faceResult.skipped && faceResult.match === false) {
      setGlobalMsg({ type: "error", text: "Selfie does not match document. Retake both photos." });
      return;
    }

    setSubmitting(true); setGlobalMsg(null);

    const fd = new FormData();
    fd.append("document_type",     form.docType);
    fd.append("document_number",   form.docNumber);
    fd.append("store_name",        form.storeName.trim());
    fd.append("store_description", form.storeDesc.trim());
    fd.append("liveness_passed",   "false");
    fd.append("doc_front",         form.front);
    fd.append("doc_back",          form.back);
    fd.append("selfie",            form.selfie);
    if (form.logo) fd.append("store_logo", form.logo);

    const { ok, status, data } = await apiUpload("/submit", fd);
    setSubmitting(false);

    if (ok || status === 202) {
      onSuccess();
    } else {
      setGlobalMsg({ type: "error", text: data.message ?? "Submission failed. Please try again." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <form className="v-form" onSubmit={handleSubmit} noValidate>

      {globalMsg && <Alert type={globalMsg.type}>{globalMsg.text}</Alert>}

      {/* ── Identity section ── */}
      <div className="v-form__section">
        <div className="v-form__section-header">
          <Icon.User s={18}/>
          <h3>Identity Verification</h3>
        </div>

        {/* Document type picker */}
        <div className="v-field">
          <fieldset className="v-doc-fieldset">
            <legend className="v-field-label">
              Document Type <span className="v-required">*</span>
            </legend>
            <div className="v-doc-grid">
              {VALID_DOC_TYPES.map(({ value, label }) => (
                <label
                  key={value}
                  className={`v-doc-option${form.docType===value?" v-doc-option--selected":""}`}
                >
                  <input
                    type="radio" name="docType" value={value}
                    checked={form.docType === value}
                    onChange={() => {
                      dispatchForm({ type: "SET_FIELD", field: "docType", value });
                      setErrors((p) => ({ ...p, docType: "", docNumber: "" }));
                      dispatchForm({ type: "SET_FIELD", field: "docNumber", value: "" });
                    }}
                  />
                  <span className="v-doc-option__label">{label}</span>
                  {form.docType === value && <Icon.Check className="v-doc-option__check" s={16}/>}
                </label>
              ))}
            </div>
          </fieldset>
          {errors.docType && <Alert type="error">{errors.docType}</Alert>}
        </div>

        {/* Document number */}
        {form.docType && (
          <div className="v-field">
            <label className="v-field-label" htmlFor="docNumber">
              {VALID_DOC_TYPES.find(d=>d.value===form.docType)?.label} Number
              <span className="v-required"> *</span>
            </label>
            <input
              id="docNumber" type="text"
              className="v-input"
              placeholder={DOC_HINTS[form.docType]}
              value={form.docNumber}
              onChange={(e) => {
                dispatchForm({ type: "SET_FIELD", field: "docNumber", value: e.target.value });
                setErrors((p) => ({ ...p, docNumber: "" }));
              }}
              autoComplete="off"
            />
            {errors.docNumber && <Alert type="error">{errors.docNumber}</Alert>}
          </div>
        )}

        {/* ID images */}
        <div className="v-id-fields">
          <FileUpload
            label="Document Front" name="doc_front"
            accept={ACCEPT_DOC} maxMB={MAX_DOC_MB} required
            value={form.front}
            error={errors.front || fileErrs.front}
            onChange={(f, err) => {
              dispatchForm({ type: "SET_FILE", field: "front", file: f });
              setErrors((p) => ({ ...p, front: "" }));
              setFileErrs((p) => ({ ...p, front: err ?? "" }));
            }}
          />
          <FileUpload
            label="Document Back" name="doc_back"
            accept={ACCEPT_DOC} maxMB={MAX_DOC_MB} required
            value={form.back}
            error={errors.back || fileErrs.back}
            onChange={(f, err) => {
              dispatchForm({ type: "SET_FILE", field: "back", file: f });
              setErrors((p) => ({ ...p, back: "" }));
              setFileErrs((p) => ({ ...p, back: err ?? "" }));
            }}
          />
        </div>

        {/* Selfie */}
        <div className="v-field">
          <label className="v-field-label">
            Selfie Photo <span className="v-required">*</span>
          </label>
          <SelfieCapture
            value={form.selfie}
            onChange={(f) => {
              dispatchForm({ type: "SET_FILE", field: "selfie", file: f });
              setErrors((p) => ({ ...p, selfie: "" }));
            }}
          />
          {errors.selfie && <Alert type="error">{errors.selfie}</Alert>}
        </div>

        {/* Face check result */}
        {faceChecking && (
          <Alert type="info">
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Icon.Loader s={14}/> Checking face match…
            </div>
          </Alert>
        )}
        {faceResult && !faceChecking && (
          faceResult.skipped ? (
            <Alert type="info">
              Face match skipped — submission will be manually reviewed.
            </Alert>
          ) : faceResult.match ? (
            <Alert type="success">
              <Icon.Check s={14}/> Face match confirmed
              {faceResult.confidence != null &&
                ` (${Math.round(faceResult.confidence * 100)}% confidence)`}.
            </Alert>
          ) : (
            <Alert type="error">
              Selfie does not match document. Please retake both photos.
            </Alert>
          )
        )}

        {/* Checklist */}
        <Checklist items={checklist.slice(0, 5)} />
      </div>

      {/* ── Store section ── */}
      <div className="v-form__section">
        <div className="v-form__section-header">
          <Icon.Store s={18}/>
          <h3>Store Information</h3>
        </div>

        <div className="v-field">
          <label className="v-field-label" htmlFor="storeName">
            Store Name <span className="v-required">*</span>
            <span className="v-char-count">{form.storeName.length}/60</span>
          </label>
          <input
            id="storeName" type="text" className="v-input"
            placeholder="Your store name"
            maxLength={60}
            value={form.storeName}
            onChange={(e) => {
              dispatchForm({ type: "SET_FIELD", field: "storeName", value: e.target.value });
              setErrors((p) => ({ ...p, storeName: "" }));
            }}
          />
          {errors.storeName && <Alert type="error">{errors.storeName}</Alert>}
        </div>

        <div className="v-field">
          <label className="v-field-label" htmlFor="storeDesc">
            Store Description
            <span className="v-char-count">{form.storeDesc.length}/300</span>
          </label>
          <textarea
            id="storeDesc" className="v-textarea"
            placeholder="Briefly describe what your store sells (optional)"
            maxLength={300}
            value={form.storeDesc}
            onChange={(e) => {
              dispatchForm({ type: "SET_FIELD", field: "storeDesc", value: e.target.value });
              setErrors((p) => ({ ...p, storeDesc: "" }));
            }}
          />
          {errors.storeDesc && <Alert type="error">{errors.storeDesc}</Alert>}
        </div>

        <FileUpload
          label="Store Logo" name="store_logo"
          accept={ACCEPT_IMG} maxMB={MAX_LOGO_MB}
          value={form.logo}
          error={fileErrs.logo}
          onChange={(f, err) => {
            dispatchForm({ type: "SET_FILE", field: "logo", file: f });
            setFileErrs((p) => ({ ...p, logo: err ?? "" }));
          }}
        />

        <Checklist items={[checklist[5]]} />
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        className="v-btn v-btn--primary v-btn--lg v-btn--full"
        disabled={submitting}
      >
        {submitting
          ? <><Icon.Loader s={18}/> Submitting…</>
          : <><Icon.Shield s={18}/> Submit for Verification</>
        }
      </button>

      {!allDone && !submitting && (
        <p className="v-form__incomplete-hint">
          Complete all required fields above to submit.
        </p>
      )}
    </form>
  );
}

// ════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ════════════════════════════════════════════════════════════
export default function Verification() {
  const navigate = useNavigate();

  const [loading,   setLoading]   = useState(true);
  const [pageError, setPageError] = useState(null);
  const [status,    setStatus]    = useState(null);
  // view: "loading" | "email-gate" | "status-card" | "form" | "submitted"
  const [view, setView] = useState("loading");

  // ── Fetch /status ──
  const fetchStatus = useCallback(async () => {
    setLoading(true); setPageError(null);
    const { ok, data } = await apiFetch("/status");
    setLoading(false);
    if (!ok) { setPageError(data.message ?? "Failed to load verification status."); return; }
    setStatus(data);
    resolveView(data);
  }, []);

  const resolveView = (data) => {
    if (!data.email_verified) { setView("email-gate"); return; }

    const idStatus    = data.identity_review?.status;
    const storeStatus = data.store_review?.status;

    // Already fully verified
    if (data.identity_verified && data.store_verified) { setView("status-card"); return; }

    // A review is pending or approved
    if (idStatus === "pending" || idStatus === "approved"
     || storeStatus === "pending" || storeStatus === "approved") {
      setView("status-card"); return;
    }

    // Rejected — allow resubmit
    if (idStatus === "rejected" || storeStatus === "rejected") {
      setView("status-card"); return;
    }

    setView("form");
  };

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Progress steps ──
  const progressSteps = status ? [
    status.email_verified,
    !!(status.identity_review),
    status.identity_verified && status.store_verified,
  ] : [];
  const progressDone = progressSteps.filter(Boolean).length;

  // ── Render ──
  if (loading) {
    return (
      <div className="v-page">
        <div className="v-loading">
          <Icon.Loader s={32}/> Loading verification…
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="v-page">
        <div className="v-page-error">
          <Icon.AlertCircle s={40}/>
          <p>{pageError}</p>
          <button className="v-btn v-btn--ghost" onClick={fetchStatus}>
            <Icon.Refresh s={14}/> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="v-page">
      <div className="v-container">

        {/* ── Top bar ── */}
        <div className="v-topbar">
          <button className="v-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <Icon.ArrowLeft s={18}/>
          </button>
          <div className="v-topbar__center">
            <div className="v-topbar__shield"><Icon.Shield s={16}/></div>
            <span className="v-topbar__title">Identity Verification</span>
          </div>
          <div className="v-topbar__spacer" aria-hidden />
        </div>

        {status && (
          <p className="v-page-sub">
            Verify your identity to unlock full seller privileges and build buyer trust.
          </p>
        )}

        {/* ── Trust ring ── */}
        {status && (
          <div className="v-card v-card--trust">
            <TrustRing score={status.trust_score ?? 0}/>
          </div>
        )}

        {/* ── Progress ── */}
        {status && (
          <ProgressBar steps={3} done={progressDone}/>
        )}

        {/* ── Limited listings warning ── */}
        {status?.limited_listings?.count > 0 && (
          <Alert type="warning">
            <strong>Listings expiring soon:</strong>{" "}
            {status.limited_listings.message}
          </Alert>
        )}

        {/* ── Upgrade benefits ── */}
        {status?.upgrade_benefits && view === "form" && (
          <Alert type="info">
            {status.upgrade_benefits.message}
          </Alert>
        )}

        {/* ── Main card ── */}
        <div className="v-card">
          {view === "email-gate" && (
            <EmailGate
              status={status}
              onVerified={(newScore) => {
                setStatus((p) => ({ ...p, email_verified: true, trust_score: newScore }));
                setView("form");
              }}
            />
          )}

          {view === "form" && (
            <VerificationForm
              onSuccess={() => {
                setView("submitted");
                fetchStatus();
              }}
            />
          )}

          {view === "submitted" && (
            <div className="v-status-card v-status-card--pending">
              <div className="v-status-card__icon"><Icon.Clock s={32}/></div>
              <h2 className="v-status-card__title">Documents Submitted</h2>
              <p className="v-status-card__body">
                Our team will review your documents within 24 hours.
                You'll be notified once a decision is made.
              </p>
            </div>
          )}

          {view === "status-card" && status && (
            <StatusCard
              identityReview={status.identity_review}
              storeReview={status.store_review}
              onResubmit={() => setView("form")}
            />
          )}
        </div>

        {/* ── Account status chip ── */}
        {status && (
          <div style={{ display:"flex", justifyContent:"center" }}>
            <span className={`v-chip ${
              status.identity_verified && status.store_verified ? "chip--complete"
              : status.identity_review?.status === "pending"    ? "chip--review"
              : status.identity_review?.status === "rejected"   ? "chip--rejected"
              : status.email_verified                            ? "chip--active"
              : "chip--pending"
            }`}>
              {status.identity_verified && status.store_verified ? "✓ Fully Verified"
              : status.identity_review?.status === "pending"     ? "⏳ Under Review"
              : status.identity_review?.status === "rejected"    ? "✗ Rejected"
              : status.email_verified                            ? "Email Verified"
              : "Not Verified"}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}