// src/pages/Profile/EditProfile.jsx

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import imageCompression from "browser-image-compression";

import EditHeader from "../../components/EditHeader.jsx";
import DropdownModal from "../../components/DropdownModal.jsx";
import { locationsByState } from "../../config/locationsByState.js";
import { categoryFields } from "../../config/categoryFields.js";
import "../../styles/EditProfile.css";

// ═══════════════════════════════════════════════════════════════
// AXIOS INSTANCE  → /api/edit-profile
// ═══════════════════════════════════════════════════════════════
const BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const api = axios.create({ baseURL: `${BASE}/api/edit-profile` });

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// ═══════════════════════════════════════════════════════════════
// LOCATION HELPERS
// ═══════════════════════════════════════════════════════════════
const STATES = Object.keys(locationsByState).sort();
const getCitiesByState = (state) =>
  state && locationsByState[state] ? locationsByState[state] : [];

// ═══════════════════════════════════════════════════════════════
// STORE CATEGORIES FROM CONFIG
// ═══════════════════════════════════════════════════════════════
const STORE_CATEGORIES = Object.keys(categoryFields);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const MAX_BIO        = 200;
const MAX_STORE_DESC = 300;
const MAX_FILE       = 5 * 1024 * 1024;
const MIN_IMG_SIZE   = 100;
const DRAFT_KEY      = "ep_draft";
const DRAFT_DEBOUNCE = 500;

const TABS = [
  { id: "personal", label: "Personal", emoji: "👤" },
  { id: "store",    label: "Store",    emoji: "🏪" },
];

const DAYS = [
  "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday", "sunday",
];

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh   = h.toString().padStart(2, "0");
      const mm   = m.toString().padStart(2, "0");
      const val  = `${hh}:${mm}`;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ value: val, label: `${h12}:${mm} ${ampm}` });
    }
  }
  return opts;
})();

// ═══════════════════════════════════════════════════════════════
// ERROR CLASSIFIER
// ═══════════════════════════════════════════════════════════════
function classifyError(err, context = "request") {
  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return "Request timed out. Check your connection and try again.";
    return "Network error. Check your internet connection.";
  }
  const status    = err.response.status;
  const serverMsg = err.response.data?.message || err.response.data?.error;
  if (status === 413) return "File is too large for the server. Try a smaller image.";
  if (status === 415) return "File type not supported. Use JPG, PNG, or WebP.";
  if (status === 401) return "Session expired. Please log in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 409) return serverMsg || "That value is already taken.";
  if (status === 422) return serverMsg || "Validation error. Check your inputs.";
  if (status >= 500) return "Server error. Please try again in a moment.";
  return serverMsg || `Unexpected error (${status}).`;
}

