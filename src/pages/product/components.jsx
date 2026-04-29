import DropdownModal from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { categoryFields } from "../../config/categoryFields.js";

/* ===================== HELPERS ===================== */
const normalizeOptions = (list) =>
  Array.isArray(list)
    ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
    : [];

const formatLabel = (text = "") =>
  text.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

/* ===================== COMPONENT ===================== */
export default function ProductComponents(props) {
  const {
    form,
    attributes,
    images,
    state,
    city,
    categories,
    selectedPlan,
    paymentData,
    loading,
    error,
    success,
    states,
    cities,
    options,
    selectedCategory,
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
    displayPrice,
    onlyNumbers,
    onlyDigits,
    INITIAL_FORM,
  } = props;

  const MAX_IMAGES = 6;

  /* ===================== CATEGORY FIELDS ===================== */
  const fields = selectedCategory
    ? [
        ...new Set([
          ...(options.fields || []),
          ...(categoryFields[selectedCategory.name] || []),
        ]),
      ].filter(Boolean)
    : [];

  /* ===================== OPTIONS MAP ===================== */
  const optionsMap = {
    brand: normalizeOptions(options.brands),
    color: normalizeOptions(options.colors),
    condition: normalizeOptions(options.conditions),
    used_detail: normalizeOptions(options.usedDetails),
    ram: normalizeOptions(options.ram),
    storage: normalizeOptions(options.storage),
    sim: normalizeOptions(options.sim),
    features: Array.isArray(options.features) ? options.features : [],
    year: normalizeOptions(options.years),
    engine: normalizeOptions(options.engines),
    fuel_type: normalizeOptions(options.fuel_types),
    size: normalizeOptions(options.size),
    age_range: normalizeOptions(options.age_range),
    bedrooms: normalizeOptions(options.bedrooms),
    bathrooms: normalizeOptions(options.bathrooms),
    experience_level: normalizeOptions(options.experience_level),
    skills: normalizeOptions(options.skills),
  };

  return (
    <>
      {/* ===================== HEADER ===================== */}
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* ===================== BASIC INFO ===================== */}
      <section className="section form-card">
        <h3>Basic Information</h3>

        <input
          placeholder="Product title"
          value={form.title}
          onChange={(e) => updateForm("title", e.target.value)}
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
        />

        <input
          placeholder="Price"
          value={displayPrice(form.price)}
          onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
        />
      </section>

      {/* ===================== CATEGORY ===================== */}
      <section className="section form-card">
        <h3>Product Details</h3>

        <DropdownModal
          value={form.category_id}
          onChange={(v) => {
            updateForm("category_id", v);
            updateForm("subcategory_id", "");
            updateForm("attributes", INITIAL_FORM.attributes);
          }}
          options={categories}
          placeholder="Select category"
        />

        {/* BRAND */}
        {optionsMap.brand.length > 0 && (
          <DropdownModal
            value={attributes.brand}
            onChange={(v) => updateAttribute("brand", v)}
            options={optionsMap.brand}
          />
        )}

        {/* CONDITIONAL FIELDS */}
        {fields.map((field) => {
          if (["brand", "model"].includes(field)) return null;

          const opts = optionsMap[field];
          if (!opts?.length) return null;

          return (
            <DropdownModal
              key={field}
              value={attributes[field]}
              onChange={(v) => updateAttribute(field, v)}
              options={opts}
              placeholder={formatLabel(field)}
            />
          );
        })}

        {/* FEATURES */}
        {optionsMap.features.length > 0 && (
          <div className="features">
            {optionsMap.features.map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  checked={attributes.features.includes(f)}
                  onChange={() => toggleFeature(f)}
                />
                {formatLabel(f)}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* ===================== CONTACT ===================== */}
      <section className="section form-card">
        <h3>Contact</h3>

        <input
          placeholder="Email"
          value={form.contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />

        <input
          placeholder="Phone"
          value={form.contact.phone}
          onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
        />

        <input
          placeholder="WhatsApp"
          value={form.contact.whatsapp}
          onChange={(e) =>
            updateContact("whatsapp", onlyDigits(e.target.value))
          }
        />
      </section>

      {/* ===================== LOCATION ===================== */}
      <section className="section form-card">
        <h3>Location</h3>

        <DropdownModal
          value={state}
          onChange={setState}
          options={states.map((s) => ({ id: s, name: s }))}
        />

        {state && (
          <DropdownModal
            value={city}
            onChange={setCity}
            options={cities.map((c) => ({ id: c, name: c }))}
          />
        )}
      </section>

      {/* ===================== IMAGES ===================== */}
      <section className="section form-card">
        <h3>Images</h3>

        <div className="image-grid">
          {images.map((img) => (
            <div key={img.id}>
              <img src={img.preview} alt="product" />
              <button onClick={() => removeImage(img.id)}>x</button>
            </div>
          ))}

          {images.length < MAX_IMAGES && (
            <label>
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => handleImages(e.target.files)}
              />
              + Add Image
            </label>
          )}
        </div>
      </section>

      {/* ===================== PROMO ===================== */}
      <section className="section form-card">
        <h3>Promotion</h3>

        {[
          { id: "free", name: "Free", price: 0 },
          { id: "basic", name: "Basic", price: 500 },
        ].map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            className={selectedPlan?.id === plan.id ? "active" : ""}
          >
            <strong>{plan.name}</strong>
            <span>₦{displayPrice(plan.price)}</span>
          </div>
        ))}
      </section>

      {/* ===================== ACTION ===================== */}
      <div className="actions">
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Processing..." : "Create Product"}
        </button>

        {paymentData && (
          <button onClick={() => window.open(paymentData.authUrl)}>
            Pay Now
          </button>
        )}
      </div>

      {/* ===================== STATUS ===================== */}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </>
  );
}