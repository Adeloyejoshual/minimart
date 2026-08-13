/**
 * src/pages/Checkout/AddressStep.jsx
 *
 * Step 1 of checkout — delivery address selection & management.
 *
 * v2 — WhatsApp notice + all transparent SVG icons
 * ──────────────────────────────────────────────────────────────
 * ✓ WhatsApp notice at top (delivery-scoped, not global)
 * ✓ "Change" button + Terms link inline in notice
 * ✓ All emoji icons replaced with transparent SVGs (currentColor)
 * ✓ All styles in styles/AddressStep.css
 * ✓ Zones fetched WITHOUT auth (endpoint is public)
 * ✓ Cross-device address sync
 * ✓ ErrorToast with inline retry
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
   SVG ICONS  (all transparent — use currentColor)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Truck: ({ size = 32 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),

  BusStop: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6v6M15 6v6M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  ),

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
      <line x1="9"  y1="6"  x2="9"  y2="6" />
      <line x1="15" y1="6"  x2="15" y2="6" />
      <line x1="9"  y1="10" x2="9"  y2="10" />
      <line x1="15" y1="10" x2="15" y2="10" />
      <line x1="9"  y1="14" x2="9"  y2="14" />
      <line x1="15" y1="14" x2="15" y2="14" />
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

  Phone: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),

  Check: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),

  Info: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),

  Trash: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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

  MoreVertical: ({ size = 18 }) => (
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
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),

  ArrowRight: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),

  Plus: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5"  x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  ),

  /* WhatsApp brand — filled currentColor */
  WhatsApp: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
};

