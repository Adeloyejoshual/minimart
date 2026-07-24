/**
 * src/pages/product/components.jsx
 * Main shell — imports all sub-components, owns page-level logic only
 *
 * v6 — EMAIL REMOVED FROM CONTACT INFORMATION
 *   • Email field completely removed from Contact Information section
 *   • Contact section now shows only: Phone + WhatsApp + WhatsApp Link
 *   • contactFilled no longer depends on email
 *   • SectionDot for contact now based on phone only
 *   • All email refs/selectors removed from UI layer
 *
 * v5 — Subscription upsell modal integrated
 * v4 — TermsCheckbox moved outside sticky bar
 * v3 — image grid mount fix
 */
import {
  useMemo, useState, useEffect, useCallback, useRef,
} from "react";
import { Link }           from "react-router-dom";
import DropdownModal      from "../../components/DropdownModal.jsx";
import AddProductHeader   from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";
import { INITIAL_FORM }   from "../../hooks/useFormState.js";

import {
  SectionDot,
  CharCounter,
  PaymentCountdown,
  ExistingImageGrid,
  ImageGrid,
  VerificationUpsellModal,
  VerificationNudgeBanner,
  SubscriptionUpsellModal,
  WarningIcon,
  CheckCircleIcon,
  CardIcon,
  LocationPinIcon,
  SpinnerIcon,
  CheckIcon,
  StarIcon,
} from "./components/index.jsx";

import "../../styles/AddProduct.css";

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
        id  : String(item.id    ?? item.value ?? item.name ?? ""),
        name: String(item.name  ?? item.label ?? item.id   ?? ""),
      };
    })
    .filter((item) => item.id && item.name);
}

function getSelectedCategory(categories, id) {
  if (!Array.isArray(categories) || !id) return null;
  return categories.find((item) => String(item.id) === String(id)) ?? null;
}

