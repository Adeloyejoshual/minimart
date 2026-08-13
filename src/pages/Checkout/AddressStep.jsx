/**
 * src/pages/Checkout/AddressStep.jsx
 *
 * Step 1 of checkout — delivery address selection & management.
 *
 * v5 — Premium redesign
 * ──────────────────────────────────────────────────────────────
 * ✓ Jumia-inspired hero banner
 * ✓ All styles in styles/AddressStep.css
 * ✓ Elevated card design with orange accent
 * ✓ Clear visual hierarchy — hero → info → cards → form
 * ✓ Zones fetched WITHOUT auth (endpoint is public)
 * ✓ Cross-device address sync (fresh fetch on mount)
 * ✓ Handles multiple response shapes defensively
 * ✓ ErrorToast with inline retry action
 */

import {
  useState, useEffect, useCallback,
  useRef, useMemo, memo,
} from "react";
import axios from "axios";
import "./styles/AddressStep.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authHeader = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const LABELS        = ["Home", "Office", "Other"];
const MAX_ADDRESSES = 3;

const LABEL_ICON = {
  Home   : "🏠",
  Office : "🏢",
  Other  : "📍",
};

const BLANK = {
  label                 : "Home",
  recipient_name        : "",
  phone                 : "",
  state                 : "",
  city                  : "",
  address_line          : "",
  bus_stop              : "",
  additional_directions : "",
  call_before_delivery  : false,
  is_default            : false,
};

/* ═══════════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════════ */
const FAKE_PATTERNS = [
  /^(abc|xyz|test|house|street|road|address|home|here|there|nil|na|none|bus|stop|busstop)$/i,
  /^(.)\1{4,}$/,
  /^[0-9]+$/,
  /^[a-z]{1,3}$/i,
];

const isFake = (value = "", minLen = 5) => {
  const t = value.trim();
  if (t.length < minLen) return true;
  return FAKE_PATTERNS.some((p) => p.test(t));
};

function normalisePhone(raw = "") {
  let c = raw.replace(/[\s\-()]/g, "");
  if (c.startsWith("+234")) c = "0" + c.slice(4);
  if (c.startsWith("234") && c.length === 13) c = "0" + c.slice(3);
  return c;
}

const validatePhone = (phone = "") => {
  const c = normalisePhone(phone);
  if (!c) return "Phone number is required";
  if (!/^0[7-9][01]\d{8}$/.test(c))
    return "Enter a valid Nigerian number (e.g. 08012345678)";
  return null;
};

const validate = (form) => {
  const errors = {};

  if (!form.recipient_name?.trim())
    errors.recipient_name = "Recipient name is required";
  else if (form.recipient_name.trim().length < 2)
    errors.recipient_name = "Enter a full name";

  const phoneErr = validatePhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  if (!form.state?.trim()) errors.state = "Select a state";
  if (!form.city?.trim())  errors.city  = "Select a city";

  if (!form.address_line?.trim())
    errors.address_line = "Street address is required";
  else if (isFake(form.address_line, 10))
    errors.address_line = "Enter a real address (e.g. No. 5, Oba Adesida Road)";

  if (!form.bus_stop?.trim())
    errors.bus_stop = "Bus stop is required — helps our rider find you";
  else if (isFake(form.bus_stop, 5))
    errors.bus_stop = "Enter a real bus stop (e.g. Oja Oba bus stop)";

  return errors;
};

