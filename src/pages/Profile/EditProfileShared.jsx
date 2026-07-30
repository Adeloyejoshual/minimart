// src/pages/Profile/EditProfileShared.jsx
//
// Shared UI components + utilities for EditProfile (mobile + desktop).
// Everything except the main page shell lives here.

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import { locationsByState } from "../../config/locationsByState.js";
import { categoryFields } from "../../config/categoryFields.js";

import {
  api,
  MAX_BIO,
  MAX_STORE_DESC,
  fmtPhone,
  unCache,
} from "./useEditProfile.js";

// ═══════════════════════════════════════════════════════════════
// LOCATION + CATEGORIES
// ═══════════════════════════════════════════════════════════════
const STATES = Object.keys(locationsByState).sort();
const getCities = (st) => (st && locationsByState[st]) || [];
const STORE_CATEGORIES = Object.keys(categoryFields);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const TIME_OPTIONS = (() => {
  const o = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 30) {
      const hh = h.toString().padStart(2,"0");
      const mm = m.toString().padStart(2,"0");
      const v  = `${hh}:${mm}`;
      const ap = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      o.push({ value: v, label: `${h12}:${mm} ${ap}` });
    }
  return o;
})();

// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════
export const Ic = {
  camera: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  crop: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
    </svg>
  ),
  copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  verified: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" width="16" height="16">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
  ),
  refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  warning: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  store: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 9l1-6h16l1 6"/>
      <path d="M4 22h16V9H4v13z"/>
      <path d="M9 22V12h6v10"/>
    </svg>
  ),
  info: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════════════════════════
