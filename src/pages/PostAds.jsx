import React, {
  useEffect, useMemo, useState,
  useCallback, useRef, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import {
  FiChevronLeft, FiChevronRight, FiCheckCircle, FiArrowLeft,
  FiZap, FiTag, FiCamera, FiTrash2, FiAlertCircle,
  FiPackage, FiPlus, FiDollarSign, FiFileText, FiGrid,
  FiShield, FiAlertTriangle,
} from "react-icons/fi";

import categories    from "../config/categories";
import ReviewStep    from "./PostAds/ReviewStep";
import PricingStep   from "./PostAds/PricingStep";
import "../styles/PostAds.css";

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const API              = "https://minimart-ivrm.onrender.com/api";
const DRAFT_KEY        = "post-ad-draft-v6";
const MAX_IMAGES       = 6;
const MAX_FILE_MB      = 5;
const COMPRESS_TARGET  = 0.5; // MB

/* ═══════════════════════════════════════════════
   STEPS CONFIG
═══════════════════════════════════════════════ */
const STEPS = [
  { id: 1, label: "Photos",   icon: <FiCamera size={15} />    },
  { id: 2, label: "Details",  icon: <FiTag size={15} />       },
  { id: 3, label: "Variants", icon: <FiPackage size={15} />   },
  { id: 4, label: "Pricing",  icon: <FiDollarSign size={15} />},
  { id: 5, label: "Review",   icon: <FiFileText size={15} />  },
];

/* ═══════════════════════════════════════════════
   BLANK VARIANT FACTORY
═══════════════════════════════════════════════ */
const BLANK_VARIANT = () => ({
  id:         Date.now() + Math.random(),
  sku:        "",
  name:       "",
  price:      "",
  stock:      "1",
  attributes: { color: "", size: "", storage: "", material: "" },
});

/* ═══════════════════════════════════════════════
   PROHIBITED CONTENT SCANNER
═══════════════════════════════════════════════ */
const PROHIBITED_PATTERNS = [
  { pattern: /\b(gun|pistol|rifle|shotgun|firearm|weapon|ammo|ammunition|explosive|bomb|grenade|machete)\b/i, category: "Weapons & Dangerous Items" },
  { pattern: /\b(cocaine|heroin|meth|cannabis|marijuana|weed|narcotic|tramadol abuse|codeine syrup)\b/i,      category: "Illegal Drugs"              },
  { pattern: /\b(replica watch|fake|counterfeit|knockoff|pirated|bootleg)\b/i,                                category: "Counterfeit Items"          },
  { pattern: /\b(human trafficking|organ for sale|kidney for sale|blood for sale)\b/i,                        category: "Human Trafficking"          },
  { pattern: /\b(ponzi|advance fee|investment scheme|pay upfront)\b/i,                                        category: "Scam / Fraud"               },
  { pattern: /\b(escort service|sex service|adult only service)\b/i,                                          category: "Adult Services"             },
  { pattern: /\b(ivory|rhino horn|tiger skin|poached)\b/i,                                                    category: "Illegal Wildlife"           },
  { pattern: /\b(stolen goods|chop shop|IMEI removed|serial removed)\b/i,                                     category: "Stolen Goods"               },
];

const SUSPICIOUS_PATTERNS = [
  { pattern: /\b(no questions asked|cash only|no receipt|as is no return)\b/i, label: "Suspicious terms"           },
  { pattern: /\b(whatsapp only|telegram only|contact outside)\b/i,             label: "Off-platform contact"       },
  { pattern: /\b(urgent sale|leaving country|emergency sale)\b/i,              label: "Urgency pressure tactic"    },
];

function scanContent({ title = "", description = "", keyFeatures = [] }) {
  const corpus = [title, description, ...keyFeatures].join(" ");
  const blocked = PROHIBITED_PATTERNS
    .filter((r) => r.pattern.test(corpus))
    .map((r) => ({ text: corpus.match(r.pattern)?.[0] ?? "flagged", category: r.category }));
  const suspicious = SUSPICIOUS_PATTERNS
    .filter((r) => r.pattern.test(corpus))
    .map((r) => ({ text: corpus.match(r.pattern)?.[0] ?? "flagged", label: r.label }));
  return { blocked, suspicious };
}

/* ═══════════════════════════════════════════════
   SHA-256 FILE HASH (true duplicate detection)
═══════════════════════════════════════════════ */
async function hashFile(file) {
  try {
    const buf    = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

/* ═══════════════════════════════════════════════
   IMAGE COMPRESSION
═══════════════════════════════════════════════ */
async function compressImage(file) {
  if (file.size <= COMPRESS_TARGET * 1024 * 1024) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB:        COMPRESS_TARGET,
      maxWidthOrHeight: 1920,
      useWebWorker:     true,
      fileType:         file.type,
    });
  } catch {
    return file;
  }
}

/* ═══════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════ */
const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();
const uniq      = (arr)    => [...new Set(arr.filter(Boolean))];

/* ═══════════════════════════════════════════════
   SMART FEATURE GENERATOR
═══════════════════════════════════════════════ */
function guessFeatures({ title, categoryName, description, specs }) {
  const t = normalize(title).toLowerCase();
  const d = normalize(description).toLowerCase();
  const specPairs = (specs || [])
    .filter((x) => normalize(x.key) && normalize(x.value))
    .map((x) => `${normalize(x.key)}: ${normalize(x.value)}`);

  const features = [];

  if (t.includes("new") || d.includes("brand new"))    features.push("Brand new condition");
  if (t.includes("original") || d.includes("original"))features.push("100% original product");
  if (d.includes("warranty"))                           features.push("Warranty included");
  if (d.includes("delivery") || d.includes("shipping"))features.push("Fast delivery available");
  if (d.includes("negotiable"))                         features.push("Price negotiable");

  if (/(iphone|samsung|tecno|infinix|xiaomi|pixel|redmi|oppo|vivo)/i.test(t)) {
    features.push("Fast performance for daily use");
    if (/(128|256|512)\s?gb/i.test(t))                features.push("Large storage capacity");
    if (d.includes("battery") || d.includes("mah"))   features.push("Long-lasting battery life");
    if (d.includes("camera"))                          features.push("High-quality camera system");
  }

  if (/(laptop|macbook|hp|dell|lenovo|asus|acer|thinkpad)/i.test(t)) {
    features.push("Smooth multitasking for work & school");
    if (d.includes("ssd") || specPairs.join(" ").includes("ssd")) features.push("Fast SSD storage");
    if (d.includes("ram") || /(8|16|32)\s?gb\s?ram/i.test(t))    features.push("Powerful RAM");
  }

  if (/(nike|adidas|puma|gucci|zara)/i.test(t)) {
    features.push("Premium brand quality");
    features.push("Stylish and trendy design");
  }

  if (categoryName) features.push(`Great for ${categoryName.toLowerCase()} shoppers`);
  specPairs.slice(0, 5).forEach((s) => features.push(s));

  return uniq(features).filter((x) => x.length >= 6 && x.length <= 60).slice(0, 10);
}

