import { useMemo } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

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

  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    const key = String(attributes.brand).toLowerCase();
    return normalizeOptions(options?.models?.[key] ?? []);
  }, [attributes?.brand, options]);

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

  const isFreePlan =
    !selectedPlan ||
    Number(selectedPlan?.effective_price ?? selectedPlan?.price ?? 0) === 0;

  const currentFeatures = toArray(attributes?.features);

  return (
    <>
      {/* HEADER */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,.1)",
      }}>
        <AddProductHeader
          title="Add Product"
          onClearDraft={clearDraft}
        />
      </div>

      {error && <div className="form-error">⚠ {error}</div>}
      {success && <div className="form-success">✅ {success}</div>}

      {/* ───────────────────────────────────── */}
      {/* PRODUCT DETAILS */}
      {/* ───────────────────────────────────── */}

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

      {/* ───────────────────────────────────── */}
      {/* PROMOTION PLANS */}
      {/* ───────────────────────────────────── */}

      <section className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>
        <div className="plans-grid">
          {promotionPlans.map((plan) => {
            const effective =
              Number(plan.effective_price ?? plan.price ?? 0);

            return (
              <div
                key={plan.id}
                className={
                  "plan-card" +
                  (selectedPlan?.id === plan.id
                    ? " selected"
                    : "")
                }
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

      {/* ───────────────────────────────────── */}
      {/* SUBMIT */}
      {/* ───────────────────────────────────── */}

      <div className="button-section section form-card">
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
            type="button"
            className="outline-btn full-width"
            onClick={() =>
              window.open(paymentData.authUrl, "_blank")
            }
          >
            💳 Complete Payment
          </button>
        )}
      </div>
    </>
  );
}