// TOAST HOOK
// ═══════════════════════════════════════════════════════════════
export function useToast() {
  const [toasts, set] = useState([]);
  const refs = useRef(new Map());

  const dismiss = useCallback((id) => {
    set(p => p.filter(t => t.id !== id));
    if (refs.current.has(id)) {
      clearTimeout(refs.current.get(id));
      refs.current.delete(id);
    }
  }, []);

  const push = useCallback((msg, type = "success", opts = {}) => {
    const id = Date.now() + Math.random();
    const dur = opts.duration ?? 3500;
    const action = opts.action ?? null;
    set(p => [...p, { id, msg, type, action }]);
    const tm = setTimeout(() => dismiss(id), dur);
    refs.current.set(id, tm);
    return () => dismiss(id);
  }, [dismiss]);

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, dismiss }) {
  return (
    <div className="ep-toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`ep-toast ep-toast--${t.type}`}>
          <span className="ep-toast-icon">
            {t.type === "success" ? "✅" : t.type === "info" ? "ℹ️" : "❌"}
          </span>
          <span className="ep-toast-msg">{t.msg}</span>
          {t.action && (
            <button
              className="ep-toast-action"
              onClick={() => { t.action.onClick(); dismiss(t.id); }}
              type="button"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SAVE FLASH HOOK
// ═══════════════════════════════════════════════════════════════
export function useSaveFlash() {
  const [f, sF] = useState(false);
  const flash = useCallback(() => {
    sF(true);
    setTimeout(() => sF(false), 1200);
  }, []);
  return { f, flash };
}

// ═══════════════════════════════════════════════════════════════
// SKELETON PAGE
// ═══════════════════════════════════════════════════════════════
export function SkeletonPage() {
  return (
    <div className="ep-page" aria-busy="true" aria-label="Loading profile">
      <div className="ep-skeleton-header">
        <div className="ep-skel ep-skel--back"/>
        <div className="ep-skel ep-skel--hdr-title"/>
        <div className="ep-skel ep-skel--btn"/>
      </div>
      <div className="ep-skeleton-tabs">
        <div className="ep-skel ep-skel--tab"/>
        <div className="ep-skel ep-skel--tab"/>
      </div>
      <div className="ep-body">
        <div className="ep-card ep-skeleton-card" aria-hidden="true">
          <div className="ep-card-head">
            <div className="ep-skel ep-skel--title"/>
          </div>
          <div className="ep-card-body ep-skeleton-avatar-body">
            <div className="ep-skel ep-skel--avatar-circle"/>
            <div className="ep-skel ep-skel--avatar-btn"/>
          </div>
        </div>
        {[4, 2].map((n, i) => (
          <div key={i} className="ep-card ep-skeleton-card" aria-hidden="true">
            <div className="ep-card-head">
              <div className="ep-skel ep-skel--title"/>
            </div>
            <div className="ep-card-body">
              {Array.from({ length: n }).map((_, j) => (
                <div key={j} className="ep-field">
                  <div className="ep-skel ep-skel--label"/>
                  <div className="ep-skel ep-skel--input"/>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DISCARD MODAL
// ═══════════════════════════════════════════════════════════════
export function DiscardModal({ onConfirm, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div
      className="ep-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-title"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="ep-modal">
        <div className="ep-modal-icon ep-modal-icon--warn"><Ic.warning/></div>
        <h3 id="discard-title" className="ep-modal-title">Discard Changes?</h3>
        <p className="ep-modal-body">
          You have unsaved changes. If you discard now, your edits will be lost.
        </p>
        <div className="ep-modal-actions">
          <button
            className="ep-modal-btn ep-modal-btn--secondary"
            onClick={onCancel}
            type="button"
          >
            Keep Editing
          </button>
          <button
            className="ep-modal-btn ep-modal-btn--danger"
            onClick={onConfirm}
            type="button"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RETRY MODAL
// ═══════════════════════════════════════════════════════════════
export function RetryModal({ target, errorMsg, previewUrl, onRetry, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div
      className="ep-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retry-title"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="ep-modal">
        {previewUrl && (
          <div className="ep-retry-preview">
            <img
              src={previewUrl}
              alt="Failed upload"
              className={`ep-retry-preview-img ${
                target === "profile" ? "ep-retry-preview-img--circle" : ""
              }`}
            />
          </div>
        )}
        <div className="ep-modal-icon ep-modal-icon--error">❌</div>
        <h3 id="retry-title" className="ep-modal-title">Upload Failed</h3>
        <p className="ep-modal-body">
          {errorMsg || `Couldn't upload your ${target === "profile" ? "photo" : "logo"}.`}
        </p>
        <div className="ep-modal-actions">
          <button
            className="ep-modal-btn ep-modal-btn--secondary"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="ep-modal-btn ep-modal-btn--primary"
            onClick={onRetry}
            type="button"
          >
            <Ic.refresh/> Retry
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CROP MODAL
// ═══════════════════════════════════════════════════════════════
export const CropModal = memo(function CropModal({ src, shape, onConfirm, onCancel }) {
  const cvs = useRef(null);
  const imgR = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState(false);
  const [ready, setReady] = useState(false);
  const ds = useRef({ x: 0, y: 0 });
  const SZ = 240, OUT = 400;

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgR.current = img;
      const s = Math.max(SZ / img.width, SZ / img.height) * 1.2;
      setScale(s);
      setPos({
        x: (SZ - img.width * s) / 2,
        y: (SZ - img.height * s) / 2,
      });
      setReady(true);
    };
    img.src = src;
  }, [src]);

  const pd = e => {
    setDrag(true);
    ds.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pm = e => {
    if (!drag) return;
    setPos({ x: e.clientX - ds.current.x, y: e.clientY - ds.current.y });
  };
  const pu = () => setDrag(false);
  const wh = e => {
    e.preventDefault();
    setScale(s => Math.max(0.2, Math.min(5, s - e.deltaY * 0.001)));
  };

  const confirm = () => {
    const c = cvs.current;
    if (!c || !imgR.current) return;
    const ctx = c.getContext("2d");
    const r = OUT / SZ;
    c.width = OUT;
    c.height = OUT;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(
      imgR.current,
      pos.x * r, pos.y * r,
      imgR.current.width * scale * r,
      imgR.current.height * scale * r
    );
    c.toBlob(b => { if (b) onConfirm(b); }, "image/jpeg", 0.9);
  };

  return (
    <div
      className="crop-overlay"
      role="dialog"
      aria-modal="true"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="crop-modal">
        <div className="crop-header">
          <h3 className="crop-title">Adjust Photo</h3>
          <p className="crop-hint">Drag to position · Scroll to zoom</p>
        </div>
        <div
          className="crop-viewport"
          style={{ width: SZ, height: SZ }}
          onPointerDown={pd}
          onPointerMove={pm}
          onPointerUp={pu}
          onWheel={wh}
        >
          <div className={`crop-mask crop-mask--${shape}`}/>
          {ready && (
            <img
              src={src}
              alt=""
              aria-hidden="true"
              className="crop-image"
              draggable={false}
              style={{
                transform: `translate(${pos.x}px,${pos.y}px) scale(${scale})`,
                transformOrigin: "0 0",
              }}
            />
          )}
        </div>
        <div className="crop-zoom-row">
          <span className="crop-zoom-label" aria-hidden="true">🔍</span>
          <input
            type="range"
            className="crop-zoom-slider"
            aria-label="Zoom"
            min="0.2"
            max="3"
            step="0.01"
            value={scale}
            onChange={e => setScale(parseFloat(e.target.value))}
          />
        </div>
        <div className="crop-actions">
          <button className="crop-btn crop-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="crop-btn crop-btn--save" onClick={confirm}><Ic.crop/> Save</button>
        </div>
        <canvas ref={cvs} style={{ display: "none" }}/>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// UPLOAD PROGRESS
// ═══════════════════════════════════════════════════════════════
export function UploadProgress({ progress, phase }) {
  const label = phase === "saving"
    ? "Saving…"
    : phase === "processing"
      ? "Processing…"
      : `Uploading… ${progress}%`;

  return (
    <div className="ep-upload-progress" role="status" aria-live="polite">
      <div className="ep-upload-progress-bar">
        <div
          className={`ep-upload-progress-fill ${
            phase !== "uploading" ? "ep-upload-progress-fill--indeterminate" : ""
          }`}
          style={phase === "uploading" ? { width: `${progress}%` } : undefined}
        />
      </div>
      <span className="ep-upload-progress-label">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DROPZONE
// ═══════════════════════════════════════════════════════════════
export function DropZone({ onFileDrop, disabled, children }) {
  const [over, setOver] = useState(false);

  const dOver = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setOver(true);
  }, [disabled]);

  const dLeave = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
  }, []);

  const dDrop = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    if (disabled) return;
    const f = e.dataTransfer?.files?.[0];
    if (f?.type.startsWith("image/")) onFileDrop(f);
  }, [disabled, onFileDrop]);

  return (
    <div
      className={`ep-dropzone ${over ? "ep-dropzone--over" : ""}`}
      onDragOver={dOver}
      onDragLeave={dLeave}
      onDrop={dDrop}
    >
      {children}
      {over && (
        <div className="ep-dropzone-overlay">
          <Ic.upload/>
          <span>Drop image here</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AVATAR PICKER
// ═══════════════════════════════════════════════════════════════
export const AvatarPicker = memo(function AvatarPicker({
  current, preview, name, uploading, uploadProgress, uploadPhase,
  shape = "circle", onPickFile, onRemove, label = "Change Photo",
}) {
  const fRef = useRef(null);
  const src = preview || current;
  const up = !!uploading;

  return (
    <DropZone onFileDrop={onPickFile} disabled={up}>
      <div className="ep-avatar-section">
        <div className={`ep-avatar-wrap ep-avatar-wrap--${shape}`}>
          {src ? (
            <img
              src={src}
              alt="Photo"
              className="ep-avatar-img"
              onError={e => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="ep-avatar-letter">
              {(name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <button
            className="ep-avatar-camera"
            onClick={() => fRef.current?.click()}
            disabled={up}
            aria-label={label}
            type="button"
          >
            {up
              ? <span className="ep-spinner ep-spinner--sm" aria-hidden="true"/>
              : <Ic.camera/>
            }
          </button>
        </div>

        {up && <UploadProgress progress={uploadProgress} phase={uploadPhase}/>}

        <input
          ref={fRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          aria-hidden="true"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            e.target.value = "";
          }}
        />

        <div className="ep-avatar-btns">
          <button
            className="ep-avatar-btn ep-avatar-btn--change"
            onClick={() => fRef.current?.click()}
            disabled={up}
            type="button"
          >
            {up ? "Uploading…" : label}
          </button>
          {(preview || current) && !up && (
            <button
              className="ep-avatar-btn ep-avatar-btn--remove"
              onClick={onRemove}
              type="button"
            >
              Remove
            </button>
          )}
        </div>

        <p className="ep-avatar-hint">
          JPG, PNG or WebP · max 5 MB · min 100×100 px
          <span className="ep-avatar-hint-drag"> · or drag & drop</span>
        </p>
      </div>
    </DropZone>
  );
});

// ═══════════════════════════════════════════════════════════════
// FIELD WRAPPER
// ═══════════════════════════════════════════════════════════════
export const Field = memo(function Field({ label, hint, error, required, id, children }) {
  const hId = hint ? `${id}-hint` : undefined;
  const eId = error ? `${id}-error` : undefined;

  const ch = Array.isArray(children) ? children : [children];
  const en = ch.map((c, i) => {
    if (!c || typeof c !== "object" || i > 0) return c;
    const db = [hId, eId].filter(Boolean).join(" ") || undefined;
    return {
      ...c,
      props: {
        ...c.props,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": db,
        "aria-required": required ? "true" : undefined,
      },
    };
  });

  return (
    <div className={`ep-field ${error ? "ep-field--error" : ""}`}>
      {label && (
        <label className="ep-label" htmlFor={id}>
          {label}
          {required && <span className="ep-required" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {en}
      {hint && !error && <p className="ep-hint" id={hId}>{hint}</p>}
      {error && <p className="ep-error-msg" id={eId} role="alert">{error}</p>}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// EMAIL FIELD
// ═══════════════════════════════════════════════════════════════
export function EmailField({ email, verified, onVerify }) {
  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="email">Email Address</label>
      <div className="ep-email-row">
        <input
          id="email"
          className="ep-input ep-input--disabled"
          type="email"
          value={email || ""}
          disabled
          readOnly
          aria-describedby="email-status"
        />
        <div className="ep-email-badge-wrap">
          {verified ? (
            <span id="email-status" className="ep-email-badge ep-email-badge--verified">
              <Ic.verified/> Verified
            </span>
          ) : (
            <button
              id="email-status"
              className="ep-email-badge ep-email-badge--unverified"
              onClick={onVerify}
              type="button"
            >
              Verify Email →
            </button>
          )}
        </div>
      </div>
      <p className="ep-hint">
        {verified
          ? "Your email is verified."
          : "Verify your email to unlock full access."}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERNAME FIELD — 30-day cooldown + status callback
// ═══════════════════════════════════════════════════════════════
export function UsernameField({ value, orig, onChange, error, cooldown, onStatusChange }) {
  const [status, setStatus] = useState("idle");
  const [sugs,   setSugs]   = useState([]);
  const [copied, setCopied] = useState(false);
  const dRef = useRef(null);

  const canChange = cooldown?.can_change ?? true;
  const daysLeft  = cooldown?.days_left  ?? 0;

  /* Notify parent whenever status changes */
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const mkSugs = useCallback(b => {
    const sx = [
      Math.floor(Math.random() * 999),
      Math.floor(Math.random() * 99),
      new Date().getFullYear().toString().slice(2),
      "_ng",
      `${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}`,
    ];
    return sx.map(s => `${b}${s}`)
             .filter(u => u.length <= 20 && u !== b)
             .slice(0, 3);
  }, []);

  useEffect(() => {
    setSugs([]);
    if (!value || value === orig)             { setStatus("idle");   return; }
    if (!canChange)                           { setStatus("locked"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(value))     { setStatus("idle");   return; }

    if (unCache.has(value)) {
      const c = unCache.get(value);
      setStatus(c);
      if (c === "taken") setSugs(mkSugs(value));
      return;
    }

    setStatus("checking");
    if (dRef.current) clearTimeout(dRef.current);
    dRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/check-username", { params: { username: value } });
        if (data.locked) { setStatus("locked"); return; }
        const r = data.available ? "available" : "taken";
        unCache.set(value, r);
        setStatus(r);
        if (r === "taken") setSugs(mkSugs(value));
      } catch (e) {
        if (e.response?.status === 409) {
          unCache.set(value, "taken");
          setStatus("taken");
          setSugs(mkSugs(value));
        } else if (e.response?.status === 429) {
          setStatus("locked");
        } else {
          setStatus("error");
        }
      }
    }, 500);
    return () => { if (dRef.current) clearTimeout(dRef.current); };
  }, [value, orig, mkSugs, canChange]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/seller/${value}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const stEl = useMemo(() => {
    if (!value || value === orig) return null;
    const m = {
      checking:  { cls: "checking",  ic: <span className="ep-spinner ep-spinner--xs" aria-hidden="true"/>, tx: "Checking…" },
      available: { cls: "available", ic: "✓", tx: "Available" },
      taken:     { cls: "taken",     ic: "✗", tx: "Username already taken" },
      error:     { cls: "error",     ic: "⚠", tx: "Could not check" },
      locked:    { cls: "locked",    ic: "🔒", tx: `Available in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` },
    };
    const s = m[status];
    if (!s) return null;
    return (
      <span
        id="username-status"
        className={`ep-username-status ep-username-status--${s.cls}`}
        role="status"
        aria-live="polite"
      >
        {s.ic} {s.tx}
      </span>
    );
  }, [status, value, orig, daysLeft]);

  const nextChangeFormatted = useMemo(() => {
    if (!cooldown?.next_change_at) return null;
    try {
      return new Date(cooldown.next_change_at).toLocaleDateString("en-NG", {
        weekday: "long",
        year:    "numeric",
        month:   "long",
        day:     "numeric",
      });
    } catch {
      return null;
    }
  }, [cooldown?.next_change_at]);

  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="username">
        Username
        {!canChange && <span className="ep-label-locked" aria-hidden="true"> 🔒</span>}
      </label>

      <div className={`ep-prefix-wrap ${!canChange ? "ep-prefix-wrap--locked" : ""}`}>
        <span className="ep-prefix" aria-hidden="true">@</span>
        <input
          id="username"
          className={`ep-input ep-input--prefixed ${!canChange ? "ep-input--locked" : ""}`}
          type="text"
          value={value}
          onChange={e => {
            if (!canChange) return;
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
          }}
          placeholder={canChange ? "yourusername" : "Username locked"}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect="off"
          disabled={!canChange}
          readOnly={!canChange}
          aria-invalid={error || status === "taken" ? "true" : undefined}
          aria-describedby={["username-status", error ? "username-error" : ""].filter(Boolean).join(" ")}
        />
      </div>

      {!canChange && (
        <div className="ep-username-cooldown" role="status">
          <span className="ep-username-cooldown-icon" aria-hidden="true"><Ic.lock/></span>
          <div className="ep-username-cooldown-content">
            <strong>Username locked for {daysLeft} more day{daysLeft !== 1 ? "s" : ""}</strong>
            <p>
              You can change your username once every 30 days.
              {nextChangeFormatted && (
                <> Next change available on <strong>{nextChangeFormatted}</strong>.</>
              )}
            </p>
          </div>
        </div>
      )}

      {stEl}

      {status === "taken" && sugs.length > 0 && canChange && (
        <div className="ep-username-suggestions" role="group" aria-label="Suggestions">
          <span className="ep-username-suggestions-label">Try:</span>
          {sugs.map(s => (
            <button
              key={s}
              type="button"
              className="ep-username-suggestion-btn"
              onClick={() => onChange(s)}
            >
              @{s}
            </button>
          ))}
        </div>
      )}

      {error && <p id="username-error" className="ep-error-msg" role="alert">{error}</p>}

      {value && (
        <div className="ep-url-row">
          <span className="ep-url-text">
            loemart.com/seller/<strong>{value}</strong>
          </span>
          <button
            className="ep-url-copy"
            onClick={copyUrl}
            type="button"
            aria-label="Copy URL"
          >
            {copied
              ? <span className="ep-url-copied">✔ Copied</span>
              : <Ic.copy/>
            }
          </button>
        </div>
      )}

      <p className="ep-hint">
        {canChange
          ? "3–20 characters · letters, numbers, underscores · changeable every 30 days"
          : "Username cannot be changed right now"}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHONE FIELD
// ═══════════════════════════════════════════════════════════════
export function PhoneField({ value, onChange, error }) {
  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="phone">Phone Number</label>
      <input
        id="phone"
        className="ep-input"
        type="tel"
        inputMode="tel"
        value={value}
        onChange={e => onChange(fmtPhone(e.target.value))}
        placeholder="0803 123 4567"
        maxLength={18}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "phone-error" : "phone-hint"}
      />
      {!error && (
        <p className="ep-hint" id="phone-hint">
          Format: 0803 123 4567 · Not shown publicly
        </p>
      )}
      {error && (
        <p className="ep-error-msg" id="phone-error" role="alert">{error}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS HOURS
// ═══════════════════════════════════════════════════════════════
export function HoursEditor({ hours, onChange }) {
  const dl = d => d.charAt(0).toUpperCase() + d.slice(1);

  const toggle = d => {
    const c = hours[d];
    onChange(
      d,
      c?.isOpen
        ? { open: "", close: "", isOpen: false }
        : { open: "09:00", close: "17:00", isOpen: true }
    );
  };

  return (
    <div className="ep-hours">
      {DAYS.map(day => {
        const d = hours[day] || { open: "", close: "", isOpen: false };
        return (
          <div key={day} className="ep-hours-row">
            <label className="ep-hours-toggle-wrap">
              <span
                className={`ep-hours-dot ${d.isOpen ? "ep-hours-dot--on" : ""}`}
                role="switch"
                aria-checked={d.isOpen}
                aria-label={`${dl(day)} open`}
                tabIndex={0}
                onClick={() => toggle(day)}
                onKeyDown={e => (e.key === " " || e.key === "Enter") && toggle(day)}
              />
              <span className="ep-hours-day-label">{dl(day)}</span>
            </label>
            {d.isOpen ? (
              <div className="ep-hours-times">
                <select
                  className="ep-hours-select"
                  aria-label={`${dl(day)} opens`}
                  value={d.open}
                  onChange={e => onChange(day, { ...d, open: e.target.value })}
                >
                  {TIME_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="ep-hours-to" aria-hidden="true">to</span>
                <select
                  className="ep-hours-select"
                  aria-label={`${dl(day)} closes`}
                  value={d.close}
                  onChange={e => onChange(day, { ...d, close: e.target.value })}
                >
                  {TIME_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="ep-hours-closed">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UNSAVED BANNER (inline)
// ═══════════════════════════════════════════════════════════════
export function UnsavedBanner({ onSave, onDiscard, saving, uploading, flash, disabled }) {
  return (
    <div className="ep-unsaved" role="status">
      <span className="ep-unsaved-dot" aria-hidden="true"/>
      <span className="ep-unsaved-text">Unsaved changes</span>
      <button
        className="ep-unsaved-discard"
        onClick={onDiscard}
        type="button"
        disabled={saving || !!uploading}
      >
        Discard
      </button>
      <button
        className={`ep-unsaved-save ${flash ? "ep-unsaved-save--flash" : ""}`}
        onClick={onSave}
        disabled={disabled}
        type="button"
        aria-label={saving ? "Saving" : "Save Changes"}
      >
        {saving
          ? <span className="ep-spinner ep-spinner--sm ep-spinner--white" aria-hidden="true"/>
          : flash ? "✔ Saved" : "Save Changes"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION CARD
// ═══════════════════════════════════════════════════════════════
export function Card({ title, sub, children }) {
  return (
    <div className="ep-card">
      {(title || sub) && (
        <div className="ep-card-head">
          {title && <h3 className="ep-card-title">{title}</h3>}
          {sub && <p className="ep-card-sub">{sub}</p>}
        </div>
      )}
      <div className="ep-card-body">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: PERSONAL
// ═══════════════════════════════════════════════════════════════
export function TabPersonal({
  form, errors, onChange, profilePreview,
  uploading, uploadProgress, uploadPhase,
  onPickPhoto, onRemovePhoto, onVerify, origUN,
  cooldown, onUsernameStatus,
}) {
  const cities = getCities(form.location_state);

  return (
    <div className="ep-tab-content">
      <Card title="Profile Photo">
        <AvatarPicker
          current={form.profile_image}
          preview={profilePreview}
          name={form.name}
          uploading={uploading === "profile" ? uploading : ""}
          uploadProgress={uploadProgress}
          uploadPhase={uploadPhase}
          shape="circle"
          onPickFile={onPickPhoto}
          onRemove={onRemovePhoto}
        />
      </Card>

      <Card title="Basic Information">
        <Field label="Full Name" id="name" required error={errors.name}>
          <input
            id="name"
            className="ep-input"
            type="text"
            value={form.name}
            onChange={e => onChange("name", e.target.value)}
            placeholder="e.g. Chidi Okafor"
            maxLength={60}
          />
        </Field>

        <UsernameField
          value={form.username}
          orig={origUN}
          onChange={v => onChange("username", v)}
          error={errors.username}
          cooldown={cooldown}
          onStatusChange={onUsernameStatus}
        />

        <EmailField
          email={form.email}
          verified={form.email_verified}
          onVerify={onVerify}
        />

        <PhoneField
          value={form.phone}
          onChange={v => onChange("phone", v)}
          error={errors.phone}
        />

        <Field
          label="About You"
          id="bio"
          hint={`${form.bio?.length || 0} / ${MAX_BIO}`}
          error={errors.bio}
        >
          <textarea
            id="bio"
            className="ep-textarea"
            value={form.bio}
            onChange={e => onChange("bio", e.target.value)}
            placeholder="Tell buyers about yourself…"
            maxLength={MAX_BIO}
            rows={3}
          />
        </Field>
      </Card>

      <Card title="Your Location" sub="Helps buyers find local sellers">
        <div className="ep-field">
          <label className="ep-label">State</label>
          <DropdownModal
            value={form.location_state}
            onChange={val => {
              onChange("location_state", val);
              if (val !== form.location_state) onChange("location_city", "");
            }}
            options={STATES.map(s => ({ id: s, name: s }))}
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
                onChange={val => onChange("location_city", val)}
                options={cities.map(c => ({ id: c, name: c }))}
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
export function TabStore({
  form, errors, onChange, storePreview,
  uploading, uploadProgress, uploadPhase,
  onPickLogo, onRemoveLogo,
}) {
  return (
    <div className="ep-tab-content">
      <Card title="Store Logo">
        <AvatarPicker
          current={form.store_logo}
          preview={storePreview}
          name={form.store_name}
          uploading={uploading === "store" ? uploading : ""}
          uploadProgress={uploadProgress}
          uploadPhase={uploadPhase}
          shape="square"
          onPickFile={onPickLogo}
          onRemove={onRemoveLogo}
          label="Change Logo"
        />
      </Card>

      <Card title="Store Details">
        <Field
          label="Store Name"
          id="store_name"
          required
          error={errors.store_name}
          hint="Your brand name on Loemart"
        >
          <input
            id="store_name"
            className="ep-input"
            type="text"
            value={form.store_name}
            onChange={e => onChange("store_name", e.target.value)}
            placeholder="e.g. Chidi's Electronics"
            maxLength={60}
          />
        </Field>

        <Field
          label="Store Description"
          id="store_description"
          hint={`${form.store_description?.length || 0} / ${MAX_STORE_DESC}`}
          error={errors.store_description}
        >
          <textarea
            id="store_description"
            className="ep-textarea"
            value={form.store_description}
            onChange={e => onChange("store_description", e.target.value)}
            placeholder="What do you sell?"
            maxLength={MAX_STORE_DESC}
            rows={4}
          />
        </Field>

        <div className="ep-field">
          <label className="ep-label">Store Category</label>
          <DropdownModal
            value={form.store_category}
            onChange={val => onChange("store_category", val)}
            options={STORE_CATEGORIES.map(c => ({ id: c, name: c }))}
            placeholder="Choose a category"
          />
        </div>
      </Card>

      <Card title="Business Hours" sub="When you're available">
        <HoursEditor
          hours={form.business_hours || {}}
          onChange={(day, val) => onChange("business_hours", {
            ...(form.business_hours || {}),
            [day]: val,
          })}
        />
      </Card>
    </div>
  );
}