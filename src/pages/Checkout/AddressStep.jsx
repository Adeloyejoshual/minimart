/**
 * src/pages/Checkout/AddressStep.jsx
 *
 * Flat Jumia-style delivery address section.
 *
 * v4 — Add New Address always accessible
 * ─────────────────────────────────────────────────────
 * ✓ "Add New Address" button visible in summary + picker views
 * ✓ Uses external validators/addressValidator.js
 * ✓ Duplicate address detection
 * ✓ Summary shows total address count
 * ✓ Cleaner mode transitions (summary → picker → form)
 * ✓ Form knows if it's adding vs editing
 * ✓ All previous v3 features (WhatsApp notice, delete, default)
 */

import {
  useState, useEffect, useCallback,
  useRef, useMemo, memo,
} from "react";
import axios from "axios";
import "./styles/AddressStep.css";
import { validateForm } from "./validators/addressValidator";

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
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Home: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Office: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M10 22V17h4v5" />
    </svg>
  ),
  Pin: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Trash: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  Edit: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Star: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  More: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="5"  r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  ),
  X: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Alert: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Plus: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5"  x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  ),
  ChevronRight: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

const LABEL_ICON = { Home: Icon.Home, Office: Icon.Office, Other: Icon.Pin };

/* ═══════════════════════════════════════════════════════════════
   FORMAT ADDRESS SUMMARY (Jumia style)
═══════════════════════════════════════════════════════════════ */
function formatSummaryLine(addr) {
  const parts = [];
  if (addr.address_line) parts.push(addr.address_line);
  if (addr.state || addr.city) {
    parts.push([addr.state, addr.city, addr.bus_stop || addr.landmark]
      .filter(Boolean).join(" - "));
  }
  const phone = addr.phone?.startsWith("0")
    ? "+234 " + addr.phone.slice(1)
    : addr.phone;
  if (phone) parts.push(phone);
  return parts.join(" | ");
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function ErrorToast({ message, onDismiss, action }) {
  if (!message) return null;
  return (
    <div role="alert" className="as-toast">
      <span className="as-toast__icon"><Icon.Alert /></span>
      <span className="as-toast__msg">{message}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="as-toast__action">
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} type="button"
          className="as-toast__dismiss" aria-label="Dismiss">
          <Icon.X />
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

  return (
    <div className="as-modal-overlay" onClick={onCancel}
      role="dialog" aria-modal="true">
      <div className="as-modal" onClick={(e) => e.stopPropagation()}>
        <div className="as-modal__icon"><Icon.Trash size={20} /></div>
        <h3 className="as-modal__title">Delete this address?</h3>
        <div className="as-modal__body">
          <p className="as-modal__addr">{address.address_line}</p>
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
    <div className="as-card__menu" ref={ref}
      onClick={(e) => e.stopPropagation()}>
      <button className="as-menu-btn" onClick={() => setOpen((v) => !v)}
        aria-label="Address options" type="button">
        <Icon.More />
      </button>
      {open && (
        <div className="as-menu-dropdown" role="menu">
          <button className="as-menu-item"
            onClick={() => { setOpen(false); onEdit(address); }}>
            <Icon.Edit /> Edit
          </button>
          {!address.is_default && (
            <button className="as-menu-item"
              onClick={() => { setOpen(false); onSetDefault(address); }}>
              <Icon.Star /> Set as Default
            </button>
          )}
          <button className="as-menu-item as-menu-item--danger"
            onClick={() => { setOpen(false); onDelete(address); }}>
            <Icon.Trash /> Delete
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
        <div className="as-skel-line as-skel-line--80 as-shimmer" />
        <div className="as-skel-line as-skel-line--60 as-shimmer" />
        <div className="as-skel-line as-skel-line--45 as-shimmer" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD ADDRESS BUTTON (reusable)
═══════════════════════════════════════════════════════════════ */
function AddAddressButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="as-add-link"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon.Plus />
      <span>Add New Address</span>
    </button>
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
  onChangeNumber,
  termsHref = "/terms",
}) {
  const [zones,      setZones]      = useState({});
  const [zonesError, setZonesError] = useState(null);
  const [zonesReady, setZonesReady] = useState(false);

  /* mode: "summary" | "picker" | "form" */
  const [mode,      setMode]      = useState("summary");
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(BLANK);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);

  const [delTarget, setDelTarget] = useState(null);
  const [actionErr, setActionErr] = useState(null);

  const makeBlank = useCallback(() => ({
    ...BLANK,
    recipient_name : user?.name         ?? "",
    phone          : user?.phone_number ?? "",
  }), [user]);

  /* ── Load delivery zones ── */
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
        if (Object.keys(z).length === 0)
          setZonesError("Delivery zones could not be loaded.");
        setZones(z);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[AddressStep] zones fetch failed:", err.message);
        setZonesError("Could not load delivery zones.");
      })
      .finally(() => { if (!cancelled) setZonesReady(true); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = loadZones();
    return cleanup;
  }, [loadZones]);

  /* ── If no addresses, jump into form ── */
  useEffect(() => {
    if (!zonesReady) return;
    if (addresses.length === 0 && mode === "summary") {
      setEditingId(null);
      setForm(makeBlank());
      setMode("form");
    }
  }, [zonesReady, addresses.length, mode, makeBlank]);

  /* ── Auto-select default address ── */
  useEffect(() => {
    if (!selected && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      onSelect(def);
    }
  }, [addresses, selected, onSelect]);

  /* ── Derived ── */
  const stateOptions = useMemo(() => Object.keys(zones).sort(), [zones]);
  const cityOptions  = useMemo(
    () => (form.state ? (zones[form.state]?.cities ?? []) : []),
    [zones, form.state]
  );

  const atLimit    = addresses.length >= MAX_ADDRESSES;
  const isEditing  = !!editingId;
  const hasMultiple = addresses.length > 1;

  /* ── Field setters ── */
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

  /* ── Enter form for editing ── */
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
    setMode("form");
  }, []);

  /* ── Enter form for new address ── */
  const handleAddNew = useCallback(() => {
    if (atLimit) {
      setActionErr(`You can only save up to ${MAX_ADDRESSES} addresses. Delete one first.`);
      return;
    }
    setEditingId(null);
    setForm(makeBlank());
    setErrors({});
    setMode("form");
  }, [atLimit, makeBlank]);

  /* ── Cancel form ── */
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setErrors({});
    setForm(makeBlank());
    setMode(addresses.length > 0 ? "summary" : "form");
  }, [makeBlank, addresses.length]);

  /* ── Save form ── */
  const handleSave = useCallback(async () => {
    if (saving) return;

    /* Use external validator */
    const { valid, errors: validationErrors } = validateForm(
      form,
      addresses,
      editingId
    );

    if (!valid) {
      setErrors(validationErrors);
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

      setEditingId(null);
      setForm(makeBlank());
      setMode("summary");

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
    saving, form, addresses, editingId, selected, onSelect,
    setAddresses, onAdd, onEdit, makeBlank,
  ]);

  /* ── Delete address ── */
  const handleDeleteConfirm = useCallback(async () => {
    if (!delTarget) return;
    try {
      await axios.delete(`${API}/checkout/address/${delTarget.id}`,
        { headers: authHeader() });
      setAddresses?.((prev) => {
        const next = prev.filter((a) => a.id !== delTarget.id);
        if (selected?.id === delTarget.id) onSelect(next[0] ?? null);
        return next;
      });
    } catch (err) {
      setActionErr(err.response?.data?.message ??
        "Failed to delete address.");
    } finally {
      setDelTarget(null);
    }
  }, [delTarget, selected, onSelect, setAddresses]);

  /* ── Set default ── */
  const handleSetDefault = useCallback(async (addr) => {
    try {
      await axios.patch(`${API}/checkout/address/${addr.id}/default`,
        {}, { headers: authHeader() });
      setAddresses?.((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === addr.id })));
      onSelect({ ...addr, is_default: true });
    } catch (err) {
      setActionErr(err.response?.data?.message ??
        "Failed to set default.");
    }
  }, [setAddresses, onSelect]);

  /* ── Pick address in picker view ── */
  const handlePickAddress = useCallback((addr) => {
    onSelect(addr);
    setMode("summary");
  }, [onSelect]);

  /* ── Open picker (also acts as "manage addresses") ── */
  const handleOpenPicker = useCallback(() => {
    if (hasMultiple) {
      setMode("picker");
    } else if (selected) {
      handleEdit(selected);
    }
  }, [hasMultiple, selected, handleEdit]);

  if (!zonesReady) return <AddressSkeleton />;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="as-root">

      {/* ══════ WHATSAPP NOTICE ══════ */}
      <div className="as-wa-notice">
        <p className="as-wa-notice__text">
          Please use a WhatsApp-enabled number to receive faster
          delivery updates and support.
          {onChangeNumber && (
            <>
              {" "}Tap{" "}
              <button
                type="button"
                onClick={onChangeNumber}
                className="as-wa-notice__change"
              >
                "Change"
              </button>
              {" "}to update your number before checkout.
            </>
          )}
          {" "}By proceeding, you are automatically accepting the{" "}
          <a href={termsHref}
            className="as-wa-notice__terms"
            target="_blank" rel="noopener noreferrer">
            Terms &amp; Conditions
          </a>.
        </p>
      </div>

      {/* ══════ TOASTS ══════ */}
      <ErrorToast message={actionErr}
        onDismiss={() => setActionErr(null)} />
      <ErrorToast message={zonesError}
        onDismiss={() => setZonesError(null)}
        action={zonesError ? { label: "Retry", onClick: loadZones } : null} />

      {/* ══════ CUSTOMER ADDRESS SECTION ══════ */}
      <div className="as-section-header">
        <h3 className="as-section-header__title">
          Customer Address
          {addresses.length > 0 && (
            <span className="as-section-header__count">
              {addresses.length} of {MAX_ADDRESSES}
            </span>
          )}
        </h3>

        {selected && mode === "summary" && (
          <button
            className="as-section-header__action"
            onClick={handleOpenPicker}
            type="button"
          >
            Change
          </button>
        )}

        {mode === "picker" && (
          <button
            className="as-section-header__action"
            onClick={() => setMode("summary")}
            type="button"
          >
            Done
          </button>
        )}
      </div>

      {/* ══════ SUMMARY VIEW ══════ */}
      {mode === "summary" && selected && (
        <>
          <div className="as-section-body">
            <p className="as-summary__name">
              {selected.recipient_name}
              {selected.is_default && (
                <span className="as-summary__default-tag">Default</span>
              )}
            </p>
            <p className="as-summary__line">{formatSummaryLine(selected)}</p>
          </div>

          {/*
            Persistent "Add New Address" button in summary view.
            Users can add more addresses without going into picker.
            Hidden when at limit.
          */}
          {!atLimit && (
            <AddAddressButton onClick={handleAddNew} />
          )}

          {atLimit && (
            <div className="as-limit-notice">
              <Icon.Alert />
              <span>
                You've saved the maximum of {MAX_ADDRESSES} addresses.
                Delete one to add a new address.
              </span>
            </div>
          )}
        </>
      )}

      {/* ══════ PICKER VIEW ══════ */}
      {mode === "picker" && (
        <>
          <div className="as-section-body">
            <div className="as-picker">
              {addresses.map((addr) => {
                const isSel = selected?.id === addr.id;
                return (
                  <div
                    key={addr.id}
                    className={`as-picker__item ${isSel ? "as-picker__item--selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="as-picker__main"
                      onClick={() => handlePickAddress(addr)}
                    >
                      <div className="as-picker__radio">
                        <div className="as-picker__radio-dot" />
                      </div>
                      <div className="as-picker__info">
                        <p className="as-picker__name">
                          {addr.recipient_name}
                          {addr.is_default && (
                            <span className="as-picker__default">Default</span>
                          )}
                        </p>
                        <p className="as-picker__addr">
                          {formatSummaryLine(addr)}
                        </p>
                      </div>
                    </button>

                    <CardMenu
                      address={addr}
                      onEdit={handleEdit}
                      onDelete={setDelTarget}
                      onSetDefault={handleSetDefault}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {!atLimit && (
            <AddAddressButton onClick={handleAddNew} />
          )}

          {atLimit && (
            <div className="as-limit-notice">
              <Icon.Alert />
              <span>Maximum {MAX_ADDRESSES} addresses. Delete one to add more.</span>
            </div>
          )}
        </>
      )}

      {/* ══════ FORM VIEW ══════ */}
      {mode === "form" && (
        <div className="as-form" role="form">
          <div className="as-form__header">
            <h3 className="as-form__title">
              {isEditing ? "Edit Address" : "Add New Address"}
            </h3>
            {addresses.length > 0 && (
              <button
                type="button"
                className="as-form__close"
                onClick={handleCancel}
                aria-label="Close form"
              >
                <Icon.X />
              </button>
            )}
          </div>

          {errors.general && (
            <div className="as-form__banner-error">
              <Icon.Alert /> {errors.general}
            </div>
          )}

          {/* Label chips */}
          <div className="as-field">
            <label className="as-label">Address Type</label>
            <div className="as-chips">
              {LABELS.map((l) => {
                const ChipIcon = LABEL_ICON[l] ?? Icon.Pin;
                return (
                  <button
                    key={l}
                    type="button"
                    className={`as-chip ${form.label === l ? "as-chip--active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, label: l }))}
                  >
                    <ChipIcon /> {l}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="as-form-grid">

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
              {errors.phone && (
                <span className="as-field-error">{errors.phone}</span>
              )}
            </div>

            <div className="as-field">
              <label className="as-label">
                State <span className="as-label__required">*</span>
              </label>
              {stateOptions.length === 0 ? (
                <div className="as-zones-error">
                  <span className="as-zones-error__msg">No states loaded</span>
                  <button type="button" onClick={loadZones}
                    className="as-zones-error__retry">
                    Retry
                  </button>
                </div>
              ) : (
                <select
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

            <div className="as-field">
              <label className="as-label">
                City <span className="as-label__required">*</span>
              </label>
              <select
                className={`as-select ${errors.city ? "as-input--error" : ""}`}
                value={form.city}
                onChange={set("city")}
                disabled={!form.state || cityOptions.length === 0}
              >
                <option value="">
                  {!form.state ? "Select state first" : "Select city"}
                </option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.city && (
                <span className="as-field-error">{errors.city}</span>
              )}
            </div>

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

            <div className="as-field as-field--full">
              <label className="as-label">
                Nearest Bus Stop <span className="as-label__required">*</span>
              </label>
              <input
                className={`as-input ${errors.bus_stop ? "as-input--error" : ""}`}
                value={form.bus_stop}
                onChange={set("bus_stop")}
                placeholder="e.g. Oja Oba bus stop"
              />
              {errors.bus_stop ? (
                <span className="as-field-error">{errors.bus_stop}</span>
              ) : (
                <span className="as-field-hint">
                  Our rider will deliver to this bus stop
                </span>
              )}
            </div>

            <div className="as-field as-field--full">
              <label className="as-label">
                Extra Directions{" "}
                <span className="as-label__optional">(optional)</span>
              </label>
              <textarea
                className="as-textarea"
                value={form.additional_directions}
                onChange={set("additional_directions")}
                placeholder="e.g. Call when you arrive"
                rows={2}
                maxLength={300}
              />
            </div>

          </div>

          <label className="as-check">
            <input
              type="checkbox"
              checked={form.call_before_delivery}
              onChange={set("call_before_delivery")}
            />
            <span className="as-check__text">
              Call me before arriving at the bus stop
              <small>Rider will call when they are on the way</small>
            </span>
          </label>

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

          <div className="as-actions">
            {addresses.length > 0 && (
              <button className="as-btn-cancel" onClick={handleCancel}
                type="button">
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

      {/* ══════ CONTINUE CTA ══════ */}
      {selected && mode === "summary" && (
        <button
          className="as-next"
          onClick={onNext}
          type="button"
        >
          Continue
          <Icon.ChevronRight />
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