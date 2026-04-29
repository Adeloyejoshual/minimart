import React from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import { categoryFields } from "../../config/categoryFields.js";

// Basic Information Section
export function BasicInfoSection({ form, updateForm, displayPrice }) {
  return (
    <section className="section form-card">
      <h3 className="section-title">Basic Information</h3>
      <div className="form-group">
        <label>Product Title *</label>
        <input
          placeholder="Enter product title (min 10 chars)"
          value={form.title}
          onChange={(e) => updateForm("title", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Description *</label>
        <textarea
          placeholder="Detailed product description (min 20 chars)"
          rows={4}
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Price (₦) *</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter price"
          value={displayPrice(form.price)}
          onChange={(e) => updateForm("price", e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
    </section>
  );
}

// Product Details Section
export function ProductDetailsSection({
  form,
  categories,
  selectedCategory,
  attributes,
  fields,
  optionsMap,
  modelOptions,
  formatLabel,
  updateForm,
  updateAttribute,
  toggleFeature,
  INITIAL_FORM,
}) {
  const options = selectedCategory?.dynamicOptions || {};

  return (
    <section className="section form-card">
      <h3 className="section-title">Product Details</h3>
      <div className="form-group">
        <label>Category *</label>
        <DropdownModal
          value={String(form.category_id)}
          onChange={(v) => {
            updateForm("category_id", v);
            updateForm("subcategory_id", "");
            updateForm("attributes", INITIAL_FORM.attributes);
          }}
          options={categories}
          placeholder="Select category"
        />
      </div>

      {optionsMap.brand?.length > 0 && (
        <div className="form-group">
          <label>{formatLabel("brand")}</label>
          <DropdownModal
            value={attributes?.brand || ""}
            onChange={(v) => updateAttribute("brand", v)}
            options={optionsMap.brand}
          />
        </div>
      )}

      {modelOptions.length > 0 && (
        <div className="form-group">
          <label>{formatLabel("model")}</label>
          <DropdownModal
            value={attributes?.model || ""}
            onChange={(v) => updateAttribute("model", v)}
            options={modelOptions}
          />
        </div>
      )}

      {fields.map((field) => {
        if (field === "brand" || field === "model") return null;

        const fieldOptions = optionsMap[field] || [];
        if (!fieldOptions.length) return null;
        if (field === "used_detail" && attributes?.condition !== "Used") return null;

        return (
          <div key={field} className="form-group">
            <label>{formatLabel(field)}</label>
            <DropdownModal
              value={attributes?.[field] || ""}
              onChange={(v) => updateAttribute(field, v)}
              options={fieldOptions}
            />
          </div>
        );
      })}

      {optionsMap.features?.length > 0 && (
        <div className="form-group">
          <label>Features</label>
          <div className="checkbox-grid-inline">
            {optionsMap.features.map((feature) => (
              <label key={feature} className="checkbox-inline">
                {formatLabel(feature)}
                <input
                  type="checkbox"
                  checked={attributes?.features?.includes(feature) || false}
                  onChange={() => toggleFeature(feature)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Contact Information Section
export function ContactSection({ contact, updateContact, onlyDigits }) {
  return (
    <section className="section form-card">
      <h3 className="section-title">Contact Information</h3>
      <div className="form-group">
        <label>Email *</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Phone *</label>
        <input
          type="tel"
          placeholder="08012345678"
          value={contact.phone}
          onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label>WhatsApp *</label>
        <input
          type="tel"
          placeholder="08012345678"
          value={contact.whatsapp}
          onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label>WhatsApp Link</label>
        <input
          type="url"
          placeholder="https://wa.me/2348012345678"
          value={contact.whatsapp_link}
          onChange={(e) => updateContact("whatsapp_link", e.target.value.trim())}
        />
      </div>
    </section>
  );
}

// Location & Delivery Section
export function LocationDeliverySection({
  state,
  city,
  states,
  cities,
  delivery,
  setState,
  setCity,
  updateDelivery,
  updateDeliveryDuration,
  onlyDigits,
  displayPrice,
}) {
  return (
    <section className="section form-card">
      <h3 className="section-title">Location & Delivery</h3>
      <div className="form-group">
        <label>State *</label>
        <DropdownModal
          value={state}
          onChange={setState}
          options={states.map((s) => ({ id: s, name: s }))}
        />
      </div>
      {state && (
        <div className="form-group">
          <label>City *</label>
          <DropdownModal
            value={city}
            onChange={setCity}
            options={cities.map((c) => ({ id: c, name: c }))}
          />
        </div>
      )}

      <div className="form-group">
        <label>Delivery Available</label>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={delivery.available}
            onChange={(e) => updateDelivery("available", e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>

      {delivery.available && (
        <div className="delivery-grid sub-grid">
          <div className="form-group">
            <label>From Day *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1"
              value={delivery.duration.from}
              onChange={(e) => updateDeliveryDuration("from", onlyDigits(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>To Day *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="3"
              value={delivery.duration.to}
              onChange={(e) => updateDeliveryDuration("to", onlyDigits(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Fee (₦) *</label>
            <input
              type="text"
              inputMode="numeric"
              value={displayPrice(delivery.fee)}
              onChange={(e) => updateDelivery("fee", e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="form-group full-width">
            <label>Delivery Note</label>
            <textarea
              placeholder="e.g., Cash on delivery available"
              value={delivery.note}
              onChange={(e) => updateDelivery("note", e.target.value)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// Images Section
export function ImagesSection({ images, handleImages, removeImage, MAX_IMAGES }) {
  return (
    <section className="section form-card">
      <h3 className="section-title">Product Images</h3>
      <label className="form-group-label">
        Max 6 images, 3MB each *
      </label>

      <div className="preview-grid-modern image-upload-box">
        {images.map((img, i) => (
          <div key={img.id} className="preview-thumb">
            <img src={img.preview} alt={`Preview ${i + 1}`} />
            <button type="button" onClick={() => removeImage(img.id)}>✕</button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <label className="add-image-box add-image-btn">
            <input
              type="file"
              multiple
              accept="image/*"
              hidden
              onChange={(e) => {
                handleImages(e.target.files);
                e.target.value = "";
              }}
            />
            <div>+</div>
            <span>Add Image</span>
          </label>
        )}
      </div>

      {images.length > 0 && <small>{images.length}/6 images</small>}
    </section>
  );
}

// Promotion Section
export function PromotionSection({ selectedPlan, setSelectedPlan, promotionPlans, displayPrice }) {
  return (
    <section className="section form-card">
      <h3 className="section-title">Promotion Plan</h3>
      <div className="plans-grid">
        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
            onClick={() => setSelectedPlan(plan)}
          >
            <div className="plan-header">
              <strong>{plan.name}</strong>
              <span className="plan-price">₦{displayPrice(plan.price)}</span>
            </div>
            <div className="plan-duration">{plan.duration || "Always"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}