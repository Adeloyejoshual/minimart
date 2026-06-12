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
const LABELS        = ["Home", "Office", "Other"];
const MAX_ADDRESSES = 3;
const LABEL_ICON    = { Home: "🏠", Office: "🏢", Other: "📍" };

const BLANK = {
  label:                 "Home",
  recipient_name:        "",
  phone:                 "",
  state:                 "",
  city:                  "",
  address_line:          "",
  bus_stop:              "",   // ← replaces landmark
  additional_directions: "",
  call_before_delivery:  false,
  is_default:            false,
};

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────
const FAKE = [
  /^(abc|xyz|test|house|street|road|address|home|here|there|nil|na|none|bus|stop|busstop)$/i,
  /^(.)\1{4,}$/,
  /^[0-9]+$/,
  /^[a-z]{1,3}$/i,
];

function isFake(value = "", minLen = 5) {
  const t = value.trim();
  if (t.length < minLen) return true;
  return FAKE.some((p) => p.test(t));
}

function validatePhone(phone = "") {
  const c = phone.replace(/[\s\-]/g, "");
  if (!c) return "Phone number is required";
  if (!/^(0[7-9][01]\d{8}|234[7-9][01]\d{8})$/.test(c)) {
    return "Enter a valid number (e.g. 08012345678)";
  }
  return null;
}

function validate(form) {
  const errors = {};

  if (!form.recipient_name?.trim()) {
    errors.recipient_name = "Recipient name is required";
  } else if (form.recipient_name.trim().length < 2) {
    errors.recipient_name = "Enter a full name";
  }

  const phoneErr = validatePhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  if (!form.state?.trim())        errors.state = "Select a state";
  if (!form.city?.trim())         errors.city  = "Select a city";

  if (!form.address_line?.trim()) {
    errors.address_line = "Street address is required";
  } else if (isFake(form.address_line, 10)) {
    errors.address_line = "Enter a real address (e.g. No. 5, Oba Adesida Road)";
  }

  if (!form.bus_stop?.trim()) {
    errors.bus_stop = "Bus stop is required — helps our rider find you";
  } else if (isFake(form.bus_stop, 5)) {
    errors.bus_stop = "Enter a real bus stop (e.g. Oja Oba bus stop)";
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      style={{
        display:      "inline-block",
        width:        "14px",
        height:       "14px",
        border:       "2px solid rgba(255,255,255,0.3)",
        borderTop:    "2px solid white",
        borderRadius: "50%",
        animation:    "ck-spin 0.7s linear infinite",
        flexShrink:   0,
      }}
      aria-hidden="true"
    />
  );
}

