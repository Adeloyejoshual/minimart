// src/pages/AddProduct.jsx
import { useMemo } from "react";

import AddProductHeader from "../components/AddProductHeader.jsx";
import { useProductForm } from "./product/hooks/useProductForm.js";
import { useImageHandler } from "./product/hooks/useImageHandler.js";
import { useDraft } from "./product/hooks/useDraft.js";
import { promotionPlans } from "../config/promotions.js";
import { locationsByState } from "../config/locationsByState.js";

const formatLabel = (t) => t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase());
const displayPrice = (v) => {
  const num = Number(v);
  return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
};

export default function AddProduct() {
  const {
    form,
    categories,
    categoryOptions,
    fields,
    options,
    attributes,
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    selectedPlan,
    setSelectedPlan,
    handleSubmit,
    clearDraft,
    loading,
    error,
    success,
  } = useProductForm();

  const { images, handleImages, removeImage, MAX_IMAGES } = useImageHandler();

  const { state, city, setState, setCity } = useDraft({
    form,
    images,
    selectedPlan,
  });

  const states = useMemo(
    () => Object.keys(locationsByState || {}).map((s) => ({ id: s, name: s })),
    []
  );
  const cities = useMemo(
    () =>
      state
        ? (locationsByState[state] || []).map((c) => ({ id: c, name: c }))
        : [],
    [state]
  );

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* Basic Information */}
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
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          />
        </div>
      </section>

      {/* Product Details */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>
        <div className="form-group">
          <label>Category *</label>
          <DropdownModal
            value={String(form.category_id)}
            onChange={(v) => {
              updateForm("category_id", v);
              updateForm("subcategory_id", "");
              updateForm("attributes", {});
            }}
            options={categories}
            placeholder="Select category"
          />
        </div>

        {options.brand?.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("brand")}</label>
            <DropdownModal
              value={attributes.brand || ""}
              onChange={(v) => updateAttribute("brand", v)}
              options={options.brand}
            />
          </div>
        )}

        {options.model?.[attributes.brand]?.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("model")}</label>
            <DropdownModal
              value={attributes.model || ""}
              onChange={(v) => updateAttribute("model", v)}
              options={options.model[attributes.brand]}
            />
          </div>
        )}

        {fields.map((field) => {
          const fieldOptions = options[field] || [];
          if (!fieldOptions.length) return null;

          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={attributes[field] || ""}
                onChange={(v) => updateAttribute(field, v)}
                options={fieldOptions}
              />
            </div>
          );
        })}

        {options.features?.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline">
              {options.features.map((feature) => (
                <label key={feature} className="checkbox-inline">
                  {formatLabel(feature)}
                  <input
                    type="checkbox"
                    checked={attributes.features?.includes(feature) || false}
                    onChange={() => toggleFeature(feature)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Contact Information */}
      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>
        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.contact.email}
            onChange={(e) => updateContact("email", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Phone *</label>
          <input
            type="tel"
            placeholder="08012345678"
            value={form.contact.phone}
            onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>WhatsApp *</label>
          <input
            type="tel"
            placeholder="08012345678"
            value={form.contact.whatsapp}
            onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>WhatsApp Link</label>
          <input
            type="url"
            placeholder="https://wa.me/2348012345678"
            value={form.contact.whatsapp_link}
            onChange={(e) => updateContact("whatsapp_link", e.target.value.trim())}
          />
        </div>
      </section>

      {/* Location & Delivery */}
      <section className="section form-card">
        <h3 className="section-title">Location & Delivery</h3>
        <div className="form-group">
          <label>State *</label>
          <DropdownModal
            value={state}
            onChange={setState}
            options={states}
          />
        </div>
        {state && (
          <div className="form-group">
            <label>City *</label>
            <DropdownModal
              value={city}
              onChange={setCity}
              options={cities}
            />
          </div>
        )}

        <div className="form-group">
          <label>Delivery Available</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) => updateDelivery("available", e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        {form.delivery.available && (
          <div className="delivery-grid sub-grid">
            <div className="form-group">
              <label>From Day *</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="1"
                value={form.delivery.duration.from}
                onChange={(e) =>
                  updateDeliveryDuration("from", onlyDigits(e.target.value))
                }
              />
            </div>
            <div className="form-group">
              <label>To Day *</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="3"
                value={form.delivery.duration.to}
                onChange={(e) =>
                  updateDeliveryDuration("to", onlyDigits(e.target.value))
                }
              />
            </div>
            <div className="form-group">
              <label>Fee (₦) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={displayPrice(form.delivery.fee)}
                onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
            </div>
            <div className="form-group full-width">
              <label>Delivery Note</label>
              <textarea
                placeholder="e.g., Cash on delivery available"
                value={form.delivery.note}
                onChange={(e) => updateDelivery("note", e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Images */}
      <section className="section form-card">
        <h3 className="section-title">Product Images</h3>
        <label className="form-group-label">Max 6 images, 3MB each *</label>

        <div className="preview-grid-modern image-upload-box">
          {images.map((img) => (
            <div key={img.id} className="preview-thumb">
              <img src={img.preview} alt="Preview" />
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

        {images.length > 0 && <small>{images.length}/{MAX_IMAGES} images</small>}
      </section>

      {/* Promotion Plan */}
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

      <div className="button-section section form-card">
        <button
          className="primary-btn"
          type="button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Processing..." : "🚀 Create Product"}
        </button>

        {form.paymentData && (
          <button
            className="secondary-btn"
            type="button"
            onClick={() => window.open(form.paymentData.authUrl, "_blank")}
          >
            💳 Pay Now
          </button>
        )}
      </div>

      {error && <div className="form-success">✅ {success}</div>}
    </div>
  );
}

// helpers for the page
const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");