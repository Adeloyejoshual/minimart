/**
 * src/pages/PostAds/VariantEditor.jsx
 *
 * Step 3 — Variant Editor
 * - Manual variant cards (collapse / expand)
 * - Matrix generator modal
 * - Completeness score bar per variant
 * - Stock level badges
 * - Duplicate SKU detection
 * - Auto-SKU generator
 * - Bulk SKU regeneration
 * - Live summary strip
 */

import {
  memo, useCallback, useMemo,
  useState, useEffect, useRef,
} from "react";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconTrash = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
);

const IconCopy = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconChevronDown = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconChevronUp = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const IconAlertCircle = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8"  x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCheckCircle = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconZap = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconGrid = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3"  y="3"  width="7" height="7" />
    <rect x="14" y="3"  width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3"  y="14" width="7" height="7" />
  </svg>
);

const IconEdit = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconRefresh = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconX = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    aria-hidden="true">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const IconPackage = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconWarehouse = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z" />
    <path d="M6 18h12M6 14h12M6 10h12" />
  </svg>
);

const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAX_VARIANTS   = 20;
const MAX_PER_ATTR   = 5;
const STOCK_CRITICAL = 2;
const STOCK_LOW      = 5;
const STOCK_REORDER  = 10;

const ATTRS = ["color", "size", "storage", "material"];

const ATTR_CONFIG = {
  color   : { label: "Color",    placeholder: "e.g. Midnight Black" },
  size    : { label: "Size",     placeholder: "e.g. XL or 42"       },
  storage : { label: "Storage",  placeholder: "e.g. 256 GB"          },
  material: { label: "Material", placeholder: "e.g. Cotton"          },
};

const SUGGESTIONS = {
  phone  : { color: ["Black", "White", "Blue", "Gold"],       storage: ["64GB", "128GB", "256GB", "512GB"]     },
  laptop : { color: ["Silver", "Space Grey", "Black"],        storage: ["256GB SSD", "512GB SSD", "1TB SSD"]  },
  fashion: { color: ["Black", "White", "Red", "Navy"],        size:    ["XS", "S", "M", "L", "XL", "XXL"]    },
  shoe   : { color: ["Black", "White", "Brown"],              size:    ["38", "39", "40", "41", "42", "43"]   },
  default: { color: ["Black", "White"],                       size:    ["S", "M", "L"]                        },
};

/* ══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */
function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const getStock = (v) => Number(v.stock) || 0;

function variantScore(v) {
  let s = 0;
  if (v.name.trim().length  >= 2) s += 20;
  if (v.sku.trim().length   >= 2) s += 25;
  if (Number(v.price)       >  0) s += 25;
  if (getStock(v)           >  0) s += 15;
  const filled = ATTRS.filter((a) => (v.attributes[a] || "").trim()).length;
  s += Math.round((filled / ATTRS.length) * 15);
  return Math.min(s, 100);
}

function getScoreColor(score) {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function buildDuplicateSkuSet(variants) {
  const countMap = new Map();
  variants.forEach((v) => {
    const key = v.sku?.trim().toUpperCase();
    if (!key) return;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });
  const dupSet = new Set();
  variants.forEach((v) => {
    const key = v.sku?.trim().toUpperCase();
    if (key && (countMap.get(key) || 0) > 1) dupSet.add(key);
  });
  return dupSet;
}

function generateSku(base, attrs, index) {
  const clean = (val = "") =>
    val.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5);
  const parts = [
    clean(base),
    clean(attrs.color),
    clean(attrs.size),
    clean(attrs.storage),
  ].filter(Boolean);
  return `${parts.join("-")}-${String(index + 1).padStart(3, "0")}`;
}

function generateVariantMatrix(options) {
  const cleanArr = (arr) => (arr || []).map((v) => v?.trim()).filter(Boolean);
  const keys = Object.keys(options).filter((k) => cleanArr(options[k]).length > 0);
  if (!keys.length) return [];

  return keys.reduce((acc, key) => {
    const values = cleanArr(options[key]);
    if (!acc.length) return values.map((v) => ({ [key]: v }));
    const result = [];
    for (const item of acc) {
      for (const v of values) result.push({ ...item, [key]: v });
    }
    return result;
  }, []);
}