const toArray  = (v) => (Array.isArray(v) ? v : []);
const safeStr  = (v) => (typeof v === "string" ? v : String(v ?? ""));
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const deepClone = (obj) => structuredClone(obj);

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
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductComponents({
  /* ─ data ─ */
  form,
  attributes,
  images,
  state,
  city,
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
  MAX_IMAGES        = 6,
  promotionPlans    = [],
  plansLoading      = false,

  /* ─ edit mode ─ */
  isEditMode        = false,
  editId            = null,
  existingImages    = [],
  removeExistingImage,
  totalImageCount   = 0,

  /* ─ seller limits (legacy) ─ */
  sellerLimits      = null,
  limitsLoading     = false,
  isVerifiedSeller  = false,
  canPost           = true,
  dailyRemaining    = null,
  activeRemaining   = null,
  cooldownSecs      = 0,
  trialExhausted    = false,
  trialRemaining    = null,

  /* ─ v4 tier-aware ─ */
  tier              = "unverified",
  isSubscriber      = false,
  lifetimeExhausted = false,
  lifetimeRemaining = null,
  lifetimeUsed      = 0,
  lifetimeMax       = null,
  upgradeTo         = null,
  upgradeUrl        = null,

  /* ─ post-creation upsells ─ */
  needsVerification = false,
  verificationData  = null,
  needsSubscription = false,
  subscriptionData  = null,

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
  moveImage,
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

  /* ─ API base ─ */
  apiBase = import.meta.env?.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : "/api",
}) {
  /* ── Local state ── */
  const [showAllFeatures,       setShowAllFeatures]       = useState(false);
  const [isDragging,            setIsDragging]            = useState(false);
  const [waLinkError,           setWaLinkError]           = useState("");
  const [deliveryRangeError,    setDeliveryRangeError]    = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [titleSuggestions,      setTitleSuggestions]      = useState([]);
  const [dupWarning,            setDupWarning]            = useState("");
  const [dupChecking,           setDupChecking]           = useState(false);
  const [imageErrors,           setImageErrors]           = useState({});

  const sessionHashMap  = useRef(new Map());
  const validationQueue = useRef(Promise.resolve());
  const validatedIdsRef = useRef(new Set());
  const dropZoneRef     = useRef(null);
  const dragCounterRef  = useRef(0);

  /* Static section refs — 6 form sections only */
  const sec0 = useRef(null); const sec1 = useRef(null);
  const sec2 = useRef(null); const sec3 = useRef(null);
  const sec4 = useRef(null); const sec5 = useRef(null);
  const sectionRefs = useMemo(
    () => [sec0, sec1, sec2, sec3, sec4, sec5],
    []
  );

  const planRefs = useRef([]);

  /* Card entrance animation */
  useEffect(() => {
    const timers = sectionRefs.map((ref, i) =>
      setTimeout(
        () => ref.current?.classList.add("ap-entered"),
        420 + i * 60
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [sectionRefs]);

  /* ═══════════════════════════════════════════════════════════
     AUTO-OPEN UPSELL MODALS
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isEditMode) return;
    if (trialExhausted && tier === "unverified") {
      setShowVerificationModal(true);
    }
  }, [trialExhausted, tier, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    if (lifetimeExhausted && tier === "verified" && !isSubscriber) {
      setShowSubscriptionModal(true);
    }
  }, [lifetimeExhausted, tier, isSubscriber, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    if (needsSubscription) setShowSubscriptionModal(true);
  }, [needsSubscription, isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     IMAGE VALIDATION
  ═══════════════════════════════════════════════════════════ */
  const _validateImages = useCallback(async (incomingImages) => {
    const errors = {};
    const newMap = new Map(sessionHashMap.current);

    for (const img of incomingImages) {
      if (!["image/jpeg","image/png","image/webp"].includes(img.file.type)) {
        errors[img.id] = "Wrong type — use JPEG, PNG or WebP"; continue;
      }
      if (img.file.size > 5 * 1024 * 1024) {
        errors[img.id] = `Too large (${(img.file.size / 1_048_576).toFixed(1)} MB) — max 5 MB`;
        continue;
      }
      if (validatedIdsRef.current.has(img.id)) continue;

      const hash        = await hashImageFile(img.file);
      const isDuplicate = [...newMap.entries()].some(
        ([id, h]) => h === hash && id !== img.id
      );
      if (isDuplicate) {
        errors[img.id] = "Duplicate — this photo is already added"; continue;
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

  const validateAndHashImages = useCallback((incomingImages) => {
    validationQueue.current = validationQueue.current
      .then(() => _validateImages(incomingImages))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn("[ImageValidation]", err);
      });
  }, [_validateImages]);

  useEffect(() => {
    if (!images.length) return;
    const newImages = images.filter(
      (img) => !validatedIdsRef.current.has(img.id)
    );
    if (!newImages.length) return;
    validateAndHashImages(newImages);
  }, [images, validateAndHashImages]);

  /* Clean up removed image hashes */
  useEffect(() => {
    const currentIds = new Set(images.map((img) => img.id));
    for (const id of validatedIdsRef.current) {
      if (!currentIds.has(id)) {
        sessionHashMap.current.delete(id);
        validatedIdsRef.current.delete(id);
      }
    }
  }, [images]);

  /* ═══════════════════════════════════════════════════════════
     SERVER DUPLICATE CHECK
  ═══════════════════════════════════════════════════════════ */
  const checkServerDuplicate = useCallback(async () => {
    if (isEditMode) return;
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
            "Content-Type" : "application/json",
            Authorization  : `Bearer ${token}`,
          },
          body: JSON.stringify({
            title       : form.title.trim(),
            price       : Number(form.price),
            category_id : form.category_id,
            image_hashes: hashes,
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
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[DupCheck]", err.message);
    } finally {
      setDupChecking(false);
    }
  }, [isEditMode, form.title, form.price, form.category_id, images, apiBase]);

  useEffect(() => {
    if (isEditMode || !form.title?.trim() || form.title.length < 8) {
      setDupWarning(""); return;
    }
    const t = setTimeout(checkServerDuplicate, 1_200);
    return () => clearTimeout(t);
  }, [
    isEditMode, form.title, form.price,
    form.category_id, images.length, checkServerDuplicate,
  ]);

  /* ═══════════════════════════════════════════════════════════
     WHATSAPP LINK
  ═══════════════════════════════════════════════════════════ */
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
        (host) =>
          url.hostname === host || url.hostname.endsWith(`.${host}`)
      );
      return allowed ? trimmed : "";
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
      setWaLinkError(
        "Invalid link — must use https://wa.me/ or similar."
      );
    } else {
      setWaLinkError("");
    }
  }, [sanitizeWhatsAppLink, updateContact]);

  /* ═══════════════════════════════════════════════════════════
     DELIVERY RANGE
  ═══════════════════════════════════════════════════════════ */
  const deliveryDurationRef = useRef(
    form.delivery?.duration ?? { from: "", to: "" }
  );
  useEffect(() => {
    deliveryDurationRef.current =
      form.delivery?.duration ?? { from: "", to: "" };
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

  /* ═══════════════════════════════════════════════════════════
     DRAG AND DROP
  ═══════════════════════════════════════════════════════════ */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) handleImages(files);
  }, [handleImages]);

  /* ═══════════════════════════════════════════════════════════
     DERIVED VALUES
  ═══════════════════════════════════════════════════════════ */
  const categoryOptions = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories
      .map((cat) => ({ id: String(cat.id), name: cat.name }))
      .filter((cat) => cat.id && cat.name);
  }, [categories]);

  const activeCategory = selectedCategory ??
    getSelectedCategory(categories, form.category_id);
  const subcategories  = activeCategory?.subcategories ?? [];

  const fields = useMemo(() => {
    if (!activeCategory) return [];
    const backendFields = Array.isArray(options?.fields)
      ? options.fields.map((f) =>
          typeof f === "object" ? f.name ?? f.id : f
        )
      : [];
    const localFields = categoryFields[activeCategory.name] ?? [];
    const seen = new Set();
    return [...backendFields, ...localFields]
      .filter(Boolean)
      .filter((f) => typeof f === "string" && f.trim().length > 0)
      .filter((f) => {
        if (seen.has(f)) return false;
        seen.add(f); return true;
      })
      .filter((f) => f !== "brand" && f !== "model");
  }, [activeCategory, options]);

  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    return normalizeOptions(
      options?.models?.[String(attributes.brand).toLowerCase()] ?? []
    );
  }, [attributes?.brand, options]);

  const normalizedOptions = useMemo(() => ({
    brand           : normalizeOptions(options?.brands),
    color           : normalizeOptions(options?.colors),
    condition       : normalizeOptions(options?.conditions),
    used_detail     : normalizeOptions(
      options?.used_details ?? options?.usedDetails ?? []
    ),
    ram             : normalizeOptions(options?.ram),
    storage         : normalizeOptions(options?.storage),
    sim             : normalizeOptions(options?.sim),
    year            : normalizeOptions(options?.years),
    engine          : normalizeOptions(
      options?.engine ?? options?.engines ?? []
    ),
    fuel_type       : normalizeOptions(
      options?.fuelType ?? options?.fuel_types ?? []
    ),
    size            : normalizeOptions(options?.size),
    age_range       : normalizeOptions(options?.age_range),
    bedrooms        : normalizeOptions(options?.bedrooms),
    bathrooms       : normalizeOptions(options?.bathrooms),
    experience_level: normalizeOptions(options?.experience_level),
    skills          : normalizeOptions(options?.skills),
    features        : Array.isArray(options?.features)
      ? options.features
      : [],
  }), [options]);

  const showModelField = !!attributes?.brand;
  const isFreePlan     = !selectedPlan ||
    Number(selectedPlan?.price ?? 0) === 0;

  const allFeatures = normalizedOptions.features;
  const visibleFeatures = useMemo(
    () => (showAllFeatures ? allFeatures : allFeatures.slice(0, 12)),
    [allFeatures, showAllFeatures]
  );
  const totalFeatureCount   = allFeatures.length;
  const selectedFeaturesSet = useMemo(
    () => new Set(toArray(attributes?.features)),
    [attributes?.features]
  );

  /* Best value plan */
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
      const effective = Number(plan.effective_price) > 0
        ? Number(plan.effective_price)
        : price * (1 - discount / 100);
      return (
        <>
          <span className="plan-price-original">
            &#8358;{displayPrice(price)}
          </span>{" "}
          <span className="plan-price-effective">
            &#8358;{displayPrice(effective.toFixed(2))}
          </span>{" "}
          <span className="plan-price-badge">-{discount}%</span>
        </>
      );
    }
    return <>&#8358;{displayPrice(price)}</>;
  }, [displayPrice]);

  const clampDay = useCallback((val) => {
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n) || n < 1) return "";
    return String(Math.min(n, 30));
  }, []);

  /* Title suggestions */
  useEffect(() => {
    if (isEditMode) return;
    if (
      !form.description ||
      form.description.length < 30 ||
      form.title?.trim().length >= 10
    ) {
      setTitleSuggestions([]); return;
    }
    const t = setTimeout(() => {
      const words = form.description
        .split(/[\s,.\-|]+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      setTitleSuggestions(words.length >= 3 ? [words.join(" ")] : []);
    }, 600);
    return () => clearTimeout(t);
  }, [isEditMode, form.description, form.title]);

  /* ═══════════════════════════════════════════════════════════
     DERIVED UI STATE
     ✅ v6: contactFilled now based on phone only (no email)
  ═══════════════════════════════════════════════════════════ */
  const canAddMore     = totalImageCount < MAX_IMAGES;
  const hasImageErrors = Object.keys(imageErrors).length > 0;

  const basicFilled   = !!(
    form.title?.trim() && form.description?.trim() && form.price
  );
  const detailsFilled  = !!form.category_id;

  /* ✅ v6: Contact is complete when phone is filled
           Email is NOT required — comes from registration */
  const contactFilled  = !!form.contact?.phone;

  const locationFilled = !!(state && city);
  const imagesFilled   = totalImageCount > 0 && !hasImageErrors;

  const sectionsComplete = [
    basicFilled, detailsFilled, contactFilled, locationFilled, imagesFilled,
  ].filter(Boolean).length;

  const submitBlocked =
    loading                             ||
    (!isEditMode && !agreedToTerms)     ||
    (!isEditMode && plansLoading)       ||
    !!deliveryRangeError                ||
    hasImageErrors;

  const submitTitle = !agreedToTerms && !isEditMode
    ? "Please accept the Terms & Conditions first"
    : plansLoading && !isEditMode
    ? "Plans are still loading"
    : !!deliveryRangeError
    ? deliveryRangeError
    : hasImageErrors
    ? "Fix image errors before submitting"
    : undefined;

  const submitLabel = (() => {
    if (loading)            return isEditMode ? "Saving…" : "Processing…";
    if (deliveryRangeError) return "Fix Delivery Dates";
    if (hasImageErrors)     return "Fix Image Errors";
    if (isEditMode)         return "Save Changes";
    if (isFreePlan)         return "Post Ad";
    return "Post Ad & Pay";
  })();

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <AddProductHeader
        title={isEditMode ? "Edit Listing" : "Post a Listing"}
        onClearDraft={isEditMode ? null : clearDraft}
      />

      {/* ── VERIFICATION UPSELL — unverified at 3-cap ── */}
      {showVerificationModal && !isEditMode && (
        <VerificationUpsellModal
          onClose={() => setShowVerificationModal(false)}
          trialRemaining={trialRemaining}
        />
      )}

      {/* ── SUBSCRIPTION UPSELL — verified at 500-cap ── */}
      {showSubscriptionModal && !isEditMode && (
        <SubscriptionUpsellModal
          onClose={() => setShowSubscriptionModal(false)}
          lifetimeUsed={
            subscriptionData?.lifetimeUsed ?? lifetimeUsed ?? 500
          }
          lifetimeMax={
            subscriptionData?.lifetimeMax ?? lifetimeMax ?? 500
          }
          upgradeUrl={
            subscriptionData?.upgradeUrl ??
            upgradeUrl ??
            "/seller/subscription/plans"
          }
        />
      )}

      {/* ── PROGRESS BAR ── */}
      {!isEditMode && sectionsComplete < 5 && (
        <div className="ap-top-bar">
          <div className="form-progress" aria-label="Form completion">
            <div
              className="form-progress-bar"
              style={{ width: `${(sectionsComplete / 5) * 100}%` }}
            />
            <span className="form-progress-label">
              {sectionsComplete}/5 sections complete
            </span>
          </div>
        </div>
      )}

      {/* ── EDIT MODE BAR ── */}
      {isEditMode && (
        <div className="ap-edit-mode-bar">
          <span className="ap-edit-mode-icon" aria-hidden="true">
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </span>
          <span>Editing listing</span>
        </div>
      )}

      {/* ── DUPLICATE WARNING ── */}
      {!isEditMode && dupWarning && (
        <div className="duplicate-warning" role="alert">
          <WarningIcon />
          <div>
            <strong>Possible duplicate listing</strong>
            <p>{dupWarning}</p>
          </div>
          <button
            type="button"
            onClick={() => setDupWarning("")}
            className="duplicate-dismiss"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {!isEditMode && dupChecking && (
        <div className="dup-checking" aria-live="polite">
          <SpinnerIcon /> Checking for duplicates…
        </div>
      )}

      {/* ── GLOBAL ERROR / SUCCESS ── */}
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

      {/* ── VERIFICATION NUDGE ── */}
      {needsVerification && verificationData && (
        <VerificationNudgeBanner verificationData={verificationData} />
      )}

      {/* ── PAYMENT RESUME BANNER ── */}
      {!isEditMode && paymentData?.authUrl && (
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
            <button
              type="button"
              className="primary-btn"
              onClick={resumePayment}
            >
              Complete Payment
            </button>
            <button
              type="button"
              className="outline-btn"
              onClick={cancelPendingPayment}
            >
              Cancel &amp; Save Draft
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          SECTION 0 — BASIC INFORMATION
      ════════════════════════════════════════════════════ */}
      <section ref={sec0} className="section form-card">
        <h3 className="section-title">
          Basic Information <SectionDot filled={basicFilled} />
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
            <span />
            <CharCounter value={form.title} max={120} />
          </div>
          {!isEditMode && titleSuggestions.length > 0 && (
            <div className="title-suggestions">
              <span className="title-suggestions-label">Suggestion:</span>
              {titleSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="title-suggestion-chip"
                  onClick={() => {
                    updateForm("title", s);
                    setTitleSuggestions([]);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
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
            <span />
            <CharCounter value={form.description} max={2000} min={10} />
          </div>
        </div>

        {/* Price */}
        <div className="form-group">
          <label htmlFor="ap-price">Price (&#8358;) *</label>
          <input
            id="ap-price"
            type="text"
            inputMode="numeric"
            placeholder="Enter price"
            value={displayPrice(form.price)}
            onChange={(e) =>
              updateForm("price", onlyNumbers(e.target.value))
            }
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 1 — PRODUCT DETAILS
      ════════════════════════════════════════════════════ */}
      <section ref={sec1} className="section form-card">
        <h3 className="section-title">
          Product Details <SectionDot filled={detailsFilled} />
        </h3>

        {/* Category */}
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
              if (!isEditMode) {
                updateForm(
                  "attributes",
                  deepClone(INITIAL_FORM.attributes)
                );
              }
            }}
          />
        </div>

        {/* Subcategory */}
        {subcategories.length > 0 && (
          <div className="form-group">
            <label>Subcategory</label>
            <DropdownModal
              value={normValue(form.subcategory_id)}
              options={subcategories.map((sub) => ({
                id  : String(sub.id),
                name: sub.name,
              }))}
              placeholder="Select subcategory"
              onChange={(value) => updateForm("subcategory_id", value)}
            />
          </div>
        )}

        {/* Brand */}
        {normalizedOptions.brand.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("brand")}</label>
            <DropdownModal
              value={attributes?.brand ?? ""}
              options={normalizedOptions.brand}
              onChange={(v) => updateAttribute("brand", v)}
            />
          </div>
        )}

        {/* Model */}
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

        {/* Dynamic fields */}
        {fields.map((field) => {
          const fieldOptions = normalizedOptions[field] ?? [];
          if (!fieldOptions.length) return null;
          if (
            field === "used_detail" &&
            attributes?.condition !== "Used"
          ) return null;
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

        {/* Features */}
        {totalFeatureCount > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div
              className="checkbox-grid-inline"
              role="group"
              aria-label="Product features"
            >
              {visibleFeatures.map((feature) => (
                <label
                  key={safeStr(feature)}
                  className="checkbox-inline"
                >
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

      {/* ════════════════════════════════════════════════════
          SECTION 2 — CONTACT INFORMATION
          ✅ v6: Email completely removed
                 Only Phone + WhatsApp + WhatsApp Link shown
      ════════════════════════════════════════════════════ */}
      <section ref={sec2} className="section form-card">
        <h3 className="section-title">
          Contact Information <SectionDot filled={contactFilled} />
        </h3>

        {/* ✅ Phone Number — required */}
        <div className="form-group">
          <label htmlFor="ap-phone">Phone Number *</label>
          <input
            id="ap-phone"
            type="tel"
            value={form.contact?.phone ?? ""}
            placeholder="08012345678"
            onChange={(e) =>
              updateContact("phone", onlyDigits(e.target.value))
            }
            maxLength={15}
            autoComplete="tel"
          />
          <small className="field-hint">
            Buyers will use this to contact you
          </small>
        </div>

        {/* ✅ WhatsApp Number — optional */}
        <div className="form-group">
          <label htmlFor="ap-wa">
            WhatsApp Number{" "}
            <span className="label-optional">(optional)</span>
          </label>
          <input
            id="ap-wa"
            type="tel"
            value={form.contact?.whatsapp ?? ""}
            placeholder="08012345678"
            onChange={(e) =>
              updateContact("whatsapp", onlyDigits(e.target.value))
            }
            maxLength={15}
          />
          <small className="field-hint">
            Leave blank if same as phone number
          </small>
        </div>

        {/* ✅ WhatsApp Link — optional */}
        <div className="form-group">
          <label htmlFor="ap-wa-link">
            WhatsApp Link{" "}
            <span className="label-optional">(optional)</span>
          </label>
          <input
            id="ap-wa-link"
            type="url"
            value={form.contact?.whatsapp_link ?? ""}
            placeholder="https://wa.me/2348012345678"
            onChange={handleWaLinkChange}
            onBlur={handleWaLinkBlur}
          />
          {waLinkError ? (
            <small className="field-hint field-hint--error">
              {waLinkError}
            </small>
          ) : (
            <small className="field-hint">
              Optional — buyers can tap to open a WhatsApp chat
            </small>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 3 — LOCATION & DELIVERY
      ════════════════════════════════════════════════════ */}
      <section ref={sec3} className="section form-card">
        <h3 className="section-title">
          Location &amp; Delivery <SectionDot filled={locationFilled} />
        </h3>

        {/* Detect Location */}
        {detectLocation && (
          <div className="detect-location-row">
            <button
              type="button"
              className="detect-location-btn"
              onClick={detectLocation}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <><SpinnerIcon /> Detecting location&#8230;</>
              ) : (
                <>
                  <LocationPinIcon />
                  {detectedCoords
                    ? "Location detected"
                    : "Detect my location"}
                </>
              )}
            </button>
          </div>
        )}

        {/* State & City */}
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

        {/* Delivery Toggle */}
        <div className="form-group">
          <label htmlFor="ap-delivery-toggle">Delivery Available</label>
          <label className="toggle-switch">
            <input
              id="ap-delivery-toggle"
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) =>
                updateDelivery("available", e.target.checked)
              }
            />
            <span className="slider" />
            <span
              className={`toggle-status${
                form.delivery.available ? " toggle-status--on" : ""
              }`}
            >
              {form.delivery.available
                ? "Yes — delivery available"
                : "No delivery"}
            </span>
          </label>
        </div>

        {/* Delivery Details */}
        {form.delivery.available && (
          <div className="delivery-grid">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-del-from">From Day *</label>
                <input
                  id="ap-del-from"
                  type="number"
                  min="1"
                  max="30"
                  value={form.delivery.duration.from}
                  onChange={(e) =>
                    handleDeliveryDuration("from", clampDay(e.target.value))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-to">To Day *</label>
                <input
                  id="ap-del-to"
                  type="number"
                  min="1"
                  max="30"
                  value={form.delivery.duration.to}
                  onChange={(e) =>
                    handleDeliveryDuration("to", clampDay(e.target.value))
                  }
                />
              </div>
            </div>

            {deliveryRangeError && (
              <div
                className="form-error"
                role="alert"
                style={{ marginBottom: 10 }}
              >
                <WarningIcon /> {deliveryRangeError}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-del-fee">Fee (&#8358;) *</label>
                <input
                  id="ap-del-fee"
                  type="text"
                  inputMode="numeric"
                  value={displayPrice(form.delivery.fee)}
                  onChange={(e) =>
                    updateDelivery("fee", onlyNumbers(e.target.value))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-note">
                  Delivery Note{" "}
                  <span className="label-optional">(optional)</span>
                </label>
                <textarea
                  id="ap-del-note"
                  rows={2}
                  value={form.delivery.note}
                  onChange={(e) =>
                    updateDelivery("note", e.target.value)
                  }
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

      {/* ════════════════════════════════════════════════════
          SECTION 4 — PRODUCT IMAGES
      ════════════════════════════════════════════════════ */}
      <section ref={sec4} className="section form-card">
        <h3 className="section-title">
          Product Images * <SectionDot filled={imagesFilled} />
        </h3>

        <div className="image-count-status">
          <span
            className={`image-count-badge${
              totalImageCount >= MAX_IMAGES
                ? " image-count-badge--full"
                : ""
            }`}
          >
            {totalImageCount}/{MAX_IMAGES} images
          </span>
          {isEditMode && existingImages.length > 0 && (
            <span className="image-count-existing">
              {existingImages.length} existing · {images.length} new
            </span>
          )}
        </div>

        {hasImageErrors && (
          <div
            className="form-error"
            role="alert"
            style={{ marginBottom: 10 }}
          >
            <WarningIcon />{" "}
            {Object.keys(imageErrors).length} image
            {Object.keys(imageErrors).length !== 1 ? "s have" : " has"}{" "}
            errors — fix before submitting
          </div>
        )}

        {isEditMode && (
          <ExistingImageGrid
            existingImages={existingImages}
            onRemove={removeExistingImage}
          />
        )}

        {(images.length > 0 || canAddMore) && (
          <ImageGrid
            images={images}
            imageErrors={imageErrors}
            MAX_IMAGES={MAX_IMAGES}
            canAddMore={canAddMore}
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
        )}

        {totalImageCount > 0 && (
          <div className="image-footer">
            <small className="image-count">
              {totalImageCount}/{MAX_IMAGES} images
            </small>
            <small className="field-hint">
              {isEditMode
                ? "Remove existing images above or add new ones below"
                : "First image is the main photo · drag to reorder"}
            </small>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 5 — PROMOTION PLAN (create mode only)
      ════════════════════════════════════════════════════ */}
      {!isEditMode && (
        <section ref={sec5} className="section form-card">
          <h3 className="section-title">Promotion Plan</h3>

          {plansLoading && (
            <div className="plans-loading" aria-live="polite">
              <SpinnerIcon /> Loading plans&#8230;
            </div>
          )}

          {!plansLoading && promotionPlans.length === 0 && (
            <div className="form-error" role="alert">
              <WarningIcon /> Could not load promotion plans. Please refresh.
            </div>
          )}

          {!plansLoading && promotionPlans.length > 0 && (
            <div
              className="plans-grid"
              role="radiogroup"
              aria-label="Promotion plan"
            >
              {promotionPlans.map((plan, planIndex) => {
                const isSelected  =
                  String(selectedPlan?.id) === String(plan.id);
                const isBestValue =
                  String(plan.id) === String(bestValuePlanId);
                return (
                  <div
                    key={plan.id}
                    ref={(el) => {
                      if (el) planRefs.current[planIndex] = el;
                    }}
                    className={[
                      "plan-card",
                      isSelected  ? "selected"        : "",
                      isBestValue ? "plan-card--best" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() =>
                      setSelectedPlan(isSelected ? null : plan)
                    }
                    role="radio"
                    tabIndex={isSelected ? 0 : -1}
                    aria-checked={isSelected}
                    aria-label={`${plan.name} plan${
                      isBestValue ? " — Best Value" : ""
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedPlan(isSelected ? null : plan);
                        return;
                      }
                      const total = promotionPlans.length;
                      if (
                        e.key === "ArrowRight" ||
                        e.key === "ArrowDown"
                      ) {
                        e.preventDefault();
                        const next = (planIndex + 1) % total;
                        setSelectedPlan(promotionPlans[next]);
                        planRefs.current[next]?.focus();
                      }
                      if (
                        e.key === "ArrowLeft" ||
                        e.key === "ArrowUp"
                      ) {
                        e.preventDefault();
                        const prev = (planIndex - 1 + total) % total;
                        setSelectedPlan(promotionPlans[prev]);
                        planRefs.current[prev]?.focus();
                      }
                    }}
                  >
                    {isBestValue && (
                      <div className="plan-best-badge">
                        <StarIcon /> Best Value
                      </div>
                    )}
                    <div className="plan-header">
                      <strong>{plan.name}</strong>
                      <span className="plan-price">
                        {planPriceLabel(plan)}
                      </span>
                    </div>
                    <div className="plan-duration">
                      {plan.duration ||
                        `${plan.duration_days ?? 30} days`}
                    </div>
                    {Array.isArray(plan.features) &&
                      plan.features.length > 0 && (
                        <ul className="plan-features">
                          {plan.features.map((f) => (
                            <li key={safeStr(f)}>
                              <CheckIcon /> {safeStr(f)}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── TERMS CHECKBOX ── */}
      {!isEditMode && TermsCheckbox}

      {/* ── EDIT BACK HINT ── */}
      {isEditMode && (
        <p className="edit-back-hint">
          Changes are saved to your listing immediately.{" "}
          <Link to="/dashboard">← Back to Dashboard</Link>
        </p>
      )}

      {/* ── STICKY SUBMIT BAR ── */}
      <div className="button-section">
        <span
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {loading
            ? isEditMode
              ? "Saving changes"
              : "Processing submission"
            : ""}
        </span>

        <button
          type="button"
          disabled={submitBlocked}
          className="primary-btn full-width"
          onClick={handleSubmit}
          aria-busy={loading}
          title={submitTitle}
        >
          {loading ? (
            <>
              <SpinnerIcon />{" "}
              {isEditMode ? "Saving…" : "Processing…"}
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </>
  );
}