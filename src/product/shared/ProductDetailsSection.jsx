/**
 * src/product/shared/ProductDetailsSection.jsx
 * Category · Subcategory · Brand · Model · Fields · Features
 *
 * v2 — Inline field error for Category (from v8 useAddProduct)
 *      Shows "Category required." inline under the Category dropdown
 */
import { useMemo, useState } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import DropdownModal      from "../../components/DropdownModal.jsx";
import { categoryFields } from "../../config/categoryFields.js";
import { INITIAL_FORM }   from "../../hooks/useFormState.js";
import SectionDot         from "../../pages/product/components/SectionDot.jsx";
import { WarningIcon }    from "../../pages/product/components/icons/index.jsx";

const safeStr   = (v) => (typeof v === "string" ? v : String(v ?? ""));
const toArray   = (v) => (Array.isArray(v) ? v : []);
const deepClone = (o) => structuredClone(o);

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
    .filter((i) => i.id && i.name);
}

export default function ProductDetailsSection({ innerRef }) {
  const {
    form, updateForm, attributes, updateAttribute,
    categories, selectedCategory, options,
    isEditMode, toggleFeature, formatLabel,
    fieldError,   /* ✅ v8: inline field errors */
  } = useAddProductContext();

  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const activeCategory =
    selectedCategory ??
    categories.find((c) => String(c.id) === String(form.category_id)) ?? null;

  const subcategories = activeCategory?.subcategories ?? [];

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: String(c.id), name: c.name }))
                    .filter((c) => c.id && c.name),
    [categories]
  );

  const fields = useMemo(() => {
    if (!activeCategory) return [];
    const backend = Array.isArray(options?.fields)
      ? options.fields.map((f) => (typeof f === "object" ? f.name ?? f.id : f))
      : [];
    const local = categoryFields[activeCategory.name] ?? [];
    const seen = new Set();
    return [...backend, ...local]
      .filter(Boolean)
      .filter((f) => typeof f === "string" && f.trim())
      .filter((f) => { if (seen.has(f)) return false; seen.add(f); return true; })
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
    used_detail     : normalizeOptions(options?.used_details ?? options?.usedDetails ?? []),
    ram             : normalizeOptions(options?.ram),
    storage         : normalizeOptions(options?.storage),
    sim             : normalizeOptions(options?.sim),
    year            : normalizeOptions(options?.years),
    engine          : normalizeOptions(options?.engine ?? options?.engines ?? []),
    fuel_type       : normalizeOptions(options?.fuelType ?? options?.fuel_types ?? []),
    size            : normalizeOptions(options?.size),
    age_range       : normalizeOptions(options?.age_range),
    bedrooms        : normalizeOptions(options?.bedrooms),
    bathrooms       : normalizeOptions(options?.bathrooms),
    experience_level: normalizeOptions(options?.experience_level),
    skills          : normalizeOptions(options?.skills),
    features        : Array.isArray(options?.features) ? options.features : [],
  }), [options]);

  const allFeatures     = normalizedOptions.features;
  const visibleFeatures = showAllFeatures ? allFeatures : allFeatures.slice(0, 12);
  const totalFeatureCount = allFeatures.length;
  const selectedFeaturesSet = new Set(toArray(attributes?.features));
  const showModelField = !!attributes?.brand;
  const detailsFilled  = !!form.category_id;

  /* Helper — checks if a specific field has an error right now */
  const hasError = (field) => fieldError?.field === field;

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Product Details <SectionDot filled={detailsFilled} />
      </h3>

      {/* ── CATEGORY ── */}
      <div className={`form-group ${hasError("category") ? "has-error" : ""}`}>
        <label>Category *</label>
        <DropdownModal
          value={String(form.category_id ?? "")}
          options={categoryOptions}
          placeholder="Select category"
          onChange={(value) => {
            if (String(value) === String(form.category_id)) return;
            updateForm("category_id", value);
            updateForm("subcategory_id", "");
            if (!isEditMode)
              updateForm("attributes", deepClone(INITIAL_FORM.attributes));
          }}
        />

        {hasError("category") && (
          <div className="field-error" role="alert">
            <WarningIcon />
            <span>{fieldError.message}</span>
          </div>
        )}
      </div>

      {/* ── SUBCATEGORY ── */}
      {subcategories.length > 0 && (
        <div className="form-group">
          <label>Subcategory</label>
          <DropdownModal
            value={String(form.subcategory_id ?? "")}
            options={subcategories.map((s) => ({ id: String(s.id), name: s.name }))}
            placeholder="Select subcategory"
            onChange={(v) => updateForm("subcategory_id", v)}
          />
        </div>
      )}

      {/* ── BRAND ── */}
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

      {/* ── MODEL ── */}
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

      {/* ── DYNAMIC CATEGORY FIELDS ── */}
      {fields.map((field) => {
        const fieldOptions = normalizedOptions[field] ?? [];
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

      {/* ── FEATURES ── */}
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