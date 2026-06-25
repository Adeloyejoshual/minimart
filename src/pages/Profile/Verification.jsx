// ════════════════════════════════════════════════════════════
// FILE: src/pages/Profile/Verification.jsx
// ════════════════════════════════════════════════════════════

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import imageCompression from "browser-image-compression";
import {
  Shield, Mail, CheckCircle, Store, Loader2,
  XCircle, RefreshCw, Lock, BadgeCheck,
  CreditCard, AlertTriangle, Upload,
  FileText, Camera, Image, User, X, Info,
  ArrowLeft, Clock,
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
const DRAFT_KEY      = "verification_draft_v1";

const COMPRESS_DOC  = { maxSizeMB: 1.5, maxWidthOrHeight: 1600, useWebWorker: true };
const COMPRESS_LOGO = { maxSizeMB: 0.5, maxWidthOrHeight: 800,  useWebWorker: true };

const MIN_WIDTH   = 400;
const MIN_HEIGHT  = 300;
const BLUR_THRESH = 80;
const DARK_THRESH = 60;

const SUSPICIOUS_SOFTWARE = [
  "photoshop", "gimp", "lightroom", "illustrator",
  "affinity", "canva", "snapseed", "picsart",
];

const DOC_RULES = {
  nin: {
    label  : "NIN must be exactly 11 digits",
    test   : (v) => /^\d{11}$/.test(v.replace(/\s/g, "")),
    format : (v) => v.replace(/\D/g, "").slice(0, 11),
  },
  passport: {
    label  : "Passport: 1 letter + 8 digits (e.g. A12345678)",
    test   : (v) => /^[A-Za-z]\d{8}$/.test(v.replace(/\s/g, "")),
    format : (v) => v.replace(/[^A-Za-z0-9]/g, "").slice(0, 9).toUpperCase(),
  },
  drivers_license: {
    label  : "License: 3 letters + 6 digits + 2 letters (e.g. ABC123456DE)",
    test   : (v) => /^[A-Za-z]{3}\d{6}[A-Za-z]{2}$/.test(v.replace(/[\s-]/g, "")),
    format : (v) => v.replace(/[^A-Za-z0-9]/g, "").slice(0, 11).toUpperCase(),
  },
  voters_card: {
    label  : "VIN must be exactly 19 alphanumeric characters",
    test   : (v) => /^[A-Za-z0-9]{19}$/.test(v.replace(/\s/g, "")),
    format : (v) => v.replace(/[^A-Za-z0-9]/g, "").slice(0, 19).toUpperCase(),
  },
};

const DOC_TYPES = [
  { value: "nin",             label: "National ID (NIN)",      numberLabel: "NIN Number",      frontLabel: "NIN Slip — Front",     backLabel: "NIN Slip — Back"     },
  { value: "passport",        label: "International Passport", numberLabel: "Passport Number", frontLabel: "Passport Photo Page",  backLabel: "Passport Data Page"  },
  { value: "drivers_license", label: "Driver's License",       numberLabel: "License Number", frontLabel: "License — Front",      backLabel: "License — Back"      },
  { value: "voters_card",     label: "Voter's Card",           numberLabel: "VIN",            frontLabel: "Voter's Card — Front", backLabel: "Voter's Card — Back" },
];

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
const getToken      = () =>
  localStorage.getItem("marketplace_token") || localStorage.getItem("token") || "";
const authJson      = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });
const authMultipart = () => ({ Authorization: `Bearer ${getToken()}` });
const fmtBytes      = (b) =>
  b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

/* ══════════════════════════════════════════════════════════════
   DRAFT
══════════════════════════════════════════════════════════════ */
const saveDraft  = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} };
const loadDraft  = ()  => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null"); } catch { return null; } };
const clearDraft = ()  => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

/* ══════════════════════════════════════════════════════════════
   EXIF
══════════════════════════════════════════════════════════════ */
const validateExif = async (file) => {
  if (!file.type.startsWith("image/")) return [];
  let exifr;
  try { exifr = (await import("exifr")).default; } catch { return []; }
  const w = [];
  try {
    const tags = await exifr.parse(file, { pick: ["DateTimeOriginal", "Software", "Make", "Model"] });
    if (!tags) return [];
    if (tags.Software) {
      const sw = String(tags.Software).toLowerCase();
      if (SUSPICIOUS_SOFTWARE.some((s) => sw.includes(s)))
        w.push(`Image edited in ${tags.Software}. Upload an original photo.`);
    }
    if (!tags.Make && !tags.Model && !tags.DateTimeOriginal)
      w.push("May be a screenshot. Use a direct camera photo.");
  } catch {}
  return w;
};

