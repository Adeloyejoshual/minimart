// pages/Checkout/AddressStep.jsx

import React, {
  useState, useEffect, useCallback, useRef, memo,
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
  bus_stop:              "",
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
  if (!form.state?.trim())  errors.state = "Select a state";
  if (!form.city?.trim())   errors.city  = "Select a city";
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
function Spinner({ size = 14 }) {
  return (
    <span
      style={{
        display:      "inline-block",
        width:        size,
        height:       size,
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

// ─────────────────────────────────────────────────────────────
// DELETE CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────
function DeleteModal({ address, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  const handleYes = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  if (!address) return null;

  const busStop = address.bus_stop || address.landmark || "";

  return (
    <div
      className="ck-modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Delete address"
    >
      <div
        className="ck-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ck-modal-icon">🗑️</span>
        <h3 className="ck-modal-title">Delete this address?</h3>
        <div className="ck-modal-body">
          <p className="ck-modal-addr">
            {address.address_line}
          </p>
          {busStop && (
            <p className="ck-modal-busstop">
              🚏 {busStop}
            </p>
          )}
          <p className="ck-modal-city">
            {address.city}, {address.state}
          </p>
          <p className="ck-modal-warn">
            This cannot be undone.
          </p>
        </div>
        <div className="ck-modal-actions">
          <button
            className="ck-modal-cancel"
            onClick={onCancel}
            disabled={busy}
            type="button"
          >
            Keep Address
          </button>
          <button
            className="ck-modal-delete"
            onClick={handleYes}
            disabled={busy}
            type="button"
          >
            {busy ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADDRESS CARD MENU
// ─────────────────────────────────────────────────────────────
function CardMenu({ address, onEdit, onDelete, onSetDefault }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div
      className="ck-card-menu"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="ck-card-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Address options"
        aria-expanded={open}
        type="button"
      >
        ⋮
      </button>

      {open && (
        <div className="ck-card-dropdown" role="menu">
          <button
            className="ck-drop-item"
            onClick={() => { setOpen(false); onEdit(address); }}
            role="menuitem"
          >
            ✏️ Edit Address
          </button>
          {!address.is_default && (
            <button
              className="ck-drop-item"
              onClick={() => { setOpen(false); onSetDefault(address); }}
              role="menuitem"
            >
              ⭐ Set as Default
            </button>
          )}
          <button
            className="ck-drop-item ck-drop-item--danger"
            onClick={() => { setOpen(false); onDelete(address); }}
            role="menuitem"
          >
            🗑️ Delete Address
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN ADDRESS STEP
// ═════════════════════════════════════════════════════════════
const AddressStep = memo(function AddressStep({
  addresses,
  setAddresses,
  selected,
  onSelect,
  onNext,
  user,
}) {
  const [zones,      setZones]      = useState({});
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(BLANK);
  const [errors,     setErrors]     = useState({});
  const [saving,     setSaving]     = useState(false);
  const [delTarget,  setDelTarget]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const formOpened   = useRef(false);

  // ── Pre-filled blank ──────────────────────────────────────
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

  // ── Wait for addresses to load before deciding form state ─
  useEffect(() => {
    // Give parent time to load addresses
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // ── ONLY open form automatically when:
  //    - Loading is done
  //    - There are genuinely 0 addresses
  //    - Form hasn't been manually opened already ────────────
  useEffect(() => {
    if (loading) return;
    if (addresses.length === 0 && !formOpened.current) {
      setShowForm(true);
      setEditingId(null);
      setForm(makeBlank());
      formOpened.current = true;
    }
  }, [loading, addresses.length, makeBlank]);

  // ── Auto-select default address on first load ─────────────
  useEffect(() => {
    if (!selected && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      onSelect(def);
    }
  }, [addresses, selected, onSelect]);

  const stateOptions = Object.keys(zones);
  const cityOptions  = zones[form.state]?.cities ?? [];

  // ── Field setter ──────────────────────────────────────────
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

  // ── Edit ──────────────────────────────────────────────────
  const handleEdit = useCallback((addr) => {
    setEditingId(addr.id);
    setForm({
      label:                 addr.label                 ?? "Home",
      recipient_name:        addr.recipient_name        ?? "",
      phone:                 addr.phone                 ?? "",
      state:                 addr.state                 ?? "",
      city:                  addr.city                  ?? "",
      address_line:          addr.address_line          ?? "",
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

    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
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
            "Failed to save. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }, [saving, form, editingId, selected, onSelect, setAddresses, makeBlank]);

  // ── Delete ────────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (!delTarget || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(
        `${API}/checkout/address/${delTarget.id}`,
        { headers: authHeader() }
      );
      setAddresses?.((prev) =>
        prev.filter((a) => a.id !== delTarget.id)
      );
      if (selected?.id === delTarget.id) {
        const rest = addresses.filter((a) => a.id !== delTarget.id);
        onSelect(rest[0] ?? null);
      }
    } catch (err) {
      alert(
        err.response?.data?.message ?? "Failed to delete address"
      );
    } finally {
      setDeleting(false);
      setDelTarget(null);
    }
  }, [delTarget, deleting, selected, addresses, onSelect, setAddresses]);

  // ── Set default ───────────────────────────────────────────
  const handleSetDefault = useCallback(async (addr) => {
    try {
      await axios.patch(
        `${API}/checkout/address/${addr.id}/default`,
        {},
        { headers: authHeader() }
      );
      setAddresses?.((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: a.id === addr.id,
        }))
      );
      onSelect({ ...addr, is_default: true });
    } catch (err) {
      alert(
        err.response?.data?.message ?? "Failed to set default"
      );
    }
  }, [setAddresses, onSelect]);

  // ── Derived ───────────────────────────────────────────────
  const atLimit   = addresses.length >= MAX_ADDRESSES;
  const isEditing = !!editingId;

  // ── Skeleton while loading ────────────────────────────────
  if (loading) {
    return (
      <div className="ck-section">
        <h2 className="ck-section-title">📍 Delivery Address</h2>
        <div className="ck-addr-skeleton">
          {[1, 2].map((i) => (
            <div key={i} className="ck-addr-sk-card">
              <div className="ck-addr-sk-dot ck-shimmer" />
              <div className="ck-addr-sk-lines">
                <div className="ck-addr-sk-line ck-addr-sk-w80 ck-shimmer" />
                <div className="ck-addr-sk-line ck-addr-sk-w60 ck-shimmer" />
                <div className="ck-addr-sk-line ck-addr-sk-w45 ck-shimmer" />
              </div>
              <div className="ck-addr-sk-btn ck-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ck-section">

      <style>{`
        @keyframes ck-spin { to { transform: rotate(360deg); } }
        @keyframes ck-shimmer {
          0%   { background-position: -300px 0; }
          100% { background-position:  300px 0; }
        }
        @keyframes ck-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ck-dropdown-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <h2 className="ck-section-title">📍 Delivery Address</h2>

      {/* Zone notice */}
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

      {/* Bus stop delivery notice */}
      <div className="ck-busstop-notice">
        <span aria-hidden="true">🚏</span>
        <p>
          Our rider delivers to your{" "}
          <strong>nearest bus stop</strong>.
          You'll meet them there to collect your package.
        </p>
      </div>

      {/* ── Address cards ────────────────────────────────── */}
      {addresses.map((addr) => {
        const isSelected  = selected?.id === addr.id;
        const isBeingEdit = editingId === addr.id;
        const busStop     = addr.bus_stop || addr.landmark || null;

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
          >
            {/* Radio */}
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
              <p className="ck-address-line">
                {addr.address_line}
              </p>

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
                <span className="ck-deliver-here">
                  ✓ Deliver Here
                </span>
              )}
            </div>

            {/* ⋮ Menu */}
            <CardMenu
              address={addr}
              onEdit={handleEdit}
              onDelete={setDelTarget}
              onSetDefault={handleSetDefault}
            />
          </div>
        );
      })}

      {/* ── Usage bar ────────────────────────────────────── */}
      {addresses.length > 0 && (
        <div className="ck-usage-row">
          <span className="ck-usage-text">
            {addresses.length} of {MAX_ADDRESSES} addresses used
          </span>
          <div className="ck-usage-bar">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`ck-usage-seg ${
                  i <= addresses.length ? "ck-usage-seg--on" : ""
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────── */}
      {showForm && (
        <div
          className="ck-address-form"
          role="form"
          aria-label={isEditing ? "Edit address" : "Add address"}
        >
          <div className="ck-form-header">
            <h3 className="ck-form-title">
              {isEditing
                ? "Edit Address"
                : addresses.length === 0
                  ? "Add Delivery Address"
                  : "New Address"}
            </h3>
            {addresses.length > 0 && (
              <button
                className="ck-form-close"
                onClick={handleCancel}
                type="button"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>

          {errors.general && (
            <div className="ck-form-error-banner" role="alert">
              ⚠️ {errors.general}
            </div>
          )}

          {/* Label */}
          <div className="ck-form-field">
            <label className="ck-form-label">Address Type</label>
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
                  {LABEL_ICON[l]} {l}
                </button>
              ))}
            </div>
          </div>

          <div className="ck-form-grid">

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
                placeholder="Full name"
              />
              {errors.recipient_name && (
                <span className="ck-field-error">
                  {errors.recipient_name}
                </span>
              )}
            </div>

            <div className="ck-form-field">
              <label className="ck-form-label">
                Phone <span className="ck-required">*</span>
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
              />
              {errors.phone ? (
                <span className="ck-field-error">{errors.phone}</span>
              ) : (
                <span className="ck-field-hint">
                  Rider calls this number
                </span>
              )}
            </div>

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
              {errors.state && (
                <span className="ck-field-error">{errors.state}</span>
              )}
            </div>

            <div className="ck-form-field">
              <label className="ck-form-label">
                City <span className="ck-required">*</span>
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
                  {form.state ? "Select city" : "—"}
                </option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.city && (
                <span className="ck-field-error">{errors.city}</span>
              )}
            </div>

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
                placeholder="No. 12, Adewale Street, Oke Baale"
              />
              {errors.address_line && (
                <span className="ck-field-error">
                  {errors.address_line}
                </span>
              )}
            </div>

            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                🚏 Nearest Bus Stop{" "}
                <span className="ck-required">*</span>
              </label>
              <div className="ck-busstop-field-note">
                Enter the bus stop closest to you.
                Our rider will deliver there.
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
                <span className="ck-field-error">
                  {errors.bus_stop}
                </span>
              ) : (
                <span className="ck-field-hint">
                  "Oja Oba bus stop" · "Olaiya junction" ·
                  "Beside First Bank"
                </span>
              )}
            </div>

            <div className="ck-form-field ck-form-field--full">
              <label className="ck-form-label">
                Extra Directions{" "}
                <span className="ck-optional">(optional)</span>
              </label>
              <textarea
                className="ck-input ck-textarea"
                value={form.additional_directions}
                onChange={set("additional_directions")}
                placeholder="e.g. I'll wear a blue shirt. Call when you arrive."
                rows={2}
                maxLength={300}
              />
            </div>
          </div>

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

          {!form.is_default && addresses.length > 0 && (
            <label className="ck-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={set("is_default")}
              />
              <span>Set as default delivery address</span>
            </label>
          )}

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
            formOpened.current = true;
          }}
          type="button"
        >
          ＋ Add New Address
        </button>
      )}

      {/* ── At limit ──────────────────────────────────────── */}
      {atLimit && !showForm && (
        <p className="ck-limit-notice">
          You've saved the maximum of {MAX_ADDRESSES} addresses.
          Use the ⋮ menu on any address to edit or remove it.
        </p>
      )}

      {/* ── Continue button — ALWAYS visible when addresses exist ── */}
      {addresses.length > 0 && (
        <button
          className={`ck-next-btn ${
            !selected ? "ck-next-btn--disabled" : ""
          }`}
          onClick={() => { if (selected) onNext(); }}
          disabled={!selected}
          type="button"
        >
          {!selected
            ? "Select an address to continue"
            : "Continue"}
        </button>
      )}

      {/* ── Delete modal ──────────────────────────────────── */}
      {delTarget && (
        <DeleteModal
          address={delTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </div>
  );
});

export default AddressStep;