// ═══════════════════════════════════════════════════════════════
// PHONE FORMATTER
// ═══════════════════════════════════════════════════════════════
function formatNigerianPhone(raw = "") {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+234")) digits = "0" + digits.slice(4);
  if (digits.startsWith("0") && digits.length <= 11) {
    const d = digits.slice(1);
    if (d.length <= 3) return `0${d}`;
    if (d.length <= 6) return `0${d.slice(0, 3)} ${d.slice(3)}`;
    return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`;
  }
  if (digits.startsWith("+")) {
    const cc = digits.slice(0, 4), rest = digits.slice(4);
    if (rest.length <= 3) return `${cc} ${rest}`;
    if (rest.length <= 6) return `${cc} ${rest.slice(0, 3)} ${rest.slice(3)}`;
    return `${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 10)}`;
  }
  return digits;
}
function unformatPhone(val = "") { return val.replace(/\s/g, ""); }

// ═══════════════════════════════════════════════════════════════
// IMAGE DIMENSION VALIDATOR
// ═══════════════════════════════════════════════════════════════
function validateImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < MIN_IMG_SIZE || img.height < MIN_IMG_SIZE)
        reject(new Error(`Image must be at least ${MIN_IMG_SIZE}×${MIN_IMG_SIZE} px (yours is ${img.width}×${img.height}).`));
      else resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image file.")); };
    img.src = url;
  });
}

// ═══════════════════════════════════════════════════════════════
// IMAGE COMPRESS (1200px for sharp high-DPI)
// ═══════════════════════════════════════════════════════════════
async function compressImage(file) {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
  } catch { return file; }
}

// ═══════════════════════════════════════════════════════════════
// DRAFT (debounced 500ms)
// ═══════════════════════════════════════════════════════════════
let _draftTimer = null;
function saveDraftDebounced(data) {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    try {
      const existing = (() => {
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          return raw ? JSON.parse(raw).data || {} : {};
        } catch { return {}; }
      })();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: { ...existing, ...data }, ts: Date.now() }));
    } catch {}
  }, DRAFT_DEBOUNCE);
}
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 24 * 60 * 60 * 1000) { localStorage.removeItem(DRAFT_KEY); return null; }
    return data;
  } catch { return null; }
}
function clearDraft() { clearTimeout(_draftTimer); localStorage.removeItem(DRAFT_KEY); }

// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════
const Ic = {
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
};

// ═══════════════════════════════════════════════════════════════
// TOAST HOOK (with undo support)
// ═══════════════════════════════════════════════════════════════
function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((p) => p.filter((t) => t.id !== id));
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback((msg, type = "success", options = {}) => {
    const id       = Date.now() + Math.random();
    const duration = options.duration ?? 3500;
    const action   = options.action ?? null;
    setToasts((p) => [...p, { id, msg, type, action }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
    return () => dismiss(id);
  }, [dismiss]);

  return { toasts, push, dismiss };
}

function ToastStack({ toasts, dismiss }) {
  return (
    <div className="ep-toast-stack" aria-live="polite">
      {toasts.map((t) => (
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
// SKELETON
// ═══════════════════════════════════════════════════════════════
function SkeletonCard({ lines = 3 }) {
  return (
    <div className="ep-card ep-skeleton-card" aria-hidden="true">
      <div className="ep-card-head"><div className="ep-skel ep-skel--title"/></div>
      <div className="ep-card-body">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="ep-field">
            <div className="ep-skel ep-skel--label"/>
            <div className="ep-skel ep-skel--input"/>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonPage() {
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
          <div className="ep-card-head"><div className="ep-skel ep-skel--title"/></div>
          <div className="ep-card-body ep-skeleton-avatar-body">
            <div className="ep-skel ep-skel--avatar-circle"/>
            <div className="ep-skel ep-skel--avatar-btn"/>
          </div>
        </div>
        <SkeletonCard lines={4}/>
        <SkeletonCard lines={2}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DISCARD MODAL
// ═══════════════════════════════════════════════════════════════
function DiscardModal({ onConfirm, onCancel }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="ep-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="discard-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ep-modal">
        <div className="ep-modal-icon ep-modal-icon--warn"><Ic.warning/></div>
        <h3 id="discard-title" className="ep-modal-title">Discard Changes?</h3>
        <p className="ep-modal-body">
          You have unsaved changes. If you discard now, your edits will be lost permanently.
        </p>
        <div className="ep-modal-actions">
          <button className="ep-modal-btn ep-modal-btn--secondary" onClick={onCancel} type="button">Keep Editing</button>
          <button className="ep-modal-btn ep-modal-btn--danger" onClick={onConfirm} type="button">Discard Changes</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD RETRY MODAL (shows preview)
// ═══════════════════════════════════════════════════════════════
function UploadRetryModal({ target, errorMsg, previewUrl, onRetry, onCancel }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="ep-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="retry-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ep-modal">
        {previewUrl && (
          <div className="ep-retry-preview">
            <img src={previewUrl} alt="Failed upload preview"
              className={`ep-retry-preview-img ${target === "profile" ? "ep-retry-preview-img--circle" : ""}`}/>
          </div>
        )}
        <div className="ep-modal-icon ep-modal-icon--error">❌</div>
        <h3 id="retry-title" className="ep-modal-title">Upload Failed</h3>
        <p className="ep-modal-body">
          {errorMsg || `We couldn't upload your ${target === "profile" ? "profile photo" : "store logo"}. Would you like to try again?`}
        </p>
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
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const [pos, setPos]           = useState({ x: 0, y: 0 });
  const [scale, setScale]       = useState(1);
  const [dragging, setDragging] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const SIZE = 240, OUTPUT = 400;

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const s = Math.max(SIZE / img.width, SIZE / img.height) * 1.2;
      setScale(s);
      setPos({ x: (SIZE - img.width * s) / 2, y: (SIZE - img.height * s) / 2 });
      setImgReady(true);
    };
    img.src = src;
  }, [src]);

  const onPointerDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onPointerUp = () => setDragging(false);
  const onWheel = (e) => {
    e.preventDefault();
    setScale((s) => Math.max(0.2, Math.min(5, s - e.deltaY * 0.001)));
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d"), ratio = OUTPUT / SIZE;
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(
      imgRef.current,
      pos.x * ratio, pos.y * ratio,
      imgRef.current.width * scale * ratio,
      imgRef.current.height * scale * ratio
    );
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.9);
  };

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label="Adjust photo"
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="crop-modal">
        <div className="crop-header">
          <h3 className="crop-title">Adjust Photo</h3>
          <p className="crop-hint">Drag to position · Scroll to zoom</p>
        </div>
        <div className="crop-viewport" style={{ width: SIZE, height: SIZE }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onWheel={onWheel}>
          <div className={`crop-mask crop-mask--${shape}`}/>
          {imgReady && (
            <img src={src} alt="" aria-hidden="true" className="crop-image" draggable={false}
              style={{ transform: `translate(${pos.x}px,${pos.y}px) scale(${scale})`, transformOrigin: "0 0" }}/>
          )}
        </div>
        <div className="crop-zoom-row">
          <span className="crop-zoom-label" aria-hidden="true">🔍</span>
          <input type="range" className="crop-zoom-slider" aria-label="Zoom"
            min="0.2" max="3" step="0.01" value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}/>
        </div>
        <div className="crop-actions">
          <button className="crop-btn crop-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="crop-btn crop-btn--save" onClick={confirm}><Ic.crop/> Save</button>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }}/>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// UPLOAD PROGRESS