/* ══════════════════════════════════════════════════════════════
   IMAGE QUALITY
══════════════════════════════════════════════════════════════ */
const analyseImage = (file) =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/")) { resolve([]); return; }
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = [];
      if (img.naturalWidth < MIN_WIDTH || img.naturalHeight < MIN_HEIGHT)
        w.push(`Too small (${img.naturalWidth}×${img.naturalHeight}). Min ${MIN_WIDTH}×${MIN_HEIGHT}.`);
      try {
        const c = document.createElement("canvas");
        const s = Math.min(1, 200 / img.naturalWidth);
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        const px = c.width * c.height;
        let br = 0;
        for (let i = 0; i < data.length; i += 4) br += data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114;
        if (br / px < DARK_THRESH) w.push("Image too dark. Use better lighting.");
        const g = new Float32Array(px);
        for (let i = 0; i < px; i++) { const p = i*4; g[i] = data[p]*0.299+data[p+1]*0.587+data[p+2]*0.114; }
        let lap = 0, lsq = 0, ln = 0;
        for (let y = 1; y < c.height-1; y++)
          for (let x = 1; x < c.width-1; x++) {
            const v = -g[(y-1)*c.width+(x-1)]-g[(y-1)*c.width+x]-g[(y-1)*c.width+(x+1)]
                      -g[y*c.width+(x-1)]+8*g[y*c.width+x]-g[y*c.width+(x+1)]
                      -g[(y+1)*c.width+(x-1)]-g[(y+1)*c.width+x]-g[(y+1)*c.width+(x+1)];
            lap += v; lsq += v*v; ln++;
          }
        if ((lsq/ln - (lap/ln)**2) < BLUR_THRESH) w.push("Image blurry. Retake in good light.");
      } catch {}
      resolve(w);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
    img.src = url;
  });

const checkImage = async (f) => {
  const [e, q] = await Promise.all([validateExif(f), analyseImage(f)]);
  return [...e, ...q];
};

/* ══════════════════════════════════════════════════════════════
   FACE MATCH
══════════════════════════════════════════════════════════════ */
const runFaceMatch = async (selfie, docFront) => {
  const fd = new FormData();
  fd.append("selfie", selfie);
  fd.append("doc_front", docFront);
  const r = await fetch(`${API}/verification/face-check`, {
    method: "POST", headers: authMultipart(), body: fd,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Face check failed.");
  return d;
};

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */
function Alert({ type = "error", children }) {
  const icons = {
    error: <XCircle size={14} />, success: <CheckCircle size={14} />,
    warning: <AlertTriangle size={14} />, info: <Info size={14} />,
  };
  return (
    <div className={`v-alert v-alert--${type}`} role="alert">
      <span className="v-alert__icon">{icons[type]}</span>
      <div className="v-alert__body">{children}</div>
    </div>
  );
}

function QualityWarnings({ warnings }) {
  if (!warnings.length) return null;
  return (
    <div className="v-quality-warnings">
      {warnings.map((w, i) => (
        <div key={i} className="v-quality-warning">
          <AlertTriangle size={12} /><span>{w}</span>
        </div>
      ))}
    </div>
  );
}

function FaceMatchBanner({ state }) {
  if (!state) return null;
  const map = {
    checking: { cls: "--checking", icon: <Loader2 size={14} className="v-spin" />, msg: "Comparing selfie with document…" },
    pass:     { cls: "--pass",     icon: <Camera size={14} />,          msg: "Face matched — selfie matches your ID." },
    fail:     { cls: "--fail",     icon: <XCircle size={14} />,         msg: "Face mismatch — retake both photos." },
    error:    { cls: "--warn",     icon: <AlertTriangle size={14} />,   msg: "Face check unavailable — review may take longer." },
  };
  const c = map[state];
  if (!c) return null;
  return <div className={`v-face-match v-face-match${c.cls}`}>{c.icon}<span>{c.msg}</span></div>;
}

function Countdown({ seconds, tick, onDone }) {
  const [left, setLeft] = useState(seconds);
  const dRef = useRef(onDone);
  useEffect(() => { dRef.current = onDone; }, [onDone]);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setLeft((p) => { if (p <= 1) { clearInterval(id); dRef.current?.(); return 0; } return p - 1; });
    }, 1_000);
    return () => clearInterval(id);
  }, [seconds, tick]);
  return <span className={`v-countdown${left <= 10 ? " v-countdown--warn" : ""}`}>{left}s</span>;
}