// ═════════════════════════════════════════════════════════════
// ADDRESS STEP
// ═════════════════════════════════════════════════════════════
const AddressStep = memo(function AddressStep({
  addresses,
  setAddresses,
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

  // ── Blank pre-filled with user ────────────────────────────
  const makeBlank = useCallback(() => ({
    ...BLANK,
    recipient_name: user?.name         ?? "",
    phone:          user?.phone_number ?? "",
  }), [user]);

  // ── Load zones ────────────────────────────────────────────
  useEffect(() => {
    axios
      .get(`${API}/checkout/address/zones`, { headers: authHeader() })
      .then(({ data }) => setZones(data.data ?? {}))
      .catch(() => {});
  }, []);

  // ── Auto-open form when no addresses ─────────────────────
  useEffect(() => {
    if (addresses.length === 0) {
      setShowForm(true);
      setEditingId(null);
      setForm(makeBlank());
    }
  }, [addresses.length, makeBlank]);

  const stateOptions = Object.keys(zones);
  const cityOptions  = zones[form.state]?.cities ?? [];

  // ── Field setter ─────────────────────────────────────────
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

  // ── Open edit ─────────────────────────────────────────────
  const handleEdit = useCallback((addr, e) => {
    e?.stopPropagation();
    setEditingId(addr.id);
    setForm({
      label:                 addr.label                 ?? "Home",
      recipient_name:        addr.recipient_name        ?? "",
      phone:                 addr.phone                 ?? "",
      state:                 addr.state                 ?? "",
      city:                  addr.city                  ?? "",
      address_line:          addr.address_line          ?? "",
      // Support both new bus_stop and old landmark field
      bus_stop:              addr.bus_stop || addr.landmark || "",
      additional_directions: addr.additional_directions ?? "",
      call_before_delivery:  addr.call_before_delivery  ?? false,
      is_default:            addr.is_default            ?? false,
    });
    setErrors({});
    setShowForm(true);
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

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) return;

    // Client-side validation
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Scroll to first error
      setTimeout(() => {
        document
          .querySelector(".ck-field-error")
          ?.closest(".ck-form-field")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setSaving(true);
    setErrors({});

    // Map bus_stop → landmark for backend
    const payload = {
      ...form,
      landmark: form.bus_stop,
    };

    try {
      if (editingId) {
        const { data } = await axios.patch(
          `${API}/checkout/address/${editingId}`,
          payload,
          { headers: authHeader() }
        );
        const updated = data.data;
        setAddresses?.((prev) =>
          prev.map((a) => (a.id === editingId ? updated : a))
        );
        if (selected?.id === editingId) onSelect(updated);
      } else {
        const { data } = await axios.post(
          `${API}/checkout/address`,
          payload,
          { headers: authHeader() }
        );
        const created = data.data;
        setAddresses?.((prev) => [...prev, created]);
        onSelect(created);
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
            "Failed to save address. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }, [saving, form, editingId, selected, onSelect, setAddresses, makeBlank]);

  // ── Derived ───────────────────────────────────────────────
  const atLimit   = addresses.length >= MAX_ADDRESSES;
  const isEditing = !!editingId;

  return (
    <div className="ck-section">

      <style>{`@keyframes ck-spin { to { transform: rotate(360deg); } }`}</style>

      <h2 className="ck-section-title">📍 Delivery Address</h2>

      {/* ── Zone notice ──────────────────────────────────── */}
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

      {/* ── Bus stop delivery model notice ───────────────── */}
      <div className="ck-busstop-notice">
        <span aria-hidden="true">🚏</span>
        <p>
          Our rider delivers to your{" "}
          <strong>nearest bus stop</strong>.
          You will meet them there to collect your package.
        </p>
      </div>

      {/* ── Address cards ────────────────────────────────── */}
      {addresses.map((addr) => {
        const isSelected  = selected?.id === addr.id;
        const isBeingEdit = editingId === addr.id;
        // Support old landmark field
        const busStop = addr.bus_stop || addr.landmark || null;

        return (
          <div
            key={addr.id}
            className={[
              "ck-address-card",
              isSelected  ? "ck-address-card--selected" : "",
              isBeingEdit ? "ck-address-card--editing"  : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              if (!isBeingEdit) {
                onSelect(addr);
                if (showForm && editingId && editingId !== addr.id) {
                  handleCancel();
                }
              }
            }}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isBeingEdit) {
                onSelect(addr);
              }
            }}
            aria-label={`${isSelected ? "Selected: " : "Select: "}${
              addr.address_line
            }, ${addr.city}`}
          >
            {/* Radio dot */}
            <div className="ck-address-radio" aria-hidden="true">
              <div className={`ck-radio ${
                isSelected ? "ck-radio--active" : ""
              }`} />
            </div>

            {/* Info */}
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

              {/* Bus stop — highlighted */}
              {busStop && (
                <p className="ck-address-busstop">
                  🚏 <strong>{busStop}</strong>
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

              {isSelected && (
                <span className="ck-deliver-here">✓ Deliver Here</span>
              )}
            </div>

            {/* Edit / cancel button */}
            <button
              className={`ck-edit-btn ${
                isBeingEdit ? "ck-edit-btn--active" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                isBeingEdit ? handleCancel() : handleEdit(addr, e);
              }}
              aria-label={
                isBeingEdit
                  ? "Cancel editing"
                  : `Edit address: ${addr.address_line}`
              }
              type="button"
            >
              {isBeingEdit ? "✕ Cancel" : "✏️ Edit"}
            </button>
          </div>
        );
      })}

      {/* ── Add / Edit form ──────────────────────────────── */}
      {showForm && (
        <div
          className="ck-address-form"
          role="form"
          aria-label={isEditing ? "Edit address" : "Add new address"}
        >
          {/* Form header */}
          <div className="ck-form-header">
            <h3 className="ck-form-title">
              {isEditing
                ? "✏️ Edit Address"
                : addresses.length === 0
                  ? "➕ Add Delivery Address"
                  : "➕ Add New Address"}
            </h3>
            {addresses.length > 0 && (
              <button
                className="ck-form-close"
                onClick={handleCancel}
                aria-label="Close form"
                type="button"
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
            <label className="ck-form-label">Address Type</label>
            <div
              className="ck-label-chips"
              role="group"
              aria-label="Address type"
            >
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

            {/* Name */}
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
                  Edit if sending to someone else
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
              {errors.address_line ? (
                <span className="ck-field-error" role="alert">
                  {errors.address_line}
                </span>
              ) : (
                <span className="ck-field-hint">
                  House number + street name + area
                </span>
              )}
            </div>

            {/* ── BUS STOP — key delivery field ── */}
            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                <span>🚏</span>
                Nearest Bus Stop{" "}
                <span className="ck-required">*</span>
              </label>

              {/* Why we need this */}
              <div className="ck-busstop-field-note">
                Our rider delivers to your nearest bus stop —
                not your house. Enter the bus stop name so
                they can find your area quickly.
              </div>

              <input
                className={`ck-input ck-input--busstop ${
                  errors.bus_stop ? "ck-input--error" : ""
                }`}
                value={form.bus_stop}
                onChange={set("bus_stop")}
                placeholder="e.g. Oja Oba bus stop, Olaiya junction"
              />
              {errors.bus_stop ? (
                <span className="ck-field-error" role="alert">
                  {errors.bus_stop}
                </span>
              ) : (
                <span className="ck-field-hint">
                  Examples: "Oja Oba bus stop" ·
                  "Olaiya junction" ·
                  "Beside First Bank bus stop"
                </span>
              )}
            </div>

            {/* Additional directions */}
            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                Extra Info{" "}
                <span className="ck-optional">(optional)</span>
              </label>
              <textarea
                className="ck-input ck-textarea"
                value={form.additional_directions}
                onChange={set("additional_directions")}
                placeholder="e.g. I'll be wearing a blue shirt. Call when you get to the bus stop."
                rows={2}
                maxLength={300}
              />
              <span className="ck-field-hint ck-field-hint--right">
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
              📞 Call me before arriving at the bus stop
              <small>Rider will call when they are on the way</small>
            </span>
          </label>

          {/* Default */}
          {!form.is_default && addresses.length > 0 && (
            <label className="ck-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={set("is_default")}
              />
              <span>Set as my default delivery address</span>
            </label>
          )}

          {/* Actions */}
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

      {/* ── Add new button ────────────────────────────────── */}
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

      {/* ── At limit notice ───────────────────────────────── */}
      {atLimit && !showForm && (
        <p className="ck-limit-notice">
          ℹ️ Max {MAX_ADDRESSES} addresses saved.
          Click <strong>Edit</strong> on one to update it.
        </p>
      )}

      {/* ── Continue button ───────────────────────────────── */}
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
            : "Continue to Review →"}
        </button>
      )}
    </div>
  );
});

export default AddressStep;