// ═══════════════════════════════════════════════════════════════
function UploadProgress({ progress, phase }) {
  const label =
    phase === "saving"      ? "Saving…" :
    phase === "processing"  ? "Processing…" :
    `Uploading… ${progress}%`;
  return (
    <div className="ep-upload-progress" role="status" aria-live="polite" aria-label={label}>
      <div className="ep-upload-progress-bar">
        <div className={`ep-upload-progress-fill ${phase !== "uploading" ? "ep-upload-progress-fill--indeterminate" : ""}`}
          style={phase === "uploading" ? { width: `${progress}%` } : undefined}/>
      </div>
      <span className="ep-upload-progress-label">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DROP ZONE (desktop drag-and-drop)
// ═══════════════════════════════════════════════════════════════
function DropZone({ onFileDrop, disabled, children }) {
  const [over, setOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (!disabled) setOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setOver(false);
    if (disabled) return;
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) onFileDrop(file);
  }, [disabled, onFileDrop]);

  return (
    <div className={`ep-dropzone ${over ? "ep-dropzone--over" : ""}`}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      role="region" aria-label="Drop image here">
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
const AvatarPicker = memo(function AvatarPicker({
  current, preview, name, uploading, uploadProgress, uploadPhase,
  shape = "circle", onPickFile, onRemove, label = "Change Photo",
}) {
  const fileRef     = useRef(null);
  const src         = preview || current;
  const isUploading = !!uploading;

  return (
    <DropZone onFileDrop={onPickFile} disabled={isUploading}>
      <div className="ep-avatar-section">
        <div className={`ep-avatar-wrap ep-avatar-wrap--${shape}`}>
          {src ? (
            <img src={src} alt="Profile photo" className="ep-avatar-img"
              onError={(e) => { e.currentTarget.style.display = "none"; }}/>
          ) : (
            <div className="ep-avatar-letter" aria-label={`Avatar for ${name || "user"}`}>
              {(name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <button className="ep-avatar-camera" onClick={() => fileRef.current?.click()}
            disabled={isUploading} aria-label={label} type="button">
            {isUploading ? <span className="ep-spinner ep-spinner--sm" aria-hidden="true"/> : <Ic.camera/>}
          </button>
        </div>

        {isUploading && <UploadProgress progress={uploadProgress} phase={uploadPhase}/>}

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }} aria-hidden="true"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }}/>

        <div className="ep-avatar-btns">
          <button className="ep-avatar-btn ep-avatar-btn--change"
            onClick={() => fileRef.current?.click()} disabled={isUploading} type="button">
            {isUploading ? "Uploading…" : label}
          </button>
          {(preview || current) && !isUploading && (
            <button className="ep-avatar-btn ep-avatar-btn--remove" onClick={onRemove} type="button">
              Remove
            </button>
          )}
        </div>
        <p className="ep-avatar-hint" id="avatar-hint">
          JPG, PNG or WebP · max 5 MB · min 100×100 px
          <span className="ep-avatar-hint-drag"> · or drag & drop</span>
        </p>
      </div>
    </DropZone>
  );
});

// ═══════════════════════════════════════════════════════════════
// FIELD (aria-invalid + aria-describedby)
// ═══════════════════════════════════════════════════════════════
const Field = memo(function Field({ label, hint, error, required, id, children }) {
  const hintId  = hint  ? `${id}-hint`  : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const child    = Array.isArray(children) ? children : [children];
  const enhanced = child.map((c, i) => {
    if (!c || typeof c !== "object" || i > 0) return c;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
    return { ...c, props: { ...c.props,
      "aria-invalid": error ? "true" : undefined,
      "aria-describedby": describedBy,
      "aria-required": required ? "true" : undefined,
    }};
  });

  return (
    <div className="ep-field">
      {label && (
        <label className="ep-label" htmlFor={id}>
          {label}
          {required && <span className="ep-required" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {enhanced}
      {hint  && !error && <p className="ep-hint"     id={hintId}>{hint}</p>}
      {error &&           <p className="ep-error-msg" id={errorId} role="alert">{error}</p>}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// EMAIL FIELD
// ═══════════════════════════════════════════════════════════════
function EmailField({ email, verified, onVerifyClick }) {
  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="email">Email Address</label>
      <div className="ep-email-row">
        <input id="email" className="ep-input ep-input--disabled" type="email"
          value={email || ""} disabled readOnly aria-describedby="email-status"/>
        <div className="ep-email-badge-wrap">
          {verified ? (
            <span id="email-status" className="ep-email-badge ep-email-badge--verified">
              <Ic.verified/> Verified
            </span>
          ) : (
            <button id="email-status" className="ep-email-badge ep-email-badge--unverified"
              onClick={onVerifyClick} type="button" aria-label="Verify your email address">
              Verify Email →
            </button>
          )}
        </div>
      </div>
      <p className="ep-hint">{verified ? "Your email is verified." : "Verify your email to unlock full access."}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERNAME FIELD (cached availability + live suggestions)
// ═══════════════════════════════════════════════════════════════
const usernameCache = new Map();

function UsernameField({ value, originalUsername, onChange, error }) {
  const [status, setStatus]           = useState("idle");
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const [copied, setCopied]           = useState(false);

  const generateSuggestions = useCallback((base) => {
    const suffixes = [
      Math.floor(Math.random() * 999),
      Math.floor(Math.random() * 99),
      new Date().getFullYear().toString().slice(2),
      "_ng",
      `${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}`,
    ];
    return suffixes
      .map((s) => `${base}${s}`)
      .filter((u) => u.length <= 20 && u !== base)
      .slice(0, 3);
  }, []);

  useEffect(() => {
    setSuggestions([]);
    if (!value || value === originalUsername) { setStatus("idle"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(value))    { setStatus("idle"); return; }

    if (usernameCache.has(value)) {
      const cached = usernameCache.get(value);
      setStatus(cached);
      if (cached === "taken") setSuggestions(generateSuggestions(value));
      return;
    }

    setStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/check-username", { params: { username: value } });
        const result = data.available ? "available" : "taken";
        usernameCache.set(value, result);
        setStatus(result);
        if (result === "taken") setSuggestions(generateSuggestions(value));
      } catch (err) {
        if (err.response?.status === 409) {
          usernameCache.set(value, "taken");
          setStatus("taken");
          setSuggestions(generateSuggestions(value));
        } else {
          setStatus("error");
        }
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, originalUsername, generateSuggestions]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/seller/${value}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const statusEl = useMemo(() => {
    if (value === originalUsername || !value) return null;
    const map = {
      checking:  { cls: "checking",  icon: <span className="ep-spinner ep-spinner--xs" aria-hidden="true"/>, text: "Checking…" },
      available: { cls: "available", icon: "✓", text: "Available" },
      taken:     { cls: "taken",     icon: "✗", text: "Username already taken" },
      error:     { cls: "error",     icon: "⚠", text: "Could not check — try again" },
    };
    const s = map[status];
    if (!s) return null;
    return (
      <span id="username-status" className={`ep-username-status ep-username-status--${s.cls}`}
        role="status" aria-live="polite">{s.icon} {s.text}</span>
    );
  }, [status, value, originalUsername]);

  return (
    <div className="ep-field">
      <label className="ep-label" htmlFor="username">Username</label>
      <div className="ep-prefix-wrap">
        <span className="ep-prefix" aria-hidden="true">@</span>
        <input id="username" className="ep-input ep-input--prefixed" type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
          placeholder="yourusername" maxLength={20} autoCapitalize="none" autoCorrect="off"
          aria-invalid={error || status === "taken" ? "true" : undefined}
          aria-describedby={["username-status", error ? "username-error" : ""].filter(Boolean).join(" ")}/>
      </div>

      {statusEl}

      {status === "taken" && suggestions.length > 0 && (
        <div className="ep-username-suggestions" role="group" aria-label="Username suggestions">
          <span className="ep-username-suggestions-label">Try:</span>
          {suggestions.map((s) => (
            <button key={s} type="button" className="ep-username-suggestion-btn"
              onClick={() => onChange(s)}>
              @{s}
            </button>
          ))}
        </div>
      )}

      {error && <p id="username-error" className="ep-error-msg" role="alert">{error}</p>}

      {value && (
        <div className="ep-url-row">
          <span className="ep-url-text">loemart.com/seller/<strong>{value}</strong></span>
          <button className="ep-url-copy" onClick={copyUrl} type="button" aria-label="Copy profile URL">
            {copied ? <span className="ep-url-copied">✔ Copied</span> : <Ic.copy/>}
          </button>
        </div>
      )}
      <p className="ep-hint">3–20 characters · letters, numbers, underscores only</p>
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
      <input id="phone" className="ep-input" type="tel" inputMode="tel"
        value={value} onChange={(e) => onChange(formatNigerianPhone(e.target.value))}
        placeholder="0803 123 4567" maxLength={18}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "phone-error" : "phone-hint"}/>
      {!error && <p className="ep-hint" id="phone-hint">Format: 0803 123 4567 · Not shown publicly</p>}
      {error  && <p className="ep-error-msg" id="phone-error" role="alert">{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS HOURS
// ═══════════════════════════════════════════════════════════════
function BusinessHoursEditor({ hours, onChange }) {
  const dayLabel = (d) => d.charAt(0).toUpperCase() + d.slice(1);
  const toggle = (day) => {
    const d = hours[day];
    onChange(day, d?.isOpen
      ? { open: "", close: "", isOpen: false }
      : { open: "09:00", close: "17:00", isOpen: true });
  };
  return (
    <div className="ep-hours">
      {DAYS.map((day) => {
        const d = hours[day] || { open: "", close: "", isOpen: false };
        return (
          <div key={day} className="ep-hours-row">
            <label className="ep-hours-toggle-wrap">
              <span className={`ep-hours-dot ${d.isOpen ? "ep-hours-dot--on" : ""}`}
                role="switch" aria-checked={d.isOpen} aria-label={`${dayLabel(day)} open`}
                tabIndex={0} onClick={() => toggle(day)}
                onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggle(day)}/>
              <span className="ep-hours-day-label">{dayLabel(day)}</span>
            </label>
            {d.isOpen ? (
              <div className="ep-hours-times">
                <select className="ep-hours-select" aria-label={`${dayLabel(day)} opening time`}
                  value={d.open} onChange={(e) => onChange(day, { ...d, open: e.target.value })}>
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="ep-hours-to" aria-hidden="true">to</span>
                <select className="ep-hours-select" aria-label={`${dayLabel(day)} closing time`}
                  value={d.close} onChange={(e) => onChange(day, { ...d, close: e.target.value })}>
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ) : (
              <span className="ep-hours-closed" aria-label={`${dayLabel(day)} closed`}>Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SAVE FLASH HOOK
// ═══════════════════════════════════════════════════════════════
function useSaveButton() {
  const [savedFlash, setSavedFlash] = useState(false);
  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, []);
  return { savedFlash, flashSaved };
}

// ═══════════════════════════════════════════════════════════════
// UNSAVED BANNER
// ═══════════════════════════════════════════════════════════════
function UnsavedBanner({ onSave, onDiscard, saving, uploading, savedFlash, isSaveDisabled }) {
  return (
    <div className="ep-unsaved" role="status">
      <span className="ep-unsaved-dot" aria-hidden="true"/>
      <span className="ep-unsaved-text">Unsaved changes</span>
      <button className="ep-unsaved-discard" onClick={onDiscard} type="button"
        disabled={saving || !!uploading}>Discard</button>
      <button className={`ep-unsaved-save ${savedFlash ? "ep-unsaved-save--flash" : ""}`}
        onClick={onSave} disabled={isSaveDisabled} type="button"
        aria-label={saving ? "Saving changes" : "Save changes"}>
        {saving ? <span className="ep-spinner ep-spinner--sm ep-spinner--white" aria-hidden="true"/>
          : savedFlash ? "✔ Saved" : "Save Changes"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION CARD
// ═══════════════════════════════════════════════════════════════
function SectionCard({ title, sub, children }) {
  return (
    <div className="ep-card">
      {(title || sub) && (
        <div className="ep-card-head">
          {title && <h3 className="ep-card-title">{title}</h3>}
          {sub   && <p className="ep-card-sub">{sub}</p>}
        </div>
      )}
      <div className="ep-card-body">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: PERSONAL
// ═══════════════════════════════════════════════════════════════
function TabPersonal({
  form, errors, onChange,
  profilePreview, uploading, uploadProgress, uploadPhase,
  onPickProfilePhoto, onRemoveProfilePhoto, onVerifyEmail,
  stateDropdownOpen, setStateDropdownOpen,
  cityDropdownOpen, setCityDropdownOpen,
  originalUsername,
}) {
  const cities = getCitiesByState(form.location_state);
  return (
    <div className="ep-tab-content">
      <SectionCard title="Profile Photo">
        <AvatarPicker current={form.profile_image} preview={profilePreview} name={form.name}
          uploading={uploading === "profile" ? uploading : ""} uploadProgress={uploadProgress}
          uploadPhase={uploadPhase} shape="circle" onPickFile={onPickProfilePhoto}
          onRemove={onRemoveProfilePhoto} label="Change Photo"/>
      </SectionCard>

      <SectionCard title="Basic Information">
        <Field label="Full Name" id="name" required error={errors.name}>
          <input id="name" className="ep-input" type="text" value={form.name}
            onChange={(e) => onChange("name", e.target.value)} placeholder="e.g. Chidi Okafor" maxLength={60}/>
        </Field>

        <UsernameField value={form.username} originalUsername={originalUsername}
          onChange={(v) => onChange("username", v)} error={errors.username}/>

        <EmailField email={form.email} verified={form.email_verified} onVerifyClick={onVerifyEmail}/>

        <PhoneField value={form.phone} onChange={(v) => onChange("phone", v)} error={errors.phone}/>

        <Field label="About You" id="bio" hint={`${form.bio?.length || 0} / ${MAX_BIO}`} error={errors.bio}>
          <textarea id="bio" className="ep-textarea" value={form.bio}
            onChange={(e) => onChange("bio", e.target.value)}
            placeholder="Tell buyers about yourself…" maxLength={MAX_BIO} rows={3}/>
        </Field>
      </SectionCard>

      <SectionCard title="Your Location" sub="Helps buyers find local sellers">
        <Field label="State" id="location_state" error={errors.location_state}>
          <button type="button" id="location_state" className="ep-dropdown-trigger"
            onClick={() => setStateDropdownOpen(true)} aria-haspopup="listbox" aria-expanded={stateDropdownOpen}
            aria-label={`State: ${form.location_state || "not selected"}`}>
            <span className={form.location_state ? "" : "ep-placeholder"}>{form.location_state || "Select state"}</span>
            <span className="ep-dropdown-arrow" aria-hidden="true">▾</span>
          </button>
          <DropdownModal open={stateDropdownOpen} onClose={() => setStateDropdownOpen(false)}
            title="Select State"
            items={STATES.map((s) => ({ label: s, value: s, selected: s === form.location_state }))}
            onSelect={(val) => { onChange("location_state", val); onChange("location_city", ""); setStateDropdownOpen(false); }}
            searchable/>
        </Field>

        <Field label="City / LGA" id="location_city" error={errors.location_city}>
          {cities.length > 0 ? (
            <>
              <button type="button" id="location_city" className="ep-dropdown-trigger"
                onClick={() => setCityDropdownOpen(true)} aria-haspopup="listbox" aria-expanded={cityDropdownOpen}
                aria-label={`City: ${form.location_city || "not selected"}`}>
                <span className={form.location_city ? "" : "ep-placeholder"}>{form.location_city || "Select city"}</span>
                <span className="ep-dropdown-arrow" aria-hidden="true">▾</span>
              </button>
              <DropdownModal open={cityDropdownOpen} onClose={() => setCityDropdownOpen(false)}
                title="Select City / LGA"
                items={cities.map((c) => ({ label: c, value: c, selected: c === form.location_city }))}
                onSelect={(val) => { onChange("location_city", val); setCityDropdownOpen(false); }}
                searchable/>
            </>
          ) : (
            <input id="location_city" className="ep-input" type="text" value={form.location_city}
              onChange={(e) => onChange("location_city", e.target.value)}
              placeholder="Enter your city or LGA" maxLength={60}/>
          )}
        </Field>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: STORE
// ═══════════════════════════════════════════════════════════════
function TabStore({
  form, errors, onChange,
  storePreview, uploading, uploadProgress, uploadPhase,
  onPickStoreLogo, onRemoveStoreLogo,
  categoryDropdownOpen, setCategoryDropdownOpen,
}) {
  return (
    <div className="ep-tab-content">
      <SectionCard title="Store Logo">
        <AvatarPicker current={form.store_logo} preview={storePreview} name={form.store_name}
          uploading={uploading === "store" ? uploading : ""} uploadProgress={uploadProgress}
          uploadPhase={uploadPhase} shape="square" onPickFile={onPickStoreLogo}
          onRemove={onRemoveStoreLogo} label="Change Logo"/>
      </SectionCard>

      <SectionCard title="Store Details">
        <Field label="Store Name" id="store_name" required error={errors.store_name}
          hint="Your public brand name on Loemart">
          <input id="store_name" className="ep-input" type="text" value={form.store_name}
            onChange={(e) => onChange("store_name", e.target.value)}
            placeholder="e.g. Chidi's Electronics" maxLength={60}/>
        </Field>

        <Field label="Store Description" id="store_description"
          hint={`${form.store_description?.length || 0} / ${MAX_STORE_DESC}`} error={errors.store_description}>
          <textarea id="store_description" className="ep-textarea" value={form.store_description}
            onChange={(e) => onChange("store_description", e.target.value)}
            placeholder="What do you sell? What makes your store special?" maxLength={MAX_STORE_DESC} rows={4}/>
        </Field>

        <Field label="Store Category" id="store_category">
          <button type="button" id="store_category" className="ep-dropdown-trigger"
            onClick={() => setCategoryDropdownOpen(true)} aria-haspopup="listbox"
            aria-expanded={categoryDropdownOpen}
            aria-label={`Category: ${form.store_category || "not selected"}`}>
            <span className={form.store_category ? "" : "ep-placeholder"}>
              {form.store_category || "Choose a category"}</span>
            <span className="ep-dropdown-arrow" aria-hidden="true">▾</span>
          </button>
          <DropdownModal open={categoryDropdownOpen} onClose={() => setCategoryDropdownOpen(false)}
            title="Store Category"
            items={STORE_CATEGORIES.map((c) => ({ label: c, value: c, selected: c === form.store_category }))}
            onSelect={(val) => { onChange("store_category", val); setCategoryDropdownOpen(false); }}/>
        </Field>
      </SectionCard>

      <SectionCard title="Business Hours" sub="Let buyers know when you're available">
        <BusinessHoursEditor hours={form.business_hours || {}}
          onChange={(day, val) => onChange("business_hours", { ...(form.business_hours || {}), [day]: val })}/>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function EditProfile() {
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToast();
  const { savedFlash, flashSaved } = useSaveButton();

  // Double-save guard
  const savingRef = useRef(false);

  // Tab
  const [activeTab, setActiveTab] = useState("personal");

  // Form state
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState({
    name: "", username: "", email: "", email_verified: false,
    phone: "", bio: "", profile_image: "", store_logo: "",
    location_state: "", location_city: "",
    store_name: "", store_description: "", store_category: "",
    business_hours: {},
  });
  const [errors, setErrors] = useState({});
  const [dirty, setDirty]   = useState(false);

  // Images
  const [profilePreview, setProfilePreview] = useState("");
  const [storePreview, setStorePreview]     = useState("");
  const [uploading, setUploading]           = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase]       = useState("uploading");

  // Retry (preserves preview)
  const [failedUpload, setFailedUpload]     = useState(null);
  const [showRetryModal, setShowRetryModal] = useState(false);

  // Crop
  const [cropSrc, setCropSrc]       = useState(null);
  const [cropTarget, setCropTarget] = useState("");

  // UI
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Discard modal
  const [showDiscardModal, setShowDiscardModal]         = useState(false);
  const [pendingDiscardAction, setPendingDiscardAction] = useState(null);

  // Dropdowns
  const [stateDropdownOpen, setStateDropdownOpen]       = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen]         = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Object URL cleanup
  const objectUrlsRef = useRef([]);

  const createPreviewUrl = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  }, []);

  const revokePreviewUrl = useCallback((url) => {
    if (!url || !url.startsWith("blob:")) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== url);
  }, []);

  useEffect(() => {
    return () => { objectUrlsRef.current.forEach(URL.revokeObjectURL); };
  }, []);

  // ── Fetch profile from /api/edit-profile/me
  useEffect(() => {
    if (!getToken()) { navigate("/auth"); return; }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/me");

        // Backend formatProfile() returns phone (not phone_number)
        // and location: { state, city }
        const initial = {
          name:              data.name              || "",
          username:          data.username           || "",
          email:             data.email              || "",
          email_verified:    data.email_verified     ?? false,
          phone:             data.phone ? formatNigerianPhone(data.phone) : "",
          bio:               data.bio                || "",
          profile_image:     data.profile_image      || "",
          store_logo:        data.store_logo         || "",
          location_state:    data.location?.state    || data.location_state || "",
          location_city:     data.location?.city     || data.location_city  || "",
          store_name:        data.store_name         || "",
          store_description: data.store_description  || "",
          store_category:    data.store_category     || "",
          business_hours:    data.business_hours     || {},
        };

        setOriginal(initial);

        const draft = loadDraft();
        if (draft) {
          setForm({ ...initial, ...draft });
          setHasDraft(true);
          setDirty(true);
        } else {
          setForm(initial);
        }
      } catch (err) {
        if (err.response?.status === 401) navigate("/auth");
        else push(classifyError(err), "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, push]);

  // ── onChange (debounced draft)
  const onChange = useCallback((key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (["bio", "store_description", "store_name", "name", "phone", "username"].includes(key)) {
        saveDraftDebounced({ [key]: value });
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setDirty(true);
  }, []);

  const dismissDraft = useCallback(() => {
    clearDraft(); setForm(original); setHasDraft(false); setDirty(false);
  }, [original]);

  // ── Image pick → validate → compress → crop
  const pickImage = useCallback(async (file, target) => {
    if (file.size > MAX_FILE) { push("Image must be under 5 MB.", "error"); return; }
    try { await validateImageDimensions(file); }
    catch (err) { push(err.message, "error"); return; }
    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = (e) => { setCropSrc(e.target.result); setCropTarget(target); };
    reader.readAsDataURL(compressed);
  }, [push]);

  // ── Upload core (R2 via /api/edit-profile/upload/image)
  const performUpload = useCallback(async (blob, target, existingPreviewUrl) => {
    setUploading(target);
    setUploadProgress(0);
    setUploadPhase("uploading");

    const previewUrl = existingPreviewUrl || createPreviewUrl(blob);

    if (target === "profile") {
      setProfilePreview((old) => { if (old !== previewUrl) revokePreviewUrl(old); return previewUrl; });
    } else {
      setStorePreview((old) => { if (old !== previewUrl) revokePreviewUrl(old); return previewUrl; });
    }

    try {
      const fd = new FormData();
      fd.append("image", blob, "avatar.jpg");

      // Send old URL so backend can clean up R2
      const oldUrl = target === "profile" ? form.profile_image : form.store_logo;
      if (oldUrl) fd.append("old_url", oldUrl);

      const { data } = await api.post("/upload/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(pct);
            if (pct === 100) setUploadPhase("processing");
          }
        },
      });

      setUploadPhase("saving");
      const url = data.url;
      if (!url) throw new Error("No URL returned from server.");

      onChange(target === "profile" ? "profile_image" : "store_logo", url);
      setFailedUpload(null);
      push("Photo uploaded ✔");
    } catch (err) {
      const msg = classifyError(err, "upload");
      // Keep preview for retry
      setFailedUpload({ blob, target, errorMsg: msg, previewUrl });
      setShowRetryModal(true);
      if (target === "profile") setProfilePreview("");
      else                      setStorePreview("");
    } finally {
      setUploading("");
      setUploadProgress(0);
      setUploadPhase("uploading");
    }
  }, [createPreviewUrl, revokePreviewUrl, onChange, push, form.profile_image, form.store_logo]);

  const onCropConfirm = useCallback(async (blob) => {
    setCropSrc(null);
    await performUpload(blob, cropTarget, null);
  }, [cropTarget, performUpload]);

  const handleRetryUpload = useCallback(async () => {
    setShowRetryModal(false);
    if (!failedUpload) return;
    await performUpload(failedUpload.blob, failedUpload.target, failedUpload.previewUrl);
  }, [failedUpload, performUpload]);

  const cancelRetry = useCallback(() => {
    setShowRetryModal(false);
    if (failedUpload?.previewUrl) revokePreviewUrl(failedUpload.previewUrl);
    setFailedUpload(null);
  }, [failedUpload, revokePreviewUrl]);

  // ── Remove image (undo for 5s)
  const removeProfilePhoto = useCallback(() => {
    const savedUrl = form.profile_image;
    const savedPreview = profilePreview;
    revokePreviewUrl(profilePreview);
    setProfilePreview("");
    onChange("profile_image", "");
    push("Profile photo removed.", "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => { setProfilePreview(savedPreview); onChange("profile_image", savedUrl); },
      },
    });
  }, [form.profile_image, profilePreview, revokePreviewUrl, onChange, push]);

  const removeStoreLogo = useCallback(() => {
    const savedUrl = form.store_logo;
    const savedPreview = storePreview;
    revokePreviewUrl(storePreview);
    setStorePreview("");
    onChange("store_logo", "");
    push("Store logo removed.", "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => { setStorePreview(savedPreview); onChange("store_logo", savedUrl); },
      },
    });
  }, [form.store_logo, storePreview, revokePreviewUrl, onChange, push]);

  // ── Validate
  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim())                 e.name = "Name is required";
    else if (form.name.trim().length < 2)  e.name = "At least 2 characters";
    if (form.username && !/^[a-z0-9_]{3,20}$/.test(form.username))
      e.username = "3–20 chars: letters, numbers, underscores";
    const rawPhone = unformatPhone(form.phone);
    if (rawPhone && !/^\+?\d{7,15}$/.test(rawPhone))
      e.phone = "Enter a valid phone number";
    if ((form.bio?.length || 0) > MAX_BIO)
      e.bio = `Max ${MAX_BIO} characters`;
    if ((form.store_description?.length || 0) > MAX_STORE_DESC)
      e.store_description = `Max ${MAX_STORE_DESC} characters`;
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  // ── Changed fields (maps to backend expected shape)
  const getChangedFields = useCallback(() => {
    if (!original) return {};
    const changed = {};

    for (const key of Object.keys(form)) {
      if (key === "email" || key === "email_verified") continue;

      const ov = key === "phone" ? unformatPhone(original[key] || "") : JSON.stringify(original[key]);
      const cv = key === "phone" ? unformatPhone(form[key] || "")    : JSON.stringify(form[key]);

      if (ov !== cv) {
        // Map phone to unformatted for API
        if (key === "phone") {
          changed.phone = unformatPhone(form[key]);
        }
        // Map location_state/city to nested location object
        else if (key === "location_state" || key === "location_city") {
          // Only set location once
          if (!changed.location) {
            changed.location = {
              state: form.location_state,
              city:  form.location_city,
            };
          }
        } else {
          changed[key] = form[key];
        }
      }
    }

    // Remove the flat keys — backend expects location: { state, city }
    delete changed.location_state;
    delete changed.location_city;

    return changed;
  }, [form, original]);

  // ── Username blocking
  const isUsernameBlocking = useMemo(() => {
    if (!form.username || form.username === original?.username) return false;
    const cached = usernameCache.get(form.username);
    return !cached || cached === "taken";
  }, [form.username, original?.username]);

  const isSaveDisabled = saving || !!uploading || !dirty || isUsernameBlocking;

  // ── Save (PATCH /api/edit-profile/me)
  const saveProfile = useCallback(async () => {
    // Double-save guard
    if (savingRef.current) return;

    if (isUsernameBlocking) {
      push("Please wait for username check to complete.", "error");
      return;
    }
    if (!validate()) {
      push("Please fix the errors below.", "error");
      return;
    }
    const changed = getChangedFields();
    if (Object.keys(changed).length === 0) {
      flashSaved(); setDirty(false); return;
    }

    // Optimistic
    const previousForm     = { ...form };
    const previousOriginal = original ? { ...original } : null;

    savingRef.current = true;
    setSaving(true);
    setDirty(false);
    setOriginal((prev) => ({ ...prev, ...form }));

    try {
      // PATCH /me — backend returns formatProfile shape
      await api.patch("/me", changed, {
        headers: { "Content-Type": "application/json" },
      });

      setProfilePreview((old) => { revokePreviewUrl(old); return ""; });
      setStorePreview((old)   => { revokePreviewUrl(old); return ""; });
      clearDraft();
      setHasDraft(false);
      flashSaved();
    } catch (err) {
      // Rollback
      setForm(previousForm);
      setOriginal(previousOriginal);
      setDirty(true);

      // Handle specific backend errors
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setErrors(serverErrors);
      }

      push(classifyError(err, "save"), "error");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [isUsernameBlocking, validate, getChangedFields, form, original, push, flashSaved, revokePreviewUrl]);

  // ── Discard
  const requestDiscard = useCallback((action) => {
    if (!dirty) { action?.(); return; }
    setPendingDiscardAction(() => action || null);
    setShowDiscardModal(true);
  }, [dirty]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardModal(false);
    if (!original) return;
    setForm(original); setErrors({}); setDirty(false);
    revokePreviewUrl(profilePreview); revokePreviewUrl(storePreview);
    setProfilePreview(""); setStorePreview("");
    clearDraft(); setHasDraft(false);
    pendingDiscardAction?.();
    setPendingDiscardAction(null);
  }, [original, profilePreview, storePreview, revokePreviewUrl, pendingDiscardAction]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardModal(false); setPendingDiscardAction(null);
  }, []);

  // ── Keyboard: Ctrl+S, Escape
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isSaveDisabled) saveProfile();
        return;
      }
      if (e.key === "Escape") {
        setStateDropdownOpen(false);
        setCityDropdownOpen(false);
        setCategoryDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSaveDisabled, saveProfile]);

  // ── beforeunload
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (loading) return <SkeletonPage/>;

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <div className="ep-page">
        <EditHeader
          title="Edit Profile"
          onBack={() => requestDiscard(() => navigate(-1))}
          rightAction={
            <button className="ep-hdr-save ep-hdr-save--desktop-only"
              onClick={saveProfile} disabled={isSaveDisabled} type="button"
              title="Save Changes (Ctrl+S)"
              aria-label={saving ? "Saving…" : "Save Changes"}>
              {saving ? <span className="ep-spinner ep-spinner--sm ep-spinner--white" aria-hidden="true"/>
                : savedFlash ? "✔ Saved" : "Save Changes"}
            </button>
          }
        />

        <div className="ep-tabs" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={activeTab === t.id}
              aria-controls={`tabpanel-${t.id}`} id={`tab-${t.id}`}
              className={`ep-tab${activeTab === t.id ? " ep-tab--active" : ""}`}
              onClick={() => setActiveTab(t.id)} type="button">
              <span className="ep-tab-emoji" aria-hidden="true">{t.emoji}</span>
              <span className="ep-tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        {hasDraft && (
          <div className="ep-draft-banner" role="status">
            <span>📝 Restored unsaved draft</span>
            <button className="ep-draft-dismiss" onClick={dismissDraft} type="button">Dismiss</button>
          </div>
        )}

        {dirty && (
          <UnsavedBanner onSave={saveProfile} onDiscard={() => requestDiscard(null)}
            saving={saving} uploading={uploading} savedFlash={savedFlash} isSaveDisabled={isSaveDisabled}/>
        )}

        {isUsernameBlocking && dirty && (
          <div className="ep-username-block-notice" role="alert">
            ⏳ Waiting for username check before saving…
          </div>
        )}

        <div className="ep-body">
          <div id="tabpanel-personal" role="tabpanel" aria-labelledby="tab-personal"
            hidden={activeTab !== "personal"}>
            <TabPersonal
              form={form} errors={errors} onChange={onChange}
              profilePreview={profilePreview} uploading={uploading}
              uploadProgress={uploadProgress} uploadPhase={uploadPhase}
              onPickProfilePhoto={(f) => pickImage(f, "profile")}
              onRemoveProfilePhoto={removeProfilePhoto}
              onVerifyEmail={() => navigate("/verification")}
              stateDropdownOpen={stateDropdownOpen} setStateDropdownOpen={setStateDropdownOpen}
              cityDropdownOpen={cityDropdownOpen} setCityDropdownOpen={setCityDropdownOpen}
              originalUsername={original?.username || ""}/>
          </div>

          <div id="tabpanel-store" role="tabpanel" aria-labelledby="tab-store"
            hidden={activeTab !== "store"}>
            <TabStore
              form={form} errors={errors} onChange={onChange}
              storePreview={storePreview} uploading={uploading}
              uploadProgress={uploadProgress} uploadPhase={uploadPhase}
              onPickStoreLogo={(f) => pickImage(f, "store")}
              onRemoveStoreLogo={removeStoreLogo}
              categoryDropdownOpen={categoryDropdownOpen}
              setCategoryDropdownOpen={setCategoryDropdownOpen}/>
          </div>
        </div>

        <p className="ep-footer">Loemart Technologies Ltd · © {new Date().getFullYear()}</p>
      </div>

      {cropSrc && (
        <CropModal src={cropSrc} shape={cropTarget === "profile" ? "circle" : "square"}
          onConfirm={onCropConfirm} onCancel={() => setCropSrc(null)}/>
      )}

      {showDiscardModal && (
        <DiscardModal onConfirm={confirmDiscard} onCancel={cancelDiscard}/>
      )}

      {showRetryModal && (
        <UploadRetryModal
          target={failedUpload?.target}
          errorMsg={failedUpload?.errorMsg}
          previewUrl={failedUpload?.previewUrl}
          onRetry={handleRetryUpload}
          onCancel={cancelRetry}/>
      )}

      <ToastStack toasts={toasts} dismiss={dismiss}/>
    </>
  );
}