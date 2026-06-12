// src/pages/Checkout/components/AddressForm.jsx

import React, { useState, useCallback, memo } from "react";
import { validateForm } from "../validators/addressValidator.js";

const LABELS = [
  { value: "Home",   icon: "🏠" },
  { value: "Office", icon: "🏢" },
  { value: "Other",  icon: "📍" },
];

function BLANK() {
  return {
    label:                 "Home",
    recipient_name:        "",
    phone:                 "",
    state:                 "",
    city:                  "",
    address_line:          "",
    bus_stop:              "",
    additional_directions: "",
    call_before_delivery:  false,
    leave_at_gate:         false,
    deliver_to_security:   false,
    fragile_package:       false,
    is_default:            false,
  };
}

const AddressForm = memo(function AddressForm({
  initial      = null,
  zones        = {},
  allAddresses = [],
  onSave,
  onCancel,
  user,
  showCancel   = true,
}) {
  const editingId = initial?.id ?? null;
  const isEdit    = !!editingId;

  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...BLANK(),
        ...initial,
        // Map old landmark field → bus_stop for backwards compat
        bus_stop: initial.bus_stop || initial.landmark || "",
      };
    }
    return {
      ...BLANK(),
      recipient_name: user?.name         ?? "",
      phone:          user?.phone_number ?? "",
      is_default:     allAddresses.length === 0,
    };
  });

  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [preview, setPreview] = useState(false);

  const set = useCallback((k) => (e) => {
    const v = e.target.type === "checkbox"
      ? e.target.checked
      : e.target.value;
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: "" }));
  }, []);

  const handleState = useCallback((e) => {
    setForm((p) => ({ ...p, state: e.target.value, city: "" }));
    setErrors((p) => ({ ...p, state: "", city: "" }));
  }, []);

  const stateOptions = Object.keys(zones);
  const cityOptions  = zones[form.state]?.cities ?? [];

  // ── Validate → preview ────────────────────────────────
  const handleReview = useCallback(() => {
    const { valid, errors: e } = validateForm(
      form, allAddresses, editingId
    );
    if (!valid) {
      setErrors(e);
      setTimeout(() => {
        document
          .querySelector(".af-err")
          ?.closest(".af-field")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});
    setPreview(true);
  }, [form, allAddresses, editingId]);

  // ── Confirm save ──────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      // Map bus_stop → landmark for backend compatibility
      await onSave({
        ...form,
        landmark: form.bus_stop,
      });
    } catch (err) {
      setSaving(false);
      setPreview(false);
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({
          general:
            err.response?.data?.message ??
            "Failed to save. Please try again.",
        });
      }
    }
  }, [form, onSave]);

  // ═══════════════════════════════════════════════════════
  // PREVIEW
  // ═══════════════════════════════════════════════════════
  if (preview) {
    return (
      <div className="af-preview">
        <div className="af-preview-header">
          <h4 className="af-preview-title">📋 Confirm Address</h4>
          <p className="af-preview-sub">
            Check everything before saving
          </p>
        </div>

        <div className="af-preview-card">
          <p className="af-pv-name">{form.recipient_name}</p>
          <p className="af-pv-phone">{form.phone}</p>
          <div className="af-pv-line" />
          <p className="af-pv-street">{form.address_line}</p>
          <p className="af-pv-busstop">
            🚏 Bus Stop: <strong>{form.bus_stop}</strong>
          </p>
          <p className="af-pv-city">{form.city}, {form.state}</p>

          {form.additional_directions && (
            <p className="af-pv-extra">
              ℹ️ {form.additional_directions}
            </p>
          )}

          <div className="af-pv-tags">
            {form.call_before_delivery && (
              <span className="af-pv-tag">📞 Call first</span>
            )}
            {form.leave_at_gate && (
              <span className="af-pv-tag">🚪 Leave at gate</span>
            )}
            {form.deliver_to_security && (
              <span className="af-pv-tag">💂 Give to security</span>
            )}
            {form.fragile_package && (
              <span className="af-pv-tag">🥚 Fragile</span>
            )}
          </div>
        </div>

        <div className="af-pv-actions">
          <button
            className="af-btn af-btn--ghost"
            onClick={() => setPreview(false)}
            type="button"
          >
            ← Edit
          </button>
          <button
            className="af-btn af-btn--green"
            onClick={handleConfirm}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving…" : "✅ Save Address"}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // FORM
  // ═══════════════════════════════════════════════════════
  return (
    <div className="af-wrap">

      {/* Header */}
      <div className="af-header">
        <h3 className="af-title">
          {isEdit ? "Edit Address" : "New Address"}
        </h3>
        {showCancel && (
          <button
            className="af-close"
            onClick={onCancel}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {errors.general && (
        <div className="af-banner" role="alert">
          ⚠️ {errors.general}
        </div>
      )}

      {/* Label */}
      <div className="af-field">
        <label className="af-label">Address Type</label>
        <div className="af-chips">
          {LABELS.map(({ value, icon }) => (
            <button
              key={value}
              type="button"
              className={`af-chip ${
                form.label === value ? "af-chip--on" : ""
              }`}
              onClick={() =>
                setForm((p) => ({ ...p, label: value }))
              }
            >
              {icon} {value}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="af-grid">

        {/* Name */}
        <div className="af-field">
          <label className="af-label">
            Recipient Name <span className="af-req">*</span>
          </label>
          <input
            className={`af-input ${
              errors.recipient_name ? "af-input--bad" : ""
            }`}
            value={form.recipient_name}
            onChange={set("recipient_name")}
            placeholder="Full name"
            autoComplete="name"
          />
          {errors.recipient_name && (
            <span className="af-err">{errors.recipient_name}</span>
          )}
        </div>

        {/* Phone */}
        <div className="af-field">
          <label className="af-label">
            Phone <span className="af-req">*</span>
          </label>
          <input
            className={`af-input ${
              errors.phone ? "af-input--bad" : ""
            }`}
            value={form.phone}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 11);
              setForm((p) => ({ ...p, phone: v }));
              setErrors((p) => ({ ...p, phone: "" }));
            }}
            placeholder="08012345678"
            type="tel"
            inputMode="numeric"
            maxLength={11}
          />
          {errors.phone ? (
            <span className="af-err">{errors.phone}</span>
          ) : (
            <span className="af-hint">
              Rider calls this number
            </span>
          )}
        </div>

        {/* State */}
        <div className="af-field">
          <label className="af-label">
            State <span className="af-req">*</span>
          </label>
          <select
            className={`af-input af-sel ${
              errors.state ? "af-input--bad" : ""
            }`}
            value={form.state}
            onChange={handleState}
          >
            <option value="">Select state</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.state && (
            <span className="af-err">{errors.state}</span>
          )}
        </div>

        {/* City */}
        <div className="af-field">
          <label className="af-label">
            City <span className="af-req">*</span>
          </label>
          <select
            className={`af-input af-sel ${
              errors.city ? "af-input--bad" : ""
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
          {errors.city && (
            <span className="af-err">{errors.city}</span>
          )}
        </div>

        {/* Street */}
        <div className="af-field af-field--full">
          <label className="af-label">
            Street Address <span className="af-req">*</span>
          </label>
          <input
            className={`af-input ${
              errors.address_line ? "af-input--bad" : ""
            }`}
            value={form.address_line}
            onChange={set("address_line")}
            placeholder="No. 5, Oba Adesida Road, Oke-Fia"
          />
          {errors.address_line ? (
            <span className="af-err">{errors.address_line}</span>
          ) : (
            <span className="af-hint">
              House number + street name + area
            </span>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
           BUS STOP — the most important delivery field
           Rider goes HERE, not to your house
        ═══════════════════════════════════════════════ */}
        <div className="af-field af-field--full">
          <label className="af-label">
            <span className="af-label-icon">🚏</span>
            Nearest Bus Stop{" "}
            <span className="af-req">*</span>
          </label>
          <p className="af-field-note">
            Our rider delivers to your <strong>nearest bus stop</strong>.
            Enter the bus stop name so the rider can locate your area easily.
          </p>
          <input
            className={`af-input af-input--busstop ${
              errors.bus_stop ? "af-input--bad" : ""
            }`}
            value={form.bus_stop}
            onChange={set("bus_stop")}
            placeholder="e.g. Oja Oba bus stop, Olaiya junction"
          />
          {errors.bus_stop ? (
            <span className="af-err">{errors.bus_stop}</span>
          ) : (
            <span className="af-hint">
              Examples: "Oja Oba bus stop" · "Olaiya junction" ·
              "Beside First Bank bus stop" · "Oke-Fia roundabout"
            </span>
          )}
        </div>

        {/* Additional */}
        <div className="af-field af-field--full">
          <label className="af-label">
            Extra Directions{" "}
            <span className="af-opt">(optional)</span>
          </label>
          <textarea
            className="af-input af-textarea"
            value={form.additional_directions}
            onChange={set("additional_directions")}
            placeholder="e.g. I'll be wearing a blue shirt. Call when you arrive at the bus stop."
            rows={2}
            maxLength={300}
          />
          <span className="af-hint af-hint--right">
            {form.additional_directions.length}/300
          </span>
        </div>
      </div>

      {/* Delivery preferences */}
      <div className="af-section">
        <p className="af-section-title">📦 Delivery Preferences</p>
        <div className="af-checks">
          {[
            { key: "call_before_delivery", text: "📞 Call me before arriving at bus stop" },
            { key: "leave_at_gate",        text: "🚪 Leave package at gate if I'm not there" },
            { key: "deliver_to_security",  text: "💂 Give to security / porter" },
            { key: "fragile_package",      text: "🥚 Fragile — handle with care" },
          ].map(({ key, text }) => (
            <label key={key} className="af-check-item">
              <input
                type="checkbox"
                checked={form[key] ?? false}
                onChange={set(key)}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Default */}
      {allAddresses.length > 0 && !form.is_default && (
        <label className="af-check-item af-check-default">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={set("is_default")}
          />
          <span>Set as default delivery address</span>
        </label>
      )}

      {/* Actions */}
      <div className="af-actions">
        {showCancel && (
          <button
            className="af-btn af-btn--ghost"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        )}
        <button
          className="af-btn af-btn--primary"
          onClick={handleReview}
          type="button"
        >
          Review Address →
        </button>
      </div>
    </div>
  );
});

export default AddressForm;