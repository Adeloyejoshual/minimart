import React, { useState, useEffect, memo } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")
  );
}

/* ── Delivery zones — loaded from API ── */
const LABELS = ["Home", "Office", "Other"];

const BLANK_FORM = {
  label:                 "Home",
  recipient_name:        "",
  phone:                 "",
  state:                 "",
  city:                  "",
  address_line:          "",
  landmark:              "",
  additional_directions: "",
  is_default:            false,
};

const AddressStep = memo(function AddressStep({
  addresses,
  selected,
  onSelect,
  onAdd,
  onNext,
}) {
  const [zones,    setZones]    = useState({});
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(BLANK_FORM);
  const [errors,   setErrors]   = useState({});

  /* Load delivery zones once */
  useEffect(() => {
    axios
      .get(`${API}/checkout/address/zones`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      .then(({ data }) => setZones(data.data ?? {}))
      .catch(() => {});
  }, []);

  /* Derived options */
  const stateOptions = Object.keys(zones);
  const cityOptions  = zones[form.state]?.cities ?? [];

  /* State change → reset city */
  const handleStateChange = (e) => {
    setForm((p) => ({ ...p, state: e.target.value, city: "" }));
    setErrors((p) => ({ ...p, state: "", city: "" }));
  };

  /* Generic field setter */
  const set = (k) => (e) => {
    const val =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
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
        setErrors({
          general:
            err.response?.data?.message ??
            "Failed to save address. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ck-section">
      <h2 className="ck-section-title">📍 Delivery Address</h2>

      {/* Coverage notice */}
      <div className="ck-zone-notice">
        <span>🚚</span>
        <div>
          <strong>We currently deliver to:</strong>
          <p>
            Osun State (Osogbo, Ile-Ife, Ilesa & more) ·
            Ondo State (Ondo Town only)
          </p>
        </div>
      </div>

      {/* Saved addresses */}
      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`ck-address-card ${
            selected?.id === addr.id ? "ck-address-card--selected" : ""
          }`}
          onClick={() => onSelect(addr)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect(addr)}
        >
          <div className="ck-address-radio">
            <div
              className={`ck-radio ${
                selected?.id === addr.id ? "ck-radio--active" : ""
              }`}
            />
          </div>
          <div className="ck-address-info">
            <div className="ck-address-label-row">
              <span className="ck-address-label">{addr.label}</span>
              {addr.is_default && (
                <span className="ck-default-tag">Default</span>
              )}
            </div>
            <p className="ck-address-name">
              {addr.recipient_name} · {addr.phone}
            </p>
            <p className="ck-address-line">{addr.address_line}</p>
            {addr.landmark && (
              <p className="ck-address-landmark">📍 {addr.landmark}</p>
            )}
            {addr.additional_directions && (
              <p className="ck-address-directions">
                ℹ️ {addr.additional_directions}
              </p>
            )}
            <p className="ck-address-location">
              {addr.city}, {addr.state}
            </p>
          </div>
        </div>
      ))}

      {/* Add new address form */}
      {showForm && (
        <div className="ck-address-form">
          <h3 className="ck-form-title">
            {addresses.length === 0
              ? "Add Delivery Address"
              : "Add New Address"}
          </h3>

          {/* General error */}
          {errors.general && (
            <div className="ck-form-error-banner">⚠️ {errors.general}</div>
          )}

          {/* Label chips */}
          <div className="ck-form-field">
            <label>Label</label>
            <div className="ck-label-chips">
              {LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`ck-label-chip ${
                    form.label === l ? "ck-label-chip--active" : ""
                  }`}
                  onClick={() =>
                    setForm((p) => ({ ...p, label: l }))
                  }
                >
                  {l === "Home" ? "🏠" : l === "Office" ? "🏢" : "📍"} {l}
                </button>
              ))}
            </div>
          </div>

          <div className="ck-form-grid">

            {/* ── Recipient Name ── */}
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

            {/* ── Phone Number ── */}
            <div className="ck-form-field">
              <label>Phone Number *</label>
              <input
                className={`ck-input ${errors.phone ? "ck-input--error" : ""}`}
                value={form.phone}
                onChange={set("phone")}
                placeholder="08012345678"
                type="tel"
                inputMode="numeric"
                maxLength={11}
              />
              {errors.phone ? (
                <span className="ck-field-error">{errors.phone}</span>
              ) : (
                <span className="ck-field-hint">
                  We'll call this number if we can't find you
                </span>
              )}
            </div>

            {/* ── State ── */}
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
              {errors.state ? (
                <span className="ck-field-error">{errors.state}</span>
              ) : !form.state ? (
                <span className="ck-field-hint">
                  Osun or Ondo only
                </span>
              ) : null}
            </div>

            {/* ── City / Area ── */}
            <div className="ck-form-field">
              <label>City / Area *</label>
              <select
                className={`ck-input ck-select ${errors.city ? "ck-input--error" : ""}`}
                value={form.city}
                onChange={set("city")}
                disabled={!form.state}
              >
                <option value="">
                  {form.state ? "Select city" : "Select state first"}
                </option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.city ? (
                <span className="ck-field-error">{errors.city}</span>
              ) : form.state === "Ondo" ? (
                <span className="ck-field-hint ck-field-hint--info">
                  ✅ Ondo Town only
                </span>
              ) : null}
            </div>

            {/* ── Street Address ── */}
            <div className="ck-form-field ck-form-field--full">
              <label>Street Address *</label>
              <input
                className={`ck-input ${errors.address_line ? "ck-input--error" : ""}`}
                value={form.address_line}
                onChange={set("address_line")}
                placeholder="House number, street name"
              />
              {errors.address_line && (
                <span className="ck-field-error">
                  {errors.address_line}
                </span>
              )}
            </div>

            {/* ── Landmark / Bus Stop ── */}
            <div className="ck-form-field ck-form-field--full">
              <label>
                Landmark / Bus Stop *
                <span className="ck-label-hint">
                  {" "}(very important for delivery)
                </span>
              </label>
              <input
                className={`ck-input ${errors.landmark ? "ck-input--error" : ""}`}
                value={form.landmark}
                onChange={set("landmark")}
                placeholder="e.g. Beside First Bank bus stop"
              />
              {errors.landmark ? (
                <span className="ck-field-error">{errors.landmark}</span>
              ) : (
                <span className="ck-field-hint">
                  📍 Helps our rider locate you quickly
                </span>
              )}
            </div>

            {/* ── Additional Directions ── */}
            <div className="ck-form-field ck-form-field--full">
              <label>
                Additional Directions
                <span className="ck-optional"> (optional)</span>
              </label>
              <textarea
                className="ck-input ck-textarea"
                value={form.additional_directions}
                onChange={set("additional_directions")}
                placeholder="e.g. Blue gate, second house after the church, call on arrival"
                rows={2}
                maxLength={300}
              />
            </div>
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