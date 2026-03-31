// Pages/Product/FormSections.jsx - ALL FORM FIELDS
import { useMemo, useCallback } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import { locationsByState } from "../../config/locationsByState.js";

const INITIAL_ATTRS = {
  brand: "",
  model: "",
  color: "",
  condition: "",
  used_detail: "",
  ram: "",
  storage: "",
  sim: "",
  year: "",
  engine: "",
  fuel_type: "",
  features: [],
};

export default function FormSections({
  form,
  categories,
  selectedCategory,
  state,
  setState,
  city,
  setCity,
  update,
  updateAttr,
  updateContact,
  updateDelivery,
  updateDeliveryDuration,
  toggleFeature,
  handleImages,
}) {
  /* ================= HELPERS ================= */
  const onlyNumbers = useCallback((v = "") => v.replace(/[^D]/g, ""), []);
  
  const normalizeOptions = useCallback((list = []) =>
    Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [],
    []
  );

  const formatLabel = useCallback((t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase()),
    []
  );

  /* ================= DYNAMIC OPTIONS ================= */
  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  const optionsMap = useMemo(() => {
    const modelsForBrand = brand && options.models?.[brand] ? options.models[brand] : [];
    return {
      brand: normalizeOptions(options.brands),
      model: normalizeOptions(modelsForBrand),
      color: normalizeOptions(options.colors),
      condition: normalizeOptions(options.conditions),
      used_detail: normalizeOptions(options.usedDetails),
      ram: normalizeOptions(options.ram),
      storage: normalizeOptions(options.storage),
      sim: normalizeOptions(options.sims),
      year: normalizeOptions(options.years),
      engine: normalizeOptions(options.engines),
      fuel_type: normalizeOptions(options.fuel_types),
    };
  }, [options, brand, normalizeOptions]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [options]);

  /* ================= RESET ATTRS ON CATEGORY CHANGE ================= */
  const handleCategoryChange = useCallback((value) => {
    update("category_id", value);
    updateAttr("brand", ""); // Reset chain
  }, [update, updateAttr]);

  return (
    <>
      {/* BASIC INFO */}
      <input
        placeholder="Product Title *"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />

      <textarea
        placeholder="Description * (min 20 chars)"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
        rows="4"
      />

      <input
        placeholder="Price (₦) *"
        value={form.price}
        onChange={(e) => update("price", onlyNumbers(e.target.value))}
      />

      {/* CONTACT */}
      <input
        placeholder="Email *"
        type="email"
        value={form.contact.email}
        onChange={(e) => updateContact("email", e.target.value)}
      />

      {/* CATEGORY & DYNAMIC FIELDS */}
      <DropdownModal
        label="Category *"
        value={form.category_id}
        onChange={handleCategoryChange}
        options={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      {/* DYNAMIC ATTRIBUTE FIELDS */}
      {fields.map((field) => {
        if (!optionsMap[field]) return null;
        if (field === "used_detail" && attributes.condition !== "used") return null;

        return (
          <DropdownModal
            key={field}
            label={formatLabel(field)}
            value={attributes[field] || ""}
            onChange={(v) => updateAttr(field, v)}
            options={optionsMap[field]}
          />
        );
      })}

      {/* MULTI-SELECT FEATURES */}
      {Array.isArray(options.features) && options.features.length > 0 && (
        <div className="form-section">
          <h3>Features</h3>
          <div className="checkbox-grid">
            {options.features.map((feature) => (
              <label key={feature} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={attributes.features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                />
                <span>{formatLabel(feature)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* DELIVERY */}
      <div className="form-section">
        <h3>Delivery</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) => updateDelivery("available", e.target.checked)}
          />
          <span>Delivery Available</span>
        </label>

        {form.delivery.available && (
          <div className="delivery-grid">
            <input
              placeholder="From (days)"
              value={form.delivery.duration.from}
              onChange={(e) => updateDeliveryDuration("from", e.target.value)}
              type="number"
            />
            <input
              placeholder="To (days)"
              value={form.delivery.duration.to}
              onChange={(e) => updateDeliveryDuration("to", e.target.value)}
              type="number"
            />
            <input
              placeholder="Fee (₦)"
              value={form.delivery.fee}
              onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* LOCATION */}
      <div className="form-section">
        <h3>Location</h3>
        <DropdownModal
          label="State *"
          value={state}
          onChange={setState}
          options={Object.keys(locationsByState)}
        />
        {state && (
          <DropdownModal
            label="City *"
            value={city}
            onChange={setCity}
            options={locationsByState[state]}
          />
        )}
      </div>

      {/* PHONE */}
      <input
        placeholder="Phone Number *"
        value={form.contact.phone}
        onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))}
      />

      {/* IMAGES UPLOAD */}
      <div className="form-section">
        <h3>Product Images (Max 8)</h3>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleImages(e.target.files)}
        />
        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i} className="preview-item">
              <img src={src} alt={`Preview ${i + 1}`} />
              <button 
                type="button"
                onClick={() => removeImage(i)}
                className="remove-btn"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}