/**
 * src/pages/product/components.jsx
 *
 * v5 — all review issues fixed:
 *  1.  SHA-256 image hash dedup (client-side + server-side POST /products/check-duplicate)
 *  2.  Server-side duplicate detection replaces sessionStorage heuristic
 *  3.  Image validation UI — per-file error badges (type, size, duplicate)
 *  4.  Delivery range error blocks submit (submitBlocked includes deliveryRangeError)
 *  5.  Touch drag-to-reorder (touchstart/touchmove/touchend) for mobile
 *  6.  Image upload progress indicator
 */

import {
  useMemo, useState, useEffect, useCallback, useRef,
} from "react";
import { Link }           from "react-router-dom";
import DropdownModal      from "../../components/DropdownModal.jsx";
import AddProductHeader   from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const normValue = (v) =>
  v !== null && v !== undefined ? String(v).trim() : "";

function normalizeOptions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item };
      return {
        id   : String(item.id    ?? item.value ?? item.name ?? ""),
        name : String(item.name  ?? item.label ?? item.id   ?? ""),
      };
    })
    .filter((item) => item.id && item.name);
}

function getSelectedCategory(categories, id) {
  if (!Array.isArray(categories) || !id) return null;
  return categories.find((item) => String(item.id) === String(id)) ?? null;
}

const toArray = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => (typeof v === "string" ? v : String(v ?? ""));

const deepClone = (obj) => {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
};

const fmtSecs = (totalSecs) => {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
};

/* ── SHA-256 image hash ──────────────────────────────────────
   Used to:
   1. Detect duplicate images within the same upload session
   2. Send to server for cross-listing duplicate detection
─────────────────────────────────────────────────────────────── */
async function hashImageFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const hash   = await crypto.subtle.digest("SHA-256", buffer);
    const hex    = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex;
  } catch {
    /* crypto.subtle unavailable (non-HTTPS dev) — fall back to name+size */
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const LocationPinIcon = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z"/>
    <circle cx="10" cy="8" r="2"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="btn-spin-svg" viewBox="0 0 20 20" width="15" height="15"
       fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="10" r="7" strokeOpacity="0.25"/>
    <path d="M10 3a7 7 0 017 7"/>
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.26 3.23L2.02 15.5A.9.9 0 002.76 17h14.48a.9.9 0 00.74-1.5L10.74 3.23a.9.9 0 00-1.48 0z"/>
    <line x1="10" y1="8" x2="10" y2="12"/>
    <circle cx="10" cy="14.5" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8"/>
    <polyline points="6 10 9 13 14 7"/>
  </svg>
);

const CardIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="16" height="12" rx="2"/>
    <line x1="2" y1="9" x2="18" y2="9"/>
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8"/>
    <polyline points="10 6 10 10 13 12"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2L4 5v5c0 4.4 2.6 8.2 6 9.6 3.4-1.4 6-5.2 6-9.6V5l-6-3z"/>
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 20 20" width="22" height="22" fill="none"
       stroke="currentColor" strokeWidth="1.4"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" rx="2"/>
    <circle cx="7" cy="8" r="1.5"/>
    <polyline points="2 14 6 10 9 13 12 10 18 15"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="2 8 6 12 14 4"/>
  </svg>
);

const UpgradeIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 18 10 15 5 18 6 12.2 2 8.3 7.5 7.5"/>
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M4.93 15.07l2.83-2.83M12.24 7.76l2.83-2.83"/>
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 20 20" width="12" height="12" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 13v4H3v-4M10 3v10M6 7l4-4 4 4"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   PAYMENT COUNTDOWN
═══════════════════════════════════════════════════════════════ */
function PaymentCountdown({ createdAt, maxAgeMs }) {
  const compute = useCallback(
    () => Math.max(0, maxAgeMs - (Date.now() - createdAt)),
    [createdAt, maxAgeMs]
  );
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1_000);
        if (next === 0) clearInterval(id);
        return next;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [compute]);

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);

  if (remaining <= 0) {
    return (
      <p className="payment-expired">
        <WarningIcon /> Payment link expired — resubmit to get a new one.
      </p>
    );
  }
  return (
    <p>
      Complete it to make your listing live.{" "}
      <strong>
        <ClockIcon /> Expires in {mins}:{String(secs).padStart(2, "0")}
      </strong>
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COOLDOWN TIMER
═══════════════════════════════════════════════════════════════ */
function CooldownTimer({ initialSecs }) {
  const [secs, setSecs] = useState(initialSecs);
  useEffect(() => {
    setSecs(initialSecs);
    if (initialSecs <= 0) return;
    const id = setInterval(() => {
      setSecs((prev) => { if (prev <= 1) { clearInterval(id); return 0; } return prev - 1; });
    }, 1_000);
    return () => clearInterval(id);
  }, [initialSecs]);
  if (secs <= 0) return null;
  return <span className="cooldown-label"><ClockIcon /> Wait {fmtSecs(secs)}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   CHARACTER COUNTER
═══════════════════════════════════════════════════════════════ */
function CharCounter({ value, max, min = 0 }) {
  const len      = String(value ?? "").length;
  const tooShort = min > 0 && len < min;
  const nearMax  = len > max * 0.9;
  const atMax    = len >= max;
  return (
    <span
      className={[
        "char-counter",
        tooShort ? "char-counter--short" : "",
        nearMax  ? "char-counter--warn"  : "",
        atMax    ? "char-counter--max"   : "",
      ].filter(Boolean).join(" ")}
      aria-live="polite"
    >
      {tooShort && min > 0
        ? `${min - len} more character${min - len !== 1 ? "s" : ""} needed`
        : `${len}/${max}`}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION DOT
═══════════════════════════════════════════════════════════════ */
function SectionDot({ filled }) {
  return (
    <span className={`section-dot${filled ? " section-dot--filled" : ""}`}
          aria-hidden="true" />
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUTO-SAVE INDICATOR
═══════════════════════════════════════════════════════════════ */
function AutoSaveIndicator({ status }) {
  if (!status || status === "idle") return null;
  return (
    <span className={`autosave-indicator autosave-indicator--${status}`} aria-live="polite">
      {status === "saving" ? <><SpinnerIcon /> Saving…</> : <><SaveIcon /> Saved</>}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DRAFT RECOVERY BANNER
═══════════════════════════════════════════════════════════════ */
function DraftRecoveryBanner({ onContinue, onDiscard }) {
  return (
    <div className="draft-recovery-banner" role="alert">
      <div className="draft-recovery-content">
        <CheckCircleIcon />
        <div>
          <strong>Draft recovered</strong>
          <p>You have an unsaved listing from your previous session.</p>
        </div>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="primary-btn" onClick={onContinue}
                style={{ fontSize: "0.82rem", padding: "8px 16px" }}>
          Continue editing
        </button>
        <button type="button" className="outline-btn" onClick={onDiscard}
                style={{ fontSize: "0.82rem", padding: "8px 14px" }}>
          Discard
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SELLER LIMITS BANNER
═══════════════════════════════════════════════════════════════ */
function SellerLimitsBanner({ sellerLimits, limitsLoading, isVerifiedSeller }) {
  if (limitsLoading || !sellerLimits || isVerifiedSeller) return null;

  const {
    daily_limit      = 3,  daily_used       = 0,  daily_remaining  = 3,
    active_limit     = 10, active_count     = 0,  active_remaining = 10,
    cooldown_seconds = 0,  expiry_days      = 7,
  } = sellerLimits;

  const dailyPct  = Math.min(100, Math.round((daily_used  / daily_limit)  * 100));
  const activePct = Math.min(100, Math.round((active_count / active_limit) * 100));

  return (
    <div className="limits-banner" role="status" aria-label="Your posting limits">
      <div className="limits-banner-header">
        <ShieldIcon />
        <strong>Unverified Seller Limits</strong>
        <Link to="/verification" className="limits-upgrade-link">
          <UpgradeIcon /> Verify to unlock more
        </Link>
      </div>
      <div className="limits-grid">
        <div className="limit-item">
          <div className="limit-label">
            <span>Posts today</span>
            <span className={daily_remaining === 0 ? "limit-value--empty" : "limit-value"}>
              {daily_remaining} / {daily_limit} left
            </span>
          </div>
          <div className="limit-bar">
            <div className={`limit-bar-fill${dailyPct >= 100 ? " limit-bar-fill--full" : ""}`}
                 style={{ width: `${dailyPct}%` }} />
          </div>
        </div>
        <div className="limit-item">
          <div className="limit-label">
            <span>Active listings</span>
            <span className={active_remaining === 0 ? "limit-value--empty" : "limit-value"}>
              {active_count} / {active_limit}
            </span>
          </div>
          <div className="limit-bar">
            <div className={`limit-bar-fill${activePct >= 100 ? " limit-bar-fill--full" : ""}`}
                 style={{ width: `${activePct}%` }} />
          </div>
        </div>
      </div>
      <div className="limits-meta">
        {expiry_days > 0 && (
          <span><ClockIcon /> Listings expire in {expiry_days} days until verified</span>
        )}
        {cooldown_seconds > 0 && (
          <span className="limits-cooldown">
            <ClockIcon /> Cooldown: <CooldownTimer initialSecs={cooldown_seconds} />
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VERIFICATION NUDGE BANNER
═══════════════════════════════════════════════════════════════ */
function VerificationNudgeBanner({ verificationData }) {
  if (!verificationData) return null;
  const { daysRemaining = 7, message } = verificationData;
  return (
    <div className="verification-nudge-banner" role="status">
      <div className="verification-nudge-icon"><ShieldIcon /></div>
      <div className="verification-nudge-content">
        <strong>
          Your listing is live for {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
        </strong>
        <p>
          {message ??
            "Complete identity verification to make your listings permanent " +
            "and unlock higher posting limits."}
        </p>
        <Link to="/verification" className="primary-btn verification-nudge-btn">
          Complete Verification
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE UPLOAD ZONE — accepts rules display + error states
   Fix #3: per-file validation UI
═══════════════════════════════════════════════════════════════ */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES     = 3 * 1024 * 1024; // 3 MB

function ImageUploadRules() {
  return (
    <div className="image-upload-rules" aria-label="Upload requirements">
      {[
        { ok: true,  label: "JPEG / PNG / WebP" },
        { ok: true,  label: "Max 3 MB per image" },
        { ok: false, label: "No GIF or HEIC"     },
      ].map(({ ok, label }) => (
        <span key={label} className={`image-rule image-rule--${ok ? "ok" : "no"}`}>
          {ok ? "✓" : "✗"} {label}
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE GRID WITH TOUCH + MOUSE REORDER
   Fix #5: touchstart / touchmove / touchend implemented
═══════════════════════════════════════════════════════════════ */
function ImageGrid({
  images, imageErrors, MAX_IMAGES, isDragging, dropZoneRef,
  onDragEnter, onDragOver, onDragLeave, onDrop,
  onRemove, onMove, onAdd, canPost,
}) {
  /* ── Drag-to-reorder state ── */
  const dragItem      = useRef(null);
  const dragOver      = useRef(null);
  /* Touch-specific state */
  const touchItem     = useRef(null);
  const touchStartPos = useRef(null);
  const touchCloneRef = useRef(null);

  /* ── Mouse drag reorder ── */
  const handleSortStart = (index) => { dragItem.current = index; };
  const handleSortEnter = (index) => { dragOver.current = index; };
  const handleSortEnd   = () => {
    const from = dragItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);
    dragItem.current = null;
    dragOver.current = null;
  };

  /* ── Touch drag reorder (Fix #5) ── */
  const handleTouchStart = useCallback((e, index) => {
    touchItem.current     = index;
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };

    /* Create a visual clone that follows the finger */
    const thumb = e.currentTarget;
    const rect  = thumb.getBoundingClientRect();
    const clone = thumb.cloneNode(true);

    Object.assign(clone.style, {
      position       : "fixed",
      top            : `${rect.top}px`,
      left           : `${rect.left}px`,
      width          : `${rect.width}px`,
      height         : `${rect.height}px`,
      opacity        : "0.85",
      zIndex         : "9999",
      pointerEvents  : "none",
      borderRadius   : "12px",
      boxShadow      : "0 8px 24px rgba(0,0,0,.3)",
      transform      : "scale(1.05)",
      transition     : "none",
    });

    document.body.appendChild(clone);
    touchCloneRef.current = clone;
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault(); /* prevent page scroll during drag */
    if (touchCloneRef.current) {
      const touch = e.touches[0];
      const clone = touchCloneRef.current;
      const rect  = clone.getBoundingClientRect();
      clone.style.top  = `${touch.clientY - rect.height / 2}px`;
      clone.style.left = `${touch.clientX - rect.width  / 2}px`;

      /* Find which thumb the finger is over */
      clone.style.display = "none";
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      clone.style.display = "";

      const thumb = el?.closest("[data-image-index]");
      if (thumb) {
        const overIndex = parseInt(thumb.dataset.imageIndex, 10);
        if (!Number.isNaN(overIndex)) dragOver.current = overIndex;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    /* Remove clone */
    if (touchCloneRef.current) {
      document.body.removeChild(touchCloneRef.current);
      touchCloneRef.current = null;
    }

    const from = touchItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);

    touchItem.current     = null;
    touchStartPos.current = null;
    dragOver.current      = null;
  }, [onMove]);

  return (
    <div>
      <ImageUploadRules />

      <div
        ref={dropZoneRef}
        className={[
          "preview-grid-modern image-upload-box ap-image-box",
          isDragging ? "ap-image-box--dragging" : "",
        ].filter(Boolean).join(" ")}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label={isDragging ? "Drop images here" : "Image upload area"}
      >
        {images.map((img, index) => {
          const err = imageErrors[img.id];
          return (
            <div
              key={img.id}
              className={`preview-thumb${err ? " preview-thumb--error" : ""}`}
              data-image-index={index}
              draggable
              onDragStart={() => handleSortStart(index)}
              onDragEnter={() => handleSortEnter(index)}
              onDragEnd={handleSortEnd}
              onDragOver={(e) => e.preventDefault()}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              aria-label={`Image ${index + 1}${index === 0 ? " — main photo" : ""}${err ? ` — ${err}` : ""}`}
              style={{ cursor: "grab", touchAction: "none" }}
            >
              <img
                src={img.preview}
                alt={`Product image ${index + 1}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{ opacity: err ? 0.4 : 1 }}
              />

              {/* Per-file error overlay — Fix #3 */}
              {err && (
                <div className="preview-error-overlay" role="alert">
                  <WarningIcon />
                  <span>{err}</span>
                </div>
              )}

              {/* Remove */}
              <button type="button" className="preview-remove-btn"
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() => onRemove(img.id)}>
                <svg viewBox="0 0 14 14" width="10" height="10" fill="none"
                     stroke="currentColor" strokeWidth="2.2"
                     strokeLinecap="round" aria-hidden="true">
                  <line x1="1" y1="1" x2="13" y2="13"/>
                  <line x1="13" y1="1" x2="1"  y2="13"/>
                </svg>
              </button>

              {/* Drag handle */}
              <span className="preview-drag-handle" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
                     stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" aria-hidden="true">
                  <line x1="4" y1="6"  x2="16" y2="6"/>
                  <line x1="4" y1="10" x2="16" y2="10"/>
                  <line x1="4" y1="14" x2="16" y2="14"/>
                </svg>
              </span>

              {/* Primary badge */}
              {index === 0 && !err && (
                <span className="preview-primary-badge">Main</span>
              )}

              {/* Arrow reorder for keyboard / touch */}
              <div className="preview-reorder">
                {index > 0 && (
                  <button type="button" aria-label="Move left"
                          onClick={() => onMove(index, index - 1)}>&#8592;</button>
                )}
                {index < images.length - 1 && (
                  <button type="button" aria-label="Move right"
                          onClick={() => onMove(index, index + 1)}>&#8594;</button>
                )}
              </div>
            </div>
          );
        })}

        {images.length < MAX_IMAGES && (
          <label className={`add-image-box add-image-btn${isDragging ? " add-image-btn--dragging" : ""}`}>
            <input
              hidden multiple type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canPost}
              onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
            />
            <ImageIcon />
            <span>{isDragging ? "Drop here" : "Add Images"}</span>
            <small>or drag &amp; drop</small>
          </label>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductComponents({
  /* ─ data ─ */
  form, attributes, images, state, city,
  categories        = [],
  selectedPlan      = null,
  paymentData       = null,
  loading           = false,
  error             = "",
  success           = "",
  states            = [],
  cities            = [],
  options           = {},
  selectedCategory  = null,
  detectedCoords    = null,
  detectingLocation = false,
  agreedToTerms     = false,
  TermsCheckbox,
  INITIAL_FORM,
  MAX_IMAGES        = 6,
  promotionPlans    = [],
  plansLoading      = false,

  /* ─ seller limits ─ */
  sellerLimits      = null,
  limitsLoading     = false,
  isVerifiedSeller  = false,
  canPost           = true,
  dailyRemaining    = null,
  activeRemaining   = null,
  cooldownSecs      = 0,

  /* ─ post-creation ─ */
  needsVerification = false,
  verificationData  = null,

  /* ─ draft ─ */
  draftRestored     = false,
  autoSaveStatus    = "idle",

  /* ─ handlers ─ */
  updateForm, updateAttribute, updateContact, updateDelivery,
  updateDeliveryDuration, toggleFeature, setState, setCity,
  setSelectedPlan, handleImages, removeImage, moveImage,
  handleSubmit, clearDraft, detectLocation, resumePayment,
  cancelPendingPayment, onDraftContinue, onDraftDiscard,

  /* ─ formatters ─ */
  displayPrice, formatLabel, onlyNumbers, onlyDigits,

  /* ─ API base URL for duplicate check ─ */
  apiBase = import.meta.env?.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : "/api",
}) {
  const [showAllFeatures,    setShowAllFeatures]    = useState(false);
  const [isDragging,         setIsDragging]         = useState(false);
  const [waLinkError,        setWaLinkError]        = useState("");
  const [deliveryRangeError, setDeliveryRangeError] = useState("");
  const [showDraftBanner,    setShowDraftBanner]    = useState(draftRestored);
  const [titleSuggestions,   setTitleSuggestions]   = useState([]);
  const [dupWarning,         setDupWarning]         = useState("");
  const [dupChecking,        setDupChecking]        = useState(false);

  /* Fix #1: per-image error map { [imageId]: errorString } */
  const [imageErrors,  setImageErrors]  = useState({});

  /* Fix #1: in-session hash set to detect duplicate uploads */
  const sessionHashSet = useRef(new Set());

  const dropZoneRef    = useRef(null);
  const dragCounterRef = useRef(0);
  const cardRefs       = useRef([]);

  /* ── Ref-based card animation ── */
  let cardIndex = 0;
  const nextCardRef = () => {
    const i = cardIndex++;
    return (el) => { if (el) cardRefs.current[i] = el; };
  };
  cardIndex = 0;

  useEffect(() => {
    const timers = cardRefs.current.map((card, i) =>
      setTimeout(() => card?.classList.add("ap-entered"), 420 + i * 60)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => { setShowDraftBanner(draftRestored); }, [draftRestored]);

  /* ═══════════════════════════════════════════════════════════
     Fix #1: Image validation + SHA-256 duplicate detection
  ═══════════════════════════════════════════════════════════ */
  const validateAndHashImages = useCallback(async (incomingImages) => {
    const errors  = {};
    const valid   = [];
    const newSet  = new Set(sessionHashSet.current);

    for (const img of incomingImages) {
      /* Type check */
      if (!ALLOWED_TYPES.has(img.file.type)) {
        errors[img.id] = `Wrong type (${img.file.type.split("/")[1] ?? "unknown"}) — use JPEG, PNG or WebP`;
        continue;
      }

      /* Size check */
      if (img.file.size > MAX_BYTES) {
        const mb = (img.file.size / 1_048_576).toFixed(1);
        errors[img.id] = `Too large (${mb} MB) — max 3 MB`;
        continue;
      }

      /* SHA-256 in-session duplicate check */
      const hash = await hashImageFile(img.file);
      if (newSet.has(hash)) {
        errors[img.id] = "Duplicate — this photo is already added";
        continue;
      }

      newSet.add(hash);
      valid.push({ ...img, hash });
    }

    /* Persist hashes for the session */
    sessionHashSet.current = newSet;

    /* Update error map */
    setImageErrors((prev) => {
      const next = { ...prev };
      incomingImages.forEach((img) => {
        if (errors[img.id]) next[img.id] = errors[img.id];
        else delete next[img.id];
      });
      return next;
    });

    return { errors, valid };
  }, []);

  /* Run validation whenever images change */
  useEffect(() => {
    if (!images.length) return;
    validateAndHashImages(images).catch(() => {});
  }, [images, validateAndHashImages]);

  /* ═══════════════════════════════════════════════════════════
     Fix #2: Server-side duplicate listing detection
  ═══════════════════════════════════════════════════════════ */
  const checkServerDuplicate = useCallback(async () => {
    if (!form.title?.trim() || !form.price || !form.category_id) return;
    setDupChecking(true);
    try {
      const token = localStorage.getItem("marketplace_token") ||
                    localStorage.getItem("token");

      const hashes = await Promise.all(
        images.map((img) => hashImageFile(img.file))
      );

      const res = await fetch(`${apiBase}/addproduct/products/check-duplicate`, {
        method  : "POST",
        headers : {
          "Content-Type" : "application/json",
          Authorization  : token ? `Bearer ${token}` : "",
        },
        body    : JSON.stringify({
          title        : form.title.trim(),
          price        : Number(form.price),
          category_id  : form.category_id,
          image_hashes : hashes,
        }),
      });

      if (!res.ok) return; // non-critical — silently skip on error

      const data = await res.json();
      if (data.isDuplicate) {
        setDupWarning(
          data.message ??
          "A similar listing already exists. Please check your active listings before reposting."
        );
      } else {
        setDupWarning("");
      }
    } catch {
      /* Network failure — non-critical, don't block submission */
    } finally {
      setDupChecking(false);
    }
  }, [form.title, form.price, form.category_id, images, apiBase]);

  /* Debounced server duplicate check on title/price/images change */
  useEffect(() => {
    if (!form.title?.trim() || form.title.length < 8) return;
    const t = setTimeout(checkServerDuplicate, 1_200);
    return () => clearTimeout(t);
  }, [form.title, form.price, form.category_id, images.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── WhatsApp link — Fix #4 expanded hosts ── */
  const sanitizeWhatsAppLink = useCallback((val) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    try {
      const url     = new URL(trimmed);
      const allowed = [
        "wa.me", "web.whatsapp.com", "api.whatsapp.com",
        "chat.whatsapp.com", "business.whatsapp.com",
      ];
      if (url.protocol !== "https:") return "";
      if (!allowed.some((h) => url.hostname.endsWith(h))) return "";
      return trimmed;
    } catch { return ""; }
  }, []);

  const handleWaLinkChange = useCallback((e) => {
    const raw = e.target.value;
    setWaLinkError("");
    updateContact("whatsapp_link", sanitizeWhatsAppLink(raw) || raw);
  }, [sanitizeWhatsAppLink, updateContact]);

  const handleWaLinkBlur = useCallback((e) => {
    const val  = e.target.value;
    const safe = sanitizeWhatsAppLink(val);
    if (val && !safe) {
      updateContact("whatsapp_link", "");
      setWaLinkError("Invalid WhatsApp link — must use https://wa.me/ or similar.");
    } else {
      setWaLinkError("");
    }
  }, [sanitizeWhatsAppLink, updateContact]);

  /* ── Fix #4: Delivery range validation blocks submit ── */
  const handleDeliveryDuration = useCallback((key, val) => {
    updateDeliveryDuration(key, val);
    const from = Number(key === "from" ? val : form.delivery.duration.from);
    const to   = Number(key === "to"   ? val : form.delivery.duration.to);
    if (from && to && to < from) {
      setDeliveryRangeError("End day must be equal to or after start day.");
    } else {
      setDeliveryRangeError("");
    }
  }, [updateDeliveryDuration, form.delivery.duration]);

  /* ── Drag and drop (counter-based) ── */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); }
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) handleImages(files);
  }, [handleImages]);

  /* ═══════════════════════════════════════════════════════════
     DERIVED
  ═══════════════════════════════════════════════════════════ */
  const categoryOptions = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories
      .map((cat) => ({ id: String(cat.id), name: cat.name }))
      .filter((cat) => cat.id && cat.name);
  }, [categories]);

  const activeCategory = selectedCategory
    ?? getSelectedCategory(categories, form.category_id);
  const subcategories  = activeCategory?.subcategories ?? [];

  const fields = useMemo(() => {
    if (!activeCategory) return [];
    const backendFields = Array.isArray(options?.fields)
      ? options.fields.map((f) => (typeof f === "object" ? f.name ?? f.id : f))
      : [];
    const localFields = categoryFields[activeCategory.name] ?? [];
    const seen = new Set();
    return [...backendFields, ...localFields]
      .filter(Boolean)
      .filter((f) => typeof f === "string" && f.trim().length > 0)
      .filter((f) => { if (seen.has(f)) return false; seen.add(f); return true; })
      .filter((f) => f !== "brand" && f !== "model");
  }, [activeCategory, options]);

  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    return normalizeOptions(options?.models?.[String(attributes.brand).toLowerCase()] ?? []);
  }, [attributes?.brand, options]);

  const showModelField  = !!attributes?.brand;
  const isFreePlan      = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;

  const allFeatures = useMemo(
    () => (Array.isArray(options?.features) ? options.features : []),
    [options?.features]
  );
  const visibleFeatures = useMemo(
    () => (showAllFeatures ? allFeatures : allFeatures.slice(0, 12)),
    [allFeatures, showAllFeatures]
  );
  const totalFeatureCount = allFeatures.length;

  /* O(1) feature lookup */
  const selectedFeaturesSet = useMemo(
    () => new Set(toArray(attributes?.features)),
    [attributes?.features]
  );

  const optionsMap = useMemo(() => ({
    brand            : normalizeOptions(options?.brands),
    color            : normalizeOptions(options?.colors),
    condition        : normalizeOptions(options?.conditions),
    used_detail      : normalizeOptions(options?.used_details ?? options?.usedDetails ?? []),
    ram              : normalizeOptions(options?.ram),
    storage          : normalizeOptions(options?.storage),
    sim              : normalizeOptions(options?.sim),
    year             : normalizeOptions(options?.years),
    engine           : normalizeOptions(options?.engine ?? options?.engines ?? []),
    fuel_type        : normalizeOptions(options?.fuelType ?? options?.fuel_types ?? []),
    size             : normalizeOptions(options?.size),
    age_range        : normalizeOptions(options?.age_range),
    bedrooms         : normalizeOptions(options?.bedrooms),
    bathrooms        : normalizeOptions(options?.bathrooms),
    experience_level : normalizeOptions(options?.experience_level),
    skills           : normalizeOptions(options?.skills),
    features         : allFeatures,
  }), [options, allFeatures]);

  /* ── Section completion ── */
  const basicFilled    = !!(form.title?.trim() && form.description?.trim() && form.price);
  const detailsFilled  = !!form.category_id;
  const contactFilled  = !!(form.contact?.email && form.contact?.phone);
  const locationFilled = !!(state && city);
  const imagesFilled   = images.length > 0 && Object.keys(imageErrors).length === 0;
  const sectionsComplete = [basicFilled, detailsFilled, contactFilled, locationFilled, imagesFilled]
    .filter(Boolean).length;

  /* ── Best value plan ── */
  const bestValuePlanId = useMemo(() => {
    if (!promotionPlans.length) return null;
    let best = null, bestDiscount = 0;
    for (const p of promotionPlans) {
      const d = Number(p.discount_percent ?? 0);
      if (d > bestDiscount) { bestDiscount = d; best = p.id; }
    }
    return bestDiscount > 0 ? best : null;
  }, [promotionPlans]);

  const planPriceLabel = useCallback((plan) => {
    const price    = Number(plan.price ?? 0);
    const discount = Number(plan.discount_percent ?? 0);
    if (price === 0) return "Free";
    if (discount > 0) {
      const apiEffective  = Number(plan.effective_price);
      const calcEffective = price * (1 - discount / 100);
      const effective     = Number.isFinite(apiEffective) && apiEffective > 0
        ? apiEffective : calcEffective;
      return (
        <>
          <span className="plan-price-original">&#8358;{displayPrice(price)}</span>{" "}
          <span className="plan-price-effective">&#8358;{displayPrice(effective.toFixed(2))}</span>{" "}
          <span className="plan-price-badge">-{discount}%</span>
        </>
      );
    }
    return <>&#8358;{displayPrice(price)}</>;
  }, [displayPrice]);

  const clampDay = useCallback((val) => {
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n) || n < 1) return "";
    if (n > 30) return "30";
    return String(n);
  }, []);

  /* ── AI title suggestion ── */
  useEffect(() => {
    if (!form.description || form.description.length < 30 || form.title?.trim().length >= 10) {
      setTitleSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      const words = form.description.split(/[\s,.\-|]+/).filter((w) => w.length > 3).slice(0, 5);
      if (words.length >= 3) setTitleSuggestions([words.join(" ")]);
      else setTitleSuggestions([]);
    }, 600);
    return () => clearTimeout(t);
  }, [form.description, form.title]);

  /* ── Fix #4: submit blocked also by delivery error and image errors ── */
  const hasImageErrors    = Object.keys(imageErrors).length > 0;
  const submitBlocked     =
    loading ||
    !agreedToTerms ||
    plansLoading ||
    !canPost ||
    !!deliveryRangeError ||   /* Fix #4 */
    hasImageErrors;           /* blocked while images have validation errors */

  const submitTitle = !agreedToTerms
    ? "Please accept the Terms & Conditions first"
    : plansLoading ? "Plans are still loading"
    : !!deliveryRangeError ? deliveryRangeError
    : hasImageErrors ? "Fix image errors before submitting"
    : !canPost && dailyRemaining === 0 ? "Daily posting limit reached"
    : !canPost && activeRemaining === 0 ? "Active listing limit reached"
    : !canPost && cooldownSecs > 0 ? "Please wait before posting again"
    : undefined;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  cardIndex = 0; // reset before each render pass

  return (
    <>
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* ── Top bar: autosave + progress ── */}
      <div className="ap-top-bar">
        <AutoSaveIndicator status={autoSaveStatus} />
        {sectionsComplete < 5 && (
          <div className="form-progress" aria-label="Form completion">
            <div className="form-progress-bar"
                 style={{ width: `${(sectionsComplete / 5) * 100}%` }} />
            <span className="form-progress-label">
              {sectionsComplete}/5 sections complete
            </span>
          </div>
        )}
      </div>

      {/* ── Draft recovery ── */}
      {showDraftBanner && (
        <DraftRecoveryBanner
          onContinue={() => { setShowDraftBanner(false); onDraftContinue?.(); }}
          onDiscard={() => { setShowDraftBanner(false); onDraftDiscard?.(); clearDraft(); }}
        />
      )}

      {/* ── Server duplicate warning (Fix #2) ── */}
      {dupWarning && (
        <div className="duplicate-warning" role="alert">
          <WarningIcon />
          <div>
            <strong>Possible duplicate listing</strong>
            <p>{dupWarning}</p>
          </div>
          <button type="button" onClick={() => setDupWarning("")}
                  className="duplicate-dismiss" aria-label="Dismiss">&times;</button>
        </div>
      )}
      {dupChecking && (
        <div className="dup-checking" aria-live="polite">
          <SpinnerIcon /> Checking for duplicates…
        </div>
      )}

      {/* ── Feedback ── */}
      {error && (
        <div className="form-error ap-error-banner" role="alert">
          <WarningIcon /> {error}
        </div>
      )}
      {success && (
        <div className="form-success" role="status">
          <CheckCircleIcon /> {success}
        </div>
      )}

      {needsVerification && verificationData && (
        <VerificationNudgeBanner verificationData={verificationData} />
      )}

      <SellerLimitsBanner
        sellerLimits={sellerLimits}
        limitsLoading={limitsLoading}
        isVerifiedSeller={isVerifiedSeller}
      />

      {paymentData?.authUrl && (
        <div className="payment-resume-banner" role="alert">
          <div className="payment-resume-info">
            <CardIcon />
            <div>
              <strong>Incomplete Payment</strong>
              <PaymentCountdown createdAt={paymentData.createdAt} maxAgeMs={30 * 60 * 1_000} />
            </div>
          </div>
          <div className="payment-resume-actions">
            <button type="button" className="primary-btn" onClick={resumePayment}>
              Complete Payment
            </button>
            <button type="button" className="outline-btn" onClick={cancelPendingPayment}>
              Cancel &amp; Save Draft
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          BASIC INFORMATION
      ══════════════════════════════════════════════════════ */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">Basic Information <SectionDot filled={basicFilled} /></h3>

        <div className="form-group">
          <label htmlFor="ap-title">Product Title *</label>
          <input
            id="ap-title"
            placeholder="e.g. HP Pavilion 15 Laptop"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            maxLength={120}
          />
          <div className="field-footer">
            <small className="field-hint">Be specific — good titles get more views</small>
            <CharCounter value={form.title} max={120} />
          </div>
          {titleSuggestions.length > 0 && (
            <div className="title-suggestions">
              <span className="title-suggestions-label">
                <SparkleIcon /> Suggestion:
              </span>
              {titleSuggestions.map((s, i) => (
                <button key={i} type="button" className="title-suggestion-chip"
                        onClick={() => { updateForm("title", s); setTitleSuggestions([]); }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="ap-desc">Description *</label>
          <textarea
            id="ap-desc" rows={4}
            placeholder="Describe your product — condition, features, reason for selling"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            maxLength={2000}
          />
          <div className="field-footer">
            <small className="field-hint">Minimum 10 characters</small>
            <CharCounter value={form.description} max={2000} min={10} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="ap-price">Price (&#8358;) *</label>
          <input
            id="ap-price" type="text" inputMode="numeric"
            placeholder="Enter price"
            value={displayPrice(form.price)}
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          />
          {form.price && Number(form.price) > 0 && (
            <small className="field-hint field-hint--price">
              &#8358;{displayPrice(form.price)} NGN
            </small>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRODUCT DETAILS
      ══════════════════════════════════════════════════════ */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">Product Details <SectionDot filled={detailsFilled} /></h3>

        <div className="form-group">
          <label>Category *</label>
          <DropdownModal
            value={normValue(form.category_id)}
            options={categoryOptions}
            placeholder="Select category"
            onChange={(value) => {
              if (normValue(value) === normValue(form.category_id)) return;
              updateForm("category_id",    value);
              updateForm("subcategory_id", "");
              updateForm("attributes",     deepClone(INITIAL_FORM.attributes));
            }}
          />
        </div>

        {subcategories.length > 0 && (
          <div className="form-group">
            <label>Subcategory</label>
            <DropdownModal
              value={normValue(form.subcategory_id)}
              options={subcategories.map((sub) => ({ id: String(sub.id), name: sub.name }))}
              placeholder="Select subcategory"
              onChange={(value) => updateForm("subcategory_id", value)}
            />
          </div>
        )}

        {optionsMap.brand.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("brand")}</label>
            <DropdownModal
              value={attributes?.brand ?? ""}
              options={optionsMap.brand}
              onChange={(v) => updateAttribute("brand", v)}
            />
          </div>
        )}

        {showModelField && (
          <div className="form-group">
            <label>{formatLabel("model")}</label>
            {modelOptions.length > 0 ? (
              <DropdownModal
                key={`model-dd-${attributes?.brand ?? "none"}`}
                value={attributes?.model ?? ""}
                options={modelOptions}
                placeholder="Select model"
                onChange={(v) => updateAttribute("model", v)}
              />
            ) : (
              <input
                key={`model-txt-${attributes?.brand ?? "none"}`}
                type="text"
                placeholder="e.g. Pavilion 15-eg3000"
                value={attributes?.model ?? ""}
                onChange={(e) => updateAttribute("model", e.target.value.trimStart())}
              />
            )}
          </div>
        )}

        {fields.map((field) => {
          const fieldOptions = optionsMap[field] ?? [];
          if (!fieldOptions.length) return null;
          if (field === "used_detail" && attributes?.condition !== "Used") return null;
          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={attributes?.[field] ?? ""}
                options={fieldOptions}
                onChange={(v) => updateAttribute(field, v)}
              />
            </div>
          );
        })}

        {totalFeatureCount > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline" role="group" aria-label="Product features">
              {visibleFeatures.map((feature) => (
                <label key={safeStr(feature)} className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={selectedFeaturesSet.has(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{formatLabel(safeStr(feature))}</span>
                </label>
              ))}
            </div>
            {totalFeatureCount > 12 && (
              <button type="button" className="link-btn"
                      onClick={() => setShowAllFeatures((v) => !v)}>
                {showAllFeatures
                  ? "Show fewer features"
                  : `Show ${totalFeatureCount - 12} more features`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          CONTACT INFORMATION
      ══════════════════════════════════════════════════════ */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">Contact Information <SectionDot filled={contactFilled} /></h3>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ap-email">Email *</label>
            <input id="ap-email" type="email"
                   value={form.contact.email} placeholder="your@email.com"
                   onChange={(e) => updateContact("email", e.target.value)}
                   autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="ap-phone">Phone *</label>
            <input id="ap-phone" type="tel"
                   value={form.contact.phone} placeholder="08012345678"
                   onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
                   maxLength={15} autoComplete="tel" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ap-wa">
              WhatsApp <span className="label-optional">(optional)</span>
            </label>
            <input id="ap-wa" type="tel"
                   value={form.contact.whatsapp} placeholder="08012345678"
                   onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))}
                   maxLength={15} />
          </div>
          <div className="form-group">
            <label htmlFor="ap-wa-link">
              WhatsApp Link <span className="label-optional">(optional)</span>
            </label>
            <input id="ap-wa-link" type="url"
                   value={form.contact.whatsapp_link}
                   placeholder="https://wa.me/2348012345678"
                   onChange={handleWaLinkChange}
                   onBlur={handleWaLinkBlur} />
            {waLinkError
              ? <small className="field-hint" style={{ color: "var(--ap-red)" }}>{waLinkError}</small>
              : <small className="field-hint">Format: https://wa.me/2348012345678</small>}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          LOCATION & DELIVERY
      ══════════════════════════════════════════════════════ */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">Location &amp; Delivery <SectionDot filled={locationFilled} /></h3>

        {detectLocation && (
          <div className="detect-location-row">
            <button type="button" className="detect-location-btn"
                    onClick={detectLocation} disabled={detectingLocation}>
              {detectingLocation
                ? <><SpinnerIcon /> Detecting location&#8230;</>
                : <><LocationPinIcon />{detectedCoords ? "Location detected ✓" : "Detect my location"}</>}
            </button>
            <small className="field-hint">Auto-fills state and city</small>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>State *</label>
            <DropdownModal value={state} onChange={setState}
                           options={states.map((s) => ({ id: s, name: s }))}
                           placeholder="Select state" />
          </div>
          {state && (
            <div className="form-group">
              <label>City *</label>
              <DropdownModal value={city} onChange={setCity}
                             options={cities.map((c) => ({ id: c, name: c }))}
                             placeholder="Select city" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="ap-delivery-toggle">Delivery Available</label>
          <label className="toggle-switch">
            <input id="ap-delivery-toggle" type="checkbox"
                   checked={form.delivery.available}
                   onChange={(e) => updateDelivery("available", e.target.checked)} />
            <span className="slider" />
            <span className={`toggle-status${form.delivery.available ? " toggle-status--on" : ""}`}>
              {form.delivery.available ? "Yes — delivery available" : "No delivery"}
            </span>
          </label>
        </div>

        {form.delivery.available && (
          <div className="delivery-grid">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-del-from">From Day *</label>
                <input id="ap-del-from" type="number" min="1" max="30"
                       value={form.delivery.duration.from}
                       onChange={(e) => handleDeliveryDuration("from", clampDay(e.target.value))} />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-to">To Day *</label>
                <input id="ap-del-to" type="number" min="1" max="30"
                       value={form.delivery.duration.to}
                       onChange={(e) => handleDeliveryDuration("to", clampDay(e.target.value))} />
              </div>
            </div>

            {/* Fix #4: delivery error shown inline */}
            {deliveryRangeError && (
              <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
                <WarningIcon /> {deliveryRangeError}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-del-fee">Fee (&#8358;) *</label>
                <input id="ap-del-fee" type="text" inputMode="numeric"
                       value={displayPrice(form.delivery.fee)}
                       onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))} />
                {form.delivery.fee && Number(form.delivery.fee) > 0 && (
                  <small className="field-hint field-hint--price">
                    &#8358;{displayPrice(form.delivery.fee)} NGN
                  </small>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-note">
                  Delivery Note <span className="label-optional">(optional)</span>
                </label>
                <textarea id="ap-del-note" rows={2}
                          value={form.delivery.note}
                          onChange={(e) => updateDelivery("note", e.target.value)}
                          maxLength={200} />
                <div className="field-footer">
                  <span />
                  <CharCounter value={form.delivery.note} max={200} />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          PRODUCT IMAGES (Fix #1 #3 #5)
      ══════════════════════════════════════════════════════ */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">
          Product Images *
          <SectionDot filled={imagesFilled} />
        </h3>

        {hasImageErrors && (
          <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
            <WarningIcon /> {Object.keys(imageErrors).length} image{Object.keys(imageErrors).length !== 1 ? "s have" : " has"} errors — fix before submitting
          </div>
        )}

        <ImageGrid
          images={images}
          imageErrors={imageErrors}
          MAX_IMAGES={MAX_IMAGES}
          isDragging={isDragging}
          dropZoneRef={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onRemove={(id) => {
            removeImage(id);
            setImageErrors((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }}
          onMove={moveImage}
          onAdd={handleImages}
          canPost={canPost}
        />

        {images.length > 0 && (
          <div className="image-footer">
            <small className="image-count">{images.length}/{MAX_IMAGES} images added</small>
            <small className="field-hint">First image is the main photo · drag to reorder</small>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          PROMOTION PLAN
      ══════════════════════════════════════════════════════ */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>

        {plansLoading && (
          <div className="plans-loading" aria-live="polite">
            <SpinnerIcon /> Loading plans&#8230;
          </div>
        )}

        {!plansLoading && promotionPlans.length === 0 && (
          <div className="form-error" role="alert">
            <WarningIcon /> Could not load promotion plans. Please refresh the page.
          </div>
        )}

        {!plansLoading && promotionPlans.length > 0 && (
          <div className="plans-grid" role="radiogroup" aria-label="Promotion plan">
            {promotionPlans.map((plan) => {
              const isSelected  = String(selectedPlan?.id) === String(plan.id);
              const isBestValue = String(plan.id) === String(bestValuePlanId);
              return (
                <div key={plan.id}
                     className={["plan-card", isSelected ? "selected" : "", isBestValue ? "plan-card--best" : ""]
                       .filter(Boolean).join(" ")}
                     onClick={() => setSelectedPlan(isSelected ? null : plan)}
                     role="radio" tabIndex={0}
                     aria-checked={isSelected}
                     aria-label={`${plan.name} plan${isBestValue ? " — Best Value" : ""}`}
                     onKeyDown={(e) => {
                       if (e.key === "Enter" || e.key === " ") {
                         e.preventDefault();
                         setSelectedPlan(isSelected ? null : plan);
                       }
                     }}>
                  {isBestValue && <div className="plan-best-badge">Best Value</div>}
                  <div className="plan-header">
                    <strong>{plan.name}</strong>
                    <span className="plan-price">{planPriceLabel(plan)}</span>
                  </div>
                  <div className="plan-duration">
                    {plan.duration || `${plan.duration_days ?? 30} days`}
                  </div>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="plan-features">
                      {plan.features.map((f, i) => (
                        <li key={i}><CheckIcon /> {safeStr(f)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isVerifiedSeller && !plansLoading && promotionPlans.length > 0 && (
          <p className="plans-note">
            <ShieldIcon />{" "}
            <Link to="/verification">Verify your identity</Link> to post without
            the 7-day listing limit.
          </p>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          TERMS + SUBMIT
      ══════════════════════════════════════════════════════ */}
      <div ref={nextCardRef()} className="button-section section form-card">
        {TermsCheckbox}

        <button
          type="button"
          disabled={submitBlocked}
          className={["primary-btn full-width", !canPost ? "primary-btn--blocked" : ""]
            .filter(Boolean).join(" ")}
          onClick={handleSubmit}
          aria-busy={loading}
          aria-live="polite"
          title={submitTitle}
        >
          {loading ? (
            <><SpinnerIcon /><span className="sr-only">Submitting…</span> Processing&#8230;</>
          ) : deliveryRangeError ? (
            "Fix Delivery Dates"
          ) : hasImageErrors ? (
            "Fix Image Errors"
          ) : !canPost && cooldownSecs > 0 ? (
            <CooldownTimer initialSecs={cooldownSecs} />
          ) : !canPost && dailyRemaining === 0 ? (
            "Daily Limit Reached"
          ) : !canPost && activeRemaining === 0 ? (
            "Active Limit Reached"
          ) : isFreePlan ? (
            "Post Ad"
          ) : (
            "Post Ad & Pay"
          )}
        </button>

        {!canPost && !loading && (
          <p className="submit-limit-note">
            <WarningIcon />
            {dailyRemaining === 0
              ? `You've reached your daily limit (${sellerLimits?.daily_limit}/day). `
              : activeRemaining === 0
              ? `You've reached your active listing limit (${sellerLimits?.active_limit}). `
              : "Posting is on cooldown. "}
            <Link to="/verification">Complete verification</Link>{" "}
            to unlock higher limits.
          </p>
        )}
      </div>

      {/* ── Styles ── */}
      <style>{`
        .ap-top-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 var(--ap-page-pad, 16px); margin-bottom: 8px; min-height: 28px;
        }
        .autosave-indicator {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: .72rem; font-weight: 600; color: var(--ap-text-3, #a8a39d);
        }
        .autosave-indicator--saved  { color: var(--ap-green, #15803d); }
        .autosave-indicator--saving { color: var(--ap-orange, #ff5c00); }
        .form-progress { flex: 1; margin-left: 16px; }
        .form-progress-bar {
          height: 3px; background: var(--ap-orange, #ff5c00);
          border-radius: 99px; transition: width .4s ease;
        }
        .form-progress-label {
          display: block; font-size: .7rem;
          color: var(--ap-text-3, #a8a39d); margin-top: 3px;
          font-variant-numeric: tabular-nums;
        }
        .draft-recovery-banner {
          margin: 0 var(--ap-page-pad, 16px) 12px; padding: 14px 16px;
          background: #F0FDF4; border: 1.5px solid rgba(21,128,61,.2);
          border-radius: var(--ap-r-md, 14px);
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px; flex-wrap: wrap;
        }
        .draft-recovery-content {
          display: flex; align-items: center; gap: 10px;
          color: var(--ap-green, #15803d); font-size: .88rem;
        }
        .draft-recovery-content p {
          margin: 2px 0 0; font-size: .8rem; color: var(--ap-text-2, #6b6560);
        }
        .draft-recovery-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .duplicate-warning {
          margin: 0 var(--ap-page-pad, 16px) 12px; padding: 12px 14px;
          background: #FFFBEB; border: 1.5px solid rgba(217,119,6,.25);
          border-radius: var(--ap-r-sm, 10px);
          display: flex; align-items: flex-start; gap: 10px;
          font-size: .84rem; color: #92400e; position: relative;
        }
        .duplicate-warning strong { display: block; margin-bottom: 2px; }
        .duplicate-warning p { margin: 0; color: #a16207; font-size: .78rem; }
        .duplicate-dismiss {
          position: absolute; top: 10px; right: 10px;
          background: none; border: none; cursor: pointer;
          font-size: 16px; color: #a16207; line-height: 1;
        }
        .dup-checking {
          margin: 0 var(--ap-page-pad, 16px) 8px;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: .78rem; color: var(--ap-text-3, #a8a39d);
        }
        /* Image upload rules */
        .image-upload-rules {
          display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0;
        }
        .image-rule {
          font-size: .72rem; font-weight: 600; padding: 3px 10px;
          border-radius: 99px;
        }
        .image-rule--ok {
          background: rgba(21,128,61,.08);
          color: var(--ap-green, #15803d);
          border: 1px solid rgba(21,128,61,.2);
        }
        .image-rule--no {
          background: rgba(220,38,38,.06);
          color: var(--ap-red, #dc2626);
          border: 1px solid rgba(220,38,38,.15);
        }
        /* Per-file error overlay */
        .preview-thumb--error { border-color: var(--ap-red, #dc2626) !important; }
        .preview-error-overlay {
          position: absolute; inset: 0; display: flex;
          flex-direction: column; align-items: center; justify-content: center;
          background: rgba(220,38,38,.85); color: #fff; border-radius: inherit;
          font-size: .68rem; font-weight: 700; text-align: center;
          padding: 4px; gap: 3px;
        }
        /* Image thumb controls */
        .preview-remove-btn {
          position: absolute; top: 5px; right: 5px;
          width: 24px; height: 24px; border-radius: 50%;
          border: none; background: rgba(0,0,0,.55); color: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .15s;
        }
        .preview-thumb:hover .preview-remove-btn { opacity: 1; }
        .preview-drag-handle {
          position: absolute; top: 5px; left: 5px;
          width: 22px; height: 22px; display: flex;
          align-items: center; justify-content: center;
          background: rgba(0,0,0,.45); border-radius: 5px; color: #fff;
          opacity: 0; transition: opacity .15s;
        }
        .preview-thumb:hover .preview-drag-handle { opacity: 1; }
        .preview-reorder {
          position: absolute; bottom: 5px; left: 50%;
          transform: translateX(-50%);
          display: flex; gap: 4px; opacity: 0; transition: opacity .15s;
        }
        .preview-thumb:hover .preview-reorder { opacity: 1; }
        .preview-reorder button {
          width: 24px; height: 24px; border-radius: 5px;
          border: none; background: rgba(0,0,0,.5); color: #fff;
          font-size: 12px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .preview-reorder button:hover { background: var(--ap-orange, #ff5c00); }
        /* Always visible on touch */
        @media (hover: none) {
          .preview-remove-btn,
          .preview-drag-handle,
          .preview-reorder { opacity: 1; }
        }
        .title-suggestions {
          margin-top: 6px; display: flex; align-items: center;
          gap: 6px; flex-wrap: wrap;
        }
        .title-suggestions-label {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: .72rem; font-weight: 700; color: var(--ap-orange, #ff5c00);
        }
        .title-suggestion-chip {
          padding: 4px 12px; border-radius: 99px; font-size: .78rem;
          background: var(--ap-orange-dim, rgba(255,92,0,.07));
          border: 1px solid rgba(255,92,0,.2);
          color: var(--ap-orange, #ff5c00); cursor: pointer;
          font-family: inherit; font-weight: 500; transition: background .14s;
        }
        .title-suggestion-chip:hover {
          background: rgba(255,92,0,.14);
        }
      `}</style>
    </>
  );
}