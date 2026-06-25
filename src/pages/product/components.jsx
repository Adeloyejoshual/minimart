/**
 * src/pages/product/components.jsx
 *
 * v9 — submit never disabled by limits
 *  ─ SellerLimitsBanner removed entirely (was already returning null)
 *  ─ Submit button never disabled by canPost — server enforces all limits
 *  ─ Submit button always shows "Post Ad" / "Post Ad & Pay"
 *  ─ No limit-based button text or submit-limit-note
 *  ─ Upsell modal auto-opens when trialExhausted becomes true
 *    (triggered by server 403 → fetchLimits → trialExhausted = true)
 *  ─ Image upload input never disabled by canPost
 *  ─ All other v8 improvements preserved
 */

import {
  useMemo, useState, useEffect, useCallback, useRef, memo,
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

const deepClone = (obj) =>
  typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

const fmtSecs = (totalSecs) => {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
};

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

async function hashImageFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const hash   = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
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
    const id = setInterval(() => setRemaining(compute()), 1_000);
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
    <span
      className={`section-dot${filled ? " section-dot--filled" : ""}`}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUTO-SAVE INDICATOR
═══════════════════════════════════════════════════════════════ */
function AutoSaveIndicator({ status }) {
  if (!status || status === "idle") return null;
  return (
    <span
      className={`autosave-indicator autosave-indicator--${status}`}
      aria-live="polite"
    >
      {status === "saving"
        ? <><SpinnerIcon /> Saving…</>
        : <><SaveIcon /> Saved</>}
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
        <button type="button" className="primary-btn draft-recovery-btn"
                onClick={onContinue}>
          Continue editing
        </button>
        <button type="button" className="outline-btn draft-recovery-btn"
                onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VERIFICATION UPSELL MODAL
   Auto-opens when trialExhausted becomes true (via useEffect below).
   Focus is trapped inside and restored on close.
═══════════════════════════════════════════════════════════════ */
function VerificationUpsellModal({ onClose, trialRemaining = null }) {
  const modalRef         = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const focusable = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable?.length) focusable[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !modalRef.current) return;

      const els = [...modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!els.length) return;

      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="upsell-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Identity verification benefits"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="upsell-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="upsell-close"
                onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none"
               stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" aria-hidden="true">
            <line x1="1" y1="1" x2="13" y2="13"/>
            <line x1="13" y1="1" x2="1"  y2="13"/>
          </svg>
        </button>

        <div className="upsell-icon" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="40" height="40" fill="none"
               stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 4L8 9v9c0 8.8 5.2 16.4 12 19.2C27.8 34.4 32 26.8 32 18V9L20 4z"/>
            <polyline points="14 20 18 24 26 16"/>
          </svg>
        </div>

        <h2 className="upsell-title">Unlock Full Seller Access</h2>
        <p className="upsell-subtitle">
          {trialRemaining !== null && trialRemaining <= 0
            ? "You have used all 3 free trial listings. Verify your identity to continue posting."
            : "Verify your identity once — sell without restrictions forever."}
        </p>

        <ul className="upsell-benefits" role="list">
          {[
            { icon: "∞", label: "Permanent listings — your posts never expire"   },
            { icon: "↑", label: "100 products per day (you get 3 trial listings)" },
            { icon: "☑", label: "500 active listings at once (vs 3 trial)"       },
            { icon: "⚡", label: "No cooldown between posts"                      },
            { icon: "★", label: "Higher trust score · more buyer confidence"      },
          ].map(({ icon, label }) => (
            <li key={label} className="upsell-benefit">
              <span className="upsell-benefit-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/verification"
          className="primary-btn upsell-cta"
          onClick={onClose}
        >
          Start Identity Verification
        </Link>

        <p className="upsell-footer">
          Free &middot; Takes about 2 minutes &middot; Reviewed within 24 hours
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VERIFICATION NUDGE BANNER (post-creation)
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
            "and unlock unlimited posting."}
        </p>
        <Link to="/verification" className="primary-btn verification-nudge-btn">
          Complete Verification
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE UPLOAD RULES
═══════════════════════════════════════════════════════════════ */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES     = 3 * 1024 * 1024;

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
   IMAGE GRID
═══════════════════════════════════════════════════════════════ */
const ImageGrid = memo(function ImageGrid({
  images, imageErrors, MAX_IMAGES, isDragging, dropZoneRef,
  onDragEnter, onDragOver, onDragLeave, onDrop,
  onRemove, onMove, onAdd,
}) {
  const dragItem      = useRef(null);
  const dragOver      = useRef(null);
  const touchItem     = useRef(null);
  const touchCloneRef = useRef(null);

  useEffect(() => {
    return () => {
      if (touchCloneRef.current) {
        try { document.body.removeChild(touchCloneRef.current); } catch {}
        touchCloneRef.current = null;
      }
    };
  }, []);

  const handleSortStart = (i) => { dragItem.current = i; };
  const handleSortEnter = (i) => { dragOver.current = i; };
  const handleSortEnd   = () => {
    const from = dragItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);
    dragItem.current = null;
    dragOver.current = null;
  };

  const handleTouchStart = useCallback((e, index) => {
    touchItem.current = index;
    const rect  = e.currentTarget.getBoundingClientRect();
    const clone = e.currentTarget.cloneNode(true);
    Object.assign(clone.style, {
      position     : "fixed",
      top          : `${rect.top}px`,
      left         : `${rect.left}px`,
      width        : `${rect.width}px`,
      height       : `${rect.height}px`,
      opacity      : "0.85",
      zIndex       : "9999",
      pointerEvents: "none",
      borderRadius : "12px",
      boxShadow    : "0 8px 24px rgba(0,0,0,.3)",
      transform    : "scale(1.05)",
      transition   : "none",
    });
    document.body.appendChild(clone);
    touchCloneRef.current = clone;
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!touchCloneRef.current) return;
    const touch = e.touches[0];
    const rect  = touchCloneRef.current.getBoundingClientRect();
    touchCloneRef.current.style.top  = `${touch.clientY - rect.height / 2}px`;
    touchCloneRef.current.style.left = `${touch.clientX - rect.width  / 2}px`;
    touchCloneRef.current.style.display = "none";
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchCloneRef.current.style.display = "";
    const thumb = el?.closest("[data-image-index]");
    if (thumb) {
      const idx = parseInt(thumb.dataset.imageIndex, 10);
      if (!Number.isNaN(idx)) dragOver.current = idx;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchCloneRef.current) {
      try { document.body.removeChild(touchCloneRef.current); } catch {}
      touchCloneRef.current = null;
    }
    const from = touchItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);
    touchItem.current = null;
    dragOver.current  = null;
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
              {err && (
                <div className="preview-error-overlay" role="alert">
                  <WarningIcon /><span>{err}</span>
                </div>
              )}
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
              <span className="preview-drag-handle" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
                     stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" aria-hidden="true">
                  <line x1="4" y1="6"  x2="16" y2="6"/>
                  <line x1="4" y1="10" x2="16" y2="10"/>
                  <line x1="4" y1="14" x2="16" y2="14"/>
                </svg>
              </span>
              {index === 0 && !err && (
                <span className="preview-primary-badge">Main</span>
              )}
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
          <label
            className={[
              "add-image-box add-image-btn",
              isDragging ? "add-image-btn--dragging" : "",
            ].filter(Boolean).join(" ")}
          >
            <input
              hidden multiple type="file"
              accept="image/jpeg,image/png,image/webp"
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
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductComponents({
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

  sellerLimits      = null,
  limitsLoading     = false,
  isVerifiedSeller  = false,
  canPost           = true,
  dailyRemaining    = null,
  activeRemaining   = null,
  cooldownSecs      = 0,

  trialExhausted    = false,
  trialRemaining    = null,

  needsVerification = false,
  verificationData  = null,
  draftRestored     = false,
  autoSaveStatus    = "idle",

  updateForm, updateAttribute, updateContact, updateDelivery,
  updateDeliveryDuration, toggleFeature, setState, setCity,
  setSelectedPlan, handleImages, removeImage, moveImage,
  handleSubmit, clearDraft, detectLocation, resumePayment,
  cancelPendingPayment, onDraftContinue, onDraftDiscard,

  displayPrice, formatLabel, onlyNumbers, onlyDigits,

  apiBase = import.meta.env?.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : "/api",
}) {
  /* ── Local state ── */
  const [showAllFeatures,    setShowAllFeatures]    = useState(false);
  const [isDragging,         setIsDragging]         = useState(false);
  const [waLinkError,        setWaLinkError]        = useState("");
  const [deliveryRangeError, setDeliveryRangeError] = useState("");
  const [showDraftBanner,    setShowDraftBanner]    = useState(draftRestored);
  const [showUpsellModal,    setShowUpsellModal]    = useState(false);
  const [titleSuggestions,   setTitleSuggestions]   = useState([]);
  const [dupWarning,         setDupWarning]         = useState("");
  const [dupChecking,        setDupChecking]        = useState(false);
  const [imageErrors,        setImageErrors]        = useState({});

  const sessionHashMap  = useRef(new Map());
  const validatedIdsRef = useRef(new Set());
  const dropZoneRef     = useRef(null);
  const dragCounterRef  = useRef(0);
  const cardRefs        = useRef([]);
  const cardIndexRef    = useRef(0);
  const planRefs        = useRef([]);

  cardIndexRef.current = 0;

  const nextCardRef = () => {
    const i = cardIndexRef.current++;
    return (el) => { if (el) cardRefs.current[i] = el; };
  };

  useEffect(() => {
    const timers = cardRefs.current.map((card, i) =>
      setTimeout(() => card?.classList.add("ap-entered"), 420 + i * 60)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => { setShowDraftBanner(draftRestored); }, [draftRestored]);

  /*
   * Auto-open the upsell modal when trialExhausted becomes true.
   * This happens after the server rejects a submit with 403 →
   * AddProduct.jsx calls fetchLimits() → trialExhausted updates.
   */
  useEffect(() => {
    if (trialExhausted) {
      setShowUpsellModal(true);
    }
  }, [trialExhausted]);

  /* ── Image validation + hash tracking ── */
  const validateAndHashImages = useCallback(async (incomingImages) => {
    const errors = {};
    const newMap = new Map(sessionHashMap.current);

    for (const img of incomingImages) {
      if (!ALLOWED_TYPES.has(img.file.type)) {
        errors[img.id] = "Wrong type — use JPEG, PNG or WebP";
        continue;
      }
      if (img.file.size > MAX_BYTES) {
        errors[img.id] = `Too large (${(img.file.size / 1_048_576).toFixed(1)} MB) — max 3 MB`;
        continue;
      }
      if (validatedIdsRef.current.has(img.id)) continue;

      const hash = await hashImageFile(img.file);
      const isDuplicate = [...newMap.entries()].some(
        ([existingId, existingHash]) =>
          existingHash === hash && existingId !== img.id
      );
      if (isDuplicate) {
        errors[img.id] = "Duplicate — this photo is already added";
        continue;
      }
      newMap.set(img.id, hash);
      validatedIdsRef.current.add(img.id);
    }

    sessionHashMap.current = newMap;
    setImageErrors((prev) => {
      const next = { ...prev };
      incomingImages.forEach((img) => {
        if (errors[img.id]) next[img.id] = errors[img.id];
        else delete next[img.id];
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!images.length) return;
    const newImages = images.filter(
      (img) => !validatedIdsRef.current.has(img.id)
    );
    if (!newImages.length) return;
    validateAndHashImages(newImages).catch(() => {});
  }, [images, validateAndHashImages]);

  useEffect(() => {
    const currentIds = new Set(images.map((img) => img.id));
    for (const id of validatedIdsRef.current) {
      if (!currentIds.has(id)) {
        sessionHashMap.current.delete(id);
        validatedIdsRef.current.delete(id);
      }
    }
  }, [images]);

  /* ── Server duplicate check ── */
  const checkServerDuplicate = useCallback(async () => {
    if (!form.title?.trim() || !form.price || !form.category_id) return;
    const token = getToken();
    if (!token) return;

    setDupChecking(true);
    try {
      const hashes = await Promise.all(
        images.map((img) => hashImageFile(img.file))
      );
      const res = await fetch(
        `${apiBase}/addproduct/products/check-duplicate`,
        {
          method  : "POST",
          headers : {
            "Content-Type": "application/json",
            Authorization : `Bearer ${token}`,
          },
          body    : JSON.stringify({
            title        : form.title.trim(),
            price        : Number(form.price),
            category_id  : form.category_id,
            image_hashes : hashes,
          }),
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      setDupWarning(
        data.isDuplicate
          ? (data.message ?? "A similar listing already exists.")
          : ""
      );
    } catch {}
    finally { setDupChecking(false); }
  }, [form.title, form.price, form.category_id, images, apiBase]);

  useEffect(() => {
    if (!form.title?.trim() || form.title.length < 8) {
      setDupWarning("");
      return;
    }
    const t = setTimeout(checkServerDuplicate, 1_200);
    return () => clearTimeout(t);
  }, [form.title, form.price, form.category_id, images.length, checkServerDuplicate]);

  /* ── WhatsApp link ── */
  const ALLOWED_WA_HOSTS = useMemo(() => [
    "wa.me", "web.whatsapp.com", "api.whatsapp.com",
    "chat.whatsapp.com", "business.whatsapp.com",
  ], []);

  const sanitizeWhatsAppLink = useCallback((val) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:") return "";
      const allowed = ALLOWED_WA_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      );
      if (!allowed) return "";
      return trimmed;
    } catch { return ""; }
  }, [ALLOWED_WA_HOSTS]);

  const handleWaLinkChange = useCallback((e) => {
    setWaLinkError("");
    updateContact(
      "whatsapp_link",
      sanitizeWhatsAppLink(e.target.value) || e.target.value
    );
  }, [sanitizeWhatsAppLink, updateContact]);

  const handleWaLinkBlur = useCallback((e) => {
    const val  = e.target.value;
    const safe = sanitizeWhatsAppLink(val);
    if (val && !safe) {
      updateContact("whatsapp_link", "");
      setWaLinkError("Invalid link — must use https://wa.me/ or similar.");
    } else {
      setWaLinkError("");
    }
  }, [sanitizeWhatsAppLink, updateContact]);

  /* ── Delivery range ── */
  const deliveryDurationRef = useRef(form.delivery?.duration ?? { from: "", to: "" });
  useEffect(() => {
    deliveryDurationRef.current = form.delivery?.duration ?? { from: "", to: "" };
  }, [form.delivery?.duration]);

  const handleDeliveryDuration = useCallback((key, val) => {
    updateDeliveryDuration(key, val);
    const current = deliveryDurationRef.current;
    const from    = Number(key === "from" ? val : current.from);
    const to      = Number(key === "to"   ? val : current.to);
    setDeliveryRangeError(
      from && to && to < from
        ? "End day must be equal to or after start day."
        : ""
    );
  }, [updateDeliveryDuration]);

  /* ── Drag and drop ── */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault(); dragCounterRef.current += 1; setIsDragging(true);
  }, []);
  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); }
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) handleImages(files);
  }, [handleImages]);

  /* ── Derived ── */
  const categoryOptions = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories
      .map((cat) => ({ id: String(cat.id), name: cat.name }))
      .filter((cat) => cat.id && cat.name);
  }, [categories]);

  const activeCategory = selectedCategory ?? getSelectedCategory(categories, form.category_id);
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
    return normalizeOptions(
      options?.models?.[String(attributes.brand).toLowerCase()] ?? []
    );
  }, [attributes?.brand, options]);

  const showModelField = !!attributes?.brand;
  const isFreePlan     = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;

  const allFeatures = useMemo(
    () => (Array.isArray(options?.features) ? options.features : []),
    [options?.features]
  );
  const visibleFeatures = useMemo(
    () => (showAllFeatures ? allFeatures : allFeatures.slice(0, 12)),
    [allFeatures, showAllFeatures]
  );
  const totalFeatureCount   = allFeatures.length;
  const selectedFeaturesSet = useMemo(
    () => new Set(toArray(attributes?.features)),
    [attributes?.features]
  );

  const brandOptions     = useMemo(() => normalizeOptions(options?.brands),     [options?.brands]);
  const colorOptions     = useMemo(() => normalizeOptions(options?.colors),     [options?.colors]);
  const conditionOptions = useMemo(() => normalizeOptions(options?.conditions), [options?.conditions]);
  const usedDetailOptions = useMemo(() => normalizeOptions(options?.used_details ?? options?.usedDetails ?? []), [options?.used_details, options?.usedDetails]);
  const ramOptions       = useMemo(() => normalizeOptions(options?.ram),        [options?.ram]);
  const storageOptions   = useMemo(() => normalizeOptions(options?.storage),    [options?.storage]);
  const simOptions       = useMemo(() => normalizeOptions(options?.sim),        [options?.sim]);
  const yearOptions      = useMemo(() => normalizeOptions(options?.years),      [options?.years]);
  const engineOptions    = useMemo(() => normalizeOptions(options?.engine ?? options?.engines ?? []), [options?.engine, options?.engines]);
  const fuelTypeOptions  = useMemo(() => normalizeOptions(options?.fuelType ?? options?.fuel_types ?? []), [options?.fuelType, options?.fuel_types]);
  const sizeOptions      = useMemo(() => normalizeOptions(options?.size),       [options?.size]);
  const ageRangeOptions  = useMemo(() => normalizeOptions(options?.age_range),  [options?.age_range]);
  const bedroomOptions   = useMemo(() => normalizeOptions(options?.bedrooms),   [options?.bedrooms]);
  const bathroomOptions  = useMemo(() => normalizeOptions(options?.bathrooms),  [options?.bathrooms]);
  const expLevelOptions  = useMemo(() => normalizeOptions(options?.experience_level), [options?.experience_level]);
  const skillsOptions    = useMemo(() => normalizeOptions(options?.skills),     [options?.skills]);

  const optionsMap = {
    brand: brandOptions, color: colorOptions, condition: conditionOptions,
    used_detail: usedDetailOptions, ram: ramOptions, storage: storageOptions,
    sim: simOptions, year: yearOptions, engine: engineOptions,
    fuel_type: fuelTypeOptions, size: sizeOptions, age_range: ageRangeOptions,
    bedrooms: bedroomOptions, bathrooms: bathroomOptions,
    experience_level: expLevelOptions, skills: skillsOptions,
    features: allFeatures,
  };

  /* ── Section completion ── */
  const basicFilled    = !!(form.title?.trim() && form.description?.trim() && form.price);
  const detailsFilled  = !!form.category_id;
  const contactFilled  = !!(form.contact?.email && form.contact?.phone);
  const locationFilled = !!(state && city);
  const hasImageErrors = Object.keys(imageErrors).length > 0;
  const imagesFilled   = images.length > 0 && !hasImageErrors;
  const sectionsComplete = [
    basicFilled, detailsFilled, contactFilled, locationFilled, imagesFilled,
  ].filter(Boolean).length;

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

  /* ── Title suggestion ── */
  useEffect(() => {
    if (
      !form.description ||
      form.description.length < 30 ||
      form.title?.trim().length >= 10
    ) {
      setTitleSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      const words = form.description
        .split(/[\s,.\-|]+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      setTitleSuggestions(words.length >= 3 ? [words.join(" ")] : []);
    }, 600);
    return () => clearTimeout(t);
  }, [form.description, form.title]);

  /*
   * Submit blocked — only by form validation issues.
   * canPost is NOT included — server enforces all limits.
   * The button is always clickable if the form is valid.
   */
  const submitBlocked =
    loading || !agreedToTerms || plansLoading ||
    !!deliveryRangeError || hasImageErrors;

  const submitTitle = !agreedToTerms
    ? "Please accept the Terms & Conditions first"
    : plansLoading         ? "Plans are still loading"
    : !!deliveryRangeError ? deliveryRangeError
    : hasImageErrors       ? "Fix image errors before submitting"
    : undefined;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {showUpsellModal && (
        <VerificationUpsellModal
          onClose={() => setShowUpsellModal(false)}
          trialRemaining={trialRemaining}
        />
      )}

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

      {showDraftBanner && (
        <DraftRecoveryBanner
          onContinue={() => { setShowDraftBanner(false); onDraftContinue?.(); }}
          onDiscard={() => {
            setShowDraftBanner(false);
            onDraftDiscard?.();
            clearDraft();
          }}
        />
      )}

      {dupWarning && (
        <div className="duplicate-warning" role="alert">
          <WarningIcon />
          <div>
            <strong>Possible duplicate listing</strong>
            <p>{dupWarning}</p>
          </div>
          <button type="button" onClick={() => setDupWarning("")}
                  className="duplicate-dismiss" aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}
      {dupChecking && (
        <div className="dup-checking" aria-live="polite">
          <SpinnerIcon /> Checking for duplicates…
        </div>
      )}

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

      {/* SellerLimitsBanner removed — upsell modal handles all messaging */}

      {paymentData?.authUrl && (
        <div className="payment-resume-banner" role="alert">
          <div className="payment-resume-info">
            <CardIcon />
            <div>
              <strong>Incomplete Payment</strong>
              <PaymentCountdown
                createdAt={paymentData.createdAt}
                maxAgeMs={30 * 60 * 1_000}
              />
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

      {/* ── BASIC INFORMATION ── */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">
          Basic Information <SectionDot filled={basicFilled} />
        </h3>

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
            <span />
            <CharCounter value={form.title} max={120} />
          </div>
          {titleSuggestions.length > 0 && (
            <div className="title-suggestions">
              <span className="title-suggestions-label">
                Suggestion from description:
              </span>
              {titleSuggestions.map((s, i) => (
                <button key={i} type="button" className="title-suggestion-chip"
                        onClick={() => {
                          updateForm("title", s);
                          setTitleSuggestions([]);
                        }}>
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
            {form.description.length > 0 && form.description.length < 10 ? (
              <small className="field-hint field-hint--error">
                Minimum 10 characters — {10 - form.description.length} more needed
              </small>
            ) : (
              <span />
            )}
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

      {/* ── PRODUCT DETAILS ── */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">
          Product Details <SectionDot filled={detailsFilled} />
        </h3>

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
              options={subcategories.map((sub) => ({
                id: String(sub.id), name: sub.name,
              }))}
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
                onChange={(e) =>
                  updateAttribute("model", e.target.value.trimStart())
                }
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
            <div className="checkbox-grid-inline" role="group"
                 aria-label="Product features">
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

      {/* ── CONTACT INFORMATION ── */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">
          Contact Information <SectionDot filled={contactFilled} />
        </h3>

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
                   onChange={(e) =>
                     updateContact("phone", onlyDigits(e.target.value))
                   }
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
                   onChange={(e) =>
                     updateContact("whatsapp", onlyDigits(e.target.value))
                   }
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
            {waLinkError && (
              <small className="field-hint field-hint--error">{waLinkError}</small>
            )}
          </div>
        </div>
      </section>

      {/* ── LOCATION & DELIVERY ── */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">
          Location &amp; Delivery <SectionDot filled={locationFilled} />
        </h3>

        {detectLocation && (
          <div className="detect-location-row">
            <button type="button" className="detect-location-btn"
                    onClick={detectLocation} disabled={detectingLocation}>
              {detectingLocation
                ? <><SpinnerIcon /> Detecting location&#8230;</>
                : (
                    <>
                      <LocationPinIcon />
                      {detectedCoords ? "Location detected ✓" : "Detect my location"}
                    </>
                  )}
            </button>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>State *</label>
            <DropdownModal
              value={state} onChange={setState}
              options={states.map((s) => ({ id: s, name: s }))}
              placeholder="Select state"
            />
          </div>
          {state && (
            <div className="form-group">
              <label>City *</label>
              <DropdownModal
                value={city} onChange={setCity}
                options={cities.map((c) => ({ id: c, name: c }))}
                placeholder="Select city"
              />
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
                       onChange={(e) =>
                         handleDeliveryDuration("from", clampDay(e.target.value))
                       } />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-to">To Day *</label>
                <input id="ap-del-to" type="number" min="1" max="30"
                       value={form.delivery.duration.to}
                       onChange={(e) =>
                         handleDeliveryDuration("to", clampDay(e.target.value))
                       } />
              </div>
            </div>

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
                       onChange={(e) =>
                         updateDelivery("fee", onlyNumbers(e.target.value))
                       } />
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

      {/* ── PRODUCT IMAGES ── */}
      <section ref={nextCardRef()} className="section form-card">
        <h3 className="section-title">
          Product Images * <SectionDot filled={imagesFilled} />
        </h3>

        {hasImageErrors && (
          <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
            <WarningIcon />{" "}
            {Object.keys(imageErrors).length} image
            {Object.keys(imageErrors).length !== 1 ? "s have" : " has"} errors
            — fix before submitting
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
        />

        {images.length > 0 && (
          <div className="image-footer">
            <small className="image-count">
              {images.length}/{MAX_IMAGES} images added
            </small>
            <small className="field-hint">
              First image is the main photo · drag to reorder
            </small>
          </div>
        )}
      </section>

      {/* ── PROMOTION PLAN ── */}
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
            {promotionPlans.map((plan, planIndex) => {
              const isSelected  = String(selectedPlan?.id) === String(plan.id);
              const isBestValue = String(plan.id) === String(bestValuePlanId);
              return (
                <div
                  key={plan.id}
                  ref={(el) => { if (el) planRefs.current[planIndex] = el; }}
                  className={[
                    "plan-card",
                    isSelected  ? "selected"       : "",
                    isBestValue ? "plan-card--best" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedPlan(isSelected ? null : plan)}
                  role="radio"
                  tabIndex={isSelected ? 0 : -1}
                  aria-checked={isSelected}
                  aria-label={`${plan.name} plan${isBestValue ? " — Best Value" : ""}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlan(isSelected ? null : plan);
                      return;
                    }
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      const next = (planIndex + 1) % promotionPlans.length;
                      setSelectedPlan(promotionPlans[next]);
                      planRefs.current[next]?.focus();
                    }
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const prev =
                        (planIndex - 1 + promotionPlans.length) % promotionPlans.length;
                      setSelectedPlan(promotionPlans[prev]);
                      planRefs.current[prev]?.focus();
                    }
                  }}
                >
                  {isBestValue && (
                    <div className="plan-best-badge">Best Value</div>
                  )}
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
      </section>

      {/* ── TERMS + SUBMIT ── */}
      <div ref={nextCardRef()} className="button-section section form-card">
        {TermsCheckbox}

        <button
          type="button"
          disabled={submitBlocked}
          className="primary-btn full-width"
          onClick={handleSubmit}
          aria-busy={loading}
          aria-live="polite"
          title={submitTitle}
        >
          {loading ? (
            <>
              <SpinnerIcon />
              <span className="sr-only">Submitting…</span>
              {" "}Processing&#8230;
            </>
          ) : deliveryRangeError ? (
            "Fix Delivery Dates"
          ) : hasImageErrors ? (
            "Fix Image Errors"
          ) : isFreePlan ? (
            "Post Ad"
          ) : (
            "Post Ad & Pay"
          )}
        </button>
      </div>
    </>
  );
}