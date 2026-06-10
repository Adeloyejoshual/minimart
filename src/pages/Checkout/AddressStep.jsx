import React, { useState, useEffect, memo } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function getToken() {
  return localStorage.getItem("marketplace_token") || localStorage.getItem("token");
}

const LABELS = ["Home", "Office", "Other"];

const BLANK_FORM = {
  label:          "Home",
  recipient_name: "",
  phone:          "",
  address_line:   "",
  landmark:       "",
  state:          "",
  city:           "",
  lga:            "",
  is_default:     false,
};

const AddressStep = memo(function AddressStep({
  addresses, selected, onSelect, onAdd, onNext,
}) {
  const [zones,    setZones]    = useState({});
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(BLANK_FORM);
  const [errors,   setErrors]   = useState({});

  /* Load delivery zones from API — single source of truth */
  useEffect(() => {
    axios
      .get(`${API}/checkout/address/zones`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      .then(({ data }) => setZones(data.data ?? {}))
      .catch(() => {});
  }, []);

  /* Derived dropdown options */
  const stateOptions = Object.keys(zones);

  const cityOptions = zones[form.state]?.cities?.map((c) => c.city) ?? [];

  const lgaOptions = zones[form.state]?.cities
    ?.find((c) => c.city === form.city)
    ?.lgas ?? [];

  /* When state changes, reset city + lga */
  const handleStateChange = (e) => {
    setForm((p) => ({ ...p, state: e.target.value, city: "", lga: "" }));
    setErrors((p) => ({ ...p, state: "", city: "", lga: "" }));
  };

  /* When city changes, reset lga */
  const handleCityChange = (e) => {
    setForm((p) => ({ ...p, city: e.target.value, lga: "" }));
    setErrors((p) => ({ ...p, city: "" }));
  };

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});

    try {
      const { data } = await axios.post(
        `${API}/checkout/address`,
        form,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      onAdd(data.data);
      onSelect(data.data);
      setShowForm(false);
      setForm(BLANK_FORM);
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ general: err.response?.data?.message ?? "Failed to save address" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ck-section">
      <h2 className="ck-section-title">📍 Delivery Address</h2>

      {/* Delivery zone notice */}
      <div className="ck-zone-notice">
        <span>🚚</span>
        <div>
          <strong>We currently deliver to:</strong>
          <p>Osun State (Osogbo, Ile-Ife, Ilesa & more) · Ondo State (Ondo Town only)</p>
        </div>
      </div>

      {/* Saved addresses */}
      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`ck-address-card ${selected?.id === addr.id ? "ck-address-card--selected" : ""}`}
          onClick={() => onSelect(addr)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect(addr)}
        >
          <div className="ck-address-radio">
            <div className={`ck-radio ${selected?.id === addr.id ? "ck-radio--active" : ""}`} />
          </div>
          <div className="ck-address-info">
            <div className="ck-address-label-row">
              <span className="ck-address-label">{addr.label}</span>
              {addr.is_default && <span className="ck-default-tag">Default</span>}
            </div>
            <p className="ck-address-name">
              {addr.recipient_name} · {addr.phone}
            </p>
            <p className="ck-address-line">
              {addr.address_line}
            </p>
            {addr.landmark && (
              <p className="ck-address-landmark">
                📍 {addr.landmark}
              </p>
            )}
            <p className="ck-address-location">
              {addr.city}, {addr.state}
              {addr.lga ? ` · ${addr.lga}` : ""}
            </p>
          </div>
        </div>
      ))}

      {/* Add new address form */}
      {showForm && (
        <div className="ck-address-form">
          <h3 className="ck-form-title">
            {addresses.length === 0 ? "Add Delivery Address" : "Add New Address"}
          </h3>

          {errors.general && (
            <div className="ck-form-error-banner">⚠️ {errors.general}</div>
          )}

          {/* Label */}
          <div className="ck-form-field">
            <label>Label</label>
            <div className="ck-label-chips">
              {LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`ck-label-chip ${form.label === l ? "ck-label-chip--active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, label: l }))}
                >
                  {l === "Home" ? "🏠" : l === "Office" ? "🏢" : "📍"} {l}
                </button>
              ))}
            </div>
          </div>

          <div className="ck-form-grid">

            {/* Recipient name */}
            <div className="ck-form-field">
              <label>Recipient Name *</label>
              <input
                className={`ck-input ${errors.recipient_name ? "ck-input--error" : ""}`}
                value={form.recipient_name}
                onChange={set("recipient_name")}
                placeholder="Full name of receiver"
              />
              {errors.recipient_name && (
                <span className="ck-field-error">{errors.recipient_name}</span>
              )}
            </div>

            {/* Phone */}
            <div className="ck-form-field">
              <label>Phone Number *</label>
              <input
                className={`ck-input ${errors.phone ? "ck-input--error" : ""}`}
                value={form.phone}
                onChange={set("phone")}
                placeholder="080xxxxxxxx"
                type="tel"
                inputMode="numeric"
              />
              {errors.phone && (
                <span className="ck-field-error">{errors.phone}</span>
              )}
            </div>

            {/* Street address */}
            <div className="ck-form-field ck-form-field--full">
              <label>Street Address *</label>
              <input
                className={`ck-input ${errors.address_line ? "ck-input--error" : ""}`}
                value={form.address_line}
                onChange={set("address_line")}
                placeholder="House number, street name"
              />
              {errors.address_line && (
                <span className="ck-field-error">{errors.address_line}</span>
              )}
            </div>

            {/* Landmark — CRITICAL */}
            <div className="ck-form-field ck-form-field--full">
              <label>
                Landmark *
                <span className="ck-label-hint"> (very important for delivery)</span>
              </label>
              <input
                className={`ck-input ${errors.landmark ? "ck-input--error" : ""}`}
                value={form.landmark}
                onChange={set("landmark")}
                placeholder="e.g. Opposite First Bank, beside bus stop"
              />
              {errors.landmark ? (
                <span className="ck-field-error">{errors.landmark}</span>
              ) : (
                <span className="ck-field-hint">
                  📍 A clear landmark helps our riders find you faster
                </span>
              )}
            </div>

            {/* State — controlled dropdown */}
            <div className="ck-form-field">
              <label>State *</label>
              <select
                className={`ck-input ck-select ${errors.state ? "ck-input--error" : ""}`}
                value={form.state}
                onChange={handleStateChange}
              >
                <option value="">Select state</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.state && (
                <span className="ck-field-error">{errors.state}</span>
              )}
              {!form.state && (
                <span className="ck-field-hint">
                  We deliver to Osun & Ondo only
                </span>
              )}
            </div>

            {/* City — controlled dropdown based on state */}
            <div className="ck-form-field">
              <label>City *</label>
              <select
                className={`ck-input ck-select ${errors.city ? "ck-input--error" : ""}`}
                value={form.city}
                onChange={handleCityChange}
                disabled={!form.state}
              >
                <option value="">
                  {form.state ? "Select city" : "Select state first"}
                </option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.city && (
                <span className="ck-field-error">{errors.city}</span>
              )}
              {/* Ondo Town warning */}
              {form.state === "Ondo" && form.city === "Ondo Town" && (
                <span className="ck-field-hint ck-field-hint--info">
                  ✅ We deliver to Ondo Town
                </span>
              )}
            </div>

            {/* LGA — optional controlled dropdown */}
            {lgaOptions.length > 0 && (
              <div className="ck-form-field">
                <label>LGA <span className="ck-optional">(optional)</span></label>
                <select
                  className="ck-input ck-select"
                  value={form.lga}
                  onChange={set("lga")}
                >
                  <option value="">Select LGA</option>
                  {lgaOptions.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Set as default */}
          <label className="ck-checkbox-label">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={set("is_default")}
            />
            Set as my default delivery address
          </label>

          {/* Actions */}
          <div className="ck-form-actions">
            {addresses.length > 0 && (
              <button
                className="ck-btn-cancel"
                onClick={() => {
                  setShowForm(false);
                  setErrors({});
                  setForm(BLANK_FORM);
                }}
              >
                Cancel
              </button>
            )}
            <button
              className="ck-btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Address"}
            </button>
          </div>
        </div>
      )}

      {/* Add address button */}
      {!showForm && (
        <button
          className="ck-add-address-btn"
          onClick={() => setShowForm(true)}
        >
          + Add New Address
        </button>
      )}

      {/* Continue button */}
      {!showForm && (
        <button
          className={`ck-next-btn ${!selected ? "ck-next-btn--disabled" : ""}`}
          onClick={onNext}
          disabled={!selected}
        >
          Continue to Review →
        </button>
      )}
    </div>
  );
});

export default AddressStep;