function suggestOptions(title = "", categoryName = "") {
  const t = `${title} ${categoryName}`.toLowerCase();
  if (/(iphone|samsung|xiaomi|tecno|pixel)/i.test(t))  return SUGGESTIONS.phone;
  if (/(laptop|macbook|notebook|hp|dell)/i.test(t))    return SUGGESTIONS.laptop;
  if (/(shoe|sneaker|boot|sandal)/i.test(t))           return SUGGESTIONS.shoe;
  if (/(shirt|dress|trouser|cloth|fashion)/i.test(t))  return SUGGESTIONS.fashion;
  return SUGGESTIONS.default;
}

/* ══════════════════════════════════════════════════════════════
   STOCK BADGE
══════════════════════════════════════════════════════════════ */
const StockBadge = memo(function StockBadge({ stock }) {
  const n = getStock({ stock });

  const cfg =
    n === 0             ? { mod: "ve-stock--zero",     label: "Out of stock",         dot: "#ef4444" } :
    n <= STOCK_CRITICAL ? { mod: "ve-stock--critical", label: `Critical — ${n}`,      dot: "#dc2626" } :
    n <= STOCK_LOW      ? { mod: "ve-stock--low",      label: `Low — ${n} left`,      dot: "#f59e0b" } :
    n <= STOCK_REORDER  ? { mod: "ve-stock--reorder",  label: `${n} — reorder soon`,  dot: "#f97316" } :
                          { mod: "ve-stock--ok",        label: `${n} in stock`,        dot: "#10b981" };

  return (
    <span className={`ve-stock ${cfg.mod}`} aria-live="polite">
      <span
        className="ve-stock-dot"
        style={{ background: cfg.dot }}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   FIELD ERROR
══════════════════════════════════════════════════════════════ */
const FieldError = memo(function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <span className="ve-field-error" role="alert" aria-live="polite">
      <IconAlertCircle size={11} />
      {msg}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRICE INPUT — raw / formatted split + stable cursor
══════════════════════════════════════════════════════════════ */
const PriceInput = memo(function PriceInput({
  id, value, onChange, onBlur, error,
}) {
  const [editing, setEditing] = useState(false);
  const [rawBuf,  setRawBuf]  = useState(value || "");

  useEffect(() => {
    if (!editing) setRawBuf(value || "");
  }, [value, editing]);

  const displayValue = editing
    ? rawBuf
    : (value ? Number(value).toLocaleString("en-NG") : "");

  return (
    <div className="ve-price-wrap">
      <span className="ve-price-symbol" aria-hidden="true">₦</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={displayValue}
        aria-required="true"
        aria-invalid={!!error}
        aria-label="Price in Naira"
        className={`ve-price-input${error ? " ve-input--error" : ""}`}
        onFocus={() => { setEditing(true); setRawBuf(value || ""); }}
        onBlur={() => {
          const raw = rawBuf.replace(/\D/g, "");
          onChange(raw);
          setEditing(false);
          onBlur?.();
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          setRawBuf(raw);
          onChange(raw);
        }}
      />
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MATRIX MODAL
══════════════════════════════════════════════════════════════ */
const MatrixModal = memo(function MatrixModal({
  onGenerate, onClose, title = "", categoryName = "",
}) {
  const suggested = useMemo(() => suggestOptions(title, categoryName), [title, categoryName]);
  const firstRef  = useRef();

  const [options, setOptions] = useState({
    color  : suggested.color   || [],
    size   : suggested.size    || [],
    storage: suggested.storage || [],
  });

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = useMemo(() => generateVariantMatrix(options).length, [options]);

  const updateOpt   = useCallback((attr, idx, val) =>
    setOptions((p) => { const n = [...(p[attr] || [])]; n[idx] = val; return { ...p, [attr]: n }; }), []);

  const addOpt      = useCallback((attr) =>
    setOptions((p) => (
      (p[attr] || []).length >= MAX_PER_ATTR ? p : { ...p, [attr]: [...(p[attr] || []), ""] }
    )), []);

  const removeOpt   = useCallback((attr, idx) =>
    setOptions((p) => ({ ...p, [attr]: (p[attr] || []).filter((_, i) => i !== idx) })), []);

  const toggleSugg  = useCallback((attr, val) =>
    setOptions((p) => {
      const cur = p[attr] || [];
      return {
        ...p,
        [attr]: cur.includes(val)
          ? cur.filter((x) => x !== val)
          : cur.length < MAX_PER_ATTR ? [...cur, val] : cur,
      };
    }), []);

  const applyAllSugg = useCallback((attr) =>
    setOptions((p) => ({ ...p, [attr]: suggested[attr] || [] })), [suggested]);

  const handleGenerate = useCallback(() => {
    const combos = generateVariantMatrix(options);
    if (!combos.length)              { alert("Add at least one valid option"); return; }
    if (combos.length > MAX_VARIANTS){ alert(`Too many (${combos.length}). Max ${MAX_VARIANTS}.`); return; }

    onGenerate(combos.map((attrs, i) => ({
      id        : newId(),
      name      : Object.values(attrs).filter(Boolean).join(" / "),
      sku       : generateSku(title, attrs, i),
      price     : "",
      stock     : "1",
      attributes: {
        color   : attrs.color    || "",
        size    : attrs.size     || "",
        storage : attrs.storage  || "",
        material: "",
      },
    })));
  }, [options, title, onGenerate]);

  const renderAttr = (attr) => {
    const { label, placeholder } = ATTR_CONFIG[attr];
    const vals   = options[attr] || [];
    const hasSug = (suggested[attr] || []).length > 0;
    const atCap  = vals.length >= MAX_PER_ATTR;

    return (
      <div key={attr} className="ve-modal-attr">
        <div className="ve-modal-attr-head">
          <label className="pa-label">{label}</label>
          <div className="ve-modal-attr-actions">
            {count > MAX_VARIANTS && vals.length > 0 && (
              <span className="ve-modal-toomany">Too many</span>
            )}
            {hasSug && (
              <button
                type="button"
                className="ve-modal-allbtn"
                onClick={() => applyAllSugg(attr)}
                aria-label={`Use all suggested ${label.toLowerCase()} values`}
              >
                <IconZap size={11} /> All
              </button>
            )}
          </div>
        </div>

        {/* Suggestion chips */}
        {hasSug && (
          <div
            className="ve-modal-chips"
            role="group"
            aria-label={`Suggested ${label.toLowerCase()} options`}
          >
            {(suggested[attr] || []).map((s) => {
              const active = vals.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  className={`ve-chip${active ? " ve-chip--active" : ""}`}
                  onClick={() => toggleSugg(attr, s)}
                  aria-pressed={active}
                  aria-label={`${active ? "Remove" : "Add"} ${s}`}
                >
                  {active ? <IconCheck size={10} /> : <IconPlus size={10} />}
                  {s}
                </button>
              );
            })}
          </div>
        )}

        {/* Custom inputs */}
        {vals.map((val, i) => (
          <div key={i} className="pa-list-row">
            <input
              className="pa-mini-input"
              value={val}
              placeholder={placeholder}
              aria-label={`Custom ${label} option ${i + 1}`}
              onChange={(e) => updateOpt(attr, i, e.target.value)}
            />
            <button
              type="button"
              className="pa-mini-btn pa-mini-btn--remove"
              onClick={() => removeOpt(attr, i)}
              aria-label={`Remove ${label} option ${i + 1}`}
            >
              <IconX size={12} />
            </button>
          </div>
        ))}

        {!atCap ? (
          <button
            type="button"
            className="pa-add-btn"
            onClick={() => addOpt(attr)}
          >
            <IconPlus size={13} /> Add {label}
          </button>
        ) : (
          <p className="ve-modal-cap-note">
            Max {MAX_PER_ATTR} {label.toLowerCase()} options
          </p>
        )}
      </div>
    );
  };

  const tooMany = count > MAX_VARIANTS;
  const isEmpty = count === 0;

  return (
    <div
      className="ve-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Variant Matrix Generator"
      onClick={onClose}
    >
      <div className="ve-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ve-modal-header">
          <div className="ve-modal-header-inner">
            <div>
              <h3
                ref={firstRef}
                tabIndex={-1}
                className="ve-modal-title"
              >
                <IconGrid size={18} />
                Variant Matrix Generator
              </h3>
              <p className="ve-modal-subtitle">
                Select options then generate all SKU combinations at once.
              </p>
            </div>
            <button
              type="button"
              className="ve-modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="ve-modal-body">
          {ATTRS.filter((a) => a !== "material").map(renderAttr)}

          {/* Live count pill */}
          <div className={`ve-count-pill${tooMany ? " ve-count-pill--error" : isEmpty ? "" : " ve-count-pill--ok"}`}
            aria-live="polite">
            <IconGrid size={14} />
            <span>
              {isEmpty
                ? "Add values above to preview combination count"
                : tooMany
                  ? `${count} combinations exceeds maximum of ${MAX_VARIANTS}. Reduce options.`
                  : `${count} variant${count !== 1 ? "s" : ""} will be generated`}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="ve-modal-footer">
          <button type="button" className="pa-btn-back" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pa-btn-next"
            onClick={handleGenerate}
            disabled={isEmpty || tooMany}
            aria-disabled={isEmpty || tooMany}
            style={{ flex: 1 }}
          >
            <IconZap size={15} />
            Generate {count > 0 ? count : ""} Variant{count !== 1 ? "s" : ""}
          </button>
        </div>

      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   VARIANT CARD
══════════════════════════════════════════════════════════════ */
const VariantCard = memo(function VariantCard({
  v, index, total, isDuplicate,
  onUpdate, onUpdateAttr, onRemove, onDuplicate, onAutoSku,
  errors, onBlur,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const score    = useMemo(() => variantScore(v), [
    v.name, v.sku, v.price, v.stock,
    v.attributes.color, v.attributes.size,
    v.attributes.storage, v.attributes.material,
  ]);
  const scoreCol = getScoreColor(score);

  const handleUpdate  = useCallback((f, val) => onUpdate(index, f, val),     [index, onUpdate]);
  const handleAttr    = useCallback((a, val) => onUpdateAttr(index, a, val), [index, onUpdateAttr]);
  const handleRemove  = useCallback(() => onRemove(index),                    [index, onRemove]);
  const handleDupe    = useCallback(() => onDuplicate(index),                 [index, onDuplicate]);
  const handleAutoSku = useCallback(() => onAutoSku(index),                   [index, onAutoSku]);
  const handleToggle  = useCallback(() => setCollapsed((x) => !x),            []);

  const cardMod = [
    isDuplicate ? "ve-card--duplicate" : "",
    score >= 80 ? "ve-card--complete"  : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={`ve-card ${cardMod}`}>

      {/* Score bar */}
      <div className="ve-score-bar" aria-hidden="true">
        <div
          className="ve-score-fill"
          style={{ width: `${score}%`, background: scoreCol }}
        />
      </div>

      {/* Header row */}
      <div className="ve-card-header">
        <div className="ve-card-header-left">
          <button
            type="button"
            className="ve-toggle-btn"
            onClick={handleToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} variant ${index + 1}`}
          >
            {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
          </button>

          <div className="ve-card-title-group">
            <span className="ve-card-index">Variant {index + 1}</span>
            {v.name.trim() && (
              <span className="ve-card-name">{v.name}</span>
            )}
            {isDuplicate && (
              <span className="ve-duplicate-tag" aria-live="polite">
                <IconAlertCircle size={10} />
                Duplicate SKU
              </span>
            )}
          </div>
        </div>

        <div className="ve-card-actions">
          <span
            className="ve-score-pill"
            style={{
              background: `${scoreCol}18`,
              color      : scoreCol,
            }}
          >
            {score}%
          </span>

          <button type="button" className="ve-action-btn ve-action-btn--amber"
            onClick={handleAutoSku}
            aria-label={`Auto-generate SKU for variant ${index + 1}`}
            title="Auto-generate SKU">
            <IconZap size={12} />
          </button>

          <button type="button" className="ve-action-btn ve-action-btn--indigo"
            onClick={handleDupe}
            aria-label={`Duplicate variant ${index + 1}`}
            title="Duplicate">
            <IconCopy size={12} />
          </button>

          <button type="button" className="ve-action-btn ve-action-btn--red"
            onClick={handleRemove}
            disabled={total <= 1}
            aria-label={`Delete variant ${index + 1}`}
            aria-disabled={total <= 1}>
            <IconTrash size={12} />
          </button>
        </div>
      </div>

      {/* Collapsed preview */}
      {collapsed && (
        <div className="ve-collapsed-preview">
          {v.sku && (
            <span className="ve-preview-sku">{v.sku}</span>
          )}
          {v.price && (
            <span className="ve-preview-price">
              ₦{Number(v.price).toLocaleString("en-NG")}
            </span>
          )}
          <StockBadge stock={v.stock} />
          {ATTRS.filter((a) => (v.attributes[a] || "").trim()).map((a) => (
            <span key={a} className="ve-attr-pill">{v.attributes[a]}</span>
          ))}
        </div>
      )}

      {/* Expanded body */}
      {!collapsed && (
        <div className="ve-card-body">

          {/* Core fields grid */}
          <div className="ve-fields-grid">

            {/* Name */}
            <div className="ve-field ve-field--full">
              <label className="ve-label" htmlFor={`v-name-${index}`}>
                Variant Name
                <span className="ve-label-required" aria-hidden="true"> *</span>
                {v.name.trim().length >= 2 && (
                  <span className="ve-label-check">
                    <IconCheckCircle size={11} />
                  </span>
                )}
              </label>
              <input
                id={`v-name-${index}`}
                className={`ve-input${errors.name ? " ve-input--error" : ""}`}
                placeholder='e.g. "Black 128 GB"'
                value={v.name}
                aria-required="true"
                aria-invalid={!!errors.name}
                onChange={(e) => handleUpdate("name", e.target.value)}
                onBlur={() => onBlur?.(`v_name_${index}`)}
              />
              <FieldError msg={errors.name} />
            </div>

            {/* SKU */}
            <div className="ve-field">
              <label className="ve-label" htmlFor={`v-sku-${index}`}>
                SKU
                <span className="ve-label-required" aria-hidden="true"> *</span>
                {v.sku.trim() && !isDuplicate && (
                  <span className="ve-label-check">
                    <IconCheckCircle size={11} />
                  </span>
                )}
                {isDuplicate && (
                  <span className="ve-label-error-icon">
                    <IconAlertCircle size={11} />
                  </span>
                )}
              </label>
              <input
                id={`v-sku-${index}`}
                className={`ve-input ve-input--mono${errors.sku || isDuplicate ? " ve-input--error" : ""}`}
                placeholder="IP13-BLK-128"
                value={v.sku}
                aria-required="true"
                aria-invalid={!!errors.sku || isDuplicate}
                onChange={(e) => handleUpdate("sku", e.target.value.toUpperCase())}
                onBlur={() => onBlur?.(`v_sku_${index}`)}
              />
              {isDuplicate
                ? <FieldError msg="Duplicate SKU — must be unique" />
                : <FieldError msg={errors.sku} />
              }
            </div>

            {/* Price */}
            <div className="ve-field">
              <label className="ve-label" htmlFor={`v-price-${index}`}>
                Price (NGN)
                <span className="ve-label-required" aria-hidden="true"> *</span>
                {Number(v.price) > 0 && (
                  <span className="ve-label-check">
                    <IconCheckCircle size={11} />
                  </span>
                )}
              </label>
              <PriceInput
                id={`v-price-${index}`}
                value={v.price}
                error={errors.price}
                onChange={(raw) => handleUpdate("price", raw)}
                onBlur={() => onBlur?.(`v_price_${index}`)}
              />
              <FieldError msg={errors.price} />
            </div>

            {/* Stock */}
            <div className="ve-field">
              <label className="ve-label" htmlFor={`v-stock-${index}`}>
                Stock Quantity
              </label>
              <input
                id={`v-stock-${index}`}
                type="number"
                min="0"
                placeholder="1"
                value={v.stock}
                className="ve-input"
                aria-label={`Stock quantity for variant ${index + 1}`}
                onChange={(e) => handleUpdate("stock", e.target.value)}
              />
              <StockBadge stock={v.stock} />
            </div>
          </div>

          {/* Attributes */}
          <div className="ve-attrs">
            <p className="ve-attrs-label">Attributes — fill what applies</p>
            <div className="ve-attrs-grid">
              {ATTRS.map((attr) => {
                const cfg = ATTR_CONFIG[attr];
                const val = v.attributes[attr] || "";
                return (
                  <div className="ve-field" key={attr}>
                    <label className="ve-label" htmlFor={`v-${attr}-${index}`}>
                      {cfg.label}
                    </label>
                    <input
                      id={`v-${attr}-${index}`}
                      className={`ve-input${val.trim() ? " ve-input--filled" : ""}`}
                      placeholder={cfg.placeholder}
                      value={val}
                      onChange={(e) => handleAttr(attr, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live summary */}
          {(v.name || v.sku || v.price) && (
            <div className="ve-summary" aria-label="Variant summary">
              {v.name.trim() && (
                <span className="ve-summary-item">
                  <IconPackage size={11} />
                  {v.name}
                </span>
              )}
              {v.sku.trim() && (
                <span className="ve-summary-item ve-summary-item--sku">
                  {v.sku}
                </span>
              )}
              {Number(v.price) > 0 && (
                <span className="ve-summary-item ve-summary-item--price">
                  ₦{Number(v.price).toLocaleString("en-NG")}
                </span>
              )}
              {ATTRS.filter((a) => (v.attributes[a] || "").trim()).map((a) => (
                <span key={a} className="ve-attr-pill">
                  {v.attributes[a]}
                </span>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
},
(prev, next) =>
  prev.v.id                  === next.v.id                  &&
  prev.v.name                === next.v.name                &&
  prev.v.sku                 === next.v.sku                 &&
  prev.v.price               === next.v.price               &&
  prev.v.stock               === next.v.stock               &&
  prev.v.attributes.color    === next.v.attributes.color    &&
  prev.v.attributes.size     === next.v.attributes.size     &&
  prev.v.attributes.storage  === next.v.attributes.storage  &&
  prev.v.attributes.material === next.v.attributes.material &&
  prev.isDuplicate           === next.isDuplicate           &&
  prev.errors.name           === next.errors.name           &&
  prev.errors.sku            === next.errors.sku            &&
  prev.errors.price          === next.errors.price          &&
  prev.index                 === next.index                 &&
  prev.total                 === next.total
);

/* ══════════════════════════════════════════════════════════════
   VARIANT EDITOR — MAIN
══════════════════════════════════════════════════════════════ */
export default function VariantEditor({
  variants,
  onUpdate,
  onUpdateAttr,
  onAdd,
  onRemove,
  onDuplicate,
  onBulkReplace,
  errors       = {},
  onBlur,
  title        = "",
  categoryName = "",
  maxVariants  = MAX_VARIANTS,
}) {
  const [showMatrix, setShowMatrix] = useState(false);

  const duplicateSkuSet = useMemo(
    () => buildDuplicateSkuSet(variants),
    [variants]
  );

  const scores = useMemo(
    () => variants.map((v) => variantScore(v)),
    [variants]
  );

  const totalStock    = useMemo(() => variants.reduce((s, v) => s + getStock(v), 0), [variants]);
  const criticalCount = useMemo(() => variants.filter((v) => v.name && getStock(v) > 0 && getStock(v) <= STOCK_CRITICAL).length, [variants]);
  const lowStockCount = useMemo(() => variants.filter((v) => v.name && getStock(v) > 0 && getStock(v) < STOCK_LOW).length, [variants]);
  const outOfStock    = useMemo(() => variants.filter((v) => v.name && getStock(v) === 0).length, [variants]);
  const completeCount = useMemo(() => scores.filter((s) => s >= 80).length, [scores]);
  const dupCount      = useMemo(() => duplicateSkuSet.size, [duplicateSkuSet]);

  const getErrors = useCallback((i) => ({
    name : errors[`v_name_${i}`]  || "",
    sku  : errors[`v_sku_${i}`]   || "",
    price: errors[`v_price_${i}`] || "",
  }), [errors]);

  const handleAutoSku = useCallback((i) => {
    const sku = generateSku(title, variants[i].attributes, i);
    onUpdate(i, "sku", sku);
  }, [variants, title, onUpdate]);

  const handleBulkAutoSku = useCallback(() => {
    variants.forEach((v, i) => {
      onUpdate(i, "sku", generateSku(title, v.attributes, i));
    });
  }, [variants, title, onUpdate]);

  const checkDuplicate = useCallback((v) =>
    duplicateSkuSet.has(v.sku?.trim().toUpperCase()), [duplicateSkuSet]);

  const atMax = variants.length >= maxVariants;

  return (
    <section className="ve-wrap" aria-label="Product variants">

      {/* ── Toolbar ── */}
      <div className="ve-toolbar">
        <button
          type="button"
          className="ve-toolbar-btn"
          aria-label="Manual variant mode"
        >
          <IconEdit size={14} />
          <span>Manual</span>
        </button>

        <button
          type="button"
          className="ve-toolbar-btn ve-toolbar-btn--indigo"
          onClick={() => setShowMatrix(true)}
          aria-label="Open variant matrix generator"
        >
          <IconGrid size={14} />
          <span>Matrix Generator</span>
        </button>

        {variants.length > 1 && (
          <button
            type="button"
            className="ve-toolbar-btn ve-toolbar-btn--amber"
            onClick={handleBulkAutoSku}
            aria-label="Regenerate all SKUs"
          >
            <IconRefresh size={13} />
            <span>Regenerate SKUs</span>
          </button>
        )}
      </div>

      {/* ── Summary strip ── */}
      {variants.length > 1 && (
        <div className="ve-strip" aria-label="Variant summary">
          <div className="ve-strip-card">
            <IconPackage size={16} />
            <span className="ve-strip-value">{variants.length}</span>
            <span className="ve-strip-label">Variants</span>
          </div>
          <div className="ve-strip-card">
            <IconWarehouse size={14} />
            <span className="ve-strip-value">{totalStock.toLocaleString()}</span>
            <span className="ve-strip-label">Total Stock</span>
          </div>
          <div className="ve-strip-card">
            <IconCheck size={14} />
            <span className="ve-strip-value">{completeCount}/{variants.length}</span>
            <span className="ve-strip-label">Complete</span>
          </div>
        </div>
      )}

      {/* ── Alerts ── */}
      {dupCount > 0 && (
        <div className="ve-alert ve-alert--red" role="alert">
          <IconAlertCircle size={14} />
          <span>
            {dupCount} duplicate SKU{dupCount > 1 ? "s" : ""} — each SKU must be unique.
          </span>
        </div>
      )}
      {criticalCount > 0 && (
        <div className="ve-alert ve-alert--red" role="alert">
          <IconAlertCircle size={14} />
          <span>
            {criticalCount} variant{criticalCount > 1 ? "s are" : " is"} critically
            low (at or below {STOCK_CRITICAL} units).
          </span>
        </div>
      )}
      {lowStockCount > 0 && (
        <div className="ve-alert ve-alert--amber" role="alert">
          <IconAlertCircle size={14} />
          <span>
            {lowStockCount} variant{lowStockCount > 1 ? "s are" : " is"} running
            low (below {STOCK_LOW} units).
          </span>
        </div>
      )}
      {outOfStock > 0 && (
        <div className="ve-alert ve-alert--amber" role="alert">
          <IconAlertCircle size={14} />
          <span>
            {outOfStock} variant{outOfStock > 1 ? "s are" : " is"} out of stock.
          </span>
        </div>
      )}

      {/* ── Variant cards ── */}
      <div role="list" aria-label="Variant list">
        {variants.map((v, i) => (
          <div key={v.id} role="listitem">
            <VariantCard
              v={v}
              index={i}
              total={variants.length}
              isDuplicate={checkDuplicate(v)}
              onUpdate={onUpdate}
              onUpdateAttr={onUpdateAttr}
              onRemove={onRemove}
              onDuplicate={onDuplicate ?? (() => {})}
              onAutoSku={handleAutoSku}
              errors={getErrors(i)}
              onBlur={onBlur}
            />
          </div>
        ))}
      </div>

      {/* ── Add / max ── */}
      {atMax ? (
        <div className="ve-max-note" role="status">
          Maximum {maxVariants} variants reached.
        </div>
      ) : (
        <button
          type="button"
          className="ve-add-btn"
          onClick={onAdd}
          aria-label="Add another variant"
        >
          <IconPlus size={16} />
          <span>Add Variant</span>
          <span className="ve-add-count">
            {variants.length}/{maxVariants}
          </span>
        </button>
      )}

      {/* ── Matrix modal ── */}
      {showMatrix && (
        <MatrixModal
          title={title}
          categoryName={categoryName}
          onGenerate={(newVariants) => {
            onBulkReplace?.(newVariants);
            setShowMatrix(false);
          }}
          onClose={() => setShowMatrix(false)}
        />
      )}

    </section>
  );
}