import { useMemo } from "react";
import DropdownModal    from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";
import { promotionPlans } from "../../config/promotions.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOptions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item };
      return {
        id:   String(item.id    ?? item.value ?? item.name ?? ""),
        name: item.name ?? item.label ?? item.id ?? "",
      };
    })
    .filter((item) => item.id && item.name);
}

function getSelectedCategory(categories, id) {
  if (!Array.isArray(categories)) return null;
  return categories.find((item) => String(item.id) === String(id)) ?? null;
}

const toArray = (v) => (Array.isArray(v) ? v : []);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductComponents({
  form, attributes, images, state, city, categories,
  selectedPlan, paymentData, loading, error, success,
  states, cities, options, selectedCategory,
  agreedToTerms, TermsCheckbox, detectedCoords, detectingLocation,
  MAX_IMAGES = 6,
  updateForm, updateAttribute, updateContact, updateDelivery,
  updateDeliveryDuration, toggleFeature, setState, setCity,
  setSelectedPlan, handleImages, removeImage, handleSubmit,
  clearDraft, detectLocation,
  displayPrice, formatLabel, onlyNumbers, onlyDigits, INITIAL_FORM,
}) {
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
    const backendFields = Array.isArray(options?.fields) ? options.fields : [];
    const localFields   = categoryFields[activeCategory.name] ?? [];
    return [...backendFields, ...localFields]
      .filter(Boolean)
      .filter((f, i, arr) => arr.indexOf(f) === i)
      .filter((f) => f !== "brand" && f !== "model");
  }, [activeCategory, options]);

  // When backend provides a model list for the chosen brand → dropdown.
  // When no list (the common case) → plain text input.
  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];
    const brandModels = options?.models ?? {};
    // Case-insensitive lookup — models.js uses "HP", "Apple" etc.
    // but the brand value from the dropdown may differ in casing.
    const matchedKey = Object.keys(brandModels).find(
      (k) => k.toLowerCase() === String(attributes.brand).toLowerCase()
    );
    return normalizeOptions(matchedKey ? brandModels[matchedKey] : []);
  }, [attributes?.brand, options]);

  const showModelField = !!attributes?.brand;

  const optionsMap = useMemo(() => ({
    brand:            normalizeOptions(options?.brands),
    color:            normalizeOptions(options?.colors),
    condition:        normalizeOptions(options?.conditions),
    used_detail:      normalizeOptions(options?.used_details ?? options?.usedDetails ?? []),
    ram:              normalizeOptions(options?.ram),
    storage:          normalizeOptions(options?.storage),
    sim:              normalizeOptions(options?.sim),
    year:             normalizeOptions(options?.years),
    engine:           normalizeOptions(options?.engine ?? options?.engines ?? []),
    fuel_type:        normalizeOptions(options?.fuelType ?? options?.fuel_types ?? []),
    size:             normalizeOptions(options?.size),
    age_range:        normalizeOptions(options?.age_range),
    bedrooms:         normalizeOptions(options?.bedrooms),
    bathrooms:        normalizeOptions(options?.bathrooms),
    experience_level: normalizeOptions(options?.experience_level),
    skills:           normalizeOptions(options?.skills),
    features:         Array.isArray(options?.features) ? options.features : [],
  }), [options]);

  const isFreePlan     = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;
  const currentFeatures = toArray(attributes?.features);

  return (
    <>
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        backgroundColor: "var(--bg-surface, #fff)",
        boxShadow: "0 1px 4px rgba(0,0,0,.1)",
      }}>
        <AddProductHeader title="Add Product" onClearDraft={clearDraft} />
      </div>

      {error   && <div className="form-error">&#9888;&#65039; {error}</div>}
      {success && <div className="form-success">&#9989; {success}</div>}

      {/* ── Basic Information ─────────────────────────────────────────────── */}
      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>

        <div className="form-group">
          <label>Product Title *</label>
          <input
            placeholder="e.g. HP Pavilion 15 Laptop"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Description *</label>
          <textarea
            rows={4}
            placeholder="Describe your product in detail"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Price (&#8358;) *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter price"
            value={displayPrice(form.price)}
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          />
        </div>
      </section>

      {/* ── Product Details ───────────────────────────────────────────────── */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>

        <div className="form-group">
          <label>Category *</label>
          <DropdownModal
            value={String(form.category_id || "")}
            options={categoryOptions}
            placeholder="Select category"
            onChange={(value) => {
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
              value={String(form.subcategory_id || "")}
              options={subcategories.map((sub) => ({ id: String(sub.id), name: sub.name }))}
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
            <DropdownModal
              key={"model-" + (attributes?.brand ?? "none")}
              value={attributes?.model ?? ""}
              options={modelOptions}
              placeholder="Select or type model name"
              onChange={(v) => updateAttribute("model", v)}
            />
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

        {optionsMap.features.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline">
              {optionsMap.features.slice(0, 12).map((feature) => (
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
          </div>
        )}
      </section>

      {/* ── Contact Information ───────────────────────────────────────────── */}
      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={form.contact.email}
              placeholder="your@email.com"
              onChange={(e) => updateContact("email", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input
              type="tel"
              value={form.contact.phone}
              placeholder="08012345678"
              onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>WhatsApp *</label>
            <input
              type="tel"
              value={form.contact.whatsapp}
              placeholder="08012345678"
              onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>WhatsApp Link</label>
            <input
              type="url"
              value={form.contact.whatsapp_link}
              placeholder="https://wa.me/234..."
              onChange={(e) => updateContact("whatsapp_link", e.target.value.trim())}
            />
          </div>
        </div>
      </section>

      {/* ── Location and Delivery ─────────────────────────────────────────── */}
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
                <><span className="detect-spinner" />Detecting&#8230;</>
              ) : (
                <>&#128205; {detectedCoords ? "Location detected" : "Detect my location"}</>
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

        <div className="form-group">
          <label>Delivery Available</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) => updateDelivery("available", e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>

        {form.delivery.available && (
          <div className="delivery-grid">
            <div className="form-row">
              <div className="form-group">
                <label>From Day *</label>
                <input
                  type="number" min="1" max="30"
                  value={form.delivery.duration.from}
                  onChange={(e) => updateDeliveryDuration("from", onlyDigits(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>To Day *</label>
                <input
                  type="number" min="1" max="30"
                  value={form.delivery.duration.to}
                  onChange={(e) => updateDeliveryDuration("to", onlyDigits(e.target.value))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fee (&#8358;) *</label>
                <input
                  type="text" inputMode="numeric"
                  value={displayPrice(form.delivery.fee)}
                  onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Delivery Note</label>
                <textarea
                  rows={2}
                  value={form.delivery.note}
                  onChange={(e) => updateDelivery("note", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Product Images ────────────────────────────────────────────────── */}
      <section className="section form-card">
        <h3 className="section-title">Product Images *</h3>
        <small className="field-hint">Max {MAX_IMAGES} images &middot; up to 3 MB each</small>

        <div className="preview-grid-modern image-upload-box">
          {images.map((img) => (
            <div key={img.id} className="preview-thumb">
              <img src={img.preview} alt="preview" />
              <button type="button" onClick={() => removeImage(img.id)}>&#10005;</button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="add-image-box add-image-btn">
              <input
                hidden multiple type="file" accept="image/*"
                onChange={(e) => { handleImages(e.target.files); e.target.value = ""; }}
              />
              <div>+</div>
              <span>Add Images</span>
            </label>
          )}
        </div>

        {images.length > 0 && (
          <small className="image-count">{images.length}/{MAX_IMAGES} images added</small>
        )}
      </section>

      {/* ── Promotion Plan ────────────────────────────────────────────────── */}
      <section className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={"plan-card" + (selectedPlan?.id === plan.id ? " selected" : "")}
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="plan-header">
                <strong>{plan.name}</strong>
                <span className="plan-price">
                  {Number(plan.price) === 0 ? "Free" : "₦" + displayPrice(plan.price)}
                </span>
              </div>
              <div className="plan-duration">{plan.duration || "Always active"}</div>
              {plan.description && <small>{plan.description}</small>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Terms + Submit ────────────────────────────────────────────────── */}
      <div className="button-section section form-card">
        {TermsCheckbox}

        <button
          type="button"
          disabled={loading || !agreedToTerms}
          className="primary-btn full-width"
          onClick={handleSubmit}
          title={!agreedToTerms ? "Please accept the Terms & Conditions first" : undefined}
        >
          {loading ? "⏳ Processing…" : isFreePlan ? "🚀 Post Ad" : "🚀 Post Ad & Pay"}
        </button>

        {paymentData && (
          <button
            type="button"
            className="outline-btn full-width"
            onClick={() => window.open(paymentData.authUrl, "_blank")}
          >
            &#128179; Complete Payment
          </button>
        )}
      </div>
    </>
  );
}