/* ═══════════════════════════════════════════════════════════════
   ERROR TOAST  (replaces alert())
═══════════════════════════════════════════════════════════════ */
function ErrorToast({ message, onDismiss, action }) {
  if (!message) return null;
  return (
    <div role="alert" className="as-toast">
      <span className="as-toast__msg">⚠️ {message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="as-toast__action"
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          type="button"
          className="as-toast__dismiss"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DELETE MODAL
═══════════════════════════════════════════════════════════════ */
function DeleteModal({ address, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  const handleYes = async () => {
    setBusy(true);
    try   { await onConfirm(); }
    finally { setBusy(false); }
  };

  if (!address) return null;

  const busStop = address.bus_stop || address.landmark || "";

  return (
    <div
      className="as-modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Delete address"
    >
      <div className="as-modal" onClick={(e) => e.stopPropagation()}>
        <div className="as-modal__icon">🗑️</div>
        <h3 className="as-modal__title">Delete this address?</h3>

        <div className="as-modal__body">
          <p className="as-modal__addr">{address.address_line}</p>
          {busStop && <p className="as-modal__busstop">🚏 {busStop}</p>}
          <p className="as-modal__city">{address.city}, {address.state}</p>
          <p className="as-modal__warn">This cannot be undone.</p>
        </div>

        <div className="as-modal__actions">
          <button className="as-modal__cancel" onClick={onCancel}
            disabled={busy} type="button">
            Keep Address
          </button>
          <button className="as-modal__delete" onClick={handleYes}
            disabled={busy} type="button">
            {busy ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARD MENU
═══════════════════════════════════════════════════════════════ */
function CardMenu({ address, onEdit, onDelete, onSetDefault }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

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
      className="as-card__menu"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="as-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Address options"
        aria-expanded={open}
        type="button"
      >
        ⋮
      </button>

      {open && (
        <div className="as-menu-dropdown" role="menu">
          <button className="as-menu-item"
            onClick={() => { setOpen(false); onEdit(address); }}
            role="menuitem">
            <span>✏️</span> Edit Address
          </button>
          {!address.is_default && (
            <button className="as-menu-item"
              onClick={() => { setOpen(false); onSetDefault(address); }}
              role="menuitem">
              <span>⭐</span> Set as Default
            </button>
          )}
          <button className="as-menu-item as-menu-item--danger"
            onClick={() => { setOpen(false); onDelete(address); }}
            role="menuitem">
            <span>🗑️</span> Delete Address
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function AddressSkeleton() {
  return (
    <div className="as-root">
      <div className="as-skeleton">
        {[1, 2].map((i) => (
          <div key={i} className="as-skel-card">
            <div className="as-skel-dot as-shimmer" />
            <div className="as-skel-lines">
              <div className="as-skel-line as-skel-line--80 as-shimmer" />
              <div className="as-skel-line as-skel-line--60 as-shimmer" />
              <div className="as-skel-line as-skel-line--45 as-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const AddressStep = memo(function AddressStep({
  addresses,
  setAddresses,
  selected,
  onSelect,
  onAdd,
  onEdit,
  onNext,
  user,
}) {
  /* ── Zones ── */
  const [zones,      setZones]      = useState({});
  const [zonesError, setZonesError] = useState(null);
  const [zonesReady, setZonesReady] = useState(false);

  /* ── Form ── */
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(BLANK);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);

  /* ── Delete + inline error ── */
  const [delTarget, setDelTarget] = useState(null);
  const [actionErr, setActionErr] = useState(null);

  const formOpened = useRef(false);

  const makeBlank = useCallback(() => ({
    ...BLANK,
    recipient_name : user?.name         ?? "",
    phone          : user?.phone_number ?? "",
  }), [user]);

  /* ══════════════════════════════════════════════════════════
     LOAD ZONES  (public endpoint — no auth)
  ══════════════════════════════════════════════════════════ */
  const loadZones = useCallback(() => {
    setZonesReady(false);
    setZonesError(null);

    let cancelled = false;

    axios
      .get(`${API}/checkout/address/zones`)
      .then((res) => {
        if (cancelled) return;

        const raw = res.data;
        const z =
          raw?.data?.zones ??
          raw?.zones       ??
          raw?.data        ??
          (typeof raw === "object" && !("success" in raw) ? raw : {}) ??
          {};

        if (Object.keys(z).length === 0) {
          setZonesError(
            "Delivery zones could not be loaded. Please refresh the page."
          );
        }
        setZones(z);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[AddressStep] zones fetch failed:", err.message);
        setZonesError(
          "Could not load delivery zones. Check your connection and try again."
        );
      })
      .finally(() => {
        if (!cancelled) setZonesReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = loadZones();
    return cleanup;
  }, [loadZones]);

  /* Auto-open form when no addresses */
  useEffect(() => {
    if (!zonesReady) return;
    if (addresses.length === 0 && !formOpened.current) {
      formOpened.current = true;
      setShowForm(true);
      setEditingId(null);
      setForm(makeBlank());
    }
  }, [zonesReady, addresses.length, makeBlank]);

  /* Auto-select default */
  useEffect(() => {
    if (!selected && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      onSelect(def);
    }
  }, [addresses, selected, onSelect]);

  /* Derived */
  const stateOptions = useMemo(() => Object.keys(zones).sort(), [zones]);
  const cityOptions  = useMemo(
    () => (form.state ? (zones[form.state]?.cities ?? []) : []),
    [zones, form.state]
  );

  const atLimit   = addresses.length >= MAX_ADDRESSES;
  const isEditing = !!editingId;

  /* Field setter */
  const set = useCallback((k) => (e) => {
    const val = e.target.type === "checkbox"
      ? e.target.checked
      : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    setErrors((p) => ({ ...p, [k]: "" }));
  }, []);

  const handleStateChange = useCallback((e) => {
    setForm((p) => ({ ...p, state: e.target.value, city: "" }));
    setErrors((p) => ({ ...p, state: "", city: "" }));
  }, []);

  const handleEdit = useCallback((addr) => {
    setEditingId(addr.id);
    setForm({
      label                 : addr.label                 ?? "Home",
      recipient_name        : addr.recipient_name        ?? "",
      phone                 : addr.phone                 ?? "",
      state                 : addr.state                 ?? "",
      city                  : addr.city                  ?? "",
      address_line          : addr.address_line          ?? "",
      bus_stop              : addr.bus_stop || addr.landmark || "",
      additional_directions : addr.additional_directions ?? "",
      call_before_delivery  : addr.call_before_delivery  ?? false,
      is_default            : addr.is_default            ?? false,
    });
    setErrors({});
    setShowForm(true);
    setTimeout(() => {
      document
        .querySelector(".as-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
    setForm(makeBlank());
  }, [makeBlank]);

  const handleSave = useCallback(async () => {
    if (saving) return;

    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setTimeout(() => {
        document
          .querySelector(".as-field-error")
          ?.closest(".as-field")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setSaving(true);
    setErrors({});

    const payload = { ...form, landmark: form.bus_stop };

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
        onEdit?.(editingId, updated);
        if (selected?.id === editingId) onSelect(updated);
      } else {
        const { data } = await axios.post(
          `${API}/checkout/address`,
          payload,
          { headers: authHeader() }
        );
        const created = data.data;
        setAddresses?.((prev) => [...prev, created]);
        onAdd?.(created);
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
          general :
            err.response?.data?.message ??
            "Failed to save. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }, [
    saving, form, editingId, selected, onSelect,
    setAddresses, onAdd, onEdit, makeBlank,
  ]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!delTarget) return;

    try {
      await axios.delete(
        `${API}/checkout/address/${delTarget.id}`,
        { headers: authHeader() }
      );

      setAddresses?.((prev) => {
        const next = prev.filter((a) => a.id !== delTarget.id);
        if (selected?.id === delTarget.id) onSelect(next[0] ?? null);
        return next;
      });
    } catch (err) {
      setActionErr(
        err.response?.data?.message ??
        "Failed to delete address. Please try again."
      );
    } finally {
      setDelTarget(null);
    }
  }, [delTarget, selected, onSelect, setAddresses]);

  const handleSetDefault = useCallback(async (addr) => {
    try {
      await axios.patch(
        `${API}/checkout/address/${addr.id}/default`,
        {},
        { headers: authHeader() }
      );
      setAddresses?.((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === addr.id }))
      );
      onSelect({ ...addr, is_default: true });
    } catch (err) {
      setActionErr(
        err.response?.data?.message ??
        "Failed to set default address."
      );
    }
  }, [setAddresses, onSelect]);

  if (!zonesReady) return <AddressSkeleton />;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="as-root">

      {/* ══════ HERO BANNER ══════ */}
      <div className="as-hero">
        <div className="as-hero__pattern" />
        <div className="as-hero__content">
          <div className="as-hero__icon">🚚</div>
          <div className="as-hero__text">
            <h2>Where should we deliver?</h2>
            <p>
              Fast delivery to Osun &amp; Ondo States ·
              Meet our rider at your bus stop
            </p>
          </div>
        </div>
      </div>

      {/* ══════ TOASTS ══════ */}
      <ErrorToast
        message={actionErr}
        onDismiss={() => setActionErr(null)}
      />
      <ErrorToast
        message={zonesError}
        onDismiss={() => setZonesError(null)}
        action={zonesError ? { label: "Retry", onClick: loadZones } : null}
      />

      {/* ══════ INFO STRIP ══════ */}
      <div className="as-info-strip">
        <span className="as-info-strip__icon">🚏</span>
        <div className="as-info-strip__text">
          We deliver to your <strong>nearest bus stop</strong>.
          You'll meet the rider there to collect your package —
          they'll call before arriving.
        </div>
      </div>

      {/* ══════ ADDRESS CARDS ══════ */}
      {addresses.length > 0 && (
        <div className="as-section-title">
          <span>Saved Addresses</span>
          <span className="as-section-title__count">
            {addresses.length} / {MAX_ADDRESSES}
          </span>
        </div>
      )}

      {addresses.map((addr) => {
        const isSelected  = selected?.id === addr.id;
        const isBeingEdit = editingId === addr.id;
        const busStop     = addr.bus_stop || addr.landmark || null;

        return (
          <div
            key={addr.id}
            className={[
              "as-card",
              isSelected  ? "as-card--selected" : "",
              isBeingEdit ? "as-card--editing"  : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              if (!isBeingEdit) {
                onSelect(addr);
                if (showForm && editingId && editingId !== addr.id)
                  handleCancel();
              }
            }}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isBeingEdit)
                onSelect(addr);
            }}
          >
            <div className="as-card__radio" aria-hidden="true">
              <div className="as-card__radio-dot" />
            </div>

            <div className="as-card__info">
              <div className="as-card__tags">
                <span className="as-card__label">
                  {LABEL_ICON[addr.label] ?? "📍"} {addr.label}
                </span>
                {addr.is_default && (
                  <span className="as-tag as-tag--default">Default</span>
                )}
                {addr.call_before_delivery && (
                  <span className="as-tag as-tag--call">📞 Call first</span>
                )}
              </div>

              <p className="as-card__name">{addr.recipient_name}</p>
              <p className="as-card__phone">{addr.phone}</p>
              <p className="as-card__street">{addr.address_line}</p>

              {busStop && (
                <div className="as-card__busstop">
                  🚏 {busStop}
                </div>
              )}

              {addr.additional_directions && (
                <p className="as-card__directions">
                  ℹ️ {addr.additional_directions}
                </p>
              )}

              <p className="as-card__location">
                {addr.city}, {addr.state}
              </p>

              {isSelected && (
                <span className="as-card__deliver-here">
                  ✓ Deliver Here
                </span>
              )}
            </div>

            <CardMenu
              address={addr}
              onEdit={handleEdit}
              onDelete={setDelTarget}
              onSetDefault={handleSetDefault}
            />
          </div>
        );
      })}

      {/* ══════ USAGE BAR ══════ */}
      {addresses.length > 0 && (
        <div className="as-usage">
          <span className="as-usage__text">
            {addresses.length === MAX_ADDRESSES
              ? "You've reached the maximum"
              : `Add up to ${MAX_ADDRESSES - addresses.length} more`}
          </span>
          <div className="as-usage__bar">
            {Array.from({ length: MAX_ADDRESSES }).map((_, i) => (
              <div
                key={i}
                className={`as-usage__seg ${
                  i < addresses.length ? "as-usage__seg--on" : ""
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ══════ ADD ADDRESS BUTTON ══════ */}
      {!showForm && !atLimit && addresses.length > 0 && (
        <button
          className="as-add-btn"
          onClick={() => {
            formOpened.current = true;
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

      {/* ══════ LIMIT NOTICE ══════ */}
      {atLimit && !showForm && (
        <p className="as-limit">
          You've saved the maximum of {MAX_ADDRESSES} addresses.
          Use the ⋮ menu on any address to edit or remove it.
        </p>
      )}

      {/* ══════ FORM ══════ */}
      {showForm && (
        <div
          className="as-form"
          role="form"
          aria-label={isEditing ? "Edit address" : "Add address"}
        >
          <div className="as-form__header">
            <h3 className="as-form__title">
              {isEditing
                ? "Edit Address"
                : addresses.length === 0
                  ? "Add Your Delivery Address"
                  : "New Address"}
            </h3>
            {addresses.length > 0 && (
              <button className="as-form__close" onClick={handleCancel}
                type="button" aria-label="Close">
                ✕
              </button>
            )}
          </div>

          {errors.general && (
            <div className="as-form__banner-error" role="alert">
              ⚠️ {errors.general}
            </div>
          )}

          {/* Label chips */}
          <div className="as-field">
            <label className="as-label">Address Type</label>
            <div className="as-chips">
              {LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`as-chip ${
                    form.label === l ? "as-chip--active" : ""
                  }`}
                  onClick={() => setForm((p) => ({ ...p, label: l }))}
                >
                  {LABEL_ICON[l]} {l}
                </button>
              ))}
            </div>
          </div>

          <div className="as-form-grid">

            {/* Recipient */}
            <div className="as-field">
              <label className="as-label">
                Recipient Name <span className="as-label__required">*</span>
              </label>
              <input
                className={`as-input ${errors.recipient_name ? "as-input--error" : ""}`}
                value={form.recipient_name}
                onChange={set("recipient_name")}
                placeholder="Full name"
              />
              {errors.recipient_name && (
                <span className="as-field-error">{errors.recipient_name}</span>
              )}
            </div>

            {/* Phone */}
            <div className="as-field">
              <label className="as-label">
                Phone <span className="as-label__required">*</span>
              </label>
              <input
                className={`as-input ${errors.phone ? "as-input--error" : ""}`}
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
                <span className="as-field-error">{errors.phone}</span>
              ) : (
                <span className="as-field-hint">Rider calls this number</span>
              )}
            </div>

            {/* State */}
            <div className="as-field">
              <label className="as-label" htmlFor="as-state-select">
                State <span className="as-label__required">*</span>
              </label>

              {stateOptions.length === 0 ? (
                <div className="as-zones-error">
                  <span className="as-zones-error__msg">
                    No states loaded
                  </span>
                  <button
                    type="button"
                    onClick={loadZones}
                    className="as-zones-error__retry"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <select
                  id="as-state-select"
                  className={`as-select ${errors.state ? "as-input--error" : ""}`}
                  value={form.state}
                  onChange={handleStateChange}
                >
                  <option value="">Select state</option>
                  {stateOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {errors.state && (
                <span className="as-field-error">{errors.state}</span>
              )}
            </div>

            {/* City */}
            <div className="as-field">
              <label className="as-label" htmlFor="as-city-select">
                City <span className="as-label__required">*</span>
              </label>
              <select
                id="as-city-select"
                className={`as-select ${errors.city ? "as-input--error" : ""}`}
                value={form.city}
                onChange={set("city")}
                disabled={!form.state || cityOptions.length === 0}
              >
                <option value="">
                  {!form.state
                    ? "Select a state first"
                    : cityOptions.length === 0
                      ? "No cities"
                      : "Select city"}
                </option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.city && (
                <span className="as-field-error">{errors.city}</span>
              )}
            </div>

            {/* Street */}
            <div className="as-field as-field--full">
              <label className="as-label">
                Street Address <span className="as-label__required">*</span>
              </label>
              <input
                className={`as-input ${errors.address_line ? "as-input--error" : ""}`}
                value={form.address_line}
                onChange={set("address_line")}
                placeholder="No. 12, Adewale Street, Oke Baale"
              />
              {errors.address_line && (
                <span className="as-field-error">{errors.address_line}</span>
              )}
            </div>

            {/* Bus stop */}
            <div className="as-field as-field--full">
              <label className="as-label">
                🚏 Nearest Bus Stop <span className="as-label__required">*</span>
              </label>
              <div className="as-field-note">
                Enter the bus stop closest to you.
                Our rider will deliver there.
              </div>
              <input
                className={`as-input ${errors.bus_stop ? "as-input--error" : ""}`}
                value={form.bus_stop}
                onChange={set("bus_stop")}
                placeholder="e.g. Oja Oba bus stop, Olaiya junction"
              />
              {errors.bus_stop ? (
                <span className="as-field-error">{errors.bus_stop}</span>
              ) : (
                <span className="as-field-hint">
                  "Oja Oba bus stop" · "Olaiya junction" · "Beside First Bank"
                </span>
              )}
            </div>

            {/* Extra directions */}
            <div className="as-field as-field--full">
              <label className="as-label">
                Extra Directions{" "}
                <span className="as-label__optional">(optional)</span>
              </label>
              <textarea
                className="as-textarea"
                value={form.additional_directions}
                onChange={set("additional_directions")}
                placeholder="e.g. I'll wear a blue shirt. Call when you arrive."
                rows={2}
                maxLength={300}
              />
            </div>

          </div>

          {/* Call before delivery */}
          <label className="as-check as-check--highlight">
            <input
              type="checkbox"
              checked={form.call_before_delivery}
              onChange={set("call_before_delivery")}
            />
            <span className="as-check__text">
              📞 Call me before arriving at the bus stop
              <small>Rider will call when they are on the way</small>
            </span>
          </label>

          {/* Set as default */}
          {!form.is_default && addresses.length > 0 && (
            <label className="as-check">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={set("is_default")}
              />
              <span className="as-check__text">
                Set as default delivery address
              </span>
            </label>
          )}

          {/* Actions */}
          <div className="as-actions">
            {addresses.length > 0 && (
              <button className="as-btn-cancel" onClick={handleCancel} type="button">
                Cancel
              </button>
            )}
            <button className="as-btn-save" onClick={handleSave}
              disabled={saving} type="button">
              {saving ? (
                <>
                  <span className="as-spinner" />
                  {isEditing ? "Updating…" : "Saving…"}
                </>
              ) : isEditing ? "Update Address" : "Save Address"}
            </button>
          </div>
        </div>
      )}

      {/* ══════ CONTINUE BUTTON ══════ */}
      {addresses.length > 0 && (
        <button
          className="as-next"
          onClick={() => { if (selected) onNext(); }}
          disabled={!selected}
          type="button"
        >
          {!selected ? "Select an address to continue" : "Continue"}
          {selected && <span className="as-next__arrow">→</span>}
        </button>
      )}

      {/* Delete modal */}
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