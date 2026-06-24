/**
 * src/pages/product/ProductDetailsSection.jsx
 */
import { useMemo } from "react";
import DropdownModal    from "../../components/DropdownModal.jsx";
import { categoryFields } from "../../config/categoryFields.js";
import { SectionDot }   from "./atoms.jsx";

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

const safeStr = (v) => (typeof v === "string" ? v : String(v ?? ""));
const toArray = (v) => (Array.isArray(v) ? v : []);

export default function ProductDetailsSection({
  form,
  attributes,
  categories   = [],
  selectedCategory = null,
  options      = {},
  INITIAL_FORM,
  updateForm,
  updateAttribute,
  toggleFeature,
  formatLabel,
  deepClone,
  /* extra ─ show all features toggle */
  showAllFeatures,
  setShowAllFeatures,
}) {
  /* ── Category options ── */
  const categoryOptions = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories
      .map((cat) => ({ id: String(cat.id), name: cat.name }))
      .filter((cat) => cat.id && cat.name);
  }, [categories]);

  const activeCategory = selectedCategory
    ?? getSelectedCategory(categories, form.category_id);
  const subcategories  = activeCategory?.subcategories ?? [];

  /* ── Fields for this category ── */
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

  /* ── Model options ── */
  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    return normalizeOptions(
      options?.models?.[String(attributes.brand).toLowerCase()] ?? []
    );
  }, [attributes?.brand, options]);

  const showModelField = !!attributes?.brand;

  /* ── Options map ── */
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
    features         : Array.isArray(options?.features) ? options.features : [],
  }), [options]);

  const allFeatures       = optionsMap.features;
  const visibleFeatures   = showAllFeatures ? allFeatures : allFeatures.slice(0, 12);
  const totalFeatureCount = allFeatures.length;

  const selectedFeaturesSet = useMemo(
    () => new Set(toArray(attributes?.features)),
    [attributes?.features]
  );

  const detailsFilled = !!form.category_id;

  return (
    <section className="section form-card">
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
            updateForm("attributes",     deepClone(INITIAL_FORM.attributes));
          }}
        />
      </div>

      {/* Subcategory */}
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

      {/* Brand */}
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
              onChange={(e) => updateAttribute("model", e.target.value.trimStart())}
            />
          )}
        </div>
      )}

      {/* Dynamic attribute fields */}
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

      {/* Features */}
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
  );
}