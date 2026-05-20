import { useMemo } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const normalizeOptions = (list = []) =>
  Array.isArray(list)
    ? list
        .map((item) =>
          typeof item === "string"
            ? { id: item, name: item }
            : {
                id: String(item.id ?? item.value ?? item.name ?? ""),
                name: item.name ?? item.label ?? item.id ?? "",
              }
        )
        .filter((item) => item.id && item.name)
    : [];

const getSelectedCategory = (categories, id) =>
  Array.isArray(categories)
    ? categories.find((c) => String(c.id) === String(id)) ?? null
    : null;

const toArray = (v) => (Array.isArray(v) ? v : []);

/* ─────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────── */

export default function ProductComponents({
  form,
  attributes,
  images,
  state,
  city,
  categories,
  promotionPlans = [],
  selectedPlan,
  paymentData,
  loading,
  error,
  success,
  states,
  cities,
  options,
  selectedCategory,
  agreedToTerms,
  TermsCheckbox,
  detectedCoords,
  detectingLocation,
  MAX_IMAGES = 6,
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
  displayPrice,
  formatLabel,
  onlyNumbers,
  onlyDigits,
  INITIAL_FORM,
}) {

  /* ────────────────────────────────────────────────────────────
     Category Logic
  ──────────────────────────────────────────────────────────── */

  const categoryOptions = useMemo(
    () =>
      Array.isArray(categories)
        ? categories
            .map((c) => ({ id: String(c.id), name: c.name }))
            .filter((c) => c.id && c.name)
        : [],
    [categories]
  );

  const activeCategory =
    selectedCategory ?? getSelectedCategory(categories, form.category_id);

  const subcategories = activeCategory?.subcategories ?? [];

  const fields = useMemo(() => {
    if (!activeCategory) return [];
    const backendFields = Array.isArray(options?.fields)
      ? options.fields
      : [];
    const localFields = categoryFields[activeCategory.name] ?? [];

    return [...backendFields, ...localFields]
      .filter(Boolean)
      .filter((f, i, arr) => arr.indexOf(f) === i)
      .filter((f) => f !== "brand" && f !== "model");
  }, [activeCategory, options]);

  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    const key = String(attributes.brand).toLowerCase();
    return normalizeOptions(options?.models?.[key] ?? []);
  }, [attributes?.brand, options]);

  const showModelField = !!attributes?.brand;

  const optionsMap = useMemo(() => ({
    brand: normalizeOptions(options?.brands),
    color: normalizeOptions(options?.colors),
    condition: normalizeOptions(options?.conditions),
    used_detail: normalizeOptions(options?.used_details),
    ram: normalizeOptions(options?.ram),
    storage: normalizeOptions(options?.storage),
    sim: normalizeOptions(options?.sim),
    year: normalizeOptions(options?.years),
    engine: normalizeOptions(options?.engine),
    fuel_type: normalizeOptions(options?.fuelType),
    size: normalizeOptions(options?.size),
    age_range: normalizeOptions(options?.age_range),
    bedrooms: normalizeOptions(options?.bedrooms),
    bathrooms: normalizeOptions(options?.bathrooms),
    experience_level: normalizeOptions(options?.experience_level),
    skills: normalizeOptions(options?.skills),
    features: Array.isArray(options?.features) ? options.features : [],
  }), [options]);

  const currentFeatures = toArray(attributes?.features);
  const isFreePlan = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;

  /* ────────────────────────────────────────────────────────────
     UI
  ──────────────────────────────────────────────────────────── */

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky-header">
        <AddProductHeader title="Add Product" onClearDraft={clearDraft} />
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}
      {success && <div className="form-success">✅ {success}</div>}

      {/* BASIC INFO */}
      <Section title="Basic Information">
        <Input
          label="Product Title *"
          value={form.title}
          onChange={(v) => updateForm("title", v)}
        />

        <Textarea
          label="Description *"
          value={form.description}
          onChange={(v) => updateForm("description", v)}
        />

        <Input
          label="Price (₦) *"
          value={displayPrice(form.price)}
          onChange={(v) => updateForm("price", onlyNumbers(v))}
        />
      </Section>

      {/* PROMOTION PLANS */}
      <Section title="Promotion Plan">
        <div className="plans-grid">

          {promotionPlans.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            const isFree = Number(plan.price) === 0;

            return (
              <div
                key={plan.id}
                className={`plan-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="plan-header">
                  <strong>{plan.name}</strong>
                  <span className="plan-price">
                    {isFree
                      ? "Free"
                      : `₦${displayPrice(plan.price)}`}
                  </span>
                </div>

                <div className="plan-duration">
                  {plan.duration ?? "Limited time"}
                </div>

                {!isFree && (
                  <small className="plan-priority">
                    Boost Priority: {plan.priority}
                  </small>
                )}

                {isSelected && (
                  <div className="selected-indicator">
                    ✓ Selected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* TERMS + SUBMIT */}
      <div className="button-section">
        {TermsCheckbox}

        <button
          type="button"
          disabled={loading || !agreedToTerms}
          className="primary-btn full-width"
          onClick={handleSubmit}
        >
          {loading
            ? "Processing..."
            : isFreePlan
            ? "🚀 Post Ad"
            : "🚀 Post Ad & Pay"}
        </button>

        {paymentData && (
          <button
            className="outline-btn full-width"
            onClick={() => window.open(paymentData.authUrl, "_blank")}
          >
            💳 Complete Payment
          </button>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Small Reusable UI Components
────────────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <section className="section form-card">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}