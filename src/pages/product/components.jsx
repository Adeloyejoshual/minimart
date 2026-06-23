/**
 * src/pages/product/components.jsx
 *
 * Upgrades v2:
 *  1.  Seller limits banner — shows daily/active remaining + cooldown
 *  2.  Verification nudge banner — shown when needsVerification is true
 *  3.  Submit button disabled + reason shown when canPost is false
 *  4.  Cooldown countdown timer on submit button
 *  5.  WhatsApp label changed to "optional"
 *  6.  Character counters on title, description, delivery note
 *  7.  Price display with formatted preview below input
 *  8.  Image drag-and-drop support
 *  9.  Promotion plan "Best Value" badge for highest discount
 * 10.  Description minimum character hint (live counter)
 * 11.  Form section completion indicators (green tick when filled)
 * 12.  PaymentCountdown moved into its own stable component with restart
 * 13.  All prop types documented with defaults
 * 14.  sellerLimits + needsVerification props consumed
 */

import {
  useMemo, useState, useEffect, useCallback, useRef,
} from "react";
import { Link }         from "react-router-dom";
import DropdownModal    from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS  (outside component — stable references)
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
        name : item.name ?? item.label ?? item.id ?? "",
      };
    })
    .filter((item) => item.id && item.name);
}

function getSelectedCategory(categories, id) {
  if (!Array.isArray(categories)) return null;
  return categories.find((item) => String(item.id) === String(id)) ?? null;
}

const toArray = (v) => (Array.isArray(v) ? v : []);

const fmtSecs = (totalSecs) => {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return m > 0
    ? `${m}m ${String(s).padStart(2, "0")}s`
    : `${s}s`;
};

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
    <path d="M10 3a7 7 0 017 7" strokeOpacity="1"/>
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
  <svg viewBox="0 0 20 20" width="24" height="24" fill="none"
       stroke="currentColor" strokeWidth="1.4"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" rx="2"/>
    <circle cx="7" cy="8" r="1.5"/>
    <polyline points="2 14 6 10 9 13 12 10 18 15"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="2 8 6 12 14 4"/>
  </svg>
);

