// ════════════════════════════════════════════════════════════
// FILE: Verification.jsx — v5
// Auth: reads "marketplace_token" from localStorage
// Matches: routes/verification.js v5 + Verification.css v2
// ════════════════════════════════════════════════════════════

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from "react";
import { useNavigate } from "react-router-dom";
import "./Verification.css";

/* ══════════════════════════════════════════════════════════════
   TOKEN
══════════════════════════════════════════════════════════════ */
const getToken = () => localStorage.getItem("marketplace_token") ?? null;

/* ══════════════════════════════════════════════════════════════
   API
══════════════════════════════════════════════════════════════ */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/verification`;

const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const apiUpload = async (path, formData) => {
  const token = getToken();
  // ⚠️ No Content-Type — browser sets multipart/form-data boundary automatically
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const OTP_LEN = 6;

const VALID_DOC_TYPES = [
  { value: "nin",             label: "National ID (NIN)"       },
  { value: "passport",        label: "International Passport"  },
  { value: "drivers_license", label: "Driver's License"        },
  { value: "voters_card",     label: "Voter's Card"            },
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

const ALLOWED_DOC_MIME  = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);
const ALLOWED_IMG_MIME  = new Set([
  "image/jpeg", "image/png", "image/webp",
]);

/* ══════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════ */
const fmtBytes = (b) => {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
};

/* ══════════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
const Ic = {
  Shield: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Mail: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  User: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  Store: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-5h16l1 5"/>
      <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/>
      <path d="M5 9v11h14V9"/>
    </svg>
  ),
  Camera: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  ),
  Upload: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  File: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Check: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  AlertCircle: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  Info: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="8"/>
    </svg>
  ),
  Clock: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  ArrowLeft: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Loader: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="v-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  Refresh: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════
   TRUST RING
══════════════════════════════════════════════════════════════ */
const TIERS = [[80,"Elite"],[60,"Trusted"],[35,"Growing"],[0,"Starter"]];
const getTier = (s) => TIERS.find(([min]) => s >= min)[1];

function TrustRing({ score }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = C - (score / 100) * C;
  return (
    <div className="v-trust-ring">
      <div className="v-trust-ring__graphic">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={R} fill="none"
            stroke="var(--v-border)" strokeWidth="10"/>
          <circle cx="70" cy="70" r={R} fill="none"
            stroke="var(--v-orange)" strokeWidth="10"
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              transition: "stroke-dashoffset .6s ease",
            }}
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

/* ══════════════════════════════════════════════════════════════
   ALERT
══════════════════════════════════════════════════════════════ */
function Alert({ type = "info", children }) {
  const icons = {
    error:   <Ic.AlertCircle s={15} />,
    success: <Ic.Check s={15} />,
    warning: <Ic.AlertCircle s={15} />,
    info:    <Ic.Info s={15} />,
  };
  return (
    <div className={`v-alert v-alert--${type}`}>
      <span className="v-alert__icon">{icons[type]}</span>
      <div className="v-alert__body">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS BAR
══════════════════════════════════════════════════════════════ */
function ProgressBar({ steps, done }) {
  const pct = Math.round((done / steps) * 100);
  return (
    <div className="v-progress">
      <div className="v-progress__header">
        <span className="v-progress__label">Verification Progress</span>
        <span className="v-progress__count">{done}/{steps} steps</span>
      </div>
      <div className="v-progress__track">
        <div className="v-progress__fill" style={{ width: `${pct}%` }}/>
      </div>
      {done === steps && (
        <div className="v-progress__done">
          <Ic.Check s={13}/> All steps complete!
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COUNTDOWN
══════════════════════════════════════════════════════════════ */
function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    if (!seconds) return;
    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) { clearInterval(id); onExpire?.(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]); // eslint-disable-line

  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return (
    <span className={`v-countdown${left < 30 ? " v-countdown--warn" : ""}`}>
      {m}:{s}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   OTP INPUT
══════════════════════════════════════════════════════════════ */
function OtpInput({ value, onChange, disabled, hasError }) {
  const cells  = useRef([]);
  const digits = value.split("");

  const focusCell = (i) => cells.current[i]?.focus();

  // Auto-focus first cell on mount
  useEffect(() => {
    const t = setTimeout(() => cells.current[0]?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

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
    const pasted = e.clipboardData.getData("text")
      .replace(/\D/g, "").slice(0, OTP_LEN);
    onChange(pasted.padEnd(OTP_LEN, "").slice(0, OTP_LEN));
    focusCell(Math.min(pasted.length, OTP_LEN - 1));
  };

  return (
    <div
      className={`v-otp-group${hasError ? " v-otp-group--error" : ""}`}
      role="group"
      aria-label="Verification code"
    >
      {Array.from({ length: OTP_LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => (cells.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          className={[
            "v-otp-cell",
            digits[i]  ? "v-otp-cell--filled" : "",
            hasError   ? "v-otp-cell--error"  : "",
          ].filter(Boolean).join(" ")}
          value={digits[i] ?? ""}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILE UPLOAD
══════════════════════════════════════════════════════════════ */
function FileUpload({
  label, accept, maxMB, required = false,
  value, onChange, error,
}) {
  const [drag, setDrag] = useState(false);
  const inputRef        = useRef(null);
  const maxBytes        = maxMB * 1_048_576;
  const allowedMime     = accept.includes(".pdf") ? ALLOWED_DOC_MIME : ALLOWED_IMG_MIME;

  const handleFile = (file) => {
    if (!file) return;
    if (!allowedMime.has(file.type)) {
      onChange(null, `Invalid file type: ${file.type}`);
      return;
    }
    if (file.size > maxBytes) {
      onChange(null, `File too large — max ${maxMB} MB.`);
      return;
    }
    onChange(file, null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const isImg = value?.type?.startsWith("image/");

  return (
    <div className="v-field">
      <label className="v-field-label">
        {label}
        {required && <span className="v-required"> *</span>}
      </label>

      <input
        ref={inputRef}
        type="file"
        className="v-upload__hidden"
        accept={accept}
        aria-label={label}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {value ? (
        <div className="v-upload v-upload--filled">
          <div className="v-upload__preview">
            {isImg
              ? <img
                  className="v-upload__thumb"
                  src={URL.createObjectURL(value)}
                  alt="preview"
                />
              : <div className="v-upload__doc"><Ic.File s={22}/></div>
            }
            <div className="v-upload__meta">
              <div className="v-upload__name">{value.name}</div>
              <div className="v-upload__size">{fmtBytes(value.size)}</div>
            </div>
            <button
              type="button"
              className="v-upload__remove"
              aria-label="Remove file"
              onClick={() => {
                onChange(null, null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <Ic.X s={14}/>
            </button>
          </div>
        </div>
      ) : (
        <div
          className={[
            "v-upload",
            drag  ? "v-upload--drag"  : "",
            error ? "v-upload--error" : "",
          ].filter(Boolean).join(" ")}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          aria-label={`Upload ${label}`}
        >
          <Ic.Upload s={22}/>
          <span className="v-upload__label">
            {drag ? "Drop here" : "Click or drag to upload"}
          </span>
          <span className="v-upload__hint">
            {accept.replace(/\./g, "").toUpperCase().split(",").join(", ")} · max {maxMB} MB
          </span>
        </div>
      )}

      {error && (
        <div className="v-upload__error">
          <Ic.AlertCircle s={12}/> {error}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SELFIE CAPTURE
══════════════════════════════════════════════════════════════ */
function SelfieCapture({ value, onChange, error }) {
  const fileRef = useRef(null);
  const preview = value ? URL.createObjectURL(value) : null;

  const handleFile = (f) => {
    if (!f) return;
    if (!ALLOWED_IMG_MIME.has(f.type)) return;
    if (f.size > MAX_DOC_MB * 1_048_576) return;
    onChange(f);
  };

  return (
    <div className="v-selfie">
      <div className="v-selfie__circle">
        {preview
          ? <img src={preview} alt="Selfie preview"/>
          : (
            <div className="v-selfie__empty">
              <Ic.Camera s={28}/>
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
          ref={fileRef}
          type="file"
          className="v-upload__hidden"
          accept={ACCEPT_IMG}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <button
          type="button"
          className="v-btn v-btn--ghost v-btn--sm"
          onClick={() => fileRef.current?.click()}
        >
          <Ic.Upload s={14}/> {value ? "Replace" : "Upload selfie"}
        </button>
        {value && (
          <button
            type="button"
            className="v-btn v-btn--ghost v-btn--sm"
            onClick={() => {
              onChange(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            <Ic.X s={14}/> Remove
          </button>
        )}
      </div>

      {error && (
        <div className="v-upload__error">
          <Ic.AlertCircle s={12}/> {error}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CHECKLIST
══════════════════════════════════════════════════════════════ */
function Checklist({ items }) {
  return (
    <div className="v-checklist">
      {items.map(({ label, done }) => (
        <div
          key={label}
          className={`v-checklist__row${done ? " v-checklist__row--done" : ""}`}
        >
          <div className="v-checklist__dot">
            {done && <Ic.Check s={9}/>}
          </div>
          {label}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMAIL GATE
══════════════════════════════════════════════════════════════ */
function EmailGate({ status, onVerified }) {
  // phase: idle | sending | sent | verifying | done
  const [phase,     setPhase]     = useState("idle");
  const [otp,       setOtp]       = useState("");
  const [otpError,  setOtpError]  = useState(false);
  const [cooldown,  setCooldown]  = useState(0);
  const [remaining, setRemaining] = useState(status.resend_remaining ?? 0);
  const [expiresIn, setExpiresIn] = useState(0);
  const [msg,       setMsg]       = useState(null); // { type, text }
  const [devOtp,    setDevOtp]    = useState("");

  const verifyingRef = useRef(false);
  const autoRef      = useRef(false);

  /* ── send ── */
  const sendOtp = async () => {
    setPhase("sending"); setMsg(null);
    const { ok, data } = await apiFetch("/send-email-otp", { method: "POST" });
    if (ok) {
      setPhase("sent");
      setRemaining(data.remaining ?? 0);
      setCooldown(data.expiresIn ? 60 : 60);
      setExpiresIn(data.expiresIn ?? 600);
      if (data.dev_otp) setDevOtp(data.dev_otp);
      setMsg({ type: "success", text: `Code sent to ${data.email}.` });
    } else {
      setPhase("idle");
      setMsg({ type: "error", text: data.message ?? "Failed to send code." });
      if (data.retryAfter) setCooldown(data.retryAfter);
    }
  };

  /* ── verify ── */
  const verifyOtp = useCallback(async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setPhase("verifying"); setMsg(null);

    const { ok, data } = await apiFetch("/verify-email-otp", {
      method: "POST",
      body: JSON.stringify({ otp: code }),
    });

    if (ok) {
      setPhase("done");
      setMsg({ type: "success", text: "Email verified!" });
      setTimeout(() => onVerified(data.trust_score ?? 0), 900);
    } else {
      setPhase("sent");
      setOtpError(true);
      setOtp("");
      setMsg({ type: "error", text: data.message ?? "Incorrect code." });
      setTimeout(() => setOtpError(false), 700);
    }

    verifyingRef.current = false;
  }, [onVerified]);

  /* ── auto-submit when 6 digits entered ── */
  useEffect(() => {
    if (
      otp.length === OTP_LEN &&
      phase === "sent"       &&
      !autoRef.current       &&
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

  const busy = phase === "sending" || phase === "verifying" || phase === "done";

  return (
    <div className="v-email-gate">
      <div className="v-email-gate__icon">
        <Ic.Mail s={28}/>
      </div>

      <h2 className="v-email-gate__title">Verify Your Email</h2>

      <p className="v-email-gate__sub">
        Confirm your email address before submitting identity documents.
        {status.email && (
          <> Your address: <strong style={{ color: "var(--v-orange)" }}>{status.email}</strong></>
        )}
      </p>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* Dev OTP helper */}
      {devOtp && (
        <div style={{
          padding: "8px 14px", background: "var(--v-amber-dim)",
          borderRadius: "var(--v-r-sm)", fontSize: 13,
          color: "var(--v-amber)", fontWeight: 600,
        }}>
          Dev mode — code: <strong>{devOtp}</strong>
        </div>
      )}

      {/* ── idle: show send button ── */}
      {phase === "idle" && (
        <button
          className="v-btn v-btn--primary v-btn--lg"
          onClick={sendOtp}
          disabled={remaining === 0}
        >
          <Ic.Mail s={16}/> Send verification code
        </button>
      )}

      {/* ── sending spinner ── */}
      {phase === "sending" && (
        <div className="v-otp-panel__status">
          <Ic.Loader s={16}/> Sending…
        </div>
      )}

      {/* ── sent / verifying: show OTP input ── */}
      {(phase === "sent" || phase === "verifying") && (
        <div className="v-otp-panel">
          <p className="v-otp-panel__dest">
            Enter the 6-digit code — auto-submits when complete
          </p>

          <OtpInput
            value={otp}
            onChange={(v) => { setOtp(v); setOtpError(false); }}
            disabled={phase === "verifying"}
            hasError={otpError}
          />

          {expiresIn > 0 && (
            <div className="v-otp-panel__hint">
              <Ic.Clock s={12}/>&nbsp;
              Expires in <Countdown seconds={expiresIn} onExpire={() => setExpiresIn(0)}/>
            </div>
          )}

          {/* Manual submit fallback */}
          <button
            className="v-btn v-btn--primary v-btn--lg"
            onClick={() => verifyOtp(otp)}
            disabled={otp.length < OTP_LEN || phase === "verifying"}
          >
            {phase === "verifying"
              ? <><Ic.Loader s={16}/> Verifying…</>
              : "Confirm code"
            }
          </button>

          {/* Resend row */}
          <div className="v-resend-row">
            <span className="v-resend-row__limit">
              {remaining} send{remaining !== 1 ? "s" : ""} left today
            </span>

            {cooldown > 0 ? (
              <div className="v-resend-row__timer">
                <Ic.Clock s={12}/>&nbsp;
                Resend in <Countdown seconds={cooldown} onExpire={() => setCooldown(0)}/>
              </div>
            ) : remaining > 0 ? (
              <button className="v-btn v-btn--link v-btn--sm" onClick={sendOtp}>
                <Ic.Refresh s={12}/> Resend code
              </button>
            ) : (
              <span className="v-resend-row__note">
                <Ic.AlertCircle s={12}/> Daily limit reached
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── done ── */}
      {phase === "done" && (
        <div className="v-otp-panel__status">
          <Ic.Check s={16}/> Redirecting…
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATUS CARD
══════════════════════════════════════════════════════════════ */
function StatusCard({ identityReview, storeReview, onResubmit }) {
  const idStatus    = identityReview?.status ?? null;
  const storeStatus = storeReview?.status    ?? null;

  const combined =
    idStatus === "approved" && storeStatus === "approved" ? "approved"
    : idStatus === "rejected" || storeStatus === "rejected" ? "rejected"
    : "pending";

  const ICON = {
    pending:  <Ic.Clock   s={32}/>,
    approved: <Ic.Check   s={32}/>,
    rejected: <Ic.X       s={32}/>,
  };

  const TITLE = {
    pending:  "Under Review",
    approved: "Fully Verified!",
    rejected: "Verification Failed",
  };

  const BODY = {
    pending:  "Our team is reviewing your documents. This usually takes up to 24 hours.",
    approved: "Your identity and store are verified. You now have full seller access.",
    rejected: identityReview?.rejection_reason
              ?? storeReview?.message
              ?? "Please check the reason below and resubmit.",
  };

  return (
    <div className={`v-status-card v-status-card--${combined}`}>
      <div className="v-status-card__icon">{ICON[combined]}</div>
      <h2 className="v-status-card__title">{TITLE[combined]}</h2>
      <p  className="v-status-card__body">{BODY[combined]}</p>

      {combined === "pending" && (
        <div className="v-status-card__steps">
          {[
            { label: "Documents uploaded", done: true,  active: false },
            { label: "Under review",       done: false, active: true  },
            { label: "Decision made",      done: false, active: false },
          ].map(({ label, done, active }) => (
            <div
              key={label}
              className={[
                "v-status-step",
                done   ? "v-status-step--done"   : "",
                active ? "v-status-step--active" : "",
              ].filter(Boolean).join(" ")}
            >
              {done   ? <Ic.Check  s={14}/>
               : active ? <Ic.Loader s={14}/>
               :           <Ic.Clock  s={14}/>
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

/* ══════════════════════════════════════════════════════════════
   FORM STATE
══════════════════════════════════════════════════════════════ */
const INIT_FORM = {
  docType: "", docNumber: "",
  storeName: "", storeDesc: "",
  front: null, back: null, selfie: null, logo: null,
};

const INIT_ERRS = {
  docType: "", docNumber: "", storeName: "", storeDesc: "",
  front: "", back: "", selfie: "",
};

function formReducer(state, action) {
  switch (action.type) {
    case "FIELD": return { ...state, [action.k]: action.v };
    case "FILE":  return { ...state, [action.k]: action.v };
    case "RESET": return INIT_FORM;
    default:      return state;
  }
}

/* ══════════════════════════════════════════════════════════════
   VERIFICATION FORM
══════════════════════════════════════════════════════════════ */
function VerificationForm({ onSuccess }) {
  const [form,       dispatchForm] = useReducer(formReducer, INIT_FORM);
  const [errs,       setErrs]      = useState(INIT_ERRS);
  const [fileErrs,   setFileErrs]  = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalMsg,  setGlobalMsg]  = useState(null);
  const [faceResult, setFaceResult] = useState(null);
  const [faceLoading,setFaceLoading]= useState(false);

  /* ── checklist ── */
  const checklist = [
    { label: "Document type selected",   done: !!form.docType },
    { label: "Document number valid",    done: !!(form.docNumber && DOC_VALIDATORS[form.docType]?.(form.docNumber)) },
    { label: "Front image uploaded",     done: !!form.front   },
    { label: "Back image uploaded",      done: !!form.back    },
    { label: "Selfie uploaded",          done: !!form.selfie  },
    { label: "Store name entered",       done: form.storeName.trim().length >= 2 },
  ];
  const allDone = checklist.every((c) => c.done);

  /* ── auto face-check when selfie + front are both present ── */
  const faceKey = useRef(null);
  useEffect(() => {
    if (!form.selfie || !form.front) { setFaceResult(null); return; }
    const key = `${form.selfie.name}__${form.front.name}`;
    if (key === faceKey.current) return;
    faceKey.current = key;

    (async () => {
      setFaceLoading(true); setFaceResult(null);
      const fd = new FormData();
      fd.append("selfie",    form.selfie);
      fd.append("doc_front", form.front);
      const { ok, data } = await apiUpload("/face-check", fd);
      setFaceLoading(false);
      if (ok) setFaceResult(data);
    })();
  }, [form.selfie, form.front]);

  /* ── validation ── */
  const validate = () => {
    const e = { ...INIT_ERRS };
    let ok = true;

    if (!form.docType) {
      e.docType = "Select a document type."; ok = false;
    }
    if (!form.docNumber.trim()) {
      e.docNumber = "Enter your document number."; ok = false;
    } else if (form.docType && !DOC_VALIDATORS[form.docType]?.(form.docNumber)) {
      e.docNumber = `Invalid ${form.docType.replace(/_/g, " ")} number.`; ok = false;
    }
    if (!form.front)  { e.front  = "Document front is required."; ok = false; }
    if (!form.back)   { e.back   = "Document back is required.";  ok = false; }
    if (!form.selfie) { e.selfie = "Selfie is required.";         ok = false; }
    if (form.storeName.trim().length < 2) {
      e.storeName = "Store name must be at least 2 characters."; ok = false;
    }
    if (form.storeName.trim().length > 60) {
      e.storeName = "Store name must be 60 characters or fewer."; ok = false;
    }
    if (form.storeDesc.length > 300) {
      e.storeDesc = "Description must be 300 characters or fewer."; ok = false;
    }

    setErrs(e);
    return ok;
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Block if face service confirmed mismatch
    if (faceResult && !faceResult.skipped && faceResult.match === false) {
      setGlobalMsg({
        type: "error",
        text: "Selfie does not match document. Retake both photos.",
      });
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
      setGlobalMsg({
        type: "error",
        text: data.message ?? "Submission failed. Please try again.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ── setField helpers ── */
  const setField = (k, v) => dispatchForm({ type: "FIELD", k, v });
  const setFile  = (k, v) => dispatchForm({ type: "FILE",  k, v });

  return (
    <form className="v-form" onSubmit={handleSubmit} noValidate>

      {globalMsg && <Alert type={globalMsg.type}>{globalMsg.text}</Alert>}

      {/* ════ Identity section ════ */}
      <div className="v-form__section">
        <div className="v-form__section-header">
          <Ic.User s={18}/>
          <h3>Identity Verification</h3>
        </div>

        {/* Document type */}
        <div className="v-field">
          <fieldset style={{ border: "none", padding: 0 }}>
            <legend className="v-field-label">
              Document Type <span className="v-required">*</span>
            </legend>
            <div className="v-doc-grid">
              {VALID_DOC_TYPES.map(({ value, label }) => (
                <label
                  key={value}
                  className={`v-doc-option${form.docType === value ? " v-doc-option--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="docType"
                    value={value}
                    checked={form.docType === value}
                    onChange={() => {
                      setField("docType",   value);
                      setField("docNumber", "");
                      setErrs((p) => ({ ...p, docType: "", docNumber: "" }));
                    }}
                  />
                  <span className="v-doc-option__label">{label}</span>
                  {form.docType === value && (
                    <span className="v-doc-option__check"><Ic.Check s={15}/></span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          {errs.docType && <Alert type="error">{errs.docType}</Alert>}
        </div>

        {/* Document number */}
        {form.docType && (
          <div className="v-field">
            <label className="v-field-label" htmlFor="docNumber">
              {VALID_DOC_TYPES.find((d) => d.value === form.docType)?.label} Number
              <span className="v-required"> *</span>
            </label>
            <input
              id="docNumber"
              type="text"
              className="v-input"
              placeholder={DOC_HINTS[form.docType]}
              value={form.docNumber}
              autoComplete="off"
              onChange={(e) => {
                setField("docNumber", e.target.value);
                setErrs((p) => ({ ...p, docNumber: "" }));
              }}
            />
            {errs.docNumber && <Alert type="error">{errs.docNumber}</Alert>}
          </div>
        )}

        {/* Front + back uploads */}
        <div className="v-id-fields">
          <FileUpload
            label="Document Front"
            accept={ACCEPT_DOC}
            maxMB={MAX_DOC_MB}
            required
            value={form.front}
            error={errs.front || fileErrs.front}
            onChange={(f, err) => {
              setFile("front", f);
              setErrs((p) => ({ ...p, front: "" }));
              setFileErrs((p) => ({ ...p, front: err ?? "" }));
            }}
          />
          <FileUpload
            label="Document Back"
            accept={ACCEPT_DOC}
            maxMB={MAX_DOC_MB}
            required
            value={form.back}
            error={errs.back || fileErrs.back}
            onChange={(f, err) => {
              setFile("back", f);
              setErrs((p) => ({ ...p, back: "" }));
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
            error={errs.selfie}
            onChange={(f) => {
              setFile("selfie", f);
              setErrs((p) => ({ ...p, selfie: "" }));
            }}
          />
        </div>

        {/* Face check result */}
        {faceLoading && (
          <Alert type="info">
            <span style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Ic.Loader s={14}/> Checking face match…
            </span>
          </Alert>
        )}
        {faceResult && !faceLoading && (
          faceResult.skipped
            ? <Alert type="info">Face match skipped — will be manually reviewed.</Alert>
            : faceResult.match
              ? (
                <Alert type="success">
                  <Ic.Check s={14}/> Face match confirmed
                  {faceResult.confidence != null &&
                    ` (${Math.round(faceResult.confidence * 100)}% confidence)`}.
                </Alert>
              )
              : (
                <Alert type="error">
                  Selfie does not match document. Please retake both photos.
                </Alert>
              )
        )}

        {/* Checklist — identity rows only */}
        <Checklist items={checklist.slice(0, 5)}/>
      </div>

      {/* ════ Store section ════ */}
      <div className="v-form__section">
        <div className="v-form__section-header">
          <Ic.Store s={18}/>
          <h3>Store Information</h3>
        </div>

        {/* Store name */}
        <div className="v-field">
          <label className="v-field-label" htmlFor="storeName">
            Store Name <span className="v-required">*</span>
            <span className="v-char-count">{form.storeName.length}/60</span>
          </label>
          <input
            id="storeName"
            type="text"
            className="v-input"
            placeholder="Your store name"
            maxLength={60}
            value={form.storeName}
            onChange={(e) => {
              setField("storeName", e.target.value);
              setErrs((p) => ({ ...p, storeName: "" }));
            }}
          />
          {errs.storeName && <Alert type="error">{errs.storeName}</Alert>}
        </div>

        {/* Store description */}
        <div className="v-field">
          <label className="v-field-label" htmlFor="storeDesc">
            Store Description
            <span className="v-char-count">{form.storeDesc.length}/300</span>
          </label>
          <textarea
            id="storeDesc"
            className="v-textarea"
            placeholder="Briefly describe what your store sells (optional)"
            maxLength={300}
            value={form.storeDesc}
            onChange={(e) => {
              setField("storeDesc", e.target.value);
              setErrs((p) => ({ ...p, storeDesc: "" }));
            }}
          />
          {errs.storeDesc && <Alert type="error">{errs.storeDesc}</Alert>}
        </div>

        {/* Store logo */}
        <FileUpload
          label="Store Logo"
          accept={ACCEPT_IMG}
          maxMB={MAX_LOGO_MB}
          value={form.logo}
          error={fileErrs.logo}
          onChange={(f, err) => {
            setFile("logo", f);
            setFileErrs((p) => ({ ...p, logo: err ?? "" }));
          }}
        />

        {/* Checklist — store row */}
        <Checklist items={[checklist[5]]}/>
      </div>

      {/* ════ Submit ════ */}
      <button
        type="submit"
        className="v-btn v-btn--primary v-btn--lg v-btn--full"
        disabled={submitting}
      >
        {submitting
          ? <><Ic.Loader s={18}/> Submitting…</>
          : <><Ic.Shield s={18}/> Submit for Verification</>
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

/* ══════════════════════════════════════════════════════════════
   CHIP
══════════════════════════════════════════════════════════════ */
function StatusChip({ status }) {
  const { identity_verified, store_verified, identity_review, email_verified } = status;

  const cls =
    identity_verified && store_verified           ? "chip--complete"
    : identity_review?.status === "pending"       ? "chip--review"
    : identity_review?.status === "rejected"      ? "chip--rejected"
    : email_verified                              ? "chip--active"
    : "chip--pending";

  const label =
    identity_verified && store_verified           ? "✓ Fully Verified"
    : identity_review?.status === "pending"       ? "⏳ Under Review"
    : identity_review?.status === "rejected"      ? "✗ Rejected"
    : email_verified                              ? "Email Verified"
    : "Not Verified";

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <span className={`v-chip ${cls}`}>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════ */
export default function Verification() {
  const navigate = useNavigate();

  const [loading,   setLoading]   = useState(true);
  const [pageError, setPageError] = useState(null);
  const [status,    setStatus]    = useState(null);

  // view: "loading" | "no-token" | "email-gate" | "form" | "status-card" | "submitted"
  const [view, setView] = useState("loading");

  /* ── resolve which view to show from /status response ── */
  const resolveView = useCallback((data) => {
    if (!data.email_verified) { setView("email-gate"); return; }

    const idStatus    = data.identity_review?.status;
    const storeStatus = data.store_review?.status;

    // Fully verified
    if (data.identity_verified && data.store_verified) {
      setView("status-card"); return;
    }
    // Pending or approved review exists
    if (
      idStatus    === "pending"  || idStatus    === "approved" ||
      storeStatus === "pending"  || storeStatus === "approved"
    ) {
      setView("status-card"); return;
    }
    // Rejected — let user resubmit
    if (idStatus === "rejected" || storeStatus === "rejected") {
      setView("status-card"); return;
    }

    setView("form");
  }, []);

  /* ── fetch /status ── */
  const fetchStatus = useCallback(async () => {
    setLoading(true); setPageError(null);

    // Guard: no token → send to login
    if (!getToken()) {
      setLoading(false);
      setView("no-token");
      return;
    }

    const { ok, status: httpStatus, data } = await apiFetch("/status");
    setLoading(false);

    if (httpStatus === 401) {
      // Token expired or invalid
      navigate("/auth", { replace: true, state: { from: { pathname: "/verification" } } });
      return;
    }
    if (!ok) {
      setPageError(data.message ?? "Failed to load verification status.");
      return;
    }

    setStatus(data);
    resolveView(data);
  }, [navigate, resolveView]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── progress steps ── */
  const progressDone = status
    ? [
        status.email_verified,
        !!(status.identity_review),
        status.identity_verified && status.store_verified,
      ].filter(Boolean).length
    : 0;

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */

  // Full-page loading
  if (loading) {
    return (
      <div className="v-page">
        <div className="v-loading">
          <Ic.Loader s={32}/> Loading verification…
        </div>
      </div>
    );
  }

  // No token at all
  if (view === "no-token") {
    return (
      <div className="v-page">
        <div className="v-page-error">
          <Ic.AlertCircle s={40}/>
          <p>You must be logged in to access verification.</p>
          <button
            className="v-btn v-btn--primary"
            onClick={() => navigate("/auth", { replace: true })}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Fetch error
  if (pageError) {
    return (
      <div className="v-page">
        <div className="v-page-error">
          <Ic.AlertCircle s={40}/>
          <p>{pageError}</p>
          <button className="v-btn v-btn--ghost" onClick={fetchStatus}>
            <Ic.Refresh s={14}/> Retry
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
          <button
            className="v-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <Ic.ArrowLeft s={18}/>
          </button>
          <div className="v-topbar__center">
            <div className="v-topbar__shield"><Ic.Shield s={16}/></div>
            <span className="v-topbar__title">Identity Verification</span>
          </div>
          <div className="v-topbar__spacer" aria-hidden="true"/>
        </div>

        <p className="v-page-sub">
          Verify your identity to unlock full seller access and build buyer trust.
        </p>

        {/* ── Trust ring ── */}
        {status && (
          <div className="v-card v-card--trust">
            <TrustRing score={status.trust_score ?? 0}/>
          </div>
        )}

        {/* ── Progress ── */}
        {status && <ProgressBar steps={3} done={progressDone}/>}

        {/* ── Limited listings warning ── */}
        {status?.limited_listings?.count > 0 && (
          <Alert type="warning">
            <strong>Listings expiring soon: </strong>
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
                setStatus((p) => ({
                  ...p,
                  email_verified: true,
                  trust_score: newScore,
                }));
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
              <div className="v-status-card__icon"><Ic.Clock s={32}/></div>
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

        {/* ── Account chip ── */}
        {status && <StatusChip status={status}/>}

      </div>
    </div>
  );
}