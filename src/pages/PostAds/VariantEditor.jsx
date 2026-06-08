import React, {
  memo, useCallback, useMemo, useState, useEffect, useRef,
} from "react";
import {
  FiTrash2, FiPlus, FiCopy, FiChevronDown, FiChevronUp,
  FiAlertCircle, FiCheckCircle, FiZap, FiGrid, FiEdit3,
  FiRefreshCw, FiX,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const MAX_VARIANTS   = 20;
const MAX_PER_ATTR   = 5;
const STOCK_CRITICAL = 2;
const STOCK_LOW      = 5;
const STOCK_REORDER  = 10;

const ATTRS = ["color", "size", "storage", "material"];

const ATTR_CONFIG = {
  color:    { label:"Color",    placeholder:"e.g. Midnight Black", emoji:"🎨" },
  size:     { label:"Size",     placeholder:"e.g. XL or 42",       emoji:"📏" },
  storage:  { label:"Storage",  placeholder:"e.g. 256GB",           emoji:"💾" },
  material: { label:"Material", placeholder:"e.g. Cotton",          emoji:"🧵" },
};

const SUGGESTIONS = {
  phone:   { color:["Black","White","Blue","Gold"],        storage:["64GB","128GB","256GB","512GB"]      },
  laptop:  { color:["Silver","Space Grey","Black"],        storage:["256GB SSD","512GB SSD","1TB SSD"]   },
  fashion: { color:["Black","White","Red","Navy"],         size:["XS","S","M","L","XL","XXL"]            },
  shoe:    { color:["Black","White","Brown"],              size:["38","39","40","41","42","43","44"]      },
  default: { color:["Black","White"],                     size:["S","M","L"]                             },
};

/* ═══════════════════════════════════════════════
   GLASS / TRANSPARENT STATIC STYLES
═══════════════════════════════════════════════ */
const G = {
  /* Glass card */
  card: {
    borderRadius:   "18px",
    padding:        "16px",
    marginBottom:   "12px",
    background:     "rgba(255,255,255,0.35)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border:         "1.5px solid rgba(255,255,255,0.5)",
    transition:     "border-color 0.2s, box-shadow 0.2s",
  },
  /* Glass inner section */
  inner: {
    padding:        "12px",
    borderRadius:   "12px",
    background:     "rgba(255,255,255,0.25)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border:         "1px solid rgba(255,255,255,0.35)",
    marginTop:      "12px",
  },
  /* Glass input */
  input: {
    background:     "rgba(255,255,255,0.5)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    border:         "1.5px solid rgba(255,255,255,0.6)",
    color:          "#1a1a1a",
  },
  /* Alert box factory */
  alert: (r, g, b) => ({
    display:        "flex",
    alignItems:     "center",
    gap:            "8px",
    padding:        "10px 14px",
    borderRadius:   "12px",
    background:     `rgba(${r},${g},${b},0.08)`,
    border:         `1px solid rgba(${r},${g},${b},0.2)`,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    marginBottom:   "8px",
    fontSize:       "12px",
    fontWeight:     700,
    color:          `rgb(${Math.round(r*0.6)},${Math.round(g*0.4)},${Math.round(b*0.4)})`,
  }),
  /* Action button factory */
  actionBtn: (color, disabled = false) => ({
    width:          "30px",
    height:         "30px",
    borderRadius:   "9px",
    border:         `1.5px solid ${color}40`,
    background:     "rgba(255,255,255,0.3)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    color:          disabled ? `${color}55` : color,
    cursor:         disabled ? "not-allowed" : "pointer",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    transition:     "all 0.15s",
    flexShrink:     0,
    opacity:        disabled ? 0.4 : 1,
  }),
  /* Mode button */
  modeBtn: (active) => ({
    display:        "flex",
    alignItems:     "center",
    gap:            "6px",
    padding:        "8px 14px",
    borderRadius:   "10px",
    border:         `1.5px solid ${active ? "#6366f1" : "rgba(255,255,255,0.4)"}`,
    background:     active
      ? "rgba(99,102,241,0.15)"
      : "rgba(255,255,255,0.25)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    color:          active ? "#6366f1" : "#6b7280",
    cursor:         "pointer",
    fontSize:       "13px",
    fontWeight:     700,
    transition:     "all 0.15s",
  }),
  /* Summary card */
  stripCard: (color) => ({
    padding:        "10px 12px",
    borderRadius:   "12px",
    background:     "rgba(255,255,255,0.3)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border:         `1px solid ${color}22`,
    textAlign:      "center",
  }),
  /* Summary pill */
  summaryPill: {
    marginTop:      "10px",
    padding:        "8px 12px",
    borderRadius:   "10px",
    background:     "rgba(255,87,34,0.06)",
    border:         "1px solid rgba(255,87,34,0.15)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display:        "flex",
    gap:            "8px",
    flexWrap:       "wrap",
    fontSize:       "11px",
    fontWeight:     700,
    color:          "#555",
  },
  /* Attr pill */
  attrPill: {
    background:     "rgba(99,102,241,0.12)",
    color:          "#6366f1",
    padding:        "1px 6px",
    borderRadius:   "5px",
  },
  /* Modal overlay */
  overlay: {
    position:       "fixed",
    inset:          0,
    zIndex:         200,
    background:     "rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "16px",
  },
  /* Modal panel */
  modal: {
    background:     "rgba(255,255,255,0.75)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderRadius:   "20px",
    width:          "100%",
    maxWidth:       "520px",
    maxHeight:      "90vh",
    overflowY:      "auto",
    boxShadow:      "0 24px 64px rgba(0,0,0,0.15)",
    border:         "1.5px solid rgba(255,255,255,0.6)",
  },
  /* Modal header/footer */
  modalBar: {
    padding:        "18px 20px",
    background:     "rgba(255,255,255,0.55)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
};

/* ═══════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════ */
const getStock = (v) => Number(v.stock) || 0;

/* ── Stable UUID generator ── */
function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ── Variant completeness score ── */
function variantScore(v) {
  let s = 0;
  if (v.name.trim().length >= 2)  s += 20;
  if (v.sku.trim().length  >= 2)  s += 25;
  if (Number(v.price) > 0)        s += 25;
  if (getStock(v) > 0)            s += 15;
  const filled = ATTRS.filter((a) => (v.attributes[a] || "").trim()).length;
  s += Math.round((filled / ATTRS.length) * 15);
  return Math.min(s, 100);
}

function getScoreColor(score) {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

/* ── Bug fix #1: track by SKU value, not index ── */
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

/* ── Deterministic SKU engine ── */
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

/* ── Bug fix #5: trim + filter blanks ── */
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

/* ── Suggest options by title/category ── */
function suggestOptions(title = "", categoryName = "") {
  const t = `${title} ${categoryName}`.toLowerCase();
  if (/(iphone|samsung|xiaomi|tecno|pixel)/i.test(t)) return SUGGESTIONS.phone;
  if (/(laptop|macbook|notebook|hp|dell)/i.test(t))   return SUGGESTIONS.laptop;
  if (/(shoe|sneaker|boot|sandal)/i.test(t))          return SUGGESTIONS.shoe;
  if (/(shirt|dress|trouser|cloth|fashion)/i.test(t)) return SUGGESTIONS.fashion;
  return SUGGESTIONS.default;
}

/* ═══════════════════════════════════════════════
   STOCK BADGE
═══════════════════════════════════════════════ */
const StockBadge = memo(({ stock }) => {
  const n = getStock({ stock });
  const cfg =
    n === 0            ? { cls:"pa-stock-badge--zero", text:"Out of stock",          dot:"#ef4444" } :
    n <= STOCK_CRITICAL? { cls:"pa-stock-badge--zero", text:`⚠ Critical — ${n}`,     dot:"#dc2626" } :
    n <= STOCK_LOW     ? { cls:"pa-stock-badge--low",  text:`Low — ${n} left`,       dot:"#f59e0b" } :
    n <= STOCK_REORDER ? { cls:"pa-stock-badge--low",  text:`${n} — reorder soon`,   dot:"#f97316" } :
                         { cls:"pa-stock-badge--ok",   text:`${n} in stock`,          dot:"#10b981" };
  return (
    <span className={`pa-stock-badge ${cfg.cls}`} aria-live="polite">
      <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot, display:"inline-block", marginRight:4, flexShrink:0 }} aria-hidden="true" />
      {cfg.text}
    </span>
  );
});

/* ═══════════════════════════════════════════════
   FIELD ERROR
═══════════════════════════════════════════════ */
const FieldError = memo(({ msg }) =>
  msg ? (
    <span style={{ display:"flex", alignItems:"center", gap:4, color:"#ef4444", fontSize:"11px", fontWeight:700, marginTop:4 }}
      role="alert" aria-live="polite">
      <FiAlertCircle size={11} aria-hidden="true" /> {msg}
    </span>
  ) : null
);

/* ═══════════════════════════════════════════════
   PRICE INPUT — raw/formatted split + stable cursor
═══════════════════════════════════════════════ */
const PriceInput = memo(({ id, value, onChange, onBlur, error }) => {
  const [editing, setEditing] = useState(false);
  const [rawBuf,  setRawBuf]  = useState(value || "");

  /* Bug fix #7: sync buffer when value changes externally */
  useEffect(() => {
    if (!editing) setRawBuf(value || "");
  }, [value, editing]);

  const displayValue = editing
    ? rawBuf
    : (value ? Number(value).toLocaleString("en-NG") : "");

  return (
    <div style={{ position:"relative" }}>
      <span style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", fontWeight:800, fontSize:"13px", color:"#ff5722", pointerEvents:"none", zIndex:1 }}>
        ₦
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={displayValue}
        aria-required="true"
        aria-invalid={!!error}
        aria-label="Price in Naira"
        style={{ paddingLeft:"26px", ...G.input }}
        className={error ? "pa-input--error" : ""}
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

/* ═══════════════════════════════════════════════
   MATRIX MODAL — focus trap + glass UI
═══════════════════════════════════════════════ */
const MatrixModal = memo(({ onGenerate, onClose, title = "", categoryName = "" }) => {
  const suggested  = useMemo(() => suggestOptions(title, categoryName), [title, categoryName]);
  const firstRef   = useRef();

  const [options, setOptions] = useState({
    color:   suggested.color   || [],
    size:    suggested.size    || [],
    storage: suggested.storage || [],
  });

  /* Focus trap on mount + Escape handler */
  useEffect(() => {
    firstRef.current?.focus();
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  /* Bug fix #5: clean trim in count */
  const count = useMemo(() => generateVariantMatrix(options).length, [options]);

  const updateOpt    = useCallback((attr, idx, val) =>
    setOptions((p) => { const n = [...(p[attr]||[])]; n[idx] = val; return { ...p, [attr]:n }; }), []);

  const addOpt       = useCallback((attr) =>
    setOptions((p) => ((p[attr]||[]).length >= MAX_PER_ATTR ? p : { ...p, [attr]:[...(p[attr]||[]),""] })), []);

  const removeOpt    = useCallback((attr, idx) =>
    setOptions((p) => ({ ...p, [attr]:(p[attr]||[]).filter((_,i)=>i!==idx) })), []);

  const toggleSugg   = useCallback((attr, val) =>
    setOptions((p) => {
      const cur = p[attr] || [];
      return { ...p, [attr]: cur.includes(val)
        ? cur.filter((x) => x !== val)
        : cur.length < MAX_PER_ATTR ? [...cur, val] : cur };
    }), []);

  const applySuggAll = useCallback((attr) =>
    setOptions((p) => ({ ...p, [attr]: suggested[attr] || [] })), [suggested]);

  const handleGenerate = useCallback(() => {
    const combos = generateVariantMatrix(options);
    if (!combos.length) { alert("Add at least one valid option"); return; }
    if (combos.length > MAX_VARIANTS) { alert(`Too many (${combos.length}). Max ${MAX_VARIANTS}.`); return; }
    onGenerate(combos.map((attrs, i) => ({
      /* Bug fix #3: stable UUID */
      id:         newId(),
      name:       Object.values(attrs).filter(Boolean).join(" / "),
      sku:        generateSku(title, attrs, i),
      price:      "",
      stock:      "1",
      attributes: {
        color:    attrs.color    || "",
        size:     attrs.size     || "",
        storage:  attrs.storage  || "",
        material: "",
      },
    })));
  }, [options, title, onGenerate]);

  const renderAttr = (attr) => {
    const { label, emoji } = ATTR_CONFIG[attr];
    const vals   = options[attr] || [];
    const hasSug = (suggested[attr] || []).length > 0;
    const atCap  = vals.length >= MAX_PER_ATTR;

    return (
      <div key={attr} style={{ marginBottom:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
          <label className="pa-label" style={{ margin:0 }}>{emoji} {label}</label>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            {count > MAX_VARIANTS && vals.length > 0 && (
              <span style={{ fontSize:"10px", fontWeight:800, color:"#ef4444" }}>Too many</span>
            )}
            {hasSug && (
              <button type="button" onClick={() => applySuggAll(attr)}
                aria-label={`Use all suggested ${label.toLowerCase()} values`}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:"11px", fontWeight:700, color:"#6366f1", display:"flex", alignItems:"center", gap:"4px" }}>
                <FiZap size={11} aria-hidden="true" /> All
              </button>
            )}
          </div>
        </div>

        {/* Suggestion chips */}
        {hasSug && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"8px" }}
            role="group" aria-label={`Suggested ${label.toLowerCase()} options`}>
            {(suggested[attr] || []).map((s) => {
              const active = vals.includes(s);
              return (
                <button key={s} type="button"
                  onClick={() => toggleSugg(attr, s)}
                  aria-label={`${active ? "Remove" : "Add"} ${s}`}
                  aria-pressed={active}
                  style={{
                    padding:"3px 9px", borderRadius:"999px", fontSize:"11px", fontWeight:700,
                    border:     `1px solid ${active ? "#6366f1" : "rgba(255,255,255,0.5)"}`,
                    background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.35)",
                    backdropFilter:"blur(4px)",
                    color:      active ? "#6366f1" : "#6b7280",
                    cursor:     "pointer", transition:"all 0.15s",
                  }}>
                  {active ? "✓ " : "+ "}{s}
                </button>
              );
            })}
          </div>
        )}

        {/* Custom inputs */}
        {vals.map((val, i) => (
          <div key={i} style={{ display:"flex", gap:"6px", marginBottom:"6px" }}>
            <input
              className="pa-mini-input"
              value={val}
              placeholder={`Custom ${label.toLowerCase()}`}
              aria-label={`Custom ${label} option ${i + 1}`}
              style={G.input}
              onChange={(e) => updateOpt(attr, i, e.target.value)}
            />
            <button type="button" className="pa-mini-btn"
              onClick={() => removeOpt(attr, i)}
              aria-label={`Remove ${label} option ${i + 1}`}>
              −
            </button>
          </div>
        ))}

        {!atCap ? (
          <button type="button" className="pa-add-btn pa-add-btn--sm"
            onClick={() => addOpt(attr)} style={{ marginTop:"4px" }}>
            + Add {label}
          </button>
        ) : (
          <p style={{ fontSize:"11px", color:"#9ca3af", fontWeight:600, marginTop:"4px" }}>
            Max {MAX_PER_ATTR} {label.toLowerCase()} options
          </p>
        )}
      </div>
    );
  };

  return (
    <div style={G.overlay} role="dialog" aria-modal="true"
      aria-label="Variant Matrix Generator" onClick={onClose}>
      <div style={G.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ ...G.modalBar, borderBottom:"1px solid rgba(255,255,255,0.3)", borderRadius:"20px 20px 0 0", position:"sticky", top:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <h3 ref={firstRef} tabIndex={-1}
                style={{ margin:0, fontSize:"16px", fontWeight:800, color:"#1a1a1a", display:"flex", alignItems:"center", gap:"8px" }}>
                <FiGrid size={18} aria-hidden="true" /> Variant Matrix Generator
              </h3>
              <p style={{ margin:"2px 0 0", fontSize:"12px", color:"#6b7280", fontWeight:600 }}>
                Select options → auto-generate all SKU combinations
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close"
              style={{ background:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.5)", backdropFilter:"blur(6px)", borderRadius:"8px", cursor:"pointer", color:"#6b7280", padding:"6px", lineHeight:1, display:"flex" }}>
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:"20px" }}>
          {ATTRS.filter((a) => a !== "material").map(renderAttr)}

          {/* Live count pill */}
          <div style={{
            display:"flex", alignItems:"center", gap:"10px",
            padding:"12px 14px", borderRadius:"12px",
            fontSize:"13px", fontWeight:700,
            background:     count === 0 ? "rgba(255,255,255,0.3)" : count > MAX_VARIANTS ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
            border:         `1px solid ${count > MAX_VARIANTS ? "rgba(239,68,68,0.25)" : count > 0 ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.4)"}`,
            backdropFilter: "blur(8px)",
            color:          count > MAX_VARIANTS ? "#991b1b" : "#4f46e5",
          }}>
            <FiGrid size={14} aria-hidden="true" />
            {count === 0
              ? "Add values above to preview"
              : count > MAX_VARIANTS
                ? `⚠ ${count} combinations — max ${MAX_VARIANTS}. Reduce options.`
                : `✅ ${count} variant${count !== 1 ? "s" : ""} will be generated`}
          </div>
        </div>

        {/* Footer */}
        <div style={{ ...G.modalBar, borderTop:"1px solid rgba(255,255,255,0.3)", borderRadius:"0 0 20px 20px", position:"sticky", bottom:0, display:"flex", gap:"10px" }}>
          <button type="button" className="pa-btn-back" onClick={onClose}>Cancel</button>
          <button type="button" className="pa-btn-next"
            onClick={handleGenerate}
            disabled={count === 0 || count > MAX_VARIANTS}
            aria-disabled={count === 0 || count > MAX_VARIANTS}
            style={{ flex:1 }}>
            <FiZap size={15} aria-hidden="true" />
            Generate {count > 0 ? count : ""} Variant{count !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   VARIANT CARD
   Bug fix #1: isDuplicate by SKU value, not index
   Bug fix #3: stable field-level memo
═══════════════════════════════════════════════ */
const VariantCard = memo(({
  v, index, total, isDuplicate,
  onUpdate, onUpdateAttr, onRemove, onDuplicate, onAutoSku,
  errors, onBlur,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  /* Bug fix #4: score memo on individual fields */
  const score = useMemo(() => variantScore(v), [
    v.name, v.sku, v.price, v.stock,
    v.attributes.color, v.attributes.size,
    v.attributes.storage, v.attributes.material,
  ]);
  const scoreCol = getScoreColor(score);

  const handleUpdate  = useCallback((f, val) => onUpdate(index, f, val),      [index, onUpdate]);
  const handleAttr    = useCallback((a, val) => onUpdateAttr(index, a, val),  [index, onUpdateAttr]);
  const handleRemove  = useCallback(() => onRemove(index),                     [index, onRemove]);
  const handleDupe    = useCallback(() => onDuplicate(index),                  [index, onDuplicate]);
  const handleAutoSku = useCallback(() => onAutoSku(index),                    [index, onAutoSku]);
  const handleToggle  = useCallback(() => setCollapsed((x) => !x),             []);

  const cardBorder = isDuplicate
    ? "rgba(239,68,68,0.4)"
    : score >= 80
      ? "rgba(16,185,129,0.3)"
      : "rgba(255,255,255,0.45)";

  return (
    <div style={{
      ...G.card,
      border:    `1.5px solid ${cardBorder}`,
      boxShadow: isDuplicate ? "0 0 0 3px rgba(239,68,68,0.1)" : "none",
    }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: collapsed ? 0 : "10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", minWidth:0 }}>
          <button type="button" role="button" onClick={handleToggle}
            aria-expanded={!collapsed} aria-label={`${collapsed?"Expand":"Collapse"} variant ${index+1}`}
            style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(0,0,0,0.35)", padding:"2px", display:"flex" }}>
            {collapsed ? <FiChevronDown size={16}/> : <FiChevronUp size={16}/>}
          </button>
          <div style={{ minWidth:0 }}>
            <span style={{ fontWeight:800, fontSize:"13px", color:"#1a1a1a" }}>Variant {index + 1}</span>
            {v.name.trim() && (
              <span style={{ fontSize:"11px", color:"#6b7280", marginLeft:"6px" }}>{v.name}</span>
            )}
            {isDuplicate && (
              <span style={{ fontSize:"10px", color:"#ef4444", fontWeight:800, marginLeft:"6px" }} aria-live="polite">
                ⚠ Duplicate SKU
              </span>
            )}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"5px", flexShrink:0 }}>
          <span style={{ fontSize:"10px", fontWeight:800, padding:"2px 8px", borderRadius:"999px", background:`${scoreCol}18`, color:scoreCol }}>
            {score}%
          </span>
          <button type="button" role="button" onClick={handleAutoSku} style={G.actionBtn("#f59e0b")}
            aria-label={`Auto-generate SKU for variant ${index+1}`} title="Auto-generate SKU">
            <FiZap size={12} aria-hidden="true"/>
          </button>
          <button type="button" role="button" onClick={handleDupe} style={G.actionBtn("#6366f1")}
            aria-label={`Duplicate variant ${index+1}`} title="Duplicate">
            <FiCopy size={12} aria-hidden="true"/>
          </button>
          <button type="button" role="button" onClick={handleRemove} disabled={total<=1}
            style={G.actionBtn("#ef4444", total<=1)}
            aria-label={`Delete variant ${index+1}`} aria-disabled={total<=1}>
            <FiTrash2 size={12} aria-hidden="true"/>
          </button>
        </div>
      </div>

      {/* Collapsed preview */}
      {collapsed && (
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"6px", fontSize:"12px", fontWeight:600, color:"#6b7280" }}>
          {v.sku && <span style={{ fontFamily:"monospace", background:"rgba(255,255,255,0.5)", padding:"2px 8px", borderRadius:"6px" }}>{v.sku}</span>}
          {v.price && <span style={{ color:"#ff5722", fontWeight:800 }}>₦{Number(v.price).toLocaleString("en-NG")}</span>}
          <StockBadge stock={v.stock}/>
          {ATTRS.filter((a) => (v.attributes[a]||"").trim()).map((a) => (
            <span key={a} style={G.attrPill}>{v.attributes[a]}</span>
          ))}
        </div>
      )}

      {/* Expanded body */}
      {!collapsed && (
        <>
          {/* Score bar */}
          <div style={{ marginBottom:"12px" }}>
            <div style={{ height:"4px", background:"rgba(0,0,0,0.06)", borderRadius:"999px", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${score}%`, background:`linear-gradient(90deg,${scoreCol},${scoreCol}cc)`, borderRadius:"999px", transition:"width 0.4s ease" }}/>
            </div>
          </div>

          {/* Core fields */}
          <div className="pa-variant-grid" style={{ marginBottom:0 }}>

            {/* Name */}
            <div className="pa-variant-field" style={{ gridColumn:"span 2" }}>
              <label htmlFor={`v-name-${index}`} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                Variant Name *
                {v.name.trim().length >= 2 && <FiCheckCircle size={11} color="#10b981" aria-hidden="true"/>}
              </label>
              <input id={`v-name-${index}`} placeholder='e.g. "Black 128GB"' value={v.name}
                aria-required="true" aria-invalid={!!errors.name}
                className={errors.name ? "pa-input--error" : ""}
                style={G.input}
                onChange={(e) => handleUpdate("name", e.target.value)}
                onBlur={() => onBlur?.(`v_name_${index}`)}/>
              <FieldError msg={errors.name}/>
            </div>

            {/* SKU */}
            <div className="pa-variant-field">
              <label htmlFor={`v-sku-${index}`} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                SKU *
                {v.sku.trim() && !isDuplicate && <FiCheckCircle size={11} color="#10b981" aria-hidden="true"/>}
                {isDuplicate && <FiAlertCircle size={11} color="#ef4444" aria-hidden="true"/>}
              </label>
              <input id={`v-sku-${index}`} placeholder="IP13-BLK-128" value={v.sku}
                aria-required="true" aria-invalid={!!errors.sku || isDuplicate}
                style={{ fontFamily:"monospace", letterSpacing:"0.5px", ...G.input }}
                className={errors.sku || isDuplicate ? "pa-input--error" : ""}
                onChange={(e) => handleUpdate("sku", e.target.value.toUpperCase())}
                onBlur={() => onBlur?.(`v_sku_${index}`)}/>
              {isDuplicate
                ? <FieldError msg="Duplicate SKU — must be unique"/>
                : <FieldError msg={errors.sku}/>
              }
            </div>

            {/* Price */}
            <div className="pa-variant-field">
              <label htmlFor={`v-price-${index}`} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                Price (₦) *
                {Number(v.price) > 0 && <FiCheckCircle size={11} color="#10b981" aria-hidden="true"/>}
              </label>
              <PriceInput id={`v-price-${index}`} value={v.price} error={errors.price}
                onChange={(raw) => handleUpdate("price", raw)}
                onBlur={() => onBlur?.(`v_price_${index}`)}/>
              <FieldError msg={errors.price}/>
            </div>

            {/* Stock */}
            <div className="pa-variant-field">
              <label htmlFor={`v-stock-${index}`}>Stock Qty</label>
              <input id={`v-stock-${index}`} type="number" min="0" placeholder="1"
                value={v.stock} aria-label={`Stock for variant ${index+1}`}
                style={G.input}
                onChange={(e) => handleUpdate("stock", e.target.value)}/>
              <StockBadge stock={v.stock}/>
            </div>
          </div>

          {/* Attributes */}
          <div style={G.inner}>
            <p style={{ margin:"0 0 10px", fontSize:"11px", fontWeight:800, color:"rgba(0,0,0,0.4)", textTransform:"uppercase", letterSpacing:"0.5px" }}>
              Attributes — fill what applies
            </p>
            <div className="pa-variant-grid">
              {ATTRS.map((attr) => {
                const cfg = ATTR_CONFIG[attr];
                const val = v.attributes[attr] || "";
                return (
                  <div className="pa-variant-field" key={attr}>
                    <label htmlFor={`v-${attr}-${index}`}>
                      <span aria-hidden="true">{cfg.emoji} </span>{cfg.label}
                    </label>
                    <input id={`v-${attr}-${index}`} placeholder={cfg.placeholder} value={val}
                      style={{ ...G.input, borderColor: val.trim() ? "rgba(99,102,241,0.35)" : undefined }}
                      onChange={(e) => handleAttr(attr, e.target.value)}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live summary */}
          {(v.name || v.sku || v.price) && (
            <div style={G.summaryPill} aria-label="Variant summary">
              {v.name.trim()       && <span>📦 {v.name}</span>}
              {v.sku.trim()        && <span style={{ fontFamily:"monospace", color:"#6366f1" }}>#{v.sku}</span>}
              {Number(v.price) > 0 && <span style={{ color:"#ff5722" }}>₦{Number(v.price).toLocaleString("en-NG")}</span>}
              {ATTRS.filter((a) => (v.attributes[a]||"").trim()).map((a) => (
                <span key={a} style={G.attrPill}>{v.attributes[a]}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
},
/* ── Bug fix #1 + field-level memo comparison ── */
(prev, next) =>
  prev.v.id                    === next.v.id                    &&
  prev.v.name                  === next.v.name                  &&
  prev.v.sku                   === next.v.sku                   &&
  prev.v.price                 === next.v.price                 &&
  prev.v.stock                 === next.v.stock                 &&
  prev.v.attributes.color      === next.v.attributes.color      &&
  prev.v.attributes.size       === next.v.attributes.size       &&
  prev.v.attributes.storage    === next.v.attributes.storage    &&
  prev.v.attributes.material   === next.v.attributes.material   &&
  prev.isDuplicate             === next.isDuplicate             &&
  prev.errors.name             === next.errors.name             &&
  prev.errors.sku              === next.errors.sku              &&
  prev.errors.price            === next.errors.price            &&
  prev.index                   === next.index                   &&
  prev.total                   === next.total
);

/* ═══════════════════════════════════════════════
   VARIANT EDITOR — MAIN
═══════════════════════════════════════════════ */
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
}) {
  const [showMatrix, setShowMatrix] = useState(false);

  /* ── Bug fix #1: SKU-based duplicate set ── */
  const duplicateSkuSet = useMemo(() => buildDuplicateSkuSet(variants), [variants]);

  /* ── Bug fix #4: precompute scores once ── */
  const scores = useMemo(() =>
    variants.map((v) => variantScore(v)), [variants]);

  /* ── Summary stats using precomputed scores ── */
  const totalStock    = useMemo(() => variants.reduce((s, v) => s + getStock(v), 0),                                                     [variants]);
  const criticalCount = useMemo(() => variants.filter((v, i) => v.name && getStock(v) > 0 && getStock(v) <= STOCK_CRITICAL).length,      [variants]);
  const lowStockCount = useMemo(() => variants.filter((v) => v.name && getStock(v) > 0 && getStock(v) < STOCK_LOW).length,               [variants]);
  const outOfStock    = useMemo(() => variants.filter((v) => v.name && getStock(v) === 0).length,                                         [variants]);
  const completeCount = useMemo(() => scores.filter((s) => s >= 80).length,                                                              [scores]);
  const dupCount      = useMemo(() => duplicateSkuSet.size,                                                                               [duplicateSkuSet]);

  /* ── Per-variant errors with defaults ── */
  const getErrors = useCallback((i) => ({
    name:  errors[`v_name_${i}`]  || "",
    sku:   errors[`v_sku_${i}`]   || "",
    price: errors[`v_price_${i}`] || "",
  }), [errors]);

  /* ── Bug fix #2: stable handleBulkAutoSku ── */
  const handleAutoSku = useCallback((i) => {
    const sku = generateSku(title, variants[i].attributes, i);
    onUpdate(i, "sku", sku);
  }, [variants, title, onUpdate]);

  const handleBulkAutoSku = useCallback(() => {
    variants.forEach((v, i) => {
      onUpdate(i, "sku", generateSku(title, v.attributes, i));
    });
  }, [variants, title, onUpdate]);

  /* ── isDuplicate by SKU value ── */
  const checkDuplicate = useCallback((v) =>
    duplicateSkuSet.has(v.sku?.trim().toUpperCase()), [duplicateSkuSet]);

  return (
    <section aria-label="Product variants">

      {/* Header */}
      <div style={{ marginBottom:"16px" }}>
        <p className="pa-section-title">📦 Product Variants</p>
        <p className="pa-section-sub">Each variant is a unique SKU — colour, size, storage, etc.</p>
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
        <button type="button" style={G.modeBtn(false)} aria-label="Manual variant mode">
          <FiEdit3 size={14} aria-hidden="true"/> Manual Mode
        </button>
        <button type="button" style={G.modeBtn(false)}
          onClick={() => setShowMatrix(true)} aria-label="Open variant matrix generator">
          <FiGrid size={14} aria-hidden="true"/> Matrix Generator
        </button>
        {variants.length > 1 && (
          <button type="button" onClick={handleBulkAutoSku} aria-label="Regenerate all SKUs"
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"10px", border:"1.5px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.1)", backdropFilter:"blur(8px)", color:"#92400e", cursor:"pointer", fontSize:"13px", fontWeight:700 }}>
            <FiRefreshCw size={13} aria-hidden="true"/> Regenerate SKUs
          </button>
        )}
      </div>

      {/* Summary strip */}
      {variants.length > 1 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"14px" }}>
          {[
            { label:"Variants", value:variants.length,             icon:"📦", color:"#6366f1" },
            { label:"Stock",    value:totalStock.toLocaleString(), icon:"🏬", color:"#10b981" },
            { label:"Complete", value:`${completeCount}/${variants.length}`, icon:"✅", color:"#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={G.stripCard(s.color)}>
              <p style={{ margin:0, fontSize:"15px", fontWeight:900, color:s.color }}>{s.icon} {s.value}</p>
              <p style={{ margin:"2px 0 0", fontSize:"10px", fontWeight:700, color:"rgba(0,0,0,0.4)", textTransform:"uppercase", letterSpacing:"0.4px" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {dupCount > 0 && (
        <div style={G.alert(220,38,38)} role="alert">
          <FiAlertCircle size={14} aria-hidden="true"/>
          {dupCount} duplicate SKU{dupCount>1?"s":""} — each must be unique
        </div>
      )}
      {criticalCount > 0 && (
        <div style={G.alert(220,38,38)} role="alert">
          <FiAlertCircle size={14} aria-hidden="true"/>
          🚨 {criticalCount} variant{criticalCount>1?"s":""} critically low (≤{STOCK_CRITICAL})
        </div>
      )}
      {lowStockCount > 0 && (
        <div style={G.alert(217,119,6)} role="alert">
          <FiAlertCircle size={14} aria-hidden="true"/>
          ⚠️ {lowStockCount} variant{lowStockCount>1?"s":""} low on stock (&lt;{STOCK_LOW})
        </div>
      )}
      {outOfStock > 0 && (
        <div style={G.alert(239,68,68)} role="alert">
          <FiAlertCircle size={14} aria-hidden="true"/>
          📭 {outOfStock} variant{outOfStock>1?"s":""} out of stock
        </div>
      )}

      {/* Variant cards */}
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

      {/* Add / max */}
      {variants.length < MAX_VARIANTS ? (
        <button type="button" className="pa-add-btn pa-add-btn--lg" onClick={onAdd}
          aria-label="Add another variant"
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", height:"48px", fontSize:"14px" }}>
          <FiPlus size={16} aria-hidden="true"/>
          Add Variant
          <span style={{ fontSize:"11px", fontWeight:600, color:"rgba(255,87,34,0.5)" }}>
            ({variants.length}/{MAX_VARIANTS})
          </span>
        </button>
      ) : (
        <div style={{ textAlign:"center", padding:"14px", fontSize:"12px", fontWeight:700, color:"rgba(0,0,0,0.35)", borderRadius:"12px", border:"1.5px dashed rgba(0,0,0,0.1)", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(6px)" }}>
          Maximum {MAX_VARIANTS} variants reached
        </div>
      )}

      {/* Matrix Modal */}
      {showMatrix && (
        <MatrixModal
          title={title}
          categoryName={categoryName}
          onGenerate={(newVariants) => { onBulkReplace?.(newVariants); setShowMatrix(false); }}
          onClose={() => setShowMatrix(false)}
        />
      )}
    </section>
  );
}