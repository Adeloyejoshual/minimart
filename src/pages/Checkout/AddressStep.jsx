// pages/Checkout/AddressStep.jsx

import React, {
  useState, useEffect, useCallback, memo,
} from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")             ||
    null
  );
}

function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const LABELS       = ["Home", "Office", "Other"];
const MAX_ADDRESSES = 3;

const LABEL_ICON = { Home: "🏠", Office: "🏢", Other: "📍" };

const BLANK = {
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

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display:      "inline-block",
      width:        "14px",
      height:       "14px",
      border:       "2px solid rgba(255,255,255,0.3)",
      borderTop:    "2px solid white",
      borderRadius: "50%",
      animation:    "ck-spin 0.7s linear infinite",
      flexShrink:   0,
    }} aria-hidden="true" />
  );
}

// ═════════════════════════════════════════════════════════════
// ADDRESS STEP
// ═════════════════════════════════════════════════════════════
const AddressStep = memo(function AddressStep({
  addresses,
  setAddresses,   // ← parent must pass this so we can update list in place
  selected,
  onSelect,
  onNext,
  user,
}) {
  const [zones,     setZones]     = useState({});
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(BLANK);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);

  // ── Blank form pre-filled with user info ──────────────────
  const makeBlank = useCallback(() => ({
    ...BLANK,
    recipient_name: user?.name         ?? "",
    phone:          user?.phone_number ?? "",
  }), [user]);

  // ── Load delivery zones once ──────────────────────────────
  useEffect(() => {
    axios
      .get(`${API}/checkout/address/zones`, {
        headers: authHeader(),
      })
      .then(({ data }) => setZones(data.data ?? {}))
      .catch(() => {});
  }, []);

  // ── If no saved addresses, open blank form automatically ──
  useEffect(() => {
    if (addresses.length === 0) {
      setShowForm(true);
      setEditingId(null);
      setForm(makeBlank());
    }
  }, [addresses.length, makeBlank]);

  const stateOptions = Object.keys(zones);
  const cityOptions  = zones[form.state]?.cities ?? [];

  // ── Field setters ─────────────────────────────────────────
  const set = (k) => (e) => {
    const val = e.target.type === "checkbox"
      ? e.target.checked
      : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  const handleStateChange = (e) => {
    setForm((p) => ({ ...p, state: e.target.value, city: "" }));
    setErrors((p) => ({ ...p, state: "", city: "" }));
  };

  // ── Open edit form ────────────────────────────────────────
  const handleEdit = useCallback((addr, e) => {
    e?.stopPropagation(); // don't trigger card select
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

    // Scroll form into view
    setTimeout(() => {
      document
        .querySelector(".ck-address-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  // ── Cancel ────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
    setForm(makeBlank());
  }, [makeBlank]);

  // ── Save (add or edit) ────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setErrors({});

    try {
      if (editingId) {
        // ── EDIT: use PATCH (not PUT) ──────────────────────
        const { data } = await axios.patch(
          `${API}/checkout/address/${editingId}`,
          form,
          { headers: authHeader() }
        );

        const updated = data.data;

        // Update in parent list
        setAddresses?.((prev) =>
          prev.map((a) => (a.id === editingId ? updated : a))
        );

        // Keep selected fresh if we just edited the selected one
        if (selected?.id === editingId) {
          onSelect(updated);
        }

      } else {
        // ── ADD new address ────────────────────────────────
        const { data } = await axios.post(
          `${API}/checkout/address`,
          form,
          { headers: authHeader() }
        );

        const created = data.data;

        // Add to parent list
        setAddresses?.((prev) => [...prev, created]);

        // Auto-select the new address
        onSelect(created);
      }

      // Close form
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
            "Failed to save address. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }, [saving, editingId, form, selected, onSelect, setAddresses, makeBlank]);

  // ── Derived ───────────────────────────────────────────────
  const atLimit   = addresses.length >= MAX_ADDRESSES;
  const isEditing = !!editingId;

  return (
    <div className="ck-section">

      <style>{`@keyframes ck-spin { to { transform:rotate(360deg); } }`}</style>

      <h2 className="ck-section-title">📍 Delivery Address</h2>

      {/* ── Delivery zone notice ─────────────────────────── */}
      <div className="ck-zone-notice">
        <span aria-hidden="true">🚚</span>
        <div>
          <strong>We currently deliver to:</strong>
          <p>
            Osun State (Osogbo, Ile-Ife, Ilesa &amp; more) ·
            Ondo State (Ondo Town only)
          </p>
        </div>
      </div>

      {/* ── Saved address cards ──────────────────────────── */}
      {addresses.map((addr) => {
        const isSelected  = selected?.id === addr.id;
        const isBeingEdit = editingId === addr.id;

        return (
          <div
            key={addr.id}
            className={[
              "ck-address-card",
              isSelected  ? "ck-address-card--selected" : "",
              isBeingEdit ? "ck-address-card--editing"  : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              // Select this address when card clicked
              // (even if form is open for a different address)
              if (!isBeingEdit) {
                onSelect(addr);
                // If form is open for a DIFFERENT address, close it
                if (showForm && editingId && editingId !== addr.id) {
                  handleCancel();
                }
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (!isBeingEdit) onSelect(addr);
              }
            }}
            aria-label={`${isSelected ? "Selected: " : "Select: "}${
              addr.address_line
            }, ${addr.city}`}
            aria-pressed={isSelected}
          >
            {/* Radio dot */}
            <div className="ck-address-radio" aria-hidden="true">
              <div className={`ck-radio ${isSelected ? "ck-radio--active" : ""}`} />
            </div>

            {/* Address info */}
            <div className="ck-address-info">
              <div className="ck-address-label-row">
                <span className="ck-address-label">
                  {LABEL_ICON[addr.label] ?? "📍"} {addr.label}
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
                <p className="ck-address-landmark">
                  📍 {addr.landmark}
                </p>
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

            {/* Edit button */}
            <button
              className={`ck-edit-btn ${
                isBeingEdit ? "ck-edit-btn--active" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isBeingEdit) {
                  // Clicking edit again on same card = cancel
                  handleCancel();
                } else {
                  handleEdit(addr, e);
                }
              }}
              aria-label={
                isBeingEdit
                  ? "Cancel editing"
                  : `Edit address: ${addr.address_line}`
              }
            >
              {isBeingEdit ? "✕ Cancel" : "✏️ Edit"}
            </button>
          </div>
        );
      })}

      {/* ── Add / Edit form ──────────────────────────────── */}
      {showForm && (
        <div className="ck-address-form" role="form"
          aria-label={isEditing ? "Edit address" : "Add new address"}>

          <div className="ck-form-header">
            <h3 className="ck-form-title">
              {isEditing
                ? "✏️ Edit Address"
                : addresses.length === 0
                  ? "➕ Add Delivery Address"
                  : "➕ Add New Address"}
            </h3>
            {/* Only show cancel if there's at least one address */}
            {addresses.length > 0 && (
              <button
                className="ck-form-close"
                onClick={handleCancel}
                aria-label="Close form"
              >
                ✕
              </button>
            )}
          </div>

          {/* General error */}
          {errors.general && (
            <div className="ck-form-error-banner" role="alert">
              ⚠️ {errors.general}
            </div>
          )}

          {/* Label chips */}
          <div className="ck-form-field">
            <label className="ck-form-label">Label</label>
            <div className="ck-label-chips" role="group"
              aria-label="Address label">
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
                  aria-pressed={form.label === l}
                >
                  {LABEL_ICON[l]} {l}
                </button>
              ))}
            </div>
          </div>

          <div className="ck-form-grid">

            {/* Recipient name */}
            <div className="ck-form-field">
              <label className="ck-form-label">
                Recipient Name <span className="ck-required">*</span>
              </label>
              <input
                className={`ck-input ${
                  errors.recipient_name ? "ck-input--error" : ""
                }`}
                value={form.recipient_name}
                onChange={set("recipient_name")}
                placeholder="Full name of receiver"
                autoComplete="name"
              />
              {errors.recipient_name ? (
                <span className="ck-field-error" role="alert">
                  {errors.recipient_name}
                </span>
              ) : user?.name &&
                form.recipient_name === user.name ? (
                <span className="ck-field-hint">
                  Auto-filled — edit if sending to someone else
                </span>
              ) : null}
            </div>

            {/* Phone */}
            <div className="ck-form-field">
              <label className="ck-form-label">
                Phone Number <span className="ck-required">*</span>
              </label>
              <input
                className={`ck-input ${
                  errors.phone ? "ck-input--error" : ""
                }`}
                value={form.phone}
                onChange={(e) => {
                  // Only digits
                  const v = e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 11);
                  setForm((p) => ({ ...p, phone: v }));
                  setErrors((p) => ({ ...p, phone: "" }));
                }}
                placeholder="08012345678"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                autoComplete="tel"
              />
              {errors.phone ? (
                <span className="ck-field-error" role="alert">
                  {errors.phone}
                </span>
              ) : (
                <span className="ck-field-hint">
                  Rider calls this number if needed
                </span>
              )}
            </div>

            {/* State */}
            <div className="ck-form-field">
              <label className="ck-form-label">
                State <span className="ck-required">*</span>
              </label>
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
                <span className="ck-field-error" role="alert">
                  {errors.state}
                </span>
              ) : !form.state ? (
                <span className="ck-field-hint">
                  Osun or Ondo only for now
                </span>
              ) : null}
            </div>

            {/* City */}
            <div className="ck-form-field">
              <label className="ck-form-label">
                City / Area <span className="ck-required">*</span>
              </label>
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
                <span className="ck-field-error" role="alert">
                  {errors.city}
                </span>
              ) : form.state === "Ondo" ? (
                <span className="ck-field-hint ck-field-hint--success">
                  ✅ We deliver to Ondo Town
                </span>
              ) : null}
            </div>

            {/* Street address */}
            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                Street Address <span className="ck-required">*</span>
              </label>
              <input
                className={`ck-input ${
                  errors.address_line ? "ck-input--error" : ""
                }`}
                value={form.address_line}
                onChange={set("address_line")}
                placeholder="e.g. No. 12, Adewale Street, Oke Baale"
                autoComplete="street-address"
              />
              {errors.address_line && (
                <span className="ck-field-error" role="alert">
                  {errors.address_line}
                </span>
              )}
            </div>

            {/* Landmark */}
            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                Landmark / Bus Stop{" "}
                <span className="ck-required">*</span>
                <span className="ck-label-hint">
                  {" "}(very important for delivery)
                </span>
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
                <span className="ck-field-error" role="alert">
                  {errors.landmark}
                </span>
              ) : (
                <span className="ck-field-hint">
                  📍 Examples: "Beside First Bank bus stop" ·
                  "After St. Mary's School"
                </span>
              )}
            </div>

            {/* Additional directions */}
            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                Additional Directions{" "}
                <span className="ck-optional">(optional)</span>
              </label>
              <textarea
                className="ck-input ck-textarea"
                value={form.additional_directions}
                onChange={set("additional_directions")}
                placeholder="e.g. Blue gate, second house after the church, call on arrival"
                rows={2}
                maxLength={300}
              />
              <span className="ck-field-hint">
                {form.additional_directions.length}/300
              </span>
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

          {/* Set as default */}
          {!form.is_default && (
            <label className="ck-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={set("is_default")}
              />
              <span>Set as my default delivery address</span>
            </label>
          )}

          {/* Form actions */}
          <div className="ck-form-actions">
            {addresses.length > 0 && (
              <button
                className="ck-btn-cancel"
                onClick={handleCancel}
                type="button"
              >
                Cancel
              </button>
            )}
            <button
              className="ck-btn-save"
              onClick={handleSave}
              disabled={saving}
              type="button"
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <Spinner />
                  {isEditing ? "Updating…" : "Saving…"}
                </>
              ) : isEditing ? (
                "Update Address"
              ) : (
                "Save Address"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Add new address button ────────────────────────── */}
      {!showForm && !atLimit && addresses.length > 0 && (
        <button
          className="ck-add-address-btn"
          onClick={() => {
            setEditingId(null);
            setForm(makeBlank());
            setErrors({});
            setShowForm(true);
          }}
          type="button"
        >
          ＋ Add New Address
        </button>
      )}

      {/* ── Limit notice ─────────────────────────────────── */}
      {atLimit && !showForm && (
        <p className="ck-limit-notice">
          ℹ️ Max {MAX_ADDRESSES} addresses saved.
          Click <strong>Edit</strong> on one to update it.
        </p>
      )}

      {/* ── Continue button ───────────────────────────────── */}
      {/* Always show when there are saved addresses, even if form is open */}
      {addresses.length > 0 && (
        <button
          className={`ck-next-btn ${
            !selected ? "ck-next-btn--disabled" : ""
          }`}
          onClick={() => { if (selected) onNext(); }}
          disabled={!selected}
          type="button"
          aria-label={
            !selected
              ? "Please select a delivery address first"
              : "Continue to review"
          }
        >
          {!selected
            ? "👆 Select an address to continue"
            : "Continue to Review →"
          }
        </button>
      )}
    </div>
  );
});

export default AddressStep;