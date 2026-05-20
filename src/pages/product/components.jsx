import { useMemo } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function normalizeOptions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item };
      return {
        id: String(item.id ?? item.value ?? item.name ?? ""),
        name: item.name ?? item.label ?? item.id ?? "",
      };
    })
    .filter((item) => item.id && item.name);
}

function getSelectedCategory(categories, id) {
  if (!Array.isArray(categories)) return null;
  return categories.find(
    (item) => String(item.id) === String(id)
  ) ?? null;
}

const toArray = (v) => (Array.isArray(v) ? v : []);

/* ─────────────────────────────────────────────
   Progress Indicator
───────────────────────────────────────────── */

function ProgressIndicator({ currentStep }) {
  const steps = ["Basic Info", "Details", "Images", "Promotion"];

  return (
    <div className="progress-wrapper">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div
            key={label}
            className={`progress-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
          >
            <div className="step-circle">
              {isCompleted ? "✓" : stepNumber}
            </div>
            <span className="step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */

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
  currentStep = 1,
}) {

  const categoryOptions = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories.map((cat) => ({
      id: String(cat.id),
      name: cat.name,
    }));
  }, [categories]);

  const activeCategory =
    selectedCategory ??
    getSelectedCategory(categories, form.category_id);

  const subcategories = activeCategory?.subcategories ?? [];

  const fields = useMemo(() => {
    if (!activeCategory) return [];
    const backendFields =
      Array.isArray(options?.fields) ? options.fields : [];
    const localFields =
      categoryFields[activeCategory.name] ?? [];

    return [...backendFields, ...localFields]
      .filter(Boolean)
      .filter((f, i, arr) => arr.indexOf(f) === i)
      .filter((f) => f !== "brand" && f !== "model");
  }, [activeCategory, options]);

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
    features: Array.isArray(options?.features)
      ? options.features
      : [],
  }), [options]);

  const currentFeatures = toArray(attributes?.features);

  const isFreePlan =
    !selectedPlan ||
    Number(selectedPlan?.effective_price ?? selectedPlan?.price ?? 0) === 0;

  return (
    <>
      {/* HEADER */}
      <div className="sticky-header">
        <AddProductHeader
          title="Add Product"
          onClearDraft={clearDraft}
        />
      </div>

      <ProgressIndicator currentStep={currentStep} />

      {error && <div className="form-error">⚠ {error}</div>}
      {success && <div className="form-success">✅ {success}</div>}

      {/* BASIC INFO */}
      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>

        <input
          placeholder="Product Title"
          value={form.title}
          onChange={(e) =>
            updateForm("title", e.target.value)
          }
        />

        <textarea
          rows={4}
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            updateForm("description", e.target.value)
          }
        />

        <input
          type="text"
          inputMode="numeric"
          placeholder="Price"
          value={displayPrice(form.price)}
          onChange={(e) =>
            updateForm("price", onlyNumbers(e.target.value))
          }
        />
      </section>

      {/* PRODUCT DETAILS */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>

        <DropdownModal
          value={String(form.category_id || "")}
          options={categoryOptions}
          placeholder="Select category"
          onChange={(value) => {
            updateForm("category_id", value);
            updateForm("subcategory_id", "");
            updateForm("attributes", INITIAL_FORM.attributes);
          }}
        />

        {subcategories.length > 0 && (
          <DropdownModal
            value={String(form.subcategory_id || "")}
            options={subcategories.map((s) => ({
              id: String(s.id),
              name: s.name,
            }))}
            placeholder="Select subcategory"
            onChange={(value) =>
              updateForm("subcategory_id", value)
            }
          />
        )}

        {fields.map((field) => {
          const fieldOptions = optionsMap[field] ?? [];
          if (!fieldOptions.length) return null;

          return (
            <DropdownModal
              key={field}
              value={attributes?.[field] ?? ""}
              options={fieldOptions}
              placeholder={formatLabel(field)}
              onChange={(v) =>
                updateAttribute(field, v)
              }
            />
          );
        })}
      </section>

      {/* IMAGES */}
      <section className="section form-card">
        <h3 className="section-title">Product Images *</h3>

        <div className="preview-grid-modern">
          {images.map((img) => (
            <div key={img.id}>
              <img src={img.preview} alt="" />
              <button
                type="button"
                onClick={() =>
                  removeImage(img.id)
                }
              >
                ✕
              </button>
            </div>
          ))}

          {images.length < MAX_IMAGES && (
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                handleImages(e.target.files);
                e.target.value = "";
              }}
            />
          )}
        </div>
      </section>

      {/* PROMOTION */}
      <section className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>

        <div className="plans-grid">
          {promotionPlans.map((plan) => {
            const effective =
              Number(plan.effective_price ?? plan.price ?? 0);

            return (
              <div
                key={plan.id}
                className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan)}
              >
                <strong>{plan.name}</strong>
                <div>
                  {effective === 0
                    ? "Free"
                    : `₦${displayPrice(effective)}`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SUBMIT */}
      <div className="button-section">
        {TermsCheckbox}

        <button
          disabled={loading || !agreedToTerms}
          className="primary-btn"
          onClick={handleSubmit}
        >
          {loading
            ? "Processing..."
            : isFreePlan
            ? "Post Ad"
            : "Post Ad & Pay"}
        </button>

        {paymentData && (
          <button
            className="outline-btn"
            onClick={() =>
              window.open(paymentData.authUrl, "_blank")
            }
          >
            Complete Payment
          </button>
        )}
      </div>
    </>
  );
}