const UpgradeIcon = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 18 10 15 5 18 6 12.2 2 8.3 7.5 7.5"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   PAYMENT COUNTDOWN  (stable — interval restarted correctly)
═══════════════════════════════════════════════════════════════ */
function PaymentCountdown({ createdAt, maxAgeMs }) {
  const computeRemaining = () =>
    Math.max(0, maxAgeMs - (Date.now() - createdAt));

  const [remaining, setRemaining] = useState(computeRemaining);

  /* Restart interval when createdAt changes (new payment session) */
  useEffect(() => {
    setRemaining(computeRemaining());
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1_000);
        if (next === 0) clearInterval(id);
        return next;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [createdAt, maxAgeMs]); // eslint-disable-line react-hooks/exhaustive-deps

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
   COOLDOWN TIMER  (counts down on submit button)
═══════════════════════════════════════════════════════════════ */
function CooldownTimer({ initialSecs }) {
  const [secs, setSecs] = useState(initialSecs);

  useEffect(() => {
    setSecs(initialSecs);
    if (initialSecs <= 0) return;
    const id = setInterval(() => {
      setSecs((prev) => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [initialSecs]);

  if (secs <= 0) return null;
  return (
    <span className="cooldown-label">
      <ClockIcon /> Wait {fmtSecs(secs)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHARACTER COUNTER
═══════════════════════════════════════════════════════════════ */
function CharCounter({ value, max, min = 0 }) {
  const len     = String(value ?? "").length;
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
   SECTION COMPLETION DOT
   Green = has meaningful content, grey = empty
═══════════════════════════════════════════════════════════════ */
function SectionDot({ filled }) {
  return (
    <span
      className={`section-dot ${filled ? "section-dot--filled" : ""}`}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   SELLER LIMITS BANNER
═══════════════════════════════════════════════════════════════ */
function SellerLimitsBanner({
  sellerLimits,
  limitsLoading,
  isVerifiedSeller,
}) {
  if (limitsLoading || !sellerLimits) return null;
  if (isVerifiedSeller) return null; // verified sellers see no banner

  const {
    daily_limit,
    daily_used,
    daily_remaining,
    active_limit,
    active_count,
    active_remaining,
    cooldown_seconds,
    expiry_days,
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
        {/* Daily */}
        <div className="limit-item">
          <div className="limit-label">
            <span>Posts today</span>
            <span className={daily_remaining === 0 ? "limit-value--empty" : "limit-value"}>
              {daily_remaining} / {daily_limit} left
            </span>
          </div>
          <div className="limit-bar">
            <div
              className={`limit-bar-fill ${dailyPct >= 100 ? "limit-bar-fill--full" : ""}`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>

        {/* Active listings */}
        <div className="limit-item">
          <div className="limit-label">
            <span>Active listings</span>
            <span className={active_remaining === 0 ? "limit-value--empty" : "limit-value"}>
              {active_count} / {active_limit}
            </span>
          </div>
          <div className="limit-bar">
            <div
              className={`limit-bar-fill ${activePct >= 100 ? "limit-bar-fill--full" : ""}`}
              style={{ width: `${activePct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="limits-meta">
        {expiry_days > 0 && (
          <span>
            <ClockIcon /> Listings expire in {expiry_days} days until verified
          </span>
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
   Shown after a product is created with active_limited status.
═══════════════════════════════════════════════════════════════ */
function VerificationNudgeBanner({ verificationData }) {
  if (!verificationData) return null;

  const { daysRemaining, message } = verificationData;

  return (
    <div className="verification-nudge-banner" role="status">
      <div className="verification-nudge-icon">
        <ShieldIcon />
      </div>
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
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductComponents({
  /* ─ data ─ */
  form,
  attributes,
  images,
  state,
  city,
  categories         = [],
  selectedPlan       = null,
  paymentData        = null,
  loading            = false,
  error              = "",
  success            = "",
  states             = [],
  cities             = [],
  options            = {},
  selectedCategory   = null,
  detectedCoords     = null,
  detectingLocation  = false,
  agreedToTerms      = false,
  TermsCheckbox,
  INITIAL_FORM,
  MAX_IMAGES         = 6,
  promotionPlans     = [],
  plansLoading       = false,

  /* ─ seller limits ─ */
  sellerLimits       = null,
  limitsLoading      = false,
  isVerifiedSeller   = false,
  canPost            = true,
  dailyRemaining     = null,
  activeRemaining    = null,
  cooldownSecs       = 0,

  /* ─ post-creation verification ─ */
  needsVerification  = false,
  verificationData   = null,

  /* ─ handlers ─ */
  updateForm,
  updateAttribute,
  updateContact,
  updateDelivery,
  updateDeliveryDuration,
  toggleFeature,
  setState,
  setCity,
  setSelectedPlan,
  handleImages,
  removeImage,
  handleSubmit,
  clearDraft,
  detectLocation,
  resumePayment,
  cancelPendingPayment,

  /* ─ formatters ─ */
  displayPrice,
  formatLabel,
  onlyNumbers,
  onlyDigits,
}) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);
  const dropZoneRef                           = useRef(null);

  /* ── Release card stacking context after entry animations ── */
  useEffect(() => {
    const cards  = document.querySelectorAll(".section, .form-card");
    const timers = Array.from(cards).map((card, i) =>
      setTimeout(() => card.classList.add("ap-entered"), 400 + i * 60 + 100)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  /* ═══════════════════════════════════════════════════════════
     DRAG AND DROP  (upgrade #8)
  ═══════════════════════════════════════════════════════════ */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    /* Only fire if leaving the drop zone entirely */
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
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
    const seen        = new Set();
    return [...backendFields, ...localFields]
      .filter(Boolean)
      .filter((f) => typeof f === "string" && f.trim().length > 0)
      .filter((f) => { if (seen.has(f)) return false; seen.add(f); return true; })
      .filter((f) => f !== "brand" && f !== "model");
  }, [activeCategory, options]);

  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    const key = String(attributes.brand).toLowerCase();
    return normalizeOptions(options?.models?.[key] ?? []);
  }, [attributes?.brand, options]);

  const showModelField  = !!attributes?.brand;
  const isFreePlan      = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;
  const currentFeatures = toArray(attributes?.features);

  const allFeatures = useMemo(
    () => (Array.isArray(options?.features) ? options.features : []),
    [options?.features]
  );
  const visibleFeatures = useMemo(
    () => (showAllFeatures ? allFeatures : allFeatures.slice(0, 12)),
    [allFeatures, showAllFeatures]
  );
  const totalFeatureCount = allFeatures.length;

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

  /* ── Section completion flags (upgrade #11) ── */
  const basicFilled    = !!(form.title?.trim() && form.description?.trim() && form.price);
  const detailsFilled  = !!form.category_id;
  const contactFilled  = !!(form.contact?.email && form.contact?.phone);
  const locationFilled = !!(state && city);
  const imagesFilled   = images.length > 0;

  /* ── Promotion plan helpers ── */

  /* Best value = highest effective discount (upgrade #9) */
  const bestValuePlanId = useMemo(() => {
    if (!promotionPlans.length) return null;
    let best = null;
    let bestDiscount = 0;
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
        ? apiEffective
        : calcEffective;
      return (
        <>
          <span className="plan-price-original">&#8358;{displayPrice(price)}</span>
          {" "}
          <span className="plan-price-effective">&#8358;{displayPrice(effective.toFixed(2))}</span>
          {" "}
          <span className="plan-price-badge">-{discount}%</span>
        </>
      );
    }
    return <>&#8358;{displayPrice(price)}</>;
  }, [displayPrice]);

  /* ── Delivery day clamp ── */
  const clampDay = useCallback((val) => {
    const n = parseInt(val.replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n) || n < 1) return "";
    if (n > 30) return "30";
    return String(n);
  }, []);

  /* ── WhatsApp link sanitiser ── */
  const sanitizeWhatsAppLink = useCallback((val) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    try {
      const url     = new URL(trimmed);
      const allowed = ["wa.me", "web.whatsapp.com", "api.whatsapp.com"];
      if (url.protocol !== "https:") return "";
      if (!allowed.some((h) => url.hostname.endsWith(h))) return "";
      return trimmed;
    } catch {
      return "";
    }
  }, []);

  /* ── Submit button state ── */
  const submitBlocked   = loading || !agreedToTerms || plansLoading || !canPost;
  const submitTitle     = !agreedToTerms
    ? "Please accept the Terms & Conditions first"
    : plansLoading
    ? "Plans are still loading"
    : !canPost && dailyRemaining === 0
    ? "Daily posting limit reached"
    : !canPost && activeRemaining === 0
    ? "Active listing limit reached"
    : !canPost && cooldownSecs > 0
    ? `Please wait before posting again`
    : undefined;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* ── Feedback banners ── */}
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

      {/* ── Post-creation verification nudge (upgrade #2) ── */}
      {needsVerification && verificationData && (
        <VerificationNudgeBanner verificationData={verificationData} />
      )}

      {/* ── Seller limits banner (upgrade #1) ── */}
      <SellerLimitsBanner
        sellerLimits={sellerLimits}
        limitsLoading={limitsLoading}
        isVerifiedSeller={isVerifiedSeller}
      />

      {/* ── Incomplete payment banner ── */}
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

      {/* ══════════════════════════════════════════════════════
          BASIC INFORMATION
      ══════════════════════════════════════════════════════ */}
      <section className="section form-card">
        <h3 className="section-title">
          Basic Information
          <SectionDot filled={basicFilled} />
        </h3>

        {/* Title */}
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
        </div>

        {/* Description (upgrade #10 — live counter with min hint) */}
        <div className="form-group">
          <label htmlFor="ap-desc">Description *</label>
          <textarea
            id="ap-desc"
            rows={4}
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

        {/* Price (upgrade #7 — formatted preview below input) */}
        <div className="form-group">
          <label htmlFor="ap-price">Price (&#8358;) *</label>
          <input
            id="ap-price"
            type="text"
            inputMode="numeric"
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
      <section className="section form-card">
        <h3 className="section-title">
          Product Details
          <SectionDot filled={detailsFilled} />
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
              updateForm("attributes",     INITIAL_FORM.attributes);
            }}
          />
        </div>

        {subcategories.length > 0 && (
          <div className="form-group">
            <label>Subcategory</label>
            <DropdownModal
              value={normValue(form.subcategory_id)}
              options={subcategories.map((sub) => ({
                id   : String(sub.id),
                name : sub.name,
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
                placeholder="e.g. Pavilion 15-eg3000, ThinkPad X1 Carbon"
                value={attributes?.model ?? ""}
                onChange={(e) =>
                  updateAttribute("model", e.target.value.trimStart())
                }
              />
            )}
            <small className="field-hint">
              {modelOptions.length > 0
                ? "Select the model from the list"
                : "Type the exact model name as it appears on the device"}
            </small>
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
            <div
              className="checkbox-grid-inline"
              role="group"
              aria-label="Product features"
            >
              {visibleFeatures.map((feature) => (
                <label key={feature} className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={currentFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{formatLabel(feature)}</span>
                </label>
              ))}
            </div>
            {totalFeatureCount > 12 && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setShowAllFeatures((v) => !v)}
              >
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
      <section className="section form-card">
        <h3 className="section-title">
          Contact Information
          <SectionDot filled={contactFilled} />
        </h3>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ap-email">Email *</label>
            <input
              id="ap-email"
              type="email"
              value={form.contact.email}
              placeholder="your@email.com"
              onChange={(e) => updateContact("email", e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="ap-phone">Phone *</label>
            <input
              id="ap-phone"
              type="tel"
              value={form.contact.phone}
              placeholder="08012345678"
              onChange={(e) =>
                updateContact("phone", onlyDigits(e.target.value))
              }
              maxLength={15}
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="form-row">
          {/* Upgrade #5 — WhatsApp is now optional */}
          <div className="form-group">
            <label htmlFor="ap-wa">
              WhatsApp
              <span className="label-optional">(optional)</span>
            </label>
            <input
              id="ap-wa"
              type="tel"
              value={form.contact.whatsapp}
              placeholder="08012345678"
              onChange={(e) =>
                updateContact("whatsapp", onlyDigits(e.target.value))
              }
              maxLength={15}
            />
          </div>
          <div className="form-group">
            <label htmlFor="ap-wa-link">
              WhatsApp Link
              <span className="label-optional">(optional)</span>
            </label>
            <input
              id="ap-wa-link"
              type="url"
              value={form.contact.whatsapp_link}
              placeholder="https://wa.me/2348012345678"
              onChange={(e) => {
                const raw  = e.target.value;
                const safe = sanitizeWhatsAppLink(raw);
                updateContact("whatsapp_link", safe !== "" ? safe : raw);
              }}
              onBlur={(e) => {
                const safe = sanitizeWhatsAppLink(e.target.value);
                if (e.target.value && !safe) updateContact("whatsapp_link", "");
              }}
            />
            <small className="field-hint">Format: https://wa.me/2348012345678</small>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          LOCATION & DELIVERY
      ══════════════════════════════════════════════════════ */}
      <section className="section form-card">
        <h3 className="section-title">
          Location &amp; Delivery
          <SectionDot filled={locationFilled} />
        </h3>

        {detectLocation && (
          <div className="detect-location-row">
            <button
              type="button"
              className="detect-location-btn"
              onClick={detectLocation}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <><SpinnerIcon />{" "}Detecting location&#8230;</>
              ) : (
                <><LocationPinIcon />{detectedCoords ? "Location detected ✓" : "Detect my location"}</>
              )}
            </button>
            <small className="field-hint">Auto-fills state and city</small>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>State *</label>
            <DropdownModal
              value={state}
              onChange={setState}
              options={states.map((s) => ({ id: s, name: s }))}
              placeholder="Select state"
            />
          </div>
          {state && (
            <div className="form-group">
              <label>City *</label>
              <DropdownModal
                value={city}
                onChange={setCity}
                options={cities.map((c) => ({ id: c, name: c }))}
                placeholder="Select city"
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="ap-delivery-toggle">Delivery Available</label>
          <label className="toggle-switch">
            <input
              id="ap-delivery-toggle"
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) => updateDelivery("available", e.target.checked)}
            />
            <span className="slider" />
            <span
              className={`toggle-status${form.delivery.available ? " toggle-status--on" : ""}`}
            >
              {form.delivery.available ? "Yes — delivery available" : "No delivery"}
            </span>
          </label>
        </div>

        {form.delivery.available && (
          <div className="delivery-grid">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-del-from">From Day *</label>
                <input
                  id="ap-del-from"
                  type="number" min="1" max="30"
                  value={form.delivery.duration.from}
                  onChange={(e) =>
                    updateDeliveryDuration("from", clampDay(e.target.value))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-to">To Day *</label>
                <input
                  id="ap-del-to"
                  type="number" min="1" max="30"
                  value={form.delivery.duration.to}
                  onChange={(e) =>
                    updateDeliveryDuration("to", clampDay(e.target.value))
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-del-fee">Fee (&#8358;) *</label>
                <input
                  id="ap-del-fee"
                  type="text" inputMode="numeric"
                  value={displayPrice(form.delivery.fee)}
                  onChange={(e) =>
                    updateDelivery("fee", onlyNumbers(e.target.value))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-note">
                  Delivery Note
                  <span className="label-optional">(optional)</span>
                </label>
                {/* Upgrade #6 — delivery note counter */}
                <textarea
                  id="ap-del-note"
                  rows={2}
                  value={form.delivery.note}
                  onChange={(e) => updateDelivery("note", e.target.value)}
                  maxLength={200}
                />
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
          PRODUCT IMAGES  (upgrade #8 — drag and drop)
      ══════════════════════════════════════════════════════ */}
      <section className="section form-card">
        <h3 className="section-title">
          Product Images *
          <SectionDot filled={imagesFilled} />
        </h3>
        <small className="field-hint">
          Max {MAX_IMAGES} images &middot; up to 3 MB each &middot; JPEG, PNG, WebP
        </small>

        <div
          ref={dropZoneRef}
          className={[
            "preview-grid-modern image-upload-box ap-image-box",
            isDragging ? "ap-image-box--dragging" : "",
          ].filter(Boolean).join(" ")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Image upload area — drag and drop or click to add"
        >
          {images.map((img, index) => (
            <div key={img.id} className="preview-thumb">
              <img
                src={img.preview}
                alt={`Product image ${index + 1} of ${images.length}`}
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                aria-label={`Remove image ${index + 1}`}
                onClick={() => removeImage(img.id)}
              >
                <svg viewBox="0 0 14 14" width="10" height="10" fill="none"
                     stroke="currentColor" strokeWidth="2.2"
                     strokeLinecap="round" aria-hidden="true">
                  <line x1="1" y1="1" x2="13" y2="13"/>
                  <line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
              {index === 0 && (
                <span className="preview-primary-badge" aria-label="Primary image">
                  Main
                </span>
              )}
            </div>
          ))}

          {images.length < MAX_IMAGES && (
            <label
              className={`add-image-box add-image-btn${isDragging ? " add-image-btn--dragging" : ""}`}
            >
              <input
                hidden
                multiple
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  handleImages(e.target.files);
                  e.target.value = "";
                }}
              />
              <ImageIcon />
              <span>{isDragging ? "Drop here" : "Add Images"}</span>
              <small>or drag &amp; drop</small>
            </label>
          )}
        </div>

        {images.length > 0 && (
          <div className="image-footer">
            <small className="image-count">
              {images.length}/{MAX_IMAGES} images added
            </small>
            <small className="field-hint">
              First image is used as the main listing photo
            </small>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          PROMOTION PLAN  (upgrade #9 — Best Value badge)
      ══════════════════════════════════════════════════════ */}
      <section className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>

        {plansLoading && (
          <div className="plans-loading" aria-live="polite">
            <SpinnerIcon />{" "}Loading plans&#8230;
          </div>
        )}

        {!plansLoading && promotionPlans.length === 0 && (
          <div className="form-error" role="alert">
            <WarningIcon />{" "}Could not load promotion plans. Please refresh the page.
          </div>
        )}

        {!plansLoading && promotionPlans.length > 0 && (
          <div className="plans-grid" role="radiogroup" aria-label="Promotion plan">
            {promotionPlans.map((plan) => {
              const isSelected   = String(selectedPlan?.id) === String(plan.id);
              const isBestValue  = String(plan.id) === String(bestValuePlanId);
              return (
                <div
                  key={plan.id}
                  className={[
                    "plan-card",
                    isSelected  ? "selected"          : "",
                    isBestValue ? "plan-card--best"   : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedPlan(isSelected ? null : plan)}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isSelected}
                  aria-label={`${plan.name} plan${isBestValue ? " — Best Value" : ""}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlan(isSelected ? null : plan);
                    }
                  }}
                >
                  {/* Best Value badge (upgrade #9) */}
                  {isBestValue && (
                    <div className="plan-best-badge" aria-hidden="true">
                      Best Value
                    </div>
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
                        <li key={i}>
                          <CheckIcon /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unverified seller — plan upsell note */}
        {!isVerifiedSeller && !plansLoading && promotionPlans.length > 0 && (
          <p className="plans-note">
            <ShieldIcon />
            {" "}
            <Link to="/verification">Verify your identity</Link> to post without
            the 7-day listing limit.
          </p>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          TERMS + SUBMIT  (upgrade #3 + #4)
      ══════════════════════════════════════════════════════ */}
      <div className="button-section section form-card">
        {TermsCheckbox}

        <button
          type="button"
          disabled={submitBlocked}
          className={[
            "primary-btn full-width",
            !canPost ? "primary-btn--blocked" : "",
          ].filter(Boolean).join(" ")}
          onClick={handleSubmit}
          aria-busy={loading}
          aria-live="polite"
          title={submitTitle}
        >
          {loading ? (
            <>
              <SpinnerIcon />
              <span className="sr-only">Submitting, please wait…</span>
              {" "}Processing&#8230;
            </>
          ) : !canPost && cooldownSecs > 0 ? (
            /* Upgrade #4 — cooldown timer on button */
            <>
              <CooldownTimer initialSecs={cooldownSecs} />
            </>
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

        {/* Soft quota warning below button */}
        {!canPost && !loading && (
          <p className="submit-limit-note">
            <WarningIcon />
            {dailyRemaining === 0
              ? `You've reached your daily limit (${sellerLimits?.daily_limit}/day). `
              : activeRemaining === 0
              ? `You've reached your active listing limit (${sellerLimits?.active_limit}). `
              : "Posting is on cooldown. "}
            <Link to="/verification">Complete verification</Link> to unlock higher limits.
          </p>
        )}
      </div>
    </>
  );
}