// src/pages/Profile/EditProfile.jsx

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import imageCompression from "browser-image-compression";

import ProfileHeader from "../../components/ProfileHeader.jsx";
import DropdownModal from "../../components/DropdownModal.jsx";
import { locationsByState } from "../../config/locationsByState.js";
import { categoryFields } from "../../config/categoryFields.js";
import "../../styles/EditProfile.css";

// ═══════════════════════════════════════════════════════════════
// AXIOS INSTANCE → /api/edit-profile
// ═══════════════════════════════════════════════════════════════
const BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const api = axios.create({ baseURL: `${BASE}/api/edit-profile` });
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ═══════════════════════════════════════════════════════════════
// LOCATION + CATEGORIES
// ═══════════════════════════════════════════════════════════════
const STATES = Object.keys(locationsByState).sort();
const getCities = (st) => (st && locationsByState[st]) || [];
const STORE_CATEGORIES = Object.keys(categoryFields);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const MAX_BIO = 200, MAX_STORE_DESC = 300, MAX_FILE = 5 * 1024 * 1024, MIN_IMG = 100;
const DRAFT_KEY = "ep_draft", DRAFT_DEBOUNCE = 500;

const TABS = [
  { id: "personal", label: "Personal", emoji: "👤" },
  { id: "store",    label: "Store",    emoji: "🏪" },
];
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const TIME_OPTIONS = (() => {
  const o = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 30) {
      const hh = h.toString().padStart(2,"0"), mm = m.toString().padStart(2,"0");
      const v = `${hh}:${mm}`, ap = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      o.push({ value: v, label: `${h12}:${mm} ${ap}` });
    }
  return o;
})();

// ═══════════════════════════════════════════════════════════════
// ERROR CLASSIFIER
// ═══════════════════════════════════════════════════════════════
function classifyError(err) {
  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return "Request timed out. Check your connection.";
    return "Network error. Check your internet connection.";
  }
  const s = err.response.status, m = err.response.data?.message;
  if (s === 413) return "File is too large. Try a smaller image.";
  if (s === 415) return "File type not supported. Use JPG, PNG or WebP.";
  if (s === 401) return "Session expired. Please log in again.";
  if (s === 409) return m || "That value is already taken.";
  if (s === 422) return m || "Validation error. Check your inputs.";
  if (s >= 500)  return "Server error. Please try again shortly.";
  return m || `Unexpected error (${s}).`;
}

// ═══════════════════════════════════════════════════════════════
// PHONE FORMATTER
// ═══════════════════════════════════════════════════════════════
function fmtPhone(raw = "") {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+234")) d = "0" + d.slice(4);
  if (d.startsWith("0") && d.length <= 11) {
    const r = d.slice(1);
    if (r.length <= 3) return `0${r}`;
    if (r.length <= 6) return `0${r.slice(0,3)} ${r.slice(3)}`;
    return `0${r.slice(0,3)} ${r.slice(3,6)} ${r.slice(6,10)}`;
  }
  if (d.startsWith("+")) {
    const cc = d.slice(0,4), r = d.slice(4);
    if (r.length <= 3) return `${cc} ${r}`;
    if (r.length <= 6) return `${cc} ${r.slice(0,3)} ${r.slice(3)}`;
    return `${cc} ${r.slice(0,3)} ${r.slice(3,6)} ${r.slice(6,10)}`;
  }
  return d;
}
const stripPhone = (v = "") => v.replace(/\s/g, "");

// ═══════════════════════════════════════════════════════════════
// IMAGE HELPERS
// ═══════════════════════════════════════════════════════════════
function checkDimensions(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(u); img.width < MIN_IMG || img.height < MIN_IMG ? rej(new Error(`Image must be at least ${MIN_IMG}×${MIN_IMG} px (yours is ${img.width}×${img.height}).`)) : res(); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Could not read image file.")); };
    img.src = u;
  });
}
async function compress(file) {
  try { return await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true, fileType: "image/jpeg" }); }
  catch { return file; }
}

// ═══════════════════════════════════════════════════════════════
// DRAFT (debounced)
// ═══════════════════════════════════════════════════════════════
let _dt = null;
function saveDraft(data) {
  clearTimeout(_dt);
  _dt = setTimeout(() => {
    try {
      const ex = (() => { try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r).data || {} : {}; } catch { return {}; } })();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: { ...ex, ...data }, ts: Date.now() }));
    } catch {}
  }, DRAFT_DEBOUNCE);
}
function loadDraft() {
  try { const r = localStorage.getItem(DRAFT_KEY); if (!r) return null; const { data, ts } = JSON.parse(r); if (Date.now() - ts > 86400000) { localStorage.removeItem(DRAFT_KEY); return null; } return data; } catch { return null; }
}
function clearDraft() { clearTimeout(_dt); localStorage.removeItem(DRAFT_KEY); }

// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════
const Ic = {
  camera:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  crop:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>,
  copy:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  verified:() => <svg viewBox="0 0 24 24" fill="#16a34a" width="16" height="16"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>,
  refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  warning: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  upload:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

// ═══════════════════════════════════════════════════════════════
// TOAST HOOK
// ═══════════════════════════════════════════════════════════════
function useToast() {
  const [toasts, set] = useState([]);
  const refs = useRef(new Map());
  const dismiss = useCallback((id) => { set(p => p.filter(t => t.id !== id)); if (refs.current.has(id)) { clearTimeout(refs.current.get(id)); refs.current.delete(id); } }, []);
  const push = useCallback((msg, type = "success", opts = {}) => {
    const id = Date.now() + Math.random(), dur = opts.duration ?? 3500, action = opts.action ?? null;
    set(p => [...p, { id, msg, type, action }]);
    const tm = setTimeout(() => dismiss(id), dur);
    refs.current.set(id, tm);
    return () => dismiss(id);
  }, [dismiss]);
  return { toasts, push, dismiss };
}
function ToastStack({ toasts, dismiss }) {
  return (
    <div className="ep-toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`ep-toast ep-toast--${t.type}`}>
          <span className="ep-toast-icon">{t.type === "success" ? "✅" : t.type === "info" ? "ℹ️" : "❌"}</span>
          <span className="ep-toast-msg">{t.msg}</span>
          {t.action && <button className="ep-toast-action" onClick={() => { t.action.onClick(); dismiss(t.id); }} type="button">{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════
function SkeletonPage() {
  return (
    <div className="ep-page" aria-busy="true" aria-label="Loading profile">
      <div className="ep-skeleton-header"><div className="ep-skel ep-skel--back"/><div className="ep-skel ep-skel--hdr-title"/><div className="ep-skel ep-skel--btn"/></div>
      <div className="ep-skeleton-tabs"><div className="ep-skel ep-skel--tab"/><div className="ep-skel ep-skel--tab"/></div>
      <div className="ep-body">
        <div className="ep-card ep-skeleton-card" aria-hidden="true"><div className="ep-card-head"><div className="ep-skel ep-skel--title"/></div><div className="ep-card-body ep-skeleton-avatar-body"><div className="ep-skel ep-skel--avatar-circle"/><div className="ep-skel ep-skel--avatar-btn"/></div></div>
        {[4,2].map((n,i) => <div key={i} className="ep-card ep-skeleton-card" aria-hidden="true"><div className="ep-card-head"><div className="ep-skel ep-skel--title"/></div><div className="ep-card-body">{Array.from({length:n}).map((_,j)=><div key={j} className="ep-field"><div className="ep-skel ep-skel--label"/><div className="ep-skel ep-skel--input"/></div>)}</div></div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODALS: Discard + Retry
// ═══════════════════════════════════════════════════════════════
function DiscardModal({ onConfirm, onCancel }) {
  useEffect(() => { const h = e => { if (e.key === "Escape") onCancel(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onCancel]);
  return (
    <div className="ep-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="discard-title" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="ep-modal">
        <div className="ep-modal-icon ep-modal-icon--warn"><Ic.warning/></div>
        <h3 id="discard-title" className="ep-modal-title">Discard Changes?</h3>
        <p className="ep-modal-body">You have unsaved changes. If you discard now, your edits will be lost.</p>
        <div className="ep-modal-actions">
          <button className="ep-modal-btn ep-modal-btn--secondary" onClick={onCancel} type="button">Keep Editing</button>
          <button className="ep-modal-btn ep-modal-btn--danger" onClick={onConfirm} type="button">Discard</button>
        </div>
      </div>
    </div>
  );
}
function RetryModal({ target, errorMsg, previewUrl, onRetry, onCancel }) {
  useEffect(() => { const h = e => { if (e.key === "Escape") onCancel(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onCancel]);
  return (
    <div className="ep-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="retry-title" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="ep-modal">
        {previewUrl && <div className="ep-retry-preview"><img src={previewUrl} alt="Failed upload" className={`ep-retry-preview-img ${target === "profile" ? "ep-retry-preview-img--circle" : ""}`}/></div>}
        <div className="ep-modal-icon ep-modal-icon--error">❌</div>
        <h3 id="retry-title" className="ep-modal-title">Upload Failed</h3>
        <p className="ep-modal-body">{errorMsg || `Couldn't upload your ${target === "profile" ? "photo" : "logo"}.`}</p>
        <div className="ep-modal-actions">
          <button className="ep-modal-btn ep-modal-btn--secondary" onClick={onCancel} type="button">Cancel</button>
          <button className="ep-modal-btn ep-modal-btn--primary" onClick={onRetry} type="button"><Ic.refresh/> Retry</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CROP MODAL
// ═══════════════════════════════════════════════════════════════
const CropModal = memo(function CropModal({ src, shape, onConfirm, onCancel }) {
  const cvs = useRef(null), imgR = useRef(null);
  const [pos, setPos] = useState({x:0,y:0}), [scale, setScale] = useState(1);
  const [drag, setDrag] = useState(false), [ready, setReady] = useState(false);
  const ds = useRef({x:0,y:0});
  const SZ = 240, OUT = 400;
  useEffect(() => { const h = e => { if (e.key === "Escape") onCancel(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onCancel]);
  useEffect(() => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { imgR.current = img; const s = Math.max(SZ/img.width,SZ/img.height)*1.2; setScale(s); setPos({x:(SZ-img.width*s)/2,y:(SZ-img.height*s)/2}); setReady(true); }; img.src = src; }, [src]);
  const pd = e => { setDrag(true); ds.current = {x:e.clientX-pos.x,y:e.clientY-pos.y}; e.currentTarget.setPointerCapture(e.pointerId); };
  const pm = e => { if (!drag) return; setPos({x:e.clientX-ds.current.x,y:e.clientY-ds.current.y}); };
  const pu = () => setDrag(false);
  const wh = e => { e.preventDefault(); setScale(s => Math.max(0.2,Math.min(5,s-e.deltaY*0.001))); };
  const confirm = () => { const c = cvs.current; if (!c || !imgR.current) return; const ctx = c.getContext("2d"), r = OUT/SZ; c.width=OUT; c.height=OUT; if (shape==="circle") { ctx.beginPath(); ctx.arc(OUT/2,OUT/2,OUT/2,0,Math.PI*2); ctx.clip(); } ctx.drawImage(imgR.current,pos.x*r,pos.y*r,imgR.current.width*scale*r,imgR.current.height*scale*r); c.toBlob(b => { if (b) onConfirm(b); },"image/jpeg",0.9); };
  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="crop-modal">
        <div className="crop-header"><h3 className="crop-title">Adjust Photo</h3><p className="crop-hint">Drag to position · Scroll to zoom</p></div>
        <div className="crop-viewport" style={{width:SZ,height:SZ}} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onWheel={wh}>
          <div className={`crop-mask crop-mask--${shape}`}/>
          {ready && <img src={src} alt="" aria-hidden="true" className="crop-image" draggable={false} style={{transform:`translate(${pos.x}px,${pos.y}px) scale(${scale})`,transformOrigin:"0 0"}}/>}
        </div>
        <div className="crop-zoom-row"><span className="crop-zoom-label" aria-hidden="true">🔍</span><input type="range" className="crop-zoom-slider" aria-label="Zoom" min="0.2" max="3" step="0.01" value={scale} onChange={e => setScale(parseFloat(e.target.value))}/></div>
        <div className="crop-actions"><button className="crop-btn crop-btn--cancel" onClick={onCancel}>Cancel</button><button className="crop-btn crop-btn--save" onClick={confirm}><Ic.crop/> Save</button></div>
        <canvas ref={cvs} style={{display:"none"}}/>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// UPLOAD PROGRESS
// ═══════════════════════════════════════════════════════════════
function UploadProgress({ progress, phase }) {
  const label = phase === "saving" ? "Saving…" : phase === "processing" ? "Processing…" : `Uploading… ${progress}%`;
  return (
    <div className="ep-upload-progress" role="status" aria-live="polite"><div className="ep-upload-progress-bar"><div className={`ep-upload-progress-fill ${phase !== "uploading" ? "ep-upload-progress-fill--indeterminate" : ""}`} style={phase === "uploading" ? {width:`${progress}%`} : undefined}/></div><span className="ep-upload-progress-label">{label}</span></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DROPZONE
// ═══════════════════════════════════════════════════════════════
function DropZone({ onFileDrop, disabled, children }) {
  const [over, setOver] = useState(false);
  const dOver = useCallback(e => { e.preventDefault(); e.stopPropagation(); if (!disabled) setOver(true); }, [disabled]);
  const dLeave = useCallback(e => { e.preventDefault(); e.stopPropagation(); setOver(false); }, []);
  const dDrop = useCallback(e => { e.preventDefault(); e.stopPropagation(); setOver(false); if (disabled) return; const f = e.dataTransfer?.files?.[0]; if (f?.type.startsWith("image/")) onFileDrop(f); }, [disabled, onFileDrop]);
  return (
    <div className={`ep-dropzone ${over ? "ep-dropzone--over" : ""}`} onDragOver={dOver} onDragLeave={dLeave} onDrop={dDrop}>
      {children}
      {over && <div className="ep-dropzone-overlay"><Ic.upload/><span>Drop image here</span></div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AVATAR PICKER
// ═══════════════════════════════════════════════════════════════
const AvatarPicker = memo(function AvatarPicker({ current, preview, name, uploading, uploadProgress, uploadPhase, shape="circle", onPickFile, onRemove, label="Change Photo" }) {
  const fRef = useRef(null), src = preview || current, up = !!uploading;
  return (
    <DropZone onFileDrop={onPickFile} disabled={up}>
      <div className="ep-avatar-section">
        <div className={`ep-avatar-wrap ep-avatar-wrap--${shape}`}>
          {src ? <img src={src} alt="Photo" className="ep-avatar-img" onError={e => { e.currentTarget.style.display="none"; }}/> : <div className="ep-avatar-letter">{(name||"U").charAt(0).toUpperCase()}</div>}
          <button className="ep-avatar-camera" onClick={() => fRef.current?.click()} disabled={up} aria-label={label} type="button">{up ? <span className="ep-spinner ep-spinner--sm" aria-hidden="true"/> : <Ic.camera/>}</button>
        </div>
        {up && <UploadProgress progress={uploadProgress} phase={uploadPhase}/>}
        <input ref={fRef} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} aria-hidden="true" onChange={e => { const f=e.target.files?.[0]; if (f) onPickFile(f); e.target.value=""; }}/>
        <div className="ep-avatar-btns">
          <button className="ep-avatar-btn ep-avatar-btn--change" onClick={() => fRef.current?.click()} disabled={up} type="button">{up ? "Uploading…" : label}</button>
          {(preview||current) && !up && <button className="ep-avatar-btn ep-avatar-btn--remove" onClick={onRemove} type="button">Remove</button>}
        </div>
        <p className="ep-avatar-hint">JPG, PNG or WebP · max 5 MB · min 100×100 px<span className="ep-avatar-hint-drag"> · or drag & drop</span></p>
      </div>
    </DropZone>
  );
});

// ═══════════════════════════════════════════════════════════════
// FIELD
// ═══════════════════════════════════════════════════════════════
const Field = memo(function Field({ label, hint, error, required, id, children }) {
  const hId = hint ? `${id}-hint` : undefined, eId = error ? `${id}-error` : undefined;
  const ch = Array.isArray(children) ? children : [children];
  const en = ch.map((c,i) => { if (!c || typeof c !== "object" || i > 0) return c; const db = [hId,eId].filter(Boolean).join(" ") || undefined; return {...c, props:{...c.props,"aria-invalid":error?"true":undefined,"aria-describedby":db,"aria-required":required?"true":undefined}}; });
  return (
    <div className={`ep-field ${error ? "ep-field--error" : ""}`}>
      {label && <label className="ep-label" htmlFor={id}>{label}{required && <span className="ep-required" aria-hidden="true">*</span>}{required && <span className="sr-only"> (required)</span>}</label>}
      {en}
      {hint && !error && <p className="ep-hint" id={hId}>{hint}</p>}
      {error && <p className="ep-error-msg" id={eId} role="alert">{error}</p>}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// EMAIL FIELD
// ═══════════════════════════════════════════════════════════════
function EmailField({ email, verified, onVerify }) {
  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="email">Email Address</label>
      <div className="ep-email-row">
        <input id="email" className="ep-input ep-input--disabled" type="email" value={email||""} disabled readOnly aria-describedby="email-status"/>
        <div className="ep-email-badge-wrap">
          {verified ? <span id="email-status" className="ep-email-badge ep-email-badge--verified"><Ic.verified/> Verified</span> : <button id="email-status" className="ep-email-badge ep-email-badge--unverified" onClick={onVerify} type="button">Verify Email →</button>}
        </div>
      </div>
      <p className="ep-hint">{verified ? "Your email is verified." : "Verify your email to unlock full access."}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERNAME FIELD (cached + suggestions)
// ═══════════════════════════════════════════════════════════════
const unCache = new Map();
function UsernameField({ value, orig, onChange, error }) {
  const [status, setStatus] = useState("idle"), [sugs, setSugs] = useState([]), [copied, setCopied] = useState(false);
  const dRef = useRef(null);
  const mkSugs = useCallback(b => {
    const sx = [Math.floor(Math.random()*999),Math.floor(Math.random()*99),new Date().getFullYear().toString().slice(2),"_ng",`${Math.floor(Math.random()*9)}${Math.floor(Math.random()*9)}`];
    return sx.map(s=>`${b}${s}`).filter(u=>u.length<=20&&u!==b).slice(0,3);
  }, []);
  useEffect(() => {
    setSugs([]);
    if (!value || value === orig) { setStatus("idle"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(value)) { setStatus("idle"); return; }
    if (unCache.has(value)) { const c = unCache.get(value); setStatus(c); if (c==="taken") setSugs(mkSugs(value)); return; }
    setStatus("checking");
    if (dRef.current) clearTimeout(dRef.current);
    dRef.current = setTimeout(async () => {
      try { const { data } = await api.get("/check-username",{params:{username:value}}); const r = data.available ? "available" : "taken"; unCache.set(value,r); setStatus(r); if (r==="taken") setSugs(mkSugs(value)); }
      catch(e) { if (e.response?.status===409) { unCache.set(value,"taken"); setStatus("taken"); setSugs(mkSugs(value)); } else setStatus("error"); }
    }, 500);
    return () => { if (dRef.current) clearTimeout(dRef.current); };
  }, [value, orig, mkSugs]);
  const copyUrl = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/seller/${value}`); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {} };
  const stEl = useMemo(() => {
    if (!value || value===orig) return null;
    const m = { checking:{cls:"checking",ic:<span className="ep-spinner ep-spinner--xs" aria-hidden="true"/>,tx:"Checking…"}, available:{cls:"available",ic:"✓",tx:"Available"}, taken:{cls:"taken",ic:"✗",tx:"Username already taken"}, error:{cls:"error",ic:"⚠",tx:"Could not check"} };
    const s = m[status]; if (!s) return null;
    return <span id="username-status" className={`ep-username-status ep-username-status--${s.cls}`} role="status" aria-live="polite">{s.ic} {s.tx}</span>;
  }, [status, value, orig]);
  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="username">Username</label>
      <div className="ep-prefix-wrap"><span className="ep-prefix" aria-hidden="true">@</span><input id="username" className="ep-input ep-input--prefixed" type="text" value={value} onChange={e=>onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20))} placeholder="yourusername" maxLength={20} autoCapitalize="none" autoCorrect="off" aria-invalid={error||status==="taken"?"true":undefined} aria-describedby={["username-status",error?"username-error":""].filter(Boolean).join(" ")}/></div>
      {stEl}
      {status==="taken" && sugs.length>0 && <div className="ep-username-suggestions" role="group" aria-label="Suggestions"><span className="ep-username-suggestions-label">Try:</span>{sugs.map(s=><button key={s} type="button" className="ep-username-suggestion-btn" onClick={()=>onChange(s)}>@{s}</button>)}</div>}
      {error && <p id="username-error" className="ep-error-msg" role="alert">{error}</p>}
      {value && <div className="ep-url-row"><span className="ep-url-text">loemart.com/seller/<strong>{value}</strong></span><button className="ep-url-copy" onClick={copyUrl} type="button" aria-label="Copy URL">{copied ? <span className="ep-url-copied">✔ Copied</span> : <Ic.copy/>}</button></div>}
      <p className="ep-hint">3–20 characters · letters, numbers, underscores</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHONE FIELD
// ═══════════════════════════════════════════════════════════════
function PhoneField({ value, onChange, error }) {
  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="phone">Phone Number</label>
      <input id="phone" className="ep-input" type="tel" inputMode="tel" value={value} onChange={e=>onChange(fmtPhone(e.target.value))} placeholder="0803 123 4567" maxLength={18} aria-invalid={error?"true":undefined} aria-describedby={error?"phone-error":"phone-hint"}/>
      {!error && <p className="ep-hint" id="phone-hint">Format: 0803 123 4567 · Not shown publicly</p>}
      {error && <p className="ep-error-msg" id="phone-error" role="alert">{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS HOURS
// ═══════════════════════════════════════════════════════════════
function HoursEditor({ hours, onChange }) {
  const dl = d => d.charAt(0).toUpperCase()+d.slice(1);
  const toggle = d => { const c=hours[d]; onChange(d, c?.isOpen ? {open:"",close:"",isOpen:false} : {open:"09:00",close:"17:00",isOpen:true}); };
  return (
    <div className="ep-hours">{DAYS.map(day => { const d = hours[day]||{open:"",close:"",isOpen:false}; return (
      <div key={day} className="ep-hours-row">
        <label className="ep-hours-toggle-wrap"><span className={`ep-hours-dot ${d.isOpen?"ep-hours-dot--on":""}`} role="switch" aria-checked={d.isOpen} aria-label={`${dl(day)} open`} tabIndex={0} onClick={()=>toggle(day)} onKeyDown={e=>(e.key===" "||e.key==="Enter")&&toggle(day)}/><span className="ep-hours-day-label">{dl(day)}</span></label>
        {d.isOpen ? <div className="ep-hours-times"><select className="ep-hours-select" aria-label={`${dl(day)} opens`} value={d.open} onChange={e=>onChange(day,{...d,open:e.target.value})}>{TIME_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><span className="ep-hours-to" aria-hidden="true">to</span><select className="ep-hours-select" aria-label={`${dl(day)} closes`} value={d.close} onChange={e=>onChange(day,{...d,close:e.target.value})}>{TIME_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div> : <span className="ep-hours-closed">Closed</span>}
      </div>
    ); })}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SAVE FLASH + UNSAVED BANNER
// ═══════════════════════════════════════════════════════════════
function useSaveFlash() { const [f, sF] = useState(false); const flash = useCallback(()=>{ sF(true); setTimeout(()=>sF(false),1200); },[]); return { f, flash }; }
function UnsavedBanner({ onSave, onDiscard, saving, uploading, flash, disabled }) {
  return (
    <div className="ep-unsaved" role="status">
      <span className="ep-unsaved-dot" aria-hidden="true"/><span className="ep-unsaved-text">Unsaved changes</span>
      <button className="ep-unsaved-discard" onClick={onDiscard} type="button" disabled={saving||!!uploading}>Discard</button>
      <button className={`ep-unsaved-save ${flash?"ep-unsaved-save--flash":""}`} onClick={onSave} disabled={disabled} type="button" aria-label={saving?"Saving":"Save Changes"}>
        {saving ? <span className="ep-spinner ep-spinner--sm ep-spinner--white" aria-hidden="true"/> : flash ? "✔ Saved" : "Save Changes"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION CARD
// ═══════════════════════════════════════════════════════════════
function Card({ title, sub, children }) {
  return <div className="ep-card">{(title||sub) && <div className="ep-card-head">{title && <h3 className="ep-card-title">{title}</h3>}{sub && <p className="ep-card-sub">{sub}</p>}</div>}<div className="ep-card-body">{children}</div></div>;
}

// ═══════════════════════════════════════════════════════════════
// TAB: PERSONAL
// ═══════════════════════════════════════════════════════════════
function TabPersonal({ form, errors, onChange, profilePreview, uploading, uploadProgress, uploadPhase, onPickPhoto, onRemovePhoto, onVerify, origUN }) {
  const cities = getCities(form.location_state);

  return (
    <div className="ep-tab-content">
      <Card title="Profile Photo">
        <AvatarPicker
          current={form.profile_image}
          preview={profilePreview}
          name={form.name}
          uploading={uploading==="profile"?uploading:""}
          uploadProgress={uploadProgress}
          uploadPhase={uploadPhase}
          shape="circle"
          onPickFile={onPickPhoto}
          onRemove={onRemovePhoto}
        />
      </Card>

      <Card title="Basic Information">
        <Field label="Full Name" id="name" required error={errors.name}>
          <input id="name" className="ep-input" type="text" value={form.name} onChange={e=>onChange("name",e.target.value)} placeholder="e.g. Chidi Okafor" maxLength={60}/>
        </Field>
        <UsernameField value={form.username} orig={origUN} onChange={v=>onChange("username",v)} error={errors.username}/>
        <EmailField email={form.email} verified={form.email_verified} onVerify={onVerify}/>
        <PhoneField value={form.phone} onChange={v=>onChange("phone",v)} error={errors.phone}/>
        <Field label="About You" id="bio" hint={`${form.bio?.length||0} / ${MAX_BIO}`} error={errors.bio}>
          <textarea id="bio" className="ep-textarea" value={form.bio} onChange={e=>onChange("bio",e.target.value)} placeholder="Tell buyers about yourself…" maxLength={MAX_BIO} rows={3}/>
        </Field>
      </Card>

      {/* ✅ Location — uses DropdownModal with correct API */}
      <Card title="Your Location" sub="Helps buyers find local sellers">
        <div className="ep-field">
          <label className="ep-label">State</label>
          <DropdownModal
            value={form.location_state}
            onChange={(val) => {
              onChange("location_state", val);
              /* Reset city when state changes */
              if (val !== form.location_state) onChange("location_city", "");
            }}
            options={STATES.map((s) => ({ id: s, name: s }))}
            placeholder="Select state"
          />
          {errors.location_state && (
            <p className="ep-error-msg" role="alert">{errors.location_state}</p>
          )}
        </div>

        {form.location_state && (
          <div className="ep-field">
            <label className="ep-label">City / LGA</label>
            {cities.length > 0 ? (
              <DropdownModal
                value={form.location_city}
                onChange={(val) => onChange("location_city", val)}
                options={cities.map((c) => ({ id: c, name: c }))}
                placeholder="Select city"
              />
            ) : (
              <input
                className="ep-input"
                type="text"
                value={form.location_city}
                onChange={e => onChange("location_city", e.target.value)}
                placeholder="Enter your city or LGA"
                maxLength={60}
              />
            )}
            {errors.location_city && (
              <p className="ep-error-msg" role="alert">{errors.location_city}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: STORE
// ═══════════════════════════════════════════════════════════════
function TabStore({ form, errors, onChange, storePreview, uploading, uploadProgress, uploadPhase, onPickLogo, onRemoveLogo }) {
  return (
    <div className="ep-tab-content">
      <Card title="Store Logo">
        <AvatarPicker
          current={form.store_logo}
          preview={storePreview}
          name={form.store_name}
          uploading={uploading==="store"?uploading:""}
          uploadProgress={uploadProgress}
          uploadPhase={uploadPhase}
          shape="square"
          onPickFile={onPickLogo}
          onRemove={onRemoveLogo}
          label="Change Logo"
        />
      </Card>

      <Card title="Store Details">
        <Field label="Store Name" id="store_name" required error={errors.store_name} hint="Your brand name on Loemart">
          <input id="store_name" className="ep-input" type="text" value={form.store_name} onChange={e=>onChange("store_name",e.target.value)} placeholder="e.g. Chidi's Electronics" maxLength={60}/>
        </Field>
        <Field label="Store Description" id="store_description" hint={`${form.store_description?.length||0} / ${MAX_STORE_DESC}`} error={errors.store_description}>
          <textarea id="store_description" className="ep-textarea" value={form.store_description} onChange={e=>onChange("store_description",e.target.value)} placeholder="What do you sell?" maxLength={MAX_STORE_DESC} rows={4}/>
        </Field>

        {/* ✅ Store Category — uses DropdownModal with correct API */}
        <div className="ep-field">
          <label className="ep-label">Store Category</label>
          <DropdownModal
            value={form.store_category}
            onChange={(val) => onChange("store_category", val)}
            options={STORE_CATEGORIES.map((c) => ({ id: c, name: c }))}
            placeholder="Choose a category"
          />
        </div>
      </Card>

      <Card title="Business Hours" sub="When you're available">
        <HoursEditor hours={form.business_hours||{}} onChange={(day,val)=>onChange("business_hours",{...(form.business_hours||{}),[day]:val})}/>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function EditProfile({ onProfileUpdate }) {
  const nav = useNavigate();
  const { toasts, push, dismiss } = useToast();
  const { f: savedFlash, flash: flashSaved } = useSaveFlash();
  const savingRef = useRef(false);

  // Tab
  const [tab, setTab] = useState("personal");

  // Form
  const [orig, setOrig] = useState(null);
  const [form, setForm] = useState({
    name:"",username:"",email:"",email_verified:false,phone:"",bio:"",
    profile_image:"",store_logo:"",location_state:"",location_city:"",
    store_name:"",store_description:"",store_category:"",business_hours:{},
  });
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);

  // Images
  const [ppv, setPpv] = useState(""), [spv, setSpv] = useState("");
  const [upl, setUpl] = useState(""), [uplPct, setUplPct] = useState(0), [uplPh, setUplPh] = useState("uploading");

  // Retry
  const [failUp, setFailUp] = useState(null), [showRetry, setShowRetry] = useState(false);

  // Crop
  const [cropSrc, setCropSrc] = useState(null), [cropTgt, setCropTgt] = useState("");

  // UI
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [hasDraft, setHasDraft] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false), [pendingDiscard, setPendingDiscard] = useState(null);

  // Object URLs
  const urlsRef = useRef([]);
  const mkUrl = useCallback(b => { const u = URL.createObjectURL(b); urlsRef.current.push(u); return u; }, []);
  const rmUrl = useCallback(u => { if (!u?.startsWith("blob:")) return; URL.revokeObjectURL(u); urlsRef.current = urlsRef.current.filter(x=>x!==u); }, []);
  useEffect(() => () => { urlsRef.current.forEach(URL.revokeObjectURL); }, []);

  // ── Fetch profile
  useEffect(() => {
    if (!getToken()) { nav("/auth"); return; }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/me");
        const init = {
          name:data.name||"",username:data.username||"",email:data.email||"",
          email_verified:data.email_verified??false,
          phone:data.phone?fmtPhone(data.phone):"",bio:data.bio||"",
          profile_image:data.profile_image||"",store_logo:data.store_logo||"",
          location_state:data.location?.state||data.location_state||"",
          location_city:data.location?.city||data.location_city||"",
          store_name:data.store_name||"",store_description:data.store_description||"",
          store_category:data.store_category||"",business_hours:data.business_hours||{},
        };
        setOrig(init);
        const dr = loadDraft();
        if (dr) { setForm({...init,...dr}); setHasDraft(true); setDirty(true); }
        else setForm(init);
      } catch(e) { if (e.response?.status===401) nav("/auth"); else push(classifyError(e),"error"); }
      finally { setLoading(false); }
    })();
  }, [nav, push]);

  // ── onChange
  const onChange = useCallback((k,v) => {
    setForm(p => { const n = {...p,[k]:v}; if (["bio","store_description","store_name","name","phone","username"].includes(k)) saveDraft({[k]:v}); return n; });
    setErrors(p => ({...p,[k]:""})); setDirty(true);
  }, []);

  const dismissDraft = useCallback(() => { clearDraft(); setForm(orig); setHasDraft(false); setDirty(false); }, [orig]);

  // ── Image pick
  const pickImg = useCallback(async (file, tgt) => {
    if (file.size > MAX_FILE) { push("Image must be under 5 MB.","error"); return; }
    try { await checkDimensions(file); } catch(e) { push(e.message,"error"); return; }
    const c = await compress(file);
    const rd = new FileReader();
    rd.onload = e => { setCropSrc(e.target.result); setCropTgt(tgt); };
    rd.readAsDataURL(c);
  }, [push]);

  // ── Upload
  const doUpload = useCallback(async (blob, tgt, existUrl) => {
    setUpl(tgt); setUplPct(0); setUplPh("uploading");
    const pUrl = existUrl || mkUrl(blob);
    if (tgt==="profile") setPpv(old=>{if(old!==pUrl)rmUrl(old);return pUrl;});
    else setSpv(old=>{if(old!==pUrl)rmUrl(old);return pUrl;});
    try {
      const fd = new FormData(); fd.append("image",blob,"avatar.jpg");
      const oldUrl = tgt==="profile" ? form.profile_image : form.store_logo;
      if (oldUrl) fd.append("old_url",oldUrl);
      const { data } = await api.post("/upload/image",fd,{
        headers:{"Content-Type":"multipart/form-data"},
        onUploadProgress:ev=>{ if(ev.total){const p=Math.round(ev.loaded/ev.total*100);setUplPct(p);if(p===100)setUplPh("processing");} },
      });
      setUplPh("saving");
      if (!data.url) throw new Error("No URL returned");
      onChange(tgt==="profile"?"profile_image":"store_logo",data.url);
      setFailUp(null); push("Photo uploaded ✔");
    } catch(e) {
      const msg = classifyError(e);
      setFailUp({blob,target:tgt,errorMsg:msg,previewUrl:pUrl}); setShowRetry(true);
      if (tgt==="profile") setPpv(""); else setSpv("");
    } finally { setUpl(""); setUplPct(0); setUplPh("uploading"); }
  }, [mkUrl, rmUrl, onChange, push, form.profile_image, form.store_logo]);

  const onCropOk = useCallback(async b => { setCropSrc(null); await doUpload(b,cropTgt,null); }, [cropTgt, doUpload]);
  const retryUp = useCallback(async () => { setShowRetry(false); if (!failUp) return; await doUpload(failUp.blob,failUp.target,failUp.previewUrl); }, [failUp, doUpload]);
  const cancelRetry = useCallback(() => { setShowRetry(false); if (failUp?.previewUrl) rmUrl(failUp.previewUrl); setFailUp(null); }, [failUp, rmUrl]);

  // ── Remove (undo)
  const rmProfile = useCallback(() => {
    const sv = form.profile_image, sp = ppv;
    rmUrl(ppv); setPpv(""); onChange("profile_image","");
    push("Profile photo removed.","info",{duration:5000,action:{label:"Undo",onClick:()=>{setPpv(sp);onChange("profile_image",sv);}}});
  }, [form.profile_image, ppv, rmUrl, onChange, push]);

  const rmStore = useCallback(() => {
    const sv = form.store_logo, sp = spv;
    rmUrl(spv); setSpv(""); onChange("store_logo","");
    push("Store logo removed.","info",{duration:5000,action:{label:"Undo",onClick:()=>{setSpv(sp);onChange("store_logo",sv);}}});
  }, [form.store_logo, spv, rmUrl, onChange, push]);

  // ── Validate
  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    else if (form.name.trim().length < 2) e.name = "At least 2 characters";
    if (form.username && !/^[a-z0-9_]{3,20}$/.test(form.username)) e.username = "3–20 chars: letters, numbers, underscores";
    const rp = stripPhone(form.phone);
    if (rp && !/^\+?\d{7,15}$/.test(rp)) e.phone = "Enter a valid phone number";
    if ((form.bio?.length||0)>MAX_BIO) e.bio = `Max ${MAX_BIO} characters`;
    if ((form.store_description?.length||0)>MAX_STORE_DESC) e.store_description = `Max ${MAX_STORE_DESC} characters`;
    setErrors(e); return Object.keys(e).length === 0;
  }, [form]);

  // ── Changed fields
  const getChanged = useCallback(() => {
    if (!orig) return {};
    const ch = {};
    for (const k of Object.keys(form)) {
      if (k==="email"||k==="email_verified") continue;
      const ov = k==="phone" ? stripPhone(orig[k]||"") : JSON.stringify(orig[k]);
      const cv = k==="phone" ? stripPhone(form[k]||"") : JSON.stringify(form[k]);
      if (ov !== cv) {
        if (k==="phone") ch.phone = stripPhone(form[k]);
        else if (k==="location_state"||k==="location_city") { if (!ch.location) ch.location = {state:form.location_state,city:form.location_city}; }
        else ch[k] = form[k];
      }
    }
    delete ch.location_state; delete ch.location_city;
    return ch;
  }, [form, orig]);

  // ── Username blocking
  const unBlocking = useMemo(() => {
    if (!form.username || form.username === orig?.username) return false;
    const c = unCache.get(form.username);
    return !c || c === "taken";
  }, [form.username, orig?.username]);

  const saveDisabled = saving || !!upl || !dirty || unBlocking;

  // ── Save
  const save = useCallback(async () => {
    if (savingRef.current) return;
    if (unBlocking) { push("Wait for username check.","error"); return; }
    if (!validate()) { push("Fix the errors below.","error"); return; }
    const ch = getChanged();
    if (!Object.keys(ch).length) { flashSaved(); setDirty(false); return; }
    const prevF = {...form}, prevO = orig ? {...orig} : null;
    savingRef.current = true; setSaving(true); setDirty(false); setOrig(p=>({...p,...form}));
    try {
      await api.patch("/me",ch,{headers:{"Content-Type":"application/json"}});
      setPpv(old=>{rmUrl(old);return"";}); setSpv(old=>{rmUrl(old);return"";}); clearDraft(); setHasDraft(false); flashSaved();
      onProfileUpdate?.({name:form.name,profile_image:form.profile_image,username:form.username,store_name:form.store_name,email_verified:form.email_verified});
    } catch(e) {
      setForm(prevF); setOrig(prevO); setDirty(true);
      const se = e.response?.data?.errors; if (se) setErrors(se);
      push(classifyError(e),"error");
    } finally { setSaving(false); savingRef.current = false; }
  }, [unBlocking, validate, getChanged, form, orig, push, flashSaved, rmUrl, onProfileUpdate]);

  // ── Discard
  const reqDiscard = useCallback(fn => { if (!dirty) { fn?.(); return; } setPendingDiscard(()=>fn||null); setShowDiscard(true); }, [dirty]);
  const doDiscard = useCallback(() => {
    setShowDiscard(false); if (!orig) return;
    setForm(orig); setErrors({}); setDirty(false);
    rmUrl(ppv); rmUrl(spv); setPpv(""); setSpv(""); clearDraft(); setHasDraft(false);
    pendingDiscard?.(); setPendingDiscard(null);
  }, [orig, ppv, spv, rmUrl, pendingDiscard]);
  const cancelDiscard = useCallback(() => { setShowDiscard(false); setPendingDiscard(null); }, []);

  // ── Keyboard
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey||e.metaKey)&&e.key==="s") { e.preventDefault(); if (!saveDisabled) save(); return; }
    };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  }, [saveDisabled, save]);

  // ── beforeunload
  useEffect(() => { const h=e=>{if(dirty){e.preventDefault();e.returnValue="";}}; window.addEventListener("beforeunload",h); return()=>window.removeEventListener("beforeunload",h); }, [dirty]);

  if (loading) return <SkeletonPage/>;

  return (
    <>
      <div className="ep-page">
        <ProfileHeader
          title="Edit Profile"
          onBack={() => reqDiscard(() => nav(-1))}
          showMenu={false}
          rightAction={
            <button className={`ep-hdr-save ${savedFlash?"ep-hdr-save--flash":""} ep-hdr-save--desktop-only`}
              onClick={save} disabled={saveDisabled} type="button" title="Save Changes (Ctrl+S)">
              {saving ? <span className="ep-spinner ep-spinner--sm ep-spinner--white" aria-hidden="true"/>
                : savedFlash ? "✔ Saved" : "Save"}
            </button>
          }
        />

        <div className="ep-tabs" role="tablist" aria-label="Profile sections">
          {TABS.map(t=>(
            <button key={t.id} role="tab" aria-selected={tab===t.id} aria-controls={`tp-${t.id}`} id={`t-${t.id}`}
              className={`ep-tab${tab===t.id?" ep-tab--active":""}`} onClick={()=>setTab(t.id)} type="button">
              <span className="ep-tab-emoji" aria-hidden="true">{t.emoji}</span><span className="ep-tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        {hasDraft && <div className="ep-draft-banner" role="status"><span>📝 Restored unsaved draft</span><button className="ep-draft-dismiss" onClick={dismissDraft} type="button">Dismiss</button></div>}
        {dirty && <UnsavedBanner onSave={save} onDiscard={()=>reqDiscard(null)} saving={saving} uploading={upl} flash={savedFlash} disabled={saveDisabled}/>}
        {unBlocking && dirty && <div className="ep-username-block-notice" role="alert">⏳ Waiting for username check…</div>}

        <div className="ep-body">
          <div id="tp-personal" role="tabpanel" aria-labelledby="t-personal" hidden={tab!=="personal"}>
            <TabPersonal
              form={form}
              errors={errors}
              onChange={onChange}
              profilePreview={ppv}
              uploading={upl}
              uploadProgress={uplPct}
              uploadPhase={uplPh}
              onPickPhoto={f=>pickImg(f,"profile")}
              onRemovePhoto={rmProfile}
              onVerify={()=>nav("/verification")}
              origUN={orig?.username||""}
            />
          </div>
          <div id="tp-store" role="tabpanel" aria-labelledby="t-store" hidden={tab!=="store"}>
            <TabStore
              form={form}
              errors={errors}
              onChange={onChange}
              storePreview={spv}
              uploading={upl}
              uploadProgress={uplPct}
              uploadPhase={uplPh}
              onPickLogo={f=>pickImg(f,"store")}
              onRemoveLogo={rmStore}
            />
          </div>
        </div>

        <p className="ep-footer">Loemart Technologies Ltd · © {new Date().getFullYear()}</p>
      </div>

      {cropSrc && <CropModal src={cropSrc} shape={cropTgt==="profile"?"circle":"square"} onConfirm={onCropOk} onCancel={()=>setCropSrc(null)}/>}
      {showDiscard && <DiscardModal onConfirm={doDiscard} onCancel={cancelDiscard}/>}
      {showRetry && <RetryModal target={failUp?.target} errorMsg={failUp?.errorMsg} previewUrl={failUp?.previewUrl} onRetry={retryUp} onCancel={cancelRetry}/>}
      <ToastStack toasts={toasts} dismiss={dismiss}/>
    </>
  );
}