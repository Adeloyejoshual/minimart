// src/pages/product/components.jsx
import { useMemo, useState, useEffect } from "react";
import DropdownModal    from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

/* ── Pure helpers (outside component) ───────────────────────── */
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

/* ── SVG Icons ───────────────────────────────────────────────── */
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

/* ── Payment countdown ───────────────────────────────────────── */
function PaymentCountdown({ createdAt, maxAgeMs }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, maxAgeMs - (Date.now() - createdAt))
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1_000));
    }, 1_000);
    return () => clearInterval(id);
  }, [remaining]);

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

/* ── Main component ──────────────────────────────────────────── */
export default function ProductComponents({
  form, attributes, images, state, city, categories,
  selectedPlan, paymentData, loading, error, success,
  states, cities, options, selectedCategory,
  agreedToTerms, TermsCheckbox, detectedCoords, detectingLocation,
  MAX_IMAGES      = 6,
  promotionPlans  = [],
  plansLoading    = false,
  updateForm, updateAttribute, updateContact, updateDelivery,
  updateDeliveryDuration, toggleFeature, setState, setCity,
  setSelectedPlan, handleImages, removeImage, handleSubmit,
  clearDraft, detectLocation, resumePayment, cancelPendingPayment,
  displayPrice, formatLabel, onlyNumbers, onlyDigits, INITIAL_FORM,
}) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  /* ── Release card stacking context after entry animations ── */
  useEffect(() => {
    const cards = document.querySelectorAll(".section, .form-card");
    const timers = Array.from(cards).map((card, i) =>
      setTimeout(() => {
        card.classList.add("ap-entered");
      }, 400 + i * 60 + 100)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  /* ── Derived ── */
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
      .filter((f) => {
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
      })
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

  const visibleFeatures = useMemo(() => {
    const all = Array.isArray(options?.features) ? options.features : [];
    return showAllFeatures ? all : all.slice(0, 12);
  }, [options?.features, showAllFeatures]);

  const totalFeatureCount = Array.isArray(options?.features)
    ? options.features.length
    : 0;

  const optionsMap = useMemo(() => ({
    brand            : normalizeOptions(options?.brands),
    color            : normalizeOptions(options?.colors),
    condition        : normalizeOptions(options?.conditions),
    used_detail      : normalizeOptions(options?.used_details    ?? options?.usedDetails    ?? []),
    ram              : normalizeOptions(options?.ram),
    storage          : normalizeOptions(options?.storage),
    sim              : normalizeOptions(options?.sim),
    year             : normalizeOptions(options?.years),
    engine           : normalizeOptions(options?.engine          ?? options?.engines        ?? []),
    fuel_type        : normalizeOptions(options?.fuelType        ?? options?.fuel_types      ?? []),
    size             : normalizeOptions(options?.size),
    age_range        : normalizeOptions(options?.age_range),
    bedrooms         : normalizeOptions(options?.bedrooms),
    bathrooms        : normalizeOptions(options?.bathrooms),
    experience_level : normalizeOptions(options?.experience_level),
    skills           : normalizeOptions(options?.skills),
    features         : Array.isArray(options?.features) ? options.features : [],
  }), [options]);

  /* ── Plan price label ── */
  const planPriceLabel = (plan) => {
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
  };

  /* ── Delivery day clamp ── */
  const clampDay = (val) => {
    const n = parseInt(val.replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n) || n < 1) return "";
    if (n > 30) return "30";
    return String(n);
  };

  /* ── WhatsApp link sanitiser ── */
  const sanitizeWhatsAppLink = (val) => {
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
  };

  /* ── Render ── */
  return (
    <>
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* Feedback banners */}
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

      {/* Incomplete payment banner */}
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

      {/* ── Basic Information ── */}
      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>

        <div className="form-group">
          <label htmlFor="ap-title">Product Title *</label>
          <input
            id="ap-title"
            placeholder="e.g. HP Pavilion 15 Laptop"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ap-desc">Description *</label>
          <textarea
            id="ap-desc"
            rows={4}
            placeholder="Describe your product in detail"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            maxLength={2000}
          />
        </div>

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
        </div>
      </section>

      {/* ── Product Details ── */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>

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

      {/* ── Contact Information ── */}
      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>

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
          <div className="form-group">
            <label htmlFor="ap-wa">WhatsApp *</label>
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
            <label htmlFor="ap-wa-link">WhatsApp Link</label>
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
                if (e.target.value && !safe)
                  updateContact("whatsapp_link", "");
              }}
            />
            <small className="field-hint">
              Format: https://wa.me/2348012345678
            </small>
          </div>
        </div>
      </section>

      {/* ── Location & Delivery ── */}
      <section className="section form-card">
        <h3 className="section-title">Location &amp; Delivery</h3>

        {detectLocation && (
          <div className="detect-location-row">
            <button
              type="button"
              className="detect-location-btn"
              onClick={detectLocation}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <>
                  <SpinnerIcon />
                  {" "}Detecting location&#8230;
                </>
              ) : (
                <>
                  <LocationPinIcon />
                  {detectedCoords ? "Location detected" : "Detect my location"}
                </>
              )}
            </button>
            <small className="field-hint">Auto-fills your state and city</small>
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

        {/* ── UPDATED TOGGLE WITH STATUS TEXT ── */}
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
                <input
                  id="ap-del-from"
                  type="number"
                  min="1"
                  max="30"
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
                  type="number"
                  min="1"
                  max="30"
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
                  type="text"
                  inputMode="numeric"
                  value={displayPrice(form.delivery.fee)}
                  onChange={(e) =>
                    updateDelivery("fee", onlyNumbers(e.target.value))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="ap-del-note">Delivery Note</label>
                <textarea
                  id="ap-del-note"
                  rows={2}
                  value={form.delivery.note}
                  onChange={(e) => updateDelivery("note", e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Product Images ── */}
      <section className="section form-card">
        <h3 className="section-title">Product Images *</h3>
        <small className="field-hint">
          Max {MAX_IMAGES} images &middot; up to 3 MB each
        </small>

        <div className="preview-grid-modern image-upload-box ap-image-box">
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
                  <line x1="13" y1="1" x2="1"  y2="13"/>
                </svg>
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="add-image-box add-image-btn">
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
              <svg viewBox="0 0 20 20" width="22" height="22" fill="none"
                   stroke="currentColor" strokeWidth="1.6"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="10" y1="4" x2="10" y2="16"/>
                <line x1="4"  y1="10" x2="16" y2="10"/>
              </svg>
              <span>Add Images</span>
            </label>
          )}
        </div>

        {images.length > 0 && (
          <small className="image-count">
            {images.length}/{MAX_IMAGES} images added
          </small>
        )}
      </section>

      {/* ── Promotion Plan ── */}
      <section className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>

        {plansLoading && (
          <div className="plans-loading" aria-live="polite">
            <SpinnerIcon />
            {" "}Loading plans&#8230;
          </div>
        )}

        {!plansLoading && promotionPlans.length === 0 && (
          <div className="form-error" role="alert">
            <WarningIcon />
            {" "}Could not load promotion plans. Please refresh the page.
          </div>
        )}

        {!plansLoading && promotionPlans.length > 0 && (
          <div
            className="plans-grid"
            role="radiogroup"
            aria-label="Promotion plan"
          >
            {promotionPlans.map((plan) => {
              const isSelected =
                String(selectedPlan?.id) === String(plan.id);
              return (
                <div
                  key={plan.id}
                  className={`plan-card${isSelected ? " selected" : ""}`}
                  onClick={() => setSelectedPlan(isSelected ? null : plan)}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isSelected}
                  aria-label={`${plan.name} plan`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlan(isSelected ? null : plan);
                    }
                  }}
                >
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
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Terms + Submit ── */}
      <div className="button-section section form-card">
        {TermsCheckbox}

        <button
          type="button"
          disabled={loading || !agreedToTerms || plansLoading}
          className="primary-btn full-width"
          onClick={handleSubmit}
          aria-busy={loading}
          aria-live="polite"
          title={
            !agreedToTerms
              ? "Please accept the Terms & Conditions first"
              : plansLoading
              ? "Plans are still loading"
              : undefined
          }
        >
          {loading ? (
            <>
              <SpinnerIcon />
              <span className="sr-only">Submitting, please wait…</span>
              {" "}Processing&#8230;
            </>
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