/* Map label → icon component */
const LABEL_ICON_COMPONENT = {
  Home   : Icon.Home,
  Office : Icon.Office,
  Other  : Icon.Pin,
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
   ERROR TOAST
═══════════════════════════════════════════════════════════════ */
function ErrorToast({ message, onDismiss, action }) {
  if (!message) return null;
  return (
    <div role="alert" className="as-toast">
      <span className="as-toast__icon"><Icon.Alert /></span>
      <span className="as-toast__msg">{message}</span>
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
          <Icon.X size={14} />
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
        <div className="as-modal__icon"><Icon.Trash size={24} /></div>
        <h3 className="as-modal__title">Delete this address?</h3>

        <div className="as-modal__body">
          <p className="as-modal__addr">{address.address_line}</p>
          {busStop && (
            <p className="as-modal__busstop">
              <Icon.BusStop size={14} /> {busStop}
            </p>
          )}
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
        <Icon.MoreVertical />
      </button>

      {open && (
        <div className="as-menu-dropdown" role="menu">
          <button className="as-menu-item"
            onClick={() => { setOpen(false); onEdit(address); }}
            role="menuitem">
            <Icon.Edit size={15} /> Edit Address
          </button>
          {!address.is_default && (
            <button className="as-menu-item"
              onClick={() => { setOpen(false); onSetDefault(address); }}
              role="menuitem">
              <Icon.Star size={15} /> Set as Default
            </button>
          )}
          <button className="as-menu-item as-menu-item--danger"
            onClick={() => { setOpen(false); onDelete(address); }}
            role="menuitem">
            <Icon.Trash size={15} /> Delete Address
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
  onChangeNumber,          /* WhatsApp notice "Change" handler */
  termsHref = "/terms",    /* Terms & Conditions URL */
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
     LOAD ZONES
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

  useEffect(() => {
    if (!zonesReady) return;
    if (addresses.length === 0 && !formOpened.current) {
      formOpened.current = true;
      setShowForm(true);
      setEditingId(null);
      setForm(makeBlank());
    }
  }, [zonesReady, addresses.length, makeBlank]);

  useEffect(() => {
    if (!selected && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      onSelect(def);
    }
  }, [addresses, selected, onSelect]);

  const stateOptions = useMemo(() => Object.keys(zones).sort(), [zones]);
  const cityOptions  = useMemo(
    () => (form.state ? (zones[form.state]?.cities ?? []) : []),
    [zones, form.state]
  );

  const atLimit   = addresses.length >= MAX_ADDRESSES;
  const isEditing = !!editingId;

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

      {/* ══════ WHATSAPP NOTICE (delivery-scoped) ══════ */}
      <div className="as-wa-notice" role="note">
        <div className="as-wa-notice__icon">
          <Icon.WhatsApp />
        </div>

        <div className="as-wa-notice__body">
          <p className="as-wa-notice__text">
            Please use a <strong>WhatsApp-enabled number</strong> to receive
            faster delivery updates and support.

            {onChangeNumber && (
              <>
                {" "}Tap
                <button
                  type="button"
                  onClick={onChangeNumber}
                  className="as-wa-notice__change-btn"
                  aria-label="Change WhatsApp number"
                >
                  <Icon.Edit size={11} /> Change
                </button>
                to update your number before checkout.
              </>
            )}

            {" "}By proceeding, you are automatically accepting the{" "}
            <a
              href={termsHref}
              className="as-wa-notice__terms-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms &amp; Conditions
            </a>.
          </p>
        </div>
      </div>

      {/* ══════ HERO BANNER ══════ */}
      <div className="as-hero">
        <div className="as-hero__pattern" />
        <div className="as-hero__content">
          <div className="as-hero__icon">
            <Icon.Truck size={40} />
          </div>
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
        <span className="as-info-strip__icon">
          <Icon.BusStop size={20} />
        </span>
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
        const LabelIcon   = LABEL_ICON_COMPONENT[addr.label] ?? Icon.Pin;

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
                  <span className="as-card__label-icon">
                    <LabelIcon />
                  </span>
                  {addr.label}
                </span>
                {addr.is_default && (
                  <span className="as-tag as-tag--default">Default</span>
                )}
                {addr.call_before_delivery && (
                  <span className="as-tag as-tag--call">
                    <Icon.Phone size={10} /> Call first
                  </span>
                )}
              </div>

              <p className="as-card__name">{addr.recipient_name}</p>
              <p className="as-card__phone">{addr.phone}</p>
              <p className="as-card__street">{addr.address_line}</p>

              {busStop && (
                <div className="as-card__busstop">
                  <Icon.BusStop size={14} /> {busStop}
                </div>
              )}

              {addr.additional_directions && (
                <p className="as-card__directions">
                  <Icon.Info size={11} /> {addr.additional_directions}
                </p>
              )}

              <p className="as-card__location">
                {addr.city}, {addr.state}
              </p>

              {isSelected && (
                <span className="as-card__deliver-here">
                  <Icon.Check size={12} /> Deliver Here
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
          <Icon.Plus /> Add New Address
        </button>
      )}

      {/* ══════ LIMIT NOTICE ══════ */}
      {atLimit && !showForm && (
        <p className="as-limit">
          You've saved the maximum of {MAX_ADDRESSES} addresses.
          Use the menu on any address to edit or remove it.
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
                <Icon.X size={16} />
              </button>
            )}
          </div>

          {errors.general && (
            <div className="as-form__banner-error" role="alert">
              <Icon.Alert /> {errors.general}
            </div>
          )}

          {/* Label chips */}
          <div className="as-field">
            <label className="as-label">Address Type</label>
            <div className="as-chips">
              {LABELS.map((l) => {
                const ChipIcon = LABEL_ICON_COMPONENT[l] ?? Icon.Pin;
                return (
                  <button
                    key={l}
                    type="button"
                    className={`as-chip ${
                      form.label === l ? "as-chip--active" : ""
                    }`}
                    onClick={() => setForm((p) => ({ ...p, label: l }))}
                  >
                    <ChipIcon /> {l}
                  </button>
                );
              })}
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
                <Icon.BusStop size={16} />
                Nearest Bus Stop <span className="as-label__required">*</span>
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
              <span className="as-check__text-row">
                <Icon.Phone size={13} />
                Call me before arriving at the bus stop
              </span>
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
          {selected && <Icon.ArrowRight />}
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