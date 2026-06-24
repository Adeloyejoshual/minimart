/**
 * src/pages/product/components.jsx
 *
 * Thin orchestrator — composes the 6 section components.
 * All business logic, state, and heavy lifting lives in AddProduct.jsx.
 * This file only wires props to sections and handles the few
 * pieces of local state that don't belong in any single section.
 */

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";

import AddProductHeader from "../../components/AddProductHeader.jsx";

import {
  AutoSaveIndicator,
  DraftRecoveryBanner,
  PaymentCountdown,
  SellerLimitsBanner,
  VerificationNudgeBanner,
  VerificationUpsellModal,
  WarningIcon,
  CheckCircleIcon,
  CardIcon,
  SparkleIcon,
  CharCounter,
  SectionDot,
} from "./atoms.jsx";

import ProductDetailsSection from "./ProductDetailsSection.jsx";
import ContactSection        from "./ContactSection.jsx";
import LocationSection       from "./LocationSection.jsx";
import ImageSection, { MIN_IMAGES } from "./ImageSection.jsx";
import PromotionSection      from "./PromotionSection.jsx";
import SubmitSection         from "./SubmitSection.jsx";

/* ── Helpers ── */
const toArray   = (v) => (Array.isArray(v) ? v : []);
const deepClone = (obj) =>
  typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

async function hashImageFile(file) {
  try {
    const buf  = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES     = 3 * 1024 * 1024;

/* Smart title suggestion from description */
function buildTitleSuggestion(description) {
  if (!description || description.length < 20) return null;
  const text   = description.trim();
  const specs  = text.match(/\b(\d+\s?[TGMK]B|\d+[Kk]|\d{3,4}[pP]|[iI]\d|[mM]\d)\b/g) ?? [];
  const branded = text.match(/\b[A-Z][a-z]{1,14}\b/g)?.filter(
    (w) => !["The","And","For","With","This","That","From","Have","Will",
              "Good","Used","Sold","Come","Just","Like","Well","Also"].includes(w)
  ) ?? [];
  const nouns = text.match(
    /\b(laptop|phone|tablet|monitor|keyboard|camera|speaker|tv|headphone|charger|battery|watch|ring|necklace|bag|shoe|shirt|dress|sofa|bed|chair|fridge|fan|iron|blender|car|bike|generator|inverter)\b/gi
  )?.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) ?? [];

  const parts  = [...branded.slice(0, 2), ...nouns.slice(0, 1), ...specs.slice(0, 3)];
  const seen   = new Set();
  const unique = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.length >= 2 ? unique.join(" ") : null;
}

/* ══════════════════════════════════════════════════════════════
   MAIN ORCHESTRATOR
══════════════════════════════════════════════════════════════ */
export default function ProductComponents({
  /* ─ data ─ */
  form, attributes, images, state, city,
  categories = [], selectedPlan = null, paymentData = null,
  loading = false, error = "", success = "",
  states = [], cities = [], options = {}, selectedCategory = null,
  detectedCoords = null, detectingLocation = false, agreedToTerms = false,
  TermsCheckbox, INITIAL_FORM,
  MAX_IMAGES = 6, promotionPlans = [], plansLoading = false,

  /* ─ seller limits ─ */
  sellerLimits = null, limitsLoading = false,
  isVerifiedSeller = false, canPost = true,
  dailyRemaining = null, activeRemaining = null, cooldownSecs = 0,

  /* ─ post-creation ─ */
  needsVerification = false, verificationData = null,

  /* ─ draft ─ */
  draftRestored = false, autoSaveStatus = "idle",

  /* ─ handlers ─ */
  updateForm, updateAttribute, updateContact, updateDelivery,
  updateDeliveryDuration, toggleFeature, setState, setCity,
  setSelectedPlan, handleImages, removeImage, moveImage,
  handleSubmit, clearDraft, detectLocation, resumePayment,
  cancelPendingPayment, onDraftContinue, onDraftDiscard,

  /* ─ formatters ─ */
  displayPrice, formatLabel, onlyNumbers, onlyDigits,

  apiBase = import.meta.env?.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : "/api",
}) {
  /* ── Local UI state ── */
  const [showAllFeatures,    setShowAllFeatures]    = useState(false);
  const [showDraftBanner,    setShowDraftBanner]    = useState(draftRestored);
  const [showUpsellModal,    setShowUpsellModal]    = useState(false);
  const [titleSuggestion,    setTitleSuggestion]    = useState("");
  const [dupWarning,         setDupWarning]         = useState("");
  const [dupChecking,        setDupChecking]        = useState(false);
  const [imageErrors,        setImageErrors]        = useState({});
  const [deliveryRangeError, setDeliveryRangeError] = useState("");

  /* FIX #1: Map<imageId, hash> */
  const imageHashMap  = useRef(new Map());
  /* FIX #3: AbortController for dup check */
  const dupAbortRef   = useRef(null);

  const cardRefs  = useRef([]);
  let   cardIndex = 0;
  const nextCardRef = () => {
    const i = cardIndex++;
    return (el) => { if (el) cardRefs.current[i] = el; };
  };
  cardIndex = 0;

  /* Stagger card entry animations */
  useEffect(() => {
    const timers = cardRefs.current.map((card, i) =>
      setTimeout(() => card?.classList.add("ap-entered"), 420 + i * 60)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => { setShowDraftBanner(draftRestored); }, [draftRestored]);

  /* ── Image validation + hash tracking ── */
  const validateAndHashImages = useCallback(async (incomingImages) => {
    const errors = {};
    for (const img of incomingImages) {
      if (!ALLOWED_TYPES.has(img.file.type)) {
        errors[img.id] = `Wrong type — use JPEG, PNG or WebP`;
        continue;
      }
      if (img.file.size > MAX_BYTES) {
        errors[img.id] = `Too large (${(img.file.size / 1_048_576).toFixed(1)} MB) — max 3 MB`;
        continue;
      }
      if (imageHashMap.current.has(img.id)) continue;

      const hash         = await hashImageFile(img.file);
      const existingEntry = [...imageHashMap.current.entries()]
        .find(([id, h]) => h === hash && id !== img.id);

      if (existingEntry) {
        errors[img.id] = "Duplicate — this photo is already added";
        continue;
      }
      imageHashMap.current.set(img.id, hash);
    }
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
    validateAndHashImages(images).catch(() => {});
  }, [images, validateAndHashImages]);

  /* ── Remove image + clean hash ── */
  const handleRemoveImage = useCallback((id) => {
    imageHashMap.current.delete(id);
    removeImage(id);
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [removeImage]);

  /* ── Server duplicate check with AbortController ── */
  const checkServerDuplicate = useCallback(async () => {
    if (!form.title?.trim() || !form.price || !form.category_id) return;
    dupAbortRef.current?.abort();
    dupAbortRef.current = new AbortController();
    setDupChecking(true);
    try {
      const token  = localStorage.getItem("marketplace_token") ||
                     localStorage.getItem("token");
      const hashes = [...imageHashMap.current.values()];
      const res    = await fetch(`${apiBase}/addproduct/products/check-duplicate`, {
        method  : "POST",
        headers : {
          "Content-Type": "application/json",
          Authorization : token ? `Bearer ${token}` : "",
        },
        body    : JSON.stringify({
          title        : form.title.trim(),
          price        : Number(form.price),
          category_id  : form.category_id,
          image_hashes : hashes,
        }),
        signal  : dupAbortRef.current.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      setDupWarning(data.isDuplicate
        ? (data.message ?? "A similar listing already exists.")
        : ""
      );
    } catch (err) {
      if (err.name !== "AbortError") console.warn("[dup check]", err.message);
    } finally {
      setDupChecking(false);
    }
  }, [form.title, form.price, form.category_id, apiBase]);

  useEffect(() => {
    if (!form.title?.trim() || form.title.length < 8) { setDupWarning(""); return; }
    const t = setTimeout(checkServerDuplicate, 1_200);
    return () => clearTimeout(t);
  }, [form.title, form.price, form.category_id, images.length]); // eslint-disable-line
  useEffect(() => () => dupAbortRef.current?.abort(), []);

  /* ── Smart AI title suggestion ── */
  useEffect(() => {
    if (!form.description || form.description.length < 20 || form.title?.trim().length >= 10) {
      setTitleSuggestion("");
      return;
    }
    const t = setTimeout(() => {
      setTitleSuggestion(buildTitleSuggestion(form.description) ?? "");
    }, 700);
    return () => clearTimeout(t);
  }, [form.description, form.title]);

  /* ── Section completion ── */
  const basicFilled = !!(form.title?.trim() && form.description?.trim() && form.price);
  const hasImageErrors = Object.keys(imageErrors).length > 0;
  const isFreePlan = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;

  cardIndex = 0;

  return (
    <>
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* Upsell modal */}
      {showUpsellModal && (
        <VerificationUpsellModal onClose={() => setShowUpsellModal(false)} />
      )}

      {/* Top bar */}
      <div className="ap-top-bar">
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      {/* Draft recovery */}
      {showDraftBanner && (
        <DraftRecoveryBanner
          onContinue={() => { setShowDraftBanner(false); onDraftContinue?.(); }}
          onDiscard={() => { setShowDraftBanner(false); onDraftDiscard?.(); clearDraft(); }}
        />
      )}

      {/* Duplicate warning */}
      {dupWarning && (
        <div className="duplicate-warning" role="alert">
          <WarningIcon />
          <div>
            <strong>Possible duplicate listing</strong>
            <p>{dupWarning}</p>
          </div>
          <button type="button" className="duplicate-dismiss"
                  onClick={() => setDupWarning("")} aria-label="Dismiss">&times;</button>
        </div>
      )}
      {dupChecking && (
        <div className="dup-checking" aria-live="polite">
          Checking for duplicates…
        </div>
      )}

      {/* Feedback */}
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
        onUpsellClick={() => setShowUpsellModal(true)}
      />

      {/* Incomplete payment */}
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
          {titleSuggestion && (
            <div className="title-suggestions">
              <span className="title-suggestions-label">
                <SparkleIcon /> Suggestion:
              </span>
              <button
                type="button"
                className="title-suggestion-chip"
                onClick={() => { updateForm("title", titleSuggestion); setTitleSuggestion(""); }}
              >
                {titleSuggestion}
              </button>
            </div>
          )}
        </div>

        {/* Description — minimum hint only when broken */}
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
            ) : <span />}
            <CharCounter value={form.description} max={2000} min={10} />
          </div>
        </div>

        {/* Price */}
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
      <div ref={nextCardRef()}>
        <ProductDetailsSection
          form={form}
          attributes={attributes}
          categories={categories}
          selectedCategory={selectedCategory}
          options={options}
          INITIAL_FORM={INITIAL_FORM}
          updateForm={updateForm}
          updateAttribute={updateAttribute}
          toggleFeature={toggleFeature}
          formatLabel={formatLabel}
          deepClone={deepClone}
          showAllFeatures={showAllFeatures}
          setShowAllFeatures={setShowAllFeatures}
        />
      </div>

      {/* ── CONTACT ── */}
      <div ref={nextCardRef()}>
        <ContactSection
          form={form}
          updateContact={updateContact}
          onlyDigits={onlyDigits}
        />
      </div>

      {/* ── LOCATION ── */}
      <div ref={nextCardRef()}>
        <LocationSection
          form={form}
          state={state}
          city={city}
          states={states}
          cities={cities}
          detectedCoords={detectedCoords}
          detectingLocation={detectingLocation}
          detectLocation={detectLocation}
          setState={setState}
          setCity={setCity}
          updateDelivery={updateDelivery}
          updateDeliveryDuration={updateDeliveryDuration}
          onlyNumbers={onlyNumbers}
          displayPrice={displayPrice}
          deliveryRangeError={deliveryRangeError}
          onDeliveryRangeError={setDeliveryRangeError}
        />
      </div>

      {/* ── IMAGES ── */}
      <div ref={nextCardRef()}>
        <ImageSection
          images={images}
          imageErrors={imageErrors}
          MAX_IMAGES={MAX_IMAGES}
          canPost={canPost}
          handleImages={handleImages}
          removeImage={handleRemoveImage}
          moveImage={moveImage}
        />
      </div>

      {/* ── PROMOTION ── */}
      <div ref={nextCardRef()}>
        <PromotionSection
          promotionPlans={promotionPlans}
          plansLoading={plansLoading}
          selectedPlan={selectedPlan}
          isVerifiedSeller={isVerifiedSeller}
          setSelectedPlan={setSelectedPlan}
          displayPrice={displayPrice}
          onUpsellClick={() => setShowUpsellModal(true)}
        />
      </div>

      {/* ── SUBMIT ── */}
      <div ref={nextCardRef()}>
        <SubmitSection
          TermsCheckbox={TermsCheckbox}
          loading={loading}
          agreedToTerms={agreedToTerms}
          plansLoading={plansLoading}
          canPost={canPost}
          isFreePlan={isFreePlan}
          deliveryRangeError={deliveryRangeError}
          hasImageErrors={hasImageErrors}
          cooldownSecs={cooldownSecs}
          dailyRemaining={dailyRemaining}
          activeRemaining={activeRemaining}
          sellerLimits={sellerLimits}
          MIN_IMAGES={MIN_IMAGES}
          imageCount={images.length}
          handleSubmit={handleSubmit}
          onUpsellClick={() => setShowUpsellModal(true)}
        />
      </div>
    </>
  );
}