function TrustRing({ score = 0 }) {
  const TIERS = [
    { min: 80, color: "#22c55e", label: "Excellent" },
    { min: 60, color: "#3b82f6", label: "Good" },
    { min: 40, color: "#f59e0b", label: "Fair" },
    { min: 0,  color: "#ef4444", label: "Low" },
  ];
  const R = 52, C = 2 * Math.PI * R;
  const cfg = TIERS.find((t) => score >= t.min) ?? TIERS[3];
  return (
    <div className="v-trust-ring">
      <div className="v-trust-ring__graphic">
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Trust score ${score}/100`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="#1f2937" strokeWidth="10" />
          <circle cx="70" cy="70" r={R} fill="none" stroke={cfg.color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C - (score / 100) * C}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)", filter: `drop-shadow(0 0 6px ${cfg.color}55)`, transition: "stroke-dashoffset 1.2s ease" }} />
        </svg>
        <div className="v-trust-ring__center">
          <span className="v-trust-ring__number" style={{ color: cfg.color }}>{score}</span>
          <span className="v-trust-ring__denom">/ 100</span>
          <span className="v-trust-ring__tier" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>
    </div>
  );
}

function OtpInput({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);
  useEffect(() => { setTimeout(() => refs.current[0]?.focus(), 350); }, []);
  useEffect(() => {
    if (!hasError) return;
    setTimeout(() => refs.current[Math.max(0, refs.current.findIndex((r) => !r?.value))]?.focus(), 700);
  }, [hasError]);
  const ch = (i) => value[i] ?? "";
  const up = (i, c) => { const a = Array.from({ length: OTP_LENGTH }, (_, k) => value[k] ?? ""); a[i] = c; onChange(a.join("")); };
  return (
    <div className={`v-otp-group${hasError ? " v-otp-group--error" : ""}`} role="group" aria-label="Verification code">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} type="text" inputMode="numeric" pattern="\d*" maxLength={1} value={ch(i)} disabled={disabled}
          aria-label={`Digit ${i+1}`} className={["v-otp-cell", ch(i) ? "v-otp-cell--filled" : "", hasError ? "v-otp-cell--error" : ""].join(" ")}
          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(-1); up(i, d); if (d && i < OTP_LENGTH-1) refs.current[i+1]?.focus(); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") { e.preventDefault(); if (ch(i)) up(i, ""); else if (i > 0) { up(i-1, ""); refs.current[i-1]?.focus(); } }
            else if (e.key === "ArrowLeft" && i > 0) refs.current[i-1]?.focus();
            else if (e.key === "ArrowRight" && i < OTP_LENGTH-1) refs.current[i+1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => { e.preventDefault(); const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
            onChange(Array.from({ length: OTP_LENGTH }, (_, k) => d[k] ?? "").join("")); refs.current[Math.min(d.length, OTP_LENGTH-1)]?.focus(); }}
        />
      ))}
    </div>
  );
}

function FileUpload({ label, hint, accept, file, onFile, onRemove, maxBytes, compress, compressOpts = COMPRESS_DOC, onWarnings }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!file || !file.type.startsWith("image/")) { setPreview(null); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  const pick = useCallback(async (raw) => {
    if (!raw) return; setErr(""); setBusy(true);
    try { let f = raw; if (compress && raw.type.startsWith("image/")) try { f = await imageCompression(raw, compressOpts); } catch {} if (maxBytes && f.size > maxBytes) { setErr(`Too large — max ${fmtBytes(maxBytes)}.`); return; } const w = await checkImage(f); onWarnings?.(w); onFile(f); } finally { setBusy(false); }
  }, [compress, compressOpts, maxBytes, onFile, onWarnings]);
  if (busy) return <div className="v-upload v-upload--processing"><Loader2 size={20} className="v-spin" /><p className="v-upload__label">Analysing…</p></div>;
  if (file) return (
    <div className="v-upload v-upload--filled"><div className="v-upload__preview">
      {preview ? <img src={preview} alt="" className="v-upload__thumb" /> : <div className="v-upload__doc"><FileText size={20} /></div>}
      <div className="v-upload__meta"><p className="v-upload__name">{file.name}</p><p className="v-upload__size">{fmtBytes(file.size)}</p></div>
      <button type="button" className="v-upload__remove" onClick={onRemove} aria-label="Remove"><X size={14} /></button>
    </div></div>
  );
  return (
    <div><label className={["v-upload", drag ? "v-upload--drag" : "", err ? "v-upload--error" : ""].join(" ")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
      <input ref={ref} type="file" accept={accept} className="v-upload__hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <Upload size={22} className="v-upload__icon" /><p className="v-upload__label">{drag ? "Drop to upload" : label}</p><p className="v-upload__hint">{hint}</p>
    </label>{err && <p className="v-upload__error"><AlertTriangle size={12} /> {err}</p>}</div>
  );
}

function SelfieCapture({ file, onFile, onRemove, onWarnings }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!file) { setPreview(null); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  const trigger = (cap) => { if (cap) ref.current?.setAttribute("capture", "user"); else ref.current?.removeAttribute("capture"); ref.current?.click(); };
  const pick = async (raw) => { if (!raw) return; setBusy(true); try { let f = raw; try { f = await imageCompression(raw, COMPRESS_DOC); } catch {} const w = await checkImage(f); onWarnings?.(w); onFile(f); } finally { setBusy(false); } };
  return (
    <div className="v-selfie">
      <input ref={ref} type="file" accept="image/*" className="v-upload__hidden" onChange={(e) => { if (e.target.files?.[0]) pick(e.target.files[0]); e.target.value = ""; }} />
      <div className="v-selfie__circle">
        {busy ? <div className="v-selfie__empty"><Loader2 size={28} className="v-spin" /></div>
         : preview ? <img src={preview} alt="Selfie" />
         : <div className="v-selfie__empty"><User size={36} /><span>No photo</span></div>}
      </div>
      <p className="v-selfie__guide">Face clearly visible, well-lit, matching your ID.</p>
      <div className="v-selfie__actions">
        {file ? (<>
          <button type="button" className="v-btn v-btn--ghost v-btn--sm" onClick={() => trigger(true)}><RefreshCw size={12} /> Retake</button>
          <button type="button" className="v-btn v-btn--ghost v-btn--sm" onClick={onRemove}><X size={12} /> Remove</button>
        </>) : (<>
          <button type="button" className="v-btn v-btn--primary v-btn--sm" onClick={() => trigger(true)}><Camera size={12} /> Camera</button>
          <button type="button" className="v-btn v-btn--ghost v-btn--sm" onClick={() => trigger(false)}><Image size={12} /> Gallery</button>
        </>)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMAIL OTP GATE
══════════════════════════════════════════════════════════════ */
function EmailOtpGate({ maskedEmail: initEmail, resendRemaining: initLeft, onVerified }) {
  const [phase, setPhase] = useState("idle");
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [canSend, setCanSend] = useState(false);
  const [tick, setTick] = useState(0);
  const [left, setLeft] = useState(initLeft ?? null);
  const [email, setEmail] = useState(initEmail ?? "");
  const [attLeft, setAttLeft] = useState(null);
  const [devCode, setDevCode] = useState("");
  const busy = useRef(false), auto = useRef(false);

  const send = useCallback(async () => {
    setPhase("sending"); setErrMsg(""); setOtp(""); setOtpErr(false); setCanSend(false); setDevCode(""); setTick((k) => k+1);
    try {
      const r = await fetch(`${API}/verification/send-email-otp`, { method: "POST", headers: authJson() });
      const d = await r.json();
      if (r.ok && d.success) { setPhase("otp"); if (d.email) setEmail(d.email); if (typeof d.remaining === "number") setLeft(d.remaining); if (d.dev_otp) setDevCode(d.dev_otp); return; }
      if (r.status === 429) { setPhase("otp"); setErrMsg(d.message || "Too many requests."); if (d.remaining === 0) setLeft(0); return; }
      setPhase("idle"); setErrMsg(d.message || "Failed to send.");
    } catch (err) { setPhase("idle"); setErrMsg(`Network error: ${err.message}`); }
  }, []);

  const verify = useCallback(async (code) => {
    if (busy.current) return; busy.current = true; setPhase("verifying"); setErrMsg("");
    try {
      const r = await fetch(`${API}/verification/verify-email-otp`, { method: "POST", headers: authJson(), body: JSON.stringify({ otp: code }) });
      const d = await r.json();
      if (r.ok && d.success) { setPhase("done"); setDevCode(""); onVerified(); return; }
      setOtpErr(true); setOtp(""); setPhase("otp"); setErrMsg(d.message || "Incorrect code.");
      if (typeof d.attemptsLeft === "number") setAttLeft(d.attemptsLeft);
      setTimeout(() => setOtpErr(false), 700);
    } catch (err) { setPhase("otp"); setErrMsg(`Network error: ${err.message}`); }
    finally { busy.current = false; }
  }, [onVerified]);

  useEffect(() => {
    if (otp.length === OTP_LENGTH && phase === "otp" && !auto.current && !busy.current) {
      auto.current = true;
      const t = setTimeout(async () => { await verify(otp); auto.current = false; }, 180);
      return () => { clearTimeout(t); auto.current = false; };
    }
  }, [otp, phase, verify]);

  const sending = phase === "sending", verifying = phase === "verifying", showOtp = phase === "otp" || verifying;

  return (
    <div className="v-email-gate">
      <div className="v-email-gate__icon"><Mail size={32} /></div>
      <h2 className="v-email-gate__title">Verify Your Email</h2>
      <p className="v-email-gate__sub">We'll send a 6-digit code to confirm your email before you can submit documents.</p>
      {phase === "idle" && <button className="v-btn v-btn--primary v-btn--lg" onClick={send}><Mail size={15} /> Send Verification Code</button>}
      {sending && <div className="v-otp-panel__status"><Loader2 size={15} className="v-spin" /><span>Sending to {email || "your email"}…</span></div>}
      {showOtp && !sending && email && <p className="v-otp-panel__dest">Code sent to <strong>{email}</strong></p>}
      {devCode && <Alert type="warning">Dev code: <strong style={{ letterSpacing: 4, fontSize: 18, fontFamily: "monospace" }}>{devCode}</strong></Alert>}
      {showOtp && <><OtpInput value={otp} onChange={setOtp} disabled={verifying} hasError={otpErr} /><p className="v-otp-panel__hint"><Lock size={11} /> Auto-submits when complete</p></>}
      {verifying && <div className="v-otp-panel__status"><Loader2 size={14} className="v-spin" /><span>Verifying…</span></div>}
      {errMsg && <Alert type="error">{errMsg}{attLeft !== null && attLeft > 0 && attLeft <= 5 && <span style={{ display: "block", fontSize: 12, opacity: .75, marginTop: 3 }}>{attLeft} attempt{attLeft !== 1 ? "s" : ""} left</span>}</Alert>}
      {showOtp && (
        <div className="v-resend-row"><div>
          {left === 0 ? <span className="v-resend-row__limit">Daily limit — try tomorrow</span>
           : canSend ? <button className="v-btn v-btn--link" onClick={send} disabled={sending}><RefreshCw size={12} className={sending ? "v-spin" : ""} /> Resend{left !== null && <span className="v-resend-row__count"> ({left} left)</span>}</button>
           : <span className="v-resend-row__timer">Resend in <Countdown seconds={RESEND_SECS} tick={tick} onDone={() => setCanSend(true)} /></span>}
        </div><span className="v-resend-row__note"><Lock size={10} /> Never share this code</span></div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATUS CARD
══════════════════════════════════════════════════════════════ */
function StatusCard({ reviewStatus, rejectionReason, onResubmit }) {
  if (reviewStatus === "pending") return (
    <div className="v-status-card v-status-card--pending">
      <div className="v-status-card__icon"><Clock size={36} /></div>
      <h2 className="v-status-card__title">Under Review</h2>
      <p className="v-status-card__body">We've received your documents. Review usually takes within 24 hours.</p>
      <div className="v-status-card__steps">
        <div className="v-status-step v-status-step--done"><CheckCircle size={14} /> Documents submitted</div>
        <div className="v-status-step v-status-step--active"><Loader2 size={14} className="v-spin" /> Admin review in progress</div>
        <div className="v-status-step"><BadgeCheck size={14} /> Account verified</div>
      </div>
    </div>
  );
  if (reviewStatus === "approved") return (
    <div className="v-status-card v-status-card--approved">
      <div className="v-status-card__icon"><BadgeCheck size={36} /></div>
      <h2 className="v-status-card__title">Verified</h2>
      <p className="v-status-card__body">Full access — 100 listings/day, 500 active, no expiry.</p>
    </div>
  );
  if (reviewStatus === "rejected") return (
    <div className="v-status-card v-status-card--rejected">
      <div className="v-status-card__icon"><XCircle size={36} /></div>
      <h2 className="v-status-card__title">Verification Rejected</h2>
      {rejectionReason && <Alert type="error"><strong>Reason: </strong>{rejectionReason}</Alert>}
      <p className="v-status-card__body">Please correct the issue and resubmit.</p>
      <button className="v-btn v-btn--primary v-btn--lg" onClick={onResubmit}><RefreshCw size={14} /> Resubmit</button>
    </div>
  );
  return null;
}

/* ══════════════════════════════════════════════════════════════
   VERIFICATION FORM — no liveness, just ID + selfie + store
══════════════════════════════════════════════════════════════ */
function VerificationForm({ onSubmitted }) {
  const draft = useMemo(() => loadDraft() ?? {}, []);

  const [docType, setDocType] = useState(draft.docType ?? "");
  const [docNumber, setDocNumber] = useState(draft.docNumber ?? "");
  const [docFront, setDocFront] = useState(null);
  const [docBack, setDocBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [storeName, setStoreName] = useState(draft.storeName ?? "");
  const [storeDesc, setStoreDesc] = useState(draft.storeDesc ?? "");
  const [storeLogo, setStoreLogo] = useState(null);

  const [frontWarns, setFrontWarns] = useState([]);
  const [backWarns, setBackWarns] = useState([]);
  const [selfieWarns, setSelfieWarns] = useState([]);
  const [faceState, setFaceState] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const docCfg  = DOC_TYPES.find((d) => d.value === docType);
  const docRule = DOC_RULES[docType] ?? null;
  const MAX_DESC = 300;
  const minLen  = docType === "nin" ? 11 : 4;
  const docNumValid = !docRule || !docNumber || docRule.test(docNumber);
  const docNumErr   = docNumber.length > 0 && !docNumValid ? docRule?.label : "";
  const hasDraft    = Boolean(docType || docNumber || storeName || storeDesc);
  const hasQWarn    = frontWarns.length > 0 || backWarns.length > 0 || selfieWarns.length > 0;

  useEffect(() => { saveDraft({ docType, docNumber, storeName, storeDesc }); }, [docType, docNumber, storeName, storeDesc]);

  useEffect(() => {
    if (!selfie || !docFront) { setFaceState(null); return; }
    let cancel = false;
    setFaceState("checking");
    runFaceMatch(selfie, docFront)
      .then((r) => { if (!cancel) setFaceState(r.match ? "pass" : r.skipped ? "error" : "fail"); })
      .catch(() => { if (!cancel) setFaceState("error"); });
    return () => { cancel = true; };
  }, [selfie, docFront]);

  const idReady = Boolean(docType) && docNumValid && docNumber.trim().length >= minLen &&
    Boolean(docFront) && Boolean(docBack) && Boolean(selfie) && faceState !== "fail";
  const storeReady = storeName.trim().length >= 2;
  const ready = idReady && storeReady;

  const checklist = useMemo(() => {
    if (!docCfg || !docRule) return [];
    return [
      { label: "Document type selected", done: Boolean(docType) },
      { label: docRule.label, done: docNumValid && docNumber.length >= minLen },
      { label: docCfg.frontLabel, done: Boolean(docFront) },
      { label: docCfg.backLabel, done: Boolean(docBack) },
      { label: "Selfie photo", done: Boolean(selfie) },
      { label: "Face matches ID", done: faceState === "pass" || faceState === "error" },
      { label: "Store name (min 2 chars)", done: storeReady },
    ];
  }, [docCfg, docRule, docType, docNumValid, docNumber, minLen, docFront, docBack, selfie, faceState, storeReady]);

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true); setErrMsg("");
    try {
      const fd = new FormData();
      fd.append("document_type", docType);
      fd.append("document_number", docNumber.trim());
      fd.append("doc_front", docFront);
      fd.append("doc_back", docBack);
      fd.append("selfie", selfie);
      fd.append("store_name", storeName.trim());
      fd.append("store_description", storeDesc.trim());
      if (storeLogo) fd.append("store_logo", storeLogo);
      fd.append("liveness_passed", "false");

      const r = await fetch(`${API}/verification/submit`, { method: "POST", headers: authMultipart(), body: fd });
      const d = await r.json();
      if (!r.ok) { setErrMsg(d.message || "Submission failed."); return; }
      clearDraft(); onSubmitted();
    } catch (err) { setErrMsg(`Network error: ${err.message}`); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="v-form">
      {/* Identity */}
      <div className="v-form__section">
        <div className="v-form__section-header"><CreditCard size={18} /><h3>Government ID</h3></div>
        <fieldset className="v-doc-fieldset">
          <legend className="v-field-label">Document Type *</legend>
          <div className="v-doc-grid">
            {DOC_TYPES.map((dt) => (
              <label key={dt.value} className={`v-doc-option${docType === dt.value ? " v-doc-option--selected" : ""}`}>
                <input type="radio" name="docType" value={dt.value} checked={docType === dt.value}
                  onChange={() => { setDocType(dt.value); setDocFront(null); setDocBack(null); setDocNumber(""); setFrontWarns([]); setBackWarns([]); setFaceState(null); }} />
                <span className="v-doc-option__label">{dt.label}</span>
                {docType === dt.value && <CheckCircle size={13} className="v-doc-option__check" />}
              </label>
            ))}
          </div>
        </fieldset>

        {docCfg && (
          <div className="v-id-fields">
            <div className="v-field">
              <label className="v-field-label">{docCfg.numberLabel} *</label>
              <input type="text" className={`v-input${docNumErr ? " v-input--error" : ""}`} value={docNumber}
                onChange={(e) => setDocNumber(docRule ? docRule.format(e.target.value) : e.target.value)}
                placeholder={`Enter ${docCfg.numberLabel}`} maxLength={docType === "nin" ? 11 : 20}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
              {docNumErr && <p className="v-field-error"><AlertTriangle size={11} /> {docNumErr}</p>}
              {!docNumErr && docNumValid && docNumber.length >= minLen && <p className="v-field-ok"><CheckCircle size={11} /> Looks good</p>}
            </div>
            <div className="v-field">
              <label className="v-field-label">{docCfg.frontLabel} *</label>
              <FileUpload label="Tap or drag to upload" hint={`JPG, PNG, WebP, PDF — max ${MAX_DOC_MB}MB`}
                accept="image/*,.pdf" file={docFront} onFile={(f) => { setDocFront(f); setFaceState(null); }}
                onRemove={() => { setDocFront(null); setFrontWarns([]); setFaceState(null); }}
                maxBytes={MAX_DOC_BYTES} compress compressOpts={COMPRESS_DOC} onWarnings={setFrontWarns} />
              <QualityWarnings warnings={frontWarns} />
            </div>
            <div className="v-field">
              <label className="v-field-label">{docCfg.backLabel} *</label>
              <FileUpload label="Tap or drag to upload" hint={`JPG, PNG, WebP, PDF — max ${MAX_DOC_MB}MB`}
                accept="image/*,.pdf" file={docBack} onFile={setDocBack}
                onRemove={() => { setDocBack(null); setBackWarns([]); }}
                maxBytes={MAX_DOC_BYTES} compress compressOpts={COMPRESS_DOC} onWarnings={setBackWarns} />
              <QualityWarnings warnings={backWarns} />
            </div>
          </div>
        )}
      </div>

      {/* Selfie */}
      {docCfg && (
        <div className="v-form__section">
          <div className="v-form__section-header"><Camera size={18} /><h3>Selfie Verification</h3></div>
          <div className="v-field">
            <SelfieCapture file={selfie} onFile={(f) => { setSelfie(f); setFaceState(null); }}
              onRemove={() => { setSelfie(null); setSelfieWarns([]); setFaceState(null); }}
              onWarnings={setSelfieWarns} />
            <QualityWarnings warnings={selfieWarns} />
          </div>
          <FaceMatchBanner state={faceState} />
        </div>
      )}

      {/* Store */}
      <div className="v-form__section">
        <div className="v-form__section-header"><Store size={18} /><h3>Store Profile</h3></div>
        <div className="v-field">
          <label className="v-field-label">Store Name <span className="v-required">*</span></label>
          <input type="text" className="v-input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Lagos Gadget Hub" maxLength={60} />
        </div>
        <div className="v-field">
          <label className="v-field-label">Description <span className="v-char-count">{storeDesc.length}/{MAX_DESC}</span></label>
          <textarea className="v-textarea" value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} placeholder="What do you sell?" maxLength={MAX_DESC} rows={3} />
        </div>
        <div className="v-field">
          <label className="v-field-label">Store Logo (optional)</label>
          <FileUpload label="Upload logo" hint={`JPG, PNG — max ${MAX_LOGO_MB}MB`} accept="image/*" file={storeLogo}
            onFile={setStoreLogo} onRemove={() => setStoreLogo(null)} maxBytes={MAX_LOGO_BYTES} compress compressOpts={COMPRESS_LOGO} />
        </div>
      </div>

      {hasDraft && <Alert type="info">Progress saved — it will be here if you close and return.</Alert>}
      {hasQWarn && <Alert type="warning">Some images have quality issues (see above). Fixing them reduces rejection risk.</Alert>}
      {faceState === "fail" && <Alert type="error">Submission blocked — selfie does not match ID. Retake both.</Alert>}

      {docCfg && (
        <div className="v-checklist">
          {checklist.map((it) => (
            <div key={it.label} className={`v-checklist__row${it.done ? " v-checklist__row--done" : ""}`}>
              <div className="v-checklist__dot">{it.done && <CheckCircle size={10} />}</div>
              <span>{it.label}</span>
            </div>
          ))}
        </div>
      )}

      {errMsg && <Alert type="error">{errMsg}</Alert>}

      <button className={`v-btn v-btn--full${ready ? " v-btn--primary" : " v-btn--ghost"}`}
              disabled={!ready || submitting || faceState === "checking"} onClick={submit}>
        {submitting ? <><Loader2 size={14} className="v-spin" /> Submitting…</>
         : faceState === "checking" ? <><Loader2 size={14} className="v-spin" /> Verifying face…</>
         : <><BadgeCheck size={14} /> Submit for Verification</>}
      </button>

      {!ready && faceState !== "fail" && <p className="v-form__incomplete-hint">Complete all required fields to submit.</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════ */
export default function Verification() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [pageErr, setPageErr] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchStatus = useCallback(async () => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }
    try {
      const r = await fetch(`${API}/verification/status`, { headers: authJson() });
      if (r.status === 401) { navigate("/auth"); return; }
      const d = await r.json();
      if (r.ok && d.success) { setStatus(d); setPageErr(""); }
      else setPageErr(d.message || "Failed to load verification status.");
    } catch (err) { setPageErr(`Network error: ${err.message}`); }
  }, [navigate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (pageErr) return (
    <div className="v-page-error">
      <AlertTriangle size={32} /><p>{pageErr}</p>
      <button className="v-btn v-btn--primary" onClick={fetchStatus}><RefreshCw size={14} /> Retry</button>
    </div>
  );

  if (!status) return null;

  const emailOk    = status?.email_verified    ?? false;
  const identityOk = status?.identity_verified ?? false;
  const trust      = Number(status?.trust_score ?? 0);
  const idReview   = status?.identity_review   ?? null;
  const revStatus  = identityOk ? "approved" : idReview?.status === "pending" ? "pending" : idReview?.status === "rejected" ? "rejected" : null;
  const reason     = idReview?.rejection_reason ?? null;
  const formVis    = emailOk && !identityOk && (revStatus === null || (revStatus === "rejected" && showForm));

  useEffect(() => {
    if (emailOk && !identityOk && revStatus === null) setShowForm(true);
  }, [emailOk, identityOk, revStatus]);

  return (
    <div className="v-page"><div className="v-container">
      <div className="v-topbar">
        <button className="v-back-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="v-topbar__center"><div className="v-topbar__shield"><Shield size={16} /></div><span className="v-topbar__title">Account Verification</span></div>
        <div className="v-topbar__spacer" />
      </div>
      <p className="v-page-sub">Complete verification to unlock full marketplace access</p>
      <div className="v-card v-card--trust"><TrustRing score={trust} /></div>
      {status?.limited_listings?.message && !identityOk && <Alert type="warning">{status.limited_listings.message}</Alert>}
      {!emailOk && <div className="v-card"><EmailOtpGate maskedEmail={status?.email} resendRemaining={status?.resend_remaining} onVerified={() => { fetchStatus(); setShowForm(true); }} /></div>}
      {emailOk && revStatus && revStatus !== "rejected" && <div className="v-card"><StatusCard reviewStatus={revStatus} rejectionReason={reason} onResubmit={() => setShowForm(true)} /></div>}
      {emailOk && revStatus === "rejected" && !showForm && <div className="v-card"><StatusCard reviewStatus="rejected" rejectionReason={reason} onResubmit={() => setShowForm(true)} /></div>}
      {formVis && <div className="v-card"><VerificationForm onSubmitted={() => { setShowForm(false); fetchStatus(); }} /></div>}
    </div></div>
  );
}