/* ═══════════════════════════════════════════════
   VARIANT MATRIX GENERATOR
═══════════════════════════════════════════════ */
function generateVariantMatrix(colors, sizes, storages) {
  const c  = colors.filter(Boolean);
  const s  = sizes.filter(Boolean);
  const st = storages.filter(Boolean);
  if (!c.length && !s.length && !st.length) return [];

  const combos    = [];
  const colorList = c.length  ? c  : [""];
  const sizeList  = s.length  ? s  : [""];
  const stList    = st.length ? st : [""];
  let idx = 1;

  for (const color of colorList) {
    for (const size of sizeList) {
      for (const storage of stList) {
        const parts = [color, size, storage].filter(Boolean);
        combos.push({
          id:         Date.now() + Math.random() + idx,
          sku:        parts.map((p) => p.replace(/\s+/g, "").toUpperCase().slice(0, 6)).join("-") || `VAR-${idx}`,
          name:       parts.join(" / ") || `Variant ${idx}`,
          price:      "",
          stock:      "1",
          attributes: { color, size, storage, material: "" },
        });
        idx++;
      }
    }
  }
  return combos;
}

/* ═══════════════════════════════════════════════
   PROHIBITED BANNER (memoised)
═══════════════════════════════════════════════ */
const ProhibitedBanner = memo(({ result, scanDone }) => {
  if (!scanDone || !result) return null;
  const { blocked, suspicious } = result;

  if (!blocked.length && !suspicious.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 14px", borderRadius: "12px",
        background: "rgba(16,185,129,0.07)",
        border: "1px solid rgba(16,185,129,0.15)",
        marginBottom: "14px", fontSize: "12px", fontWeight: 700, color: "#065f46",
      }}>
        <FiShield size={14} style={{ flexShrink: 0 }} />
        ✅ Content scan passed — no prohibited items detected
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
      {blocked.length > 0 && (
        <div style={{
          padding: "14px 16px", borderRadius: "14px",
          background: "rgba(220,38,38,0.07)",
          border: "1.5px solid rgba(220,38,38,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <FiAlertTriangle size={16} color="#dc2626" />
            <span style={{ fontWeight: 800, fontSize: "13px", color: "#991b1b" }}>
              🚫 Prohibited Content Detected
            </span>
            <span style={{ marginLeft: "auto", background: "#dc2626", color: "#fff", fontSize: "10px", fontWeight: 900, padding: "2px 7px", borderRadius: "5px" }}>
              BLOCKED
            </span>
          </div>
          {blocked.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "10px", background: "rgba(220,38,38,0.05)", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ padding: "2px 8px", borderRadius: "6px", background: "rgba(220,38,38,0.12)", color: "#991b1b", fontWeight: 800, fontSize: "11px" }}>
                {b.category}
              </span>
              <span style={{ color: "#991b1b", fontWeight: 700 }}>"{b.text}"</span>
            </div>
          ))}
          <p style={{ margin: "10px 0 0", fontSize: "12px", fontWeight: 600, color: "#991b1b", lineHeight: 1.5 }}>
            Remove prohibited content before continuing. Violations may result in account suspension.
          </p>
        </div>
      )}

      {suspicious.length > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: "14px", background: "rgba(245,158,11,0.07)", border: "1.5px solid rgba(245,158,11,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <FiAlertCircle size={15} color="#d97706" />
            <span style={{ fontWeight: 800, fontSize: "13px", color: "#92400e" }}>⚠️ Suspicious Terms</span>
            <span style={{ marginLeft: "auto", background: "rgba(245,158,11,0.15)", color: "#92400e", fontSize: "10px", fontWeight: 900, padding: "2px 7px", borderRadius: "5px" }}>
              WARNING
            </span>
          </div>
          {suspicious.map((s, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#92400e", fontWeight: 600, marginBottom: "4px" }}>
              • {s.label}: <em>"{s.text}"</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════
   STEP BAR (memoised)
═══════════════════════════════════════════════ */
const StepBar = memo(({ current }) => (
  <div className="pa-stepbar" role="navigation" aria-label="Form steps">
    {STEPS.map((s, i) => (
      <React.Fragment key={s.id}>
        <div
          className={[
            "pa-step",
            current === s.id ? "pa-step--active" : "",
            current > s.id  ? "pa-step--done"   : "",
          ].join(" ")}
          aria-current={current === s.id ? "step" : undefined}
        >
          <div className="pa-step-dot">
            {current > s.id ? <FiCheckCircle size={14} /> : s.icon}
          </div>
          <span className="pa-step-label">{s.label}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={`pa-step-line ${current > s.id ? "pa-step-line--done" : ""}`} aria-hidden="true" />
        )}
      </React.Fragment>
    ))}
  </div>
));

/* ═══════════════════════════════════════════════
   IMAGE SLOT (memoised)
═══════════════════════════════════════════════ */
const ImageSlot = memo(({
  img, index, isPrimary,
  onAdd, onRemove,
  onDragStart, onDragOver, onDrop,
}) => {
  const fileRef  = useRef();
  const [over,   setOver]   = useState(false);
  const [active, setActive] = useState(false);

  const handleFileDrop = useCallback(async (e) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onAdd(index, file);
  }, [index, onAdd]);

  const handleDrop = useCallback((e) => {
    if (e.dataTransfer?.files?.length) handleFileDrop(e);
    else { e.preventDefault(); setOver(false); onDrop?.(e, index); }
  }, [handleFileDrop, onDrop, index]);

  return (
    <div
      className={[
        "pa-img-slot",
        isPrimary ? "pa-img-slot--primary" : "",
        over      ? "pa-img-slot--dragover" : "",
        active    ? "pa-img-slot--dragging" : "",
      ].filter(Boolean).join(" ")}
      draggable={!!img}
      onDragStart={(e) => { if (!img) return; setActive(true); e.dataTransfer.effectAllowed = "move"; onDragStart?.(e, index); }}
      onDragEnd={() => setActive(false)}
      onDragOver={(e) => { e.preventDefault(); setOver(true); onDragOver?.(e, index); }}
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={img ? 0 : -1}
      aria-label={img ? `Photo ${index + 1} — drag to reorder` : isPrimary ? "Add cover photo" : "Add photo"}
    >
      {img ? (
        <>
          <img
            src={img.preview}
            alt={`Photo ${index + 1}`}
            className="pa-img-preview"
            draggable={false}
          />
          <span className="pa-img-order" aria-hidden="true">{index + 1}</span>
          {isPrimary && <span className="pa-img-cover-tag">⭐ Cover</span>}
          {img.compressed && <span className="pa-img-compressed-tag" title="Auto-compressed">✓</span>}
          <button
            type="button"
            className="pa-img-remove"
            onClick={() => onRemove(index)}
            aria-label={`Remove photo ${index + 1}`}
          >
            <FiTrash2 size={13} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="pa-img-add"
          onClick={() => fileRef.current?.click()}
          aria-label={isPrimary ? "Add cover photo" : "Add photo"}
        >
          <FiCamera size={isPrimary ? 28 : 20} />
          <span className="pa-img-add-label">{isPrimary ? "Add Cover" : "Add"}</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-hidden="true"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) {
            onAdd(index, e.target.files[0]);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
});

/* ═══════════════════════════════════════════════
   MATRIX MODAL (memoised)
═══════════════════════════════════════════════ */
const MatrixModal = memo(({ onGenerate, onClose }) => {
  const [colors,   setColors]   = useState(["", ""]);
  const [sizes,    setSizes]    = useState(["", ""]);
  const [storages, setStorages] = useState([""]);

  const updArr = useCallback((setter, i, val) =>
    setter((p) => p.map((x, idx) => (idx === i ? val : x))), []);
  const addArr = useCallback((setter, max) =>
    setter((p) => (p.length < max ? [...p, ""] : p)), []);
  const remArr = useCallback((setter, i) =>
    setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i))), []);

  const count = useMemo(() => {
    const c  = colors.filter(Boolean).length   || 1;
    const s  = sizes.filter(Boolean).length    || 1;
    const st = storages.filter(Boolean).length || 1;
    return c * s * st;
  }, [colors, sizes, storages]);

  const handleGen = () => {
    const result = generateVariantMatrix(colors, sizes, storages);
    if (!result.length) { toast.error("Add at least one attribute value"); return; }
    onGenerate(result);
    onClose();
    toast.success(`${result.length} variants generated`);
  };

  /* Close on Escape */
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const renderSection = (label, arr, setter, max, placeholder) => (
    <div className="pa-matrix-section">
      <label className="pa-label">{label}</label>
      {arr.map((val, i) => (
        <div key={i} className="pa-matrix-row">
          <input
            className="pa-mini-input"
            value={val}
            placeholder={placeholder}
            aria-label={`${label} option ${i + 1}`}
            onChange={(e) => updArr(setter, i, e.target.value)}
          />
          <button
            type="button"
            className="pa-mini-btn"
            aria-label={`Remove ${label} option ${i + 1}`}
            onClick={() => remArr(setter, i)}
          >
            −
          </button>
        </div>
      ))}
      <button
        type="button"
        className="pa-add-btn pa-add-btn--sm"
        onClick={() => addArr(setter, max)}
      >
        + Add
      </button>
    </div>
  );

  return (
    <div
      className="pa-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Variant Matrix Generator"
      onClick={onClose}
    >
      <div className="pa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <FiGrid size={18} /> Variant Matrix Generator
          </h3>
          <button
            type="button"
            className="pa-modal-close"
            onClick={onClose}
            aria-label="Close matrix generator"
          >
            ✕
          </button>
        </div>

        <div className="pa-modal-body">
          <p className="pa-section-sub">Enter attributes — we generate all combinations.</p>
          {renderSection("Colors",   colors,   setColors,   8, "e.g. Black")}
          {renderSection("Sizes",    sizes,    setSizes,    8, "e.g. XL")}
          {renderSection("Storages", storages, setStorages, 6, "e.g. 256GB")}
          <div className="pa-matrix-preview">
            <FiPackage size={16} />
            <strong>{count}</strong> variant{count !== 1 ? "s" : ""} will be generated
          </div>
        </div>

        <div className="pa-modal-footer">
          <button type="button" className="pa-btn-back" onClick={onClose}>Cancel</button>
          <button type="button" className="pa-btn-generate" onClick={handleGen}>
            <FiZap size={16} /> Generate {count}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function PostAds({ user }) {
  const navigate = useNavigate();

  /* ── Step / UI ── */
  const [step,        setStep]        = useState(1);
  const [posting,     setPosting]     = useState(false);
  const [posted,      setPosted]      = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [showMatrix,  setShowMatrix]  = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [lastSaved,   setLastSaved]   = useState(null);

  /* ── Images ── */
  const [images,      setImages]      = useState(Array(MAX_IMAGES).fill(null));
  const [imageHashes, setImageHashes] = useState({}); // index → SHA-256

  /* ── Step 2 ── */
  const [title,          setTitle]          = useState("");
  const [brand,          setBrand]          = useState("");
  const [tags,           setTags]           = useState([]);
  const [tagInput,       setTagInput]       = useState("");
  const [description,    setDescription]    = useState("");
  const [category,       setCategory]       = useState("");
  const [keyFeatures,    setKeyFeatures]    = useState([""]);
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [whatsInBox,     setWhatsInBox]     = useState([""]);

  /* ── Step 3 ── */
  const [variants, setVariants] = useState([BLANK_VARIANT()]);

  /* ── Step 4 ── */
  const [basePrice,     setBasePrice]     = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  /* ── Validation ── */
  const [touched,       setTouched]       = useState({});
  const [attemptedNext, setAttemptedNext] = useState(false);

  /* ── Prohibited scan ── */
  const [scanResult, setScanResult] = useState(null);
  const [scanDone,   setScanDone]   = useState(false);

  /* ── Drag ── */
  const dragIdx = useRef(null);

  /* ── Derived ── */
  const filledImages  = useMemo(() => images.filter(Boolean), [images]);
  const activeCategory = useMemo(() => categories.find((c) => c.id === category), [category]);

  const discountPct = useMemo(() =>
    originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
      ? Math.round(((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100)
      : 0,
    [originalPrice, basePrice]
  );

  /* ═══ Lifecycle ═══ */

  /* Cleanup blob URLs */
  useEffect(() => {
    return () => {
      images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Load draft */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.step)                   setStep(d.step);
      if (d.title)                  setTitle(d.title);
      if (d.brand)                  setBrand(d.brand);
      if (Array.isArray(d.tags))    setTags(d.tags);
      if (d.description)            setDescription(d.description);
      if (d.category)               setCategory(d.category);
      if (d.keyFeatures?.length)    setKeyFeatures(d.keyFeatures);
      if (d.specifications?.length) setSpecifications(d.specifications);
      if (d.whatsInBox?.length)     setWhatsInBox(d.whatsInBox);
      if (d.variants?.length)       setVariants(d.variants);
      if (d.basePrice)              setBasePrice(d.basePrice);
      if (d.originalPrice)          setOriginalPrice(d.originalPrice);
    } catch {}
  }, []);

  /* Auto-save draft */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, title, brand, tags, description, category,
      keyFeatures, specifications, whatsInBox, variants,
      basePrice, originalPrice,
    }));
    setLastSaved(Date.now());
  }, [
    step, title, brand, tags, description, category,
    keyFeatures, specifications, whatsInBox, variants,
    basePrice, originalPrice,
  ]);

  /* Prohibited scan — re-runs when content changes */
  useEffect(() => {
    if (!title && !description && !keyFeatures.some((f) => f.trim())) {
      setScanResult(null);
      setScanDone(false);
      return;
    }
    const result = scanContent({ title, description, keyFeatures });
    setScanResult(result);
    setScanDone(true);
    if (result.blocked.length > 0) {
      toast.error(`🚫 Prohibited: ${result.blocked[0].category}`);
    }
  }, [title, description, keyFeatures]);

  /* Listen for edit-step events from ReviewStep */
  useEffect(() => {
    const handler = (e) => setStep(e.detail);
    window.addEventListener("pa-edit-step", handler);
    return () => window.removeEventListener("pa-edit-step", handler);
  }, []);

  /* ═══ Image handlers ═══ */

  const handleAddImage = useCallback(async (index, file) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Max ${MAX_FILE_MB}MB per image`); return; }

    setCompressing(true);

    /* SHA-256 hash BEFORE compression for true duplicate detection */
    const hash = await hashFile(file);

    const duplicate = Object.entries(imageHashes).find(
      ([idx, h]) => h === hash && Number(idx) !== index
    );

    if (duplicate) {
      toast.error(`This photo is already in slot ${Number(duplicate[0]) + 1}`);
      setCompressing(false);
      return;
    }

    const compressed    = await compressImage(file);
    const preview       = URL.createObjectURL(compressed);
    const wasCompressed = compressed.size < file.size;

    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = { file: compressed, preview, compressed: wasCompressed };
      return next;
    });

    setImageHashes((prev) => ({ ...prev, [index]: hash }));
    setCompressing(false);

    if (wasCompressed) {
      const saved = ((file.size - compressed.size) / 1024).toFixed(0);
      toast.success(`Compressed — saved ${saved} KB`);
    }
  }, [imageHashes]);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = null;
      return next;
    });
    setImageHashes((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  /* ═══ Drag reorder ═══ */

  const handleDragStart = useCallback((e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e, targetIdx) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === targetIdx) return;

    setImages((prev) => {
      const next    = [...prev];
      const temp    = next[from];
      next[from]    = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });

    setImageHashes((prev) => {
      const next              = { ...prev };
      const tempHash          = next[from];
      next[from]              = next[targetIdx];
      next[targetIdx]         = tempHash;
      return next;
    });

    dragIdx.current = null;
    toast.success("Image reordered");
  }, []);

  /* ═══ List helpers ═══ */

  const updateList = useCallback((setter, i, val) =>
    setter((p) => p.map((x, idx) => (idx === i ? val : x))), []);

  const addList = useCallback((setter, list, limit) => {
    if (list.length < limit) setter((p) => [...p, ""]);
  }, []);

  const removeList = useCallback((setter, i) =>
    setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i))), []);

  /* ═══ Variant helpers ═══ */

  const updateVariant = useCallback((i, field, val) =>
    setVariants((p) => p.map((v, idx) => (idx === i ? { ...v, [field]: val } : v))), []);

  const updateVariantAttr = useCallback((i, attr, val) =>
    setVariants((p) => p.map((v, idx) =>
      idx === i ? { ...v, attributes: { ...v.attributes, [attr]: val } } : v
    )), []);

  const addVariant    = useCallback(() => setVariants((p) => [...p, BLANK_VARIANT()]), []);
  const removeVariant = useCallback((i) =>
    setVariants((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i))), []);

  /* ═══ Tags ═══ */

  const commitTag = useCallback(() => {
    const t = normalize(tagInput).toLowerCase();
    if (!t || t.length > 24) return;
    if (tags.includes(t))   { setTagInput(""); return; }
    if (tags.length >= 8)   { toast.error("Max 8 tags"); return; }
    setTags((p) => [...p, t]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((t) =>
    setTags((p) => p.filter((x) => x !== t)), []);

  /* ═══ Smart feature generator ═══ */

  const generateKeyFeatures = useCallback(() => {
    const gen = guessFeatures({
      title,
      categoryName: activeCategory?.name,
      description,
      specs: specifications,
    });
    if (!gen.length) { toast.error("Add title/description first"); return; }
    const existing = keyFeatures.map(normalize).filter(Boolean);
    setKeyFeatures(uniq([...existing, ...gen]).slice(0, 10) || [""]);
    toast.success(`${gen.length} features generated`);
    window.navigator?.vibrate?.(15);
  }, [title, activeCategory, description, specifications, keyFeatures]);

  /* ═══ Field-level validation ═══ */

  const fieldErrors = useMemo(() => {
    const e = {};
    if (filledImages.length === 0) e.images = "Add at least 1 photo";
    if (touched.title && title.trim().length < 3)   e.title    = "Title must be at least 3 characters";
    if (touched.title && title.trim().length > 80)   e.title    = "Title too long";
    if (touched.category && !category)               e.category = "Select a category";
    if (touched.basePrice) {
      const n = Number(basePrice);
      if (!basePrice || isNaN(n) || n <= 0) e.basePrice = "Enter a valid price";
    }
    if (touched.originalPrice && originalPrice) {
      if (Number(originalPrice) <= Number(basePrice)) e.originalPrice = "Should be higher than base price";
    }
    variants.forEach((v, i) => {
      if (touched[`v_sku_${i}`]   && !v.sku.trim())                                   e[`v_sku_${i}`]   = "Required";
      if (touched[`v_name_${i}`]  && !v.name.trim())                                  e[`v_name_${i}`]  = "Required";
      if (touched[`v_price_${i}`] && (isNaN(Number(v.price)) || Number(v.price) < 0)) e[`v_price_${i}`] = "Invalid";
    });
    return e;
  }, [touched, title, category, filledImages.length, variants, basePrice, originalPrice]);

  const markTouched = useCallback((field) =>
    setTouched((p) => ({ ...p, [field]: true })), []);

  /* ═══ Step-level validation ═══ */

  const stepValid = useMemo(() => {
    if (step === 1) return filledImages.length > 0;
    if (step === 2) return title.trim().length >= 3 && !!category;
    if (step === 3) return variants.every((v) => v.sku.trim() && v.name.trim() && Number(v.price) >= 0);
    if (step === 4) return !isNaN(Number(basePrice)) && Number(basePrice) > 0;
    if (step === 5) return filledImages.length > 0 && title.trim().length >= 3 && Number(basePrice) > 0;
    return true;
  }, [step, filledImages.length, title, category, variants, basePrice]);

  const stepError = useMemo(() => {
    if (step === 1 && filledImages.length === 0) return "Add at least one photo";
    if (step === 2 && title.trim().length < 3)   return "Title needs at least 3 characters";
    if (step === 2 && !category)                 return "Pick a category";
    if (step === 3 && !variants.every((v) => v.sku.trim() && v.name.trim())) return "Fill in SKU and name for each variant";
    if (step === 4 && (!basePrice || Number(basePrice) <= 0)) return "Set a valid base price";
    return "";
  }, [step, filledImages.length, title, category, variants, basePrice]);

  /* ═══ Navigation ═══ */

  const goNext = useCallback(() => {
    setAttemptedNext(true);
    if (!stepValid) return;

    if (scanResult?.blocked.length > 0) {
      toast.error("Remove prohibited content before continuing");
      return;
    }

    setAttemptedNext(false);
    setStep((s) => Math.min(5, s + 1));
    window.navigator?.vibrate?.(12);
  }, [stepValid, scanResult]);

  const goBack = useCallback(() => {
    setAttemptedNext(false);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  /* ═══ Submit ═══ */

  const handleSubmit = useCallback(async () => {
    if (!user)                { toast.error("Please log in first"); return; }
    if (!filledImages.length) { toast.error("Add at least one photo"); return; }
    if (scanResult?.blocked.length > 0) { toast.error("Remove prohibited content first"); return; }

    setPosting(true);
    setUploadPct(0);

    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("marketplace_token") ||
        localStorage.getItem("seller_token");

      const fd = new FormData();
      fd.append("name",        title.trim());
      fd.append("description", description.trim());
      fd.append("category",    category);
      fd.append("basePrice",   basePrice);
      if (originalPrice)   fd.append("originalPrice", originalPrice);
      if (brand.trim())    fd.append("brand",         brand.trim());
      if (tags.length)     fd.append("tags",          JSON.stringify(tags));

      fd.append("variants",       JSON.stringify(variants.filter((v) => v.sku.trim() && v.name.trim())));
      fd.append("keyFeatures",    JSON.stringify(keyFeatures.map(normalize).filter(Boolean)));
      fd.append("specifications", JSON.stringify(specifications.filter((s) => normalize(s.key) && normalize(s.value))));
      fd.append("whatsInBox",     JSON.stringify(whatsInBox.map(normalize).filter(Boolean)));

      images.forEach((img) => { if (img?.file) fd.append("images", img.file); });

      await axios.post(`${API}/products`, fd, {
        headers: {
          Authorization:  token ? `Bearer ${token}` : undefined,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100));
        },
      });

      localStorage.removeItem(DRAFT_KEY);
      setPosted(true);
      toast.success("Ad posted! 🎉");
      window.navigator?.vibrate?.([50, 30, 80]);
    } catch (err) {
      if (!err.response)                    toast.error("Network error.");
      else if (err.response.status === 401) toast.error("Session expired.");
      else if (err.response.status === 413) toast.error("Images too large.");
      else toast.error(err.response.data?.message || "Failed to post.");
    } finally {
      setPosting(false);
    }
  }, [
    user, filledImages, scanResult, title, description, category,
    basePrice, originalPrice, brand, tags, variants,
    keyFeatures, specifications, whatsInBox, images,
  ]);

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <>
      {/* Screen-reader skip link */}
      <a href="#pa-main" className="pa-skip-link">Skip to main content</a>

      <div className="pa-page pa-glass">

        {/* ── Topbar ── */}
        <div className="pa-topbar pa-glass-bar">
          <button
            type="button"
            className="pa-topbar-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <FiArrowLeft size={18} />
          </button>
          <div className="pa-topbar-center">
            <h1 className="pa-topbar-title">Post an Ad</h1>
            <p className="pa-topbar-sub">
              Step {step}/5{activeCategory ? ` · ${activeCategory.icon} ${activeCategory.name}` : ""}
            </p>
          </div>
          <div style={{ width: 36 }} aria-hidden="true" />
        </div>

        {/* ── Success ── */}
        {posted ? (
          <div className="pa-success" role="alert" aria-live="polite">
            <div className="pa-success-icon"><FiCheckCircle size={42} /></div>
            <h2>Ad Posted! 🎉</h2>
            <p>Your listing is now live. Buyers can see it right away.</p>
            <div className="pa-success-btns">
              <button type="button" className="pa-success-primary" onClick={() => navigate("/minimart")}>
                Browse Minimart
              </button>
              <button type="button" className="pa-success-secondary" onClick={() => navigate("/dashboard")}>
                View My Listings
              </button>
            </div>
          </div>
        ) : (
          <>
            <StepBar current={step} />

            <main className="pa-body" id="pa-main">

              {/* Inline step error */}
              {attemptedNext && stepError && (
                <div className="pa-inline-error" role="alert" aria-live="assertive">
                  <FiAlertCircle size={16} /> {stepError}
                </div>
              )}

              {/* Prohibited banner (shows on step 2 onwards) */}
              {step >= 2 && (
                <ProhibitedBanner result={scanResult} scanDone={scanDone} />
              )}

              {/* ───────── STEP 1: PHOTOS ───────── */}
              {step === 1 && (
                <section aria-label="Add photos">
                  <p className="pa-section-title">📷 Add Photos</p>
                  <p className="pa-section-sub">
                    First photo = cover · Drag to reorder · Drop files anywhere
                  </p>

                  {compressing && (
                    <div className="pa-compressing" role="status" aria-live="polite">
                      <span className="pa-spinner-sm" aria-hidden="true" />
                      Compressing image…
                    </div>
                  )}

                  <div className="pa-img-grid" role="list" aria-label="Photo slots">
                    {images.map((img, i) => (
                      <div key={i} role="listitem">
                        <ImageSlot
                          img={img}
                          index={i}
                          isPrimary={i === 0}
                          onAdd={handleAddImage}
                          onRemove={handleRemoveImage}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pa-img-tip" role="note">
                    <FiAlertCircle size={14} aria-hidden="true" />
                    <div>
                      Max {MAX_IMAGES} photos · {MAX_FILE_MB}MB each ·
                      Auto-compressed to {COMPRESS_TARGET}MB ·
                      Drag to reorder
                    </div>
                  </div>

                  {filledImages.length > 0 && (
                    <p className="pa-img-stats" aria-live="polite">
                      {filledImages.length}/{MAX_IMAGES} photos ·{" "}
                      {(filledImages.reduce((s, i) => s + (i?.file?.size || 0), 0) / 1024 / 1024).toFixed(1)} MB total
                    </p>
                  )}
                </section>
              )}

              {/* ───────── STEP 2: DETAILS ───────── */}
              {step === 2 && (
                <section aria-label="Product details">
                  <div className="pa-section-head">
                    <div>
                      <p className="pa-section-title">📝 Product Details</p>
                      <p className="pa-section-sub">Clear titles rank higher.</p>
                    </div>
                    <button
                      type="button"
                      className="pa-gen-btn"
                      onClick={generateKeyFeatures}
                      aria-label="Auto-generate key features from title and description"
                    >
                      <FiZap size={15} aria-hidden="true" /> Auto-Generate
                    </button>
                  </div>

                  {/* Title */}
                  <div className="pa-field">
                    <label className="pa-label" htmlFor="pa-title">Title *</label>
                    <input
                      id="pa-title"
                      type="text"
                      className={`pa-input ${fieldErrors.title ? "pa-input--error" : ""}`}
                      placeholder='e.g. "iPhone 13 Pro Max 256GB"'
                      value={title}
                      maxLength={80}
                      aria-required="true"
                      aria-invalid={!!fieldErrors.title}
                      aria-describedby={fieldErrors.title ? "pa-title-err" : undefined}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => markTouched("title")}
                    />
                    <div className="pa-field-footer">
                      {fieldErrors.title && (
                        <span id="pa-title-err" className="pa-field-error" role="alert">
                          {fieldErrors.title}
                        </span>
                      )}
                      <span className={`pa-char-count ${title.length > 70 ? "pa-char-count--warn" : ""}`}>
                        {title.length}/80
                      </span>
                    </div>
                  </div>

                  {/* Brand + Tags */}
                  <div className="pa-grid-2">
                    <div className="pa-field">
                      <label className="pa-label" htmlFor="pa-brand">Brand</label>
                      <input
                        id="pa-brand"
                        type="text"
                        className="pa-input"
                        placeholder='e.g. "Apple"'
                        value={brand}
                        maxLength={40}
                        onChange={(e) => setBrand(e.target.value)}
                      />
                    </div>

                    <div className="pa-field">
                      <label className="pa-label" htmlFor="pa-tag-input">Tags</label>
                      <div className="pa-tag-input">
                        <FiTag size={14} aria-hidden="true" />
                        <input
                          id="pa-tag-input"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          aria-label="Add a tag and press Enter"
                          placeholder="press Enter to add"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); }
                            if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
                          }}
                        />
                      </div>
                      {tags.length > 0 && (
                        <div className="pa-tags" role="list" aria-label="Added tags">
                          {tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="pa-tag"
                              role="listitem"
                              aria-label={`Remove tag: ${t}`}
                              onClick={() => removeTag(t)}
                            >
                              {t} <span aria-hidden="true">×</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="pa-field">
                    <label className="pa-label" htmlFor="pa-desc">Description</label>
                    <textarea
                      id="pa-desc"
                      className="pa-textarea"
                      placeholder="Describe your product…"
                      value={description}
                      maxLength={700}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <span className={`pa-char-count ${description.length > 640 ? "pa-char-count--warn" : ""}`}>
                      {description.length}/700
                    </span>
                  </div>

                  {/* Key Features */}
                  <div className="pa-field">
                    <label className="pa-label">Key Features</label>
                    <div className="pa-list-wrap">
                      {keyFeatures.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "5000mAh battery"'
                            aria-label={`Key feature ${i + 1}`}
                            onChange={(e) => updateList(setKeyFeatures, i, e.target.value)}
                          />
                          <button
                            type="button"
                            className="pa-mini-btn"
                            aria-label={`Remove feature ${i + 1}`}
                            onClick={() => removeList(setKeyFeatures, i)}
                          >
                            −
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="pa-add-btn"
                        onClick={() => addList(setKeyFeatures, keyFeatures, 10)}
                      >
                        + Add Feature
                      </button>
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="pa-field">
                    <label className="pa-label">Specifications</label>
                    <div className="pa-list-wrap">
                      {specifications.map((row, i) => (
                        <div className="pa-list-row" key={i}>
                          <div className="pa-spec-grid">
                            <input
                              className="pa-mini-input"
                              value={row.key}
                              placeholder="e.g. RAM"
                              aria-label={`Spec ${i + 1} name`}
                              onChange={(e) => {
                                const n = [...specifications];
                                n[i] = { ...n[i], key: e.target.value };
                                setSpecifications(n);
                              }}
                            />
                            <input
                              className="pa-mini-input"
                              value={row.value}
                              placeholder="e.g. 8GB"
                              aria-label={`Spec ${i + 1} value`}
                              onChange={(e) => {
                                const n = [...specifications];
                                n[i] = { ...n[i], value: e.target.value };
                                setSpecifications(n);
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="pa-mini-btn"
                            aria-label={`Remove spec ${i + 1}`}
                            onClick={() => removeList(setSpecifications, i)}
                          >
                            −
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="pa-add-btn"
                        onClick={() => setSpecifications((p) => (p.length >= 12 ? p : [...p, { key: "", value: "" }]))}
                      >
                        + Add Spec
                      </button>
                    </div>
                  </div>

                  {/* What's in the Box */}
                  <div className="pa-field">
                    <label className="pa-label">What's in the Box</label>
                    <div className="pa-list-wrap">
                      {whatsInBox.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "1× Charging Cable"'
                            aria-label={`Box item ${i + 1}`}
                            onChange={(e) => updateList(setWhatsInBox, i, e.target.value)}
                          />
                          <button
                            type="button"
                            className="pa-mini-btn"
                            aria-label={`Remove box item ${i + 1}`}
                            onClick={() => removeList(setWhatsInBox, i)}
                          >
                            −
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="pa-add-btn"
                        onClick={() => addList(setWhatsInBox, whatsInBox, 12)}
                      >
                        + Add Item
                      </button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="pa-field">
                    <label className="pa-label" id="pa-cat-label">Category *</label>
                    {fieldErrors.category && (
                      <span className="pa-field-error" role="alert">{fieldErrors.category}</span>
                    )}
                    <div
                      className="pa-cat-grid"
                      role="radiogroup"
                      aria-labelledby="pa-cat-label"
                    >
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={category === c.id}
                          className={`pa-cat-btn ${category === c.id ? "pa-cat-btn--active" : ""}`}
                          onClick={() => { setCategory(c.id); markTouched("category"); }}
                        >
                          <span className="pa-cat-icon" aria-hidden="true">{c.icon}</span>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ───────── STEP 3: VARIANTS ───────── */}
              {step === 3 && (
                <section aria-label="Product variants">
                  <div className="pa-section-head">
                    <div>
                      <p className="pa-section-title">📦 Product Variants</p>
                      <p className="pa-section-sub">Each variant = unique SKU.</p>
                    </div>
                    <button
                      type="button"
                      className="pa-gen-btn"
                      onClick={() => setShowMatrix(true)}
                      aria-label="Open variant matrix generator"
                    >
                      <FiGrid size={15} aria-hidden="true" /> Matrix Generator
                    </button>
                  </div>

                  {variants.map((v, i) => {
                    const stock = parseInt(v.stock, 10) || 0;
                    return (
                      <div className="pa-variant-card" key={v.id}>
                        <div className="pa-variant-header">
                          <span className="pa-variant-title" aria-label={`Variant ${i + 1}`}>
                            Variant {i + 1}
                          </span>
                          <button
                            type="button"
                            className="pa-variant-delete"
                            onClick={() => removeVariant(i)}
                            aria-label={`Delete variant ${i + 1}`}
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>

                        <div className="pa-variant-grid">
                          {/* Name */}
                          <div className="pa-variant-field" style={{ gridColumn: "span 2" }}>
                            <label htmlFor={`v-name-${i}`}>Name *</label>
                            <input
                              id={`v-name-${i}`}
                              placeholder='e.g. "Black 128GB"'
                              value={v.name}
                              aria-required="true"
                              aria-invalid={!!fieldErrors[`v_name_${i}`]}
                              className={fieldErrors[`v_name_${i}`] ? "pa-input--error" : ""}
                              onChange={(e) => updateVariant(i, "name", e.target.value)}
                              onBlur={() => markTouched(`v_name_${i}`)}
                            />
                            {fieldErrors[`v_name_${i}`] && (
                              <span className="pa-field-error" role="alert">
                                {fieldErrors[`v_name_${i}`]}
                              </span>
                            )}
                          </div>

                          {/* SKU */}
                          <div className="pa-variant-field">
                            <label htmlFor={`v-sku-${i}`}>SKU *</label>
                            <input
                              id={`v-sku-${i}`}
                              placeholder="IP13-BLK-128"
                              value={v.sku}
                              aria-required="true"
                              aria-invalid={!!fieldErrors[`v_sku_${i}`]}
                              className={fieldErrors[`v_sku_${i}`] ? "pa-input--error" : ""}
                              onChange={(e) => updateVariant(i, "sku", e.target.value.toUpperCase())}
                              onBlur={() => markTouched(`v_sku_${i}`)}
                            />
                            {fieldErrors[`v_sku_${i}`] && (
                              <span className="pa-field-error" role="alert">
                                {fieldErrors[`v_sku_${i}`]}
                              </span>
                            )}
                          </div>

                          {/* Price */}
                          <div className="pa-variant-field">
                            <label htmlFor={`v-price-${i}`}>Price (₦)</label>
                            <input
                              id={`v-price-${i}`}
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={v.price ? Number(v.price).toLocaleString() : ""}
                              aria-invalid={!!fieldErrors[`v_price_${i}`]}
                              className={fieldErrors[`v_price_${i}`] ? "pa-input--error" : ""}
                              onChange={(e) => updateVariant(i, "price", e.target.value.replace(/\D/g, ""))}
                              onBlur={() => markTouched(`v_price_${i}`)}
                            />
                            {fieldErrors[`v_price_${i}`] && (
                              <span className="pa-field-error" role="alert">
                                {fieldErrors[`v_price_${i}`]}
                              </span>
                            )}
                          </div>

                          {/* Stock */}
                          <div className="pa-variant-field">
                            <label htmlFor={`v-stock-${i}`}>Stock</label>
                            <input
                              id={`v-stock-${i}`}
                              type="number"
                              min="0"
                              value={v.stock}
                              aria-label={`Stock quantity for variant ${i + 1}`}
                              onChange={(e) => updateVariant(i, "stock", e.target.value)}
                            />
                            <span
                              className={`pa-stock-badge ${
                                stock === 0 ? "pa-stock-badge--zero" :
                                stock <= 3  ? "pa-stock-badge--low"  :
                                              "pa-stock-badge--ok"
                              }`}
                              aria-live="polite"
                            >
                              {stock === 0 ? "Out of stock" : stock <= 3 ? `Only ${stock} left` : `${stock} in stock`}
                            </span>
                          </div>
                        </div>

                        <p className="pa-attr-label" aria-hidden="true">Attributes</p>
                        <div className="pa-variant-grid">
                          {["color", "size", "storage", "material"].map((attr) => (
                            <div className="pa-variant-field" key={attr}>
                              <label htmlFor={`v-${attr}-${i}`}>
                                {attr.charAt(0).toUpperCase() + attr.slice(1)}
                              </label>
                              <input
                                id={`v-${attr}-${i}`}
                                placeholder={
                                  attr === "color"    ? "Midnight Black" :
                                  attr === "size"     ? "XL"             :
                                  attr === "storage"  ? "256GB"          : "Cotton"
                                }
                                value={v.attributes[attr] || ""}
                                onChange={(e) => updateVariantAttr(i, attr, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {variants.length < 20 && (
                    <button
                      type="button"
                      className="pa-add-btn pa-add-btn--lg"
                      onClick={addVariant}
                      aria-label="Add another variant"
                    >
                      <FiPlus size={16} aria-hidden="true" /> Add Variant
                    </button>
                  )}
                </section>
              )}

              {/* ───────── STEP 4: PRICING ───────── */}
              {step === 4 && (
                <section aria-label="Pricing">
                  <PricingStep
                    basePrice={basePrice}
                    setBasePrice={setBasePrice}
                    originalPrice={originalPrice}
                    setOriginalPrice={setOriginalPrice}
                    discountPct={discountPct}
                    errors={fieldErrors}
                    touched={touched}
                    onBlur={markTouched}
                  />
                </section>
              )}

              {/* ───────── STEP 5: REVIEW ───────── */}
              {step === 5 && (
                <section aria-label="Review listing">
                  <ReviewStep
                    filledImages={filledImages}
                    title={title}
                    brand={brand}
                    tags={tags}
                    basePrice={basePrice}
                    originalPrice={originalPrice}
                    discountPct={discountPct}
                    description={description}
                    category={category}
                    activeCategory={activeCategory}
                    variants={variants}
                    keyFeatures={keyFeatures}
                    specifications={specifications}
                    whatsInBox={whatsInBox}
                    posting={posting}
                    uploadPct={uploadPct}
                    onSubmit={handleSubmit}
                    lastSaved={lastSaved}
                    prohibitedResult={scanResult}
                    scanDone={scanDone}
                  />
                </section>
              )}
            </main>

            {/* ── Footer nav ── */}
            <div className="pa-footer pa-glass-bar" role="navigation" aria-label="Step navigation">
              {step > 1 ? (
                <button
                  type="button"
                  className="pa-btn-back"
                  onClick={goBack}
                  aria-label="Go to previous step"
                >
                  <FiChevronLeft size={16} aria-hidden="true" /> Back
                </button>
              ) : <div aria-hidden="true" />}

              {step < 5 ? (
                <button
                  type="button"
                  className="pa-btn-next"
                  onClick={goNext}
                  disabled={posting || compressing}
                  aria-label={compressing ? "Compressing image, please wait" : "Go to next step"}
                >
                  {compressing ? "Compressing…" : "Continue"}
                  <FiChevronRight size={16} aria-hidden="true" />
                </button>
              ) : <div aria-hidden="true" />}
            </div>
          </>
        )}

        {/* Matrix Modal */}
        {showMatrix && (
          <MatrixModal
            onGenerate={(newVariants) => setVariants(newVariants)}
            onClose={() => setShowMatrix(false)}
          />
        )}
      </div>
    </>
  );
}