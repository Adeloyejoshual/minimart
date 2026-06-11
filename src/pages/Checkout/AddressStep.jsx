import React, { useState, useEffect, memo } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")
  );
}

const LABELS = ["Home", "Office", "Other"];
const MAX_ADDRESSES = 2;

const BLANK_FORM = {
  label:                 "Home",
  recipient_name:        "",
  phone:                 "",
  state:                 "",
  city:                  "",
  address_line:          "",
  landmark:              "",
  additional_directions: "",
  call_before_delivery:  false,
  is_default:            false,
};

const AddressStep = memo(function AddressStep({
  addresses,
  selected,
  onSelect,
  onAdd,
  onEdit,       /* ← new: called with (id, updatedAddress) */
  onNext,
  user,
}) {
  const [zones,      setZones]      = useState({});
  const [showForm,   setShowForm]   = useState(addresses.length === 0);
  const [editingId,  setEditingId]  = useState(null); /* id being edited */
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState({});

  const makeBlank = () => ({
    ...BLANK_FORM,
    recipient_name: user?.name         ?? "",
    phone:          user?.phone_number ?? "",
  });

  const [form, setForm] = useState(makeBlank);

  /* Load delivery zones */
  useEffect(() => {
    axios
      .get(`${API}/checkout/address/zones`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      .then(({ data }) => setZones(data.data ?? {}))
      .catch(() => {});
  }, []);

  const stateOptions = Object.keys(zones);
  const cityOptions  = zones[form.state]?.cities ?? [];

  const handleStateChange = (e) => {
    setForm((p) => ({ ...p, state: e.target.value, city: "" }));
    setErrors((p) => ({ ...p, state: "", city: "" }));
  };

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  /* ── Open edit form ── */
  const handleEdit = (addr) => {
    setEditingId(addr.id);
    setForm({
      label:                 addr.label                 ?? "Home",
      recipient_name:        addr.recipient_name        ?? "",
      phone:                 addr.phone                 ?? "",
      state:                 addr.state                 ?? "",
      city:                  addr.city                  ?? "",
      address_line:          addr.address_line          ?? "",
      landmark:              addr.landmark              ?? "",
      additional_directions: addr.additional_directions ?? "",
      call_before_delivery:  addr.call_before_delivery  ?? false,
      is_default:            addr.is_default            ?? false,
    });
    setErrors({});
    setShowForm(true);
  };

  /* ── Cancel form ── */
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
    setForm(makeBlank());
  };

  /* ── Save (add or edit) ── */
  const handleSave = async () => {
    setSaving(true);
    setErrors({});

    try {
      if (editingId) {
        /* EDIT existing address */
        const { data } = await axios.put(
          `${API}/checkout/address/${editingId}`,
          form,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
        onEdit?.(editingId, data.data);          /* notify parent */
        if (selected?.id === editingId) onSelect(data.data); /* keep selected fresh */
      } else {
        /* ADD new address */
        const { data } = await axios.post(
          `${API}/checkout/address`,
          form,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
        onAdd(data.data);
        onSelect(data.data);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(makeBlank());
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({
          general:
            err.response?.data?.message ??
            "Failed to save address. Please check your connection.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  /* ── Helpers ── */
  const atLimit    = addresses.length >= MAX_ADDRESSES;
  const isEditing  = !!editingId;

  return (
    <div className="ck-section">
      <h2 className="ck-section-title">📍 Delivery Address</h2>

      {/* Coverage notice */}
      <div className="ck-zone-notice">
        <span>🚚</span>
        <div>
          <strong>We currently deliver to:</strong>
          <p>
            Osun State (Osogbo, Ile-Ife, Ilesa &amp; more) ·
            Ondo State (Ondo Town only)
          </p>
        </div>
      </div>

      {/* Address limit notice */}
      {atLimit && !isEditing && (
        <div className="ck-limit-notice">
          ℹ️ You have saved {MAX_ADDRESSES} addresses (maximum).
          Click <strong>Edit</strong> on one to update it.
        </div>
      )}

      {/* ── Saved address cards ── */}
      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`ck-address-card ${
            selected?.id === addr.id ? "ck-address-card--selected" : ""
          }`}
          onClick={() => {
            if (!showForm) onSelect(addr); /* select only when form is closed */
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !showForm) onSelect(addr);
          }}
          aria-label={`Select address: ${addr.address_line}, ${addr.city}`}
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
              <span className="ck-address-label">
                {addr.label === "Home"
                  ? "🏠"
                  : addr.label === "Office"
                  ? "🏢"
                  : "📍"}{" "}
                {addr.label}
              </span>
              {addr.is_default && (
                <span className="ck-default-tag">Default</span>
              )}
              {addr.call_before_delivery && (
                <span className="ck-call-tag">📞 Call first</span>
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

          {/* Edit button — always visible */}
          <button
            className="ck-edit-btn"
            onClick={(e) => {
              e.stopPropagation(); /* don't also trigger card select */
              handleEdit(addr);
            }}
            aria-label={`Edit address: ${addr.address_line}`}
          >
            ✏️ Edit
          </button>
        </div>
      ))}

      {/* ── Add / Edit form ── */}
      {showForm && (
        <div className="ck-address-form">
          <h3 className="ck-form-title">
            {isEditing
              ? "Edit Address"
              : addresses.length === 0
              ? "Add Delivery Address"
              : "Add New Address"}
          </h3>

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
                  onClick={() => setForm((p) => ({ ...p, label: l }))}
                >
                  {l === "Home" ? "🏠" : l === "Office" ? "🏢" : "📍"} {l}
                </button>
              ))}
            </div>
          </div>

          <div className="ck-form-grid">
            {/* Recipient Name */}
            <div className="ck-form-field">
              <label>Recipient Name *</label>
              <input
                className={`ck-input ${
                  errors.recipient_name ? "ck-input--error" : ""
                }`}
                value={form.recipient_name}
                onChange={set("recipient_name")}
                placeholder="Full name of receiver"
              />
              {errors.recipient_name ? (
                <span className="ck-field-error">{errors.recipient_name}</span>
              ) : user?.name && form.recipient_name === user.name ? (
                <span className="ck-field-hint">
                  Auto-filled from your account — edit if sending to someone else
                </span>
              ) : null}
            </div>

            {/* Phone */}
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
                  Our rider will call this number if needed
                </span>
              )}
            </div>

            {/* State */}
            <div className="ck-form-field">
              <label>State *</label>
              <select
                className={`ck-input ck-select ${
                  errors.state ? "ck-input--error" : ""
                }`}
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
                <span className="ck-field-hint">Osun or Ondo only for now</span>
              ) : null}
            </div>

            {/* City */}
            <div className="ck-form-field">
              <label>City / Area *</label>
              <select
                className={`ck-input ck-select ${
                  errors.city ? "ck-input--error" : ""
                }`}
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
                  ✅ We deliver to Ondo Town
                </span>
              ) : null}
            </div>

            {/* Street Address */}
            <div className="ck-form-field ck-form-field--full">
              <label>Street Address *</label>
              <input
                className={`ck-input ${
                  errors.address_line ? "ck-input--error" : ""
                }`}
                value={form.address_line}
                onChange={set("address_line")}
                placeholder="e.g. House No. 12, Adewale Street, Oke Baale"
              />
              {errors.address_line && (
                <span className="ck-field-error">{errors.address_line}</span>
              )}
            </div>

            {/* Landmark */}
            <div className="ck-form-field ck-form-field--full">
              <label>
                Landmark / Bus Stop *
                <span className="ck-label-hint"> (very important for delivery)</span>
              </label>
              <input
                className={`ck-input ck-input--landmark ${
                  errors.landmark ? "ck-input--error" : ""
                }`}
                value={form.landmark}
                onChange={set("landmark")}
                placeholder="e.g. Opposite GTBank, beside Oja Oba Market"
              />
              {errors.landmark ? (
                <span className="ck-field-error">{errors.landmark}</span>
              ) : (
                <span className="ck-field-hint">
                  📍 Examples: "Beside First Bank bus stop" · "After St. Mary's School"
                </span>
              )}
            </div>

            {/* Additional directions */}
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

          {/* Call before delivery */}
          <label className="ck-checkbox-label ck-checkbox-label--highlight">
            <input
              type="checkbox"
              checked={form.call_before_delivery}
              onChange={set("call_before_delivery")}
            />
            <span>
              📞 Call me before delivery
              <small>Rider will call your number before arriving</small>
            </span>
          </label>

          {/* Default */}
          <label className="ck-checkbox-label">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={set("is_default")}
            />
            Set as my default delivery address
          </label>

          {/* Form actions */}
          <div className="ck-form-actions">
            <button className="ck-btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button
              className="ck-btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : isEditing
                ? "Update Address"
                : "Save Address"}
            </button>
          </div>
        </div>
      )}

      {/* Add new address button — hidden at limit or when form open */}
      {!showForm && !atLimit && (
        <button
          className="ck-add-address-btn"
          onClick={() => {
            setEditingId(null);
            setForm(makeBlank());
            setErrors({});
            setShowForm(true);
          }}
        >
          + Add New Address
        </button>
      )}

      {/* ── Continue button — only when form is closed & address selected ── */}
      {!showForm && (
        <button
          className={`ck-next-btn ${!selected ? "ck-next-btn--disabled" : ""}`}
          onClick={() => {
            if (selected) onNext();
          }}
          disabled={!selected}
          title={!selected ? "Please select a delivery address" : ""}
        >
          Continue to Review →
        </button>
      )}
    </div>
  );
});

export default AddressStep;