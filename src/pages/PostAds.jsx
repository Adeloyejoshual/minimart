import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import {
  FiChevronLeft, FiChevronRight, FiCheckCircle, FiArrowLeft,
  FiZap, FiTag, FiCamera, FiTrash2, FiAlertCircle,
  FiPackage, FiPlus, FiDollarSign, FiFileText, FiGrid,
} from "react-icons/fi";
import categories from "../config/categories";
import "../styles/PostAds.css";

/* ─── Constants ─── */
const API = "https://minimart-ivrm.onrender.com/api";
const DRAFT_KEY = "post-ad-draft-v5";
const MAX_IMAGES = 6;
const MAX_FILE_MB = 5;
const COMPRESS_TARGET_MB = 0.5;

const STEPS = [
  { id: 1, label: "Photos",   icon: <FiCamera size={15} /> },
  { id: 2, label: "Details",  icon: <FiTag size={15} /> },
  { id: 3, label: "Variants", icon: <FiPackage size={15} /> },
  { id: 4, label: "Pricing",  icon: <FiDollarSign size={15} /> },
  { id: 5, label: "Review",   icon: <FiFileText size={15} /> },
];

const BLANK_VARIANT = () => ({
  id: Date.now() + Math.random(),
  sku: "", name: "", price: "", stock: "1",
  attributes: { color: "", size: "", storage: "", material: "" },
});

const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/* ─── Smart Feature Generator ─── */
function guessFeatures({ title, categoryName, description, specs }) {
  const t = normalize(title).toLowerCase();
  const d = normalize(description).toLowerCase();
  const specPairs = (specs || [])
    .filter((x) => normalize(x.key) && normalize(x.value))
    .map((x) => `${normalize(x.key)}: ${normalize(x.value)}`);
  const features = [];

  if (t.includes("new") || d.includes("brand new")) features.push("Brand new condition");
  if (t.includes("original") || d.includes("original")) features.push("100% original product");
  if (d.includes("warranty")) features.push("Warranty included");
  if (d.includes("delivery") || d.includes("shipping")) features.push("Fast delivery available");
  if (d.includes("negotiable")) features.push("Price negotiable");

  if (/(iphone|samsung|tecno|infinix|xiaomi|pixel|redmi|oppo|vivo)/i.test(t)) {
    features.push("Fast performance for daily use");
    if (/(128|256|512)\s?gb/i.test(t)) features.push("Large storage capacity");
    if (d.includes("battery") || d.includes("mah")) features.push("Long-lasting battery life");
    if (d.includes("camera")) features.push("High-quality camera system");
  }

  if (/(laptop|macbook|hp|dell|lenovo|asus|acer|thinkpad)/i.test(t)) {
    features.push("Smooth multitasking for work & school");
    if (d.includes("ssd") || specPairs.join(" ").includes("ssd")) features.push("Fast SSD storage");
    if (d.includes("ram") || /(8|16|32)\s?gb\s?ram/i.test(t)) features.push("Powerful RAM for heavy tasks");
  }

  if (/(nike|adidas|puma|gucci|zara|h&m)/i.test(t)) {
    features.push("Premium brand quality");
    features.push("Stylish and trendy design");
  }

  if (categoryName) features.push(`Great for ${categoryName.toLowerCase()} shoppers`);

  specPairs.slice(0, 5).forEach((s) => features.push(s));

  return uniq(features).filter((x) => x.length >= 6 && x.length <= 60).slice(0, 10);
}

/* ─── Variant Matrix Generator ─── */
function generateVariantMatrix(colors, sizes, storages) {
  const c = colors.filter(Boolean);
  const s = sizes.filter(Boolean);
  const st = storages.filter(Boolean);

  if (!c.length && !s.length && !st.length) return [];

  const combos = [];
  const colorList = c.length ? c : [""];
  const sizeList = s.length ? s : [""];
  const storageList = st.length ? st : [""];

  let idx = 1;
  for (const color of colorList) {
    for (const size of sizeList) {
      for (const storage of storageList) {
        const parts = [color, size, storage].filter(Boolean);
        const name = parts.join(" / ") || `Variant ${idx}`;
        const sku = parts.map((p) => p.replace(/\s+/g, "").toUpperCase().slice(0, 6)).join("-") || `VAR-${idx}`;
        combos.push({
          id: Date.now() + Math.random() + idx,
          sku, name, price: "", stock: "1",
          attributes: { color, size, storage, material: "" },
        });
        idx++;
      }
    }
  }
  return combos;
}

/* ─── Image Compression ─── */
async function compressImage(file) {
  if (file.size <= COMPRESS_TARGET_MB * 1024 * 1024) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: COMPRESS_TARGET_MB,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    return file;
  }
}

/* ═══════════════════════════════════════════════════════════
   STEP BAR (inline — no sub-component needed)
═══════════════════════════════════════════════════════════ */
function StepBar({ current }) {
  return (
    <div className="pa-stepbar">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={`pa-step ${current === s.id ? "pa-step--active" : ""} ${current > s.id ? "pa-step--done" : ""}`}>
            <div className="pa-step-dot">
              {current > s.id ? <FiCheckCircle size={14} /> : s.icon}
            </div>
            <span className="pa-step-label">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`pa-step-line ${current > s.id ? "pa-step-line--done" : ""}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   IMAGE SLOT (with drag/drop + reorder)
═══════════════════════════════════════════════════════════ */
function ImageSlot({ img, index, isPrimary, onAdd, onRemove, onDragStart, onDragOver, onDrop }) {
  const ref = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onAdd(index, file);
  };

  return (
    <div
      className={`pa-img-slot ${isPrimary ? "pa-img-slot--primary" : ""} ${dragOver ? "pa-img-slot--dragover" : ""}`}
      draggable={!!img}
      onDragStart={(e) => img && onDragStart?.(e, index)}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); onDragOver?.(e, index); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { if (e.dataTransfer?.files?.length) handleFileDrop(e); else { setDragOver(false); onDrop?.(e, index); } }}
    >
      {img ? (
        <>
          <img src={img.preview} alt={`Photo ${index + 1}`} className="pa-img-preview" draggable={false} />
          {isPrimary && <span className="pa-img-cover-tag">Cover</span>}
          {img.compressed && <span className="pa-img-compressed-tag">Compressed</span>}
          <button type="button" className="pa-img-remove" onClick={() => onRemove(index)} aria-label="Remove image">
            <FiTrash2 size={13} />
          </button>
          <span className="pa-img-order">{index + 1}</span>
        </>
      ) : (
        <button type="button" className="pa-img-add" onClick={() => ref.current?.click()}>
          <FiCamera size={isPrimary ? 28 : 20} />
          {isPrimary ? <span>Add Cover Photo</span> : <span>Add</span>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onAdd(index, e.target.files[0])} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   VARIANT MATRIX MODAL
═══════════════════════════════════════════════════════════ */
function MatrixModal({ onGenerate, onClose }) {
  const [colors, setColors] = useState(["", ""]);
  const [sizes, setSizes] = useState(["", ""]);
  const [storages, setStorages] = useState([""]);

  const updateArr = (setter, i, val) => setter((p) => p.map((x, idx) => (idx === i ? val : x)));
  const addArr = (setter, max) => setter((p) => (p.length < max ? [...p, ""] : p));
  const removeArr = (setter, i) => setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const count = useMemo(() => {
    const c = colors.filter(Boolean).length || 1;
    const s = sizes.filter(Boolean).length || 1;
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

  const renderRow = (label, arr, setter, max) => (
    <div className="pa-matrix-section">
      <label className="pa-label">{label}</label>
      {arr.map((val, i) => (
        <div key={i} className="pa-matrix-row">
          <input className="pa-mini-input" value={val} placeholder={`e.g. ${label === "Colors" ? "Black" : label === "Sizes" ? "XL" : "256GB"}`}
            onChange={(e) => updateArr(setter, i, e.target.value)} />
          <button type="button" className="pa-mini-btn" onClick={() => removeArr(setter, i)}>−</button>
        </div>
      ))}
      <button type="button" className="pa-add-btn pa-add-btn--sm" onClick={() => addArr(setter, max)}>+ Add</button>
    </div>
  );

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h3><FiGrid size={18} /> Variant Matrix Generator</h3>
          <button type="button" onClick={onClose} className="pa-modal-close">✕</button>
        </div>
        <div className="pa-modal-body">
          <p className="pa-section-sub">Enter attribute values. We'll generate all combinations automatically.</p>
          {renderRow("Colors", colors, setColors, 8)}
          {renderRow("Sizes", sizes, setSizes, 8)}
          {renderRow("Storages", storages, setStorages, 6)}
          <div className="pa-matrix-preview">
            <FiPackage size={16} />
            <strong>{count}</strong> variant{count !== 1 ? "s" : ""} will be generated
          </div>
        </div>
        <div className="pa-modal-footer">
          <button type="button" className="pa-btn-back" onClick={onClose}>Cancel</button>
          <button type="button" className="pa-btn-generate" onClick={handleGen}>
            <FiZap size={16} /> Generate {count} Variant{count !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function PostAds({ user }) {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  /* Images */
  const [images, setImages] = useState(Array(MAX_IMAGES).fill(null));
  const [compressing, setCompressing] = useState(false);

  /* Step 2 */
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [keyFeatures, setKeyFeatures] = useState([""]);
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [whatsInBox, setWhatsInBox] = useState([""]);

  /* Step 3 */
  const [variants, setVariants] = useState([BLANK_VARIANT()]);
  const [showMatrix, setShowMatrix] = useState(false);

  /* Step 4 */
  const [basePrice, setBasePrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  /* Validation */
  const [touched, setTouched] = useState({});
  const [attemptedNext, setAttemptedNext] = useState(false);

  /* Drag state */
  const dragIdx = useRef(null);

  const filledImages = useMemo(() => images.filter(Boolean), [images]);
  const activeCategory = useMemo(() => categories.find((c) => c.id === category), [category]);

  /* ── Cleanup ── */
  useEffect(() => {
    return () => images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load draft ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.step) setStep(d.step);
      if (d.title) setTitle(d.title);
      if (d.brand) setBrand(d.brand);
      if (Array.isArray(d.tags)) setTags(d.tags);
      if (d.description) setDescription(d.description);
      if (d.category) setCategory(d.category);
      if (d.keyFeatures?.length) setKeyFeatures(d.keyFeatures);
      if (d.specifications?.length) setSpecifications(d.specifications);
      if (d.whatsInBox?.length) setWhatsInBox(d.whatsInBox);
      if (d.variants?.length) setVariants(d.variants);
      if (d.basePrice) setBasePrice(d.basePrice);
      if (d.originalPrice) setOriginalPrice(d.originalPrice);
    } catch {}
  }, []);

  /* ── Auto-save draft ── */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, title, brand, tags, description, category,
      keyFeatures, specifications, whatsInBox, variants,
      basePrice, originalPrice,
    }));
  }, [step, title, brand, tags, description, category, keyFeatures, specifications, whatsInBox, variants, basePrice, originalPrice]);

  /* ── Image handlers ── */
  const handleAddImage = useCallback(async (index, file) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Max ${MAX_FILE_MB}MB per image`); return; }

    setCompressing(true);
    const compressed = await compressImage(file);
    const preview = URL.createObjectURL(compressed);
    const wasCompressed = compressed.size < file.size;

    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = { file: compressed, preview, compressed: wasCompressed };
      return next;
    });
    setCompressing(false);

    if (wasCompressed) {
      const saved = ((file.size - compressed.size) / 1024).toFixed(0);
      toast.success(`Compressed — saved ${saved}KB`);
    }
  }, []);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = null;
      return next;
    });
  }, []);

  /* ── Drag reorder ── */
  const handleDragStart = (e, idx) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === targetIdx) return;
    setImages((prev) => {
      const next = [...prev];
      const temp = next[from];
      next[from] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
    dragIdx.current = null;
    toast.success("Image reordered");
  };

  /* ── List helpers ── */
  const updateList = (setter, i, val) => setter((p) => p.map((x, idx) => (idx === i ? val : x)));
  const addList = (setter, list, limit) => { if (list.length < limit) setter((p) => [...p, ""]); };
  const removeList = (setter, i) => setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  /* ── Variant helpers ── */
  const updateVariant = (i, field, val) => setVariants((p) => p.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)));
  const updateVariantAttr = (i, attr, val) => setVariants((p) => p.map((v, idx) => idx === i ? { ...v, attributes: { ...v.attributes, [attr]: val } } : v));
  const addVariant = () => setVariants((p) => [...p, BLANK_VARIANT()]);
  const removeVariant = (i) => setVariants((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  /* ── Tags ── */
  const commitTag = () => {
    const t = normalize(tagInput).toLowerCase();
    if (!t || t.length > 24) return;
    if (tags.includes(t)) { setTagInput(""); return; }
    if (tags.length >= 8) { toast.error("Max 8 tags"); return; }
    setTags((p) => [...p, t]);
    setTagInput("");
  };
  const removeTag = (t) => setTags((p) => p.filter((x) => x !== t));

  /* ── Smart generator ── */
  const generateKeyFeatures = () => {
    const gen = guessFeatures({ title, categoryName: activeCategory?.name, description, specs: specifications });
    if (!gen.length) { toast.error("Add title/description first"); return; }
    const existing = keyFeatures.map(normalize).filter(Boolean);
    setKeyFeatures(uniq([...existing, ...gen]).slice(0, 10) || [""]);
    toast.success(`${gen.length} features generated`);
    if (window.navigator?.vibrate) window.navigator.vibrate(15);
  };

  /* ── Field-level validation ── */
  const fieldErrors = useMemo(() => {
    const e = {};

    // Step 1
    if (filledImages.length === 0) e.images = "Add at least 1 photo";

    // Step 2
    if (touched.title && title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (touched.title && title.trim().length > 80) e.title = "Title too long";
    if (touched.category && !category) e.category = "Select a category";

    // Step 3
    variants.forEach((v, i) => {
      if (touched[`v_sku_${i}`] && !v.sku.trim()) e[`v_sku_${i}`] = "Required";
      if (touched[`v_name_${i}`] && !v.name.trim()) e[`v_name_${i}`] = "Required";
      if (touched[`v_price_${i}`] && (isNaN(Number(v.price)) || Number(v.price) < 0)) e[`v_price_${i}`] = "Invalid";
    });

    // Step 4
    if (touched.basePrice) {
      const n = Number(basePrice);
      if (!basePrice || isNaN(n) || n <= 0) e.basePrice = "Enter a valid price";
    }
    if (touched.originalPrice && originalPrice) {
      if (Number(originalPrice) <= Number(basePrice)) e.originalPrice = "Should be higher than base price";
    }

    return e;
  }, [touched, title, category, filledImages.length, variants, basePrice, originalPrice]);

  const markTouched = (field) => setTouched((p) => ({ ...p, [field]: true }));

  /* ── Step-level validation ── */
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
    if (step === 2 && title.trim().length < 3) return "Title needs at least 3 characters";
    if (step === 2 && !category) return "Pick a category";
    if (step === 3 && !variants.every((v) => v.sku.trim() && v.name.trim())) return "Fill in SKU and name for each variant";
    if (step === 4 && (!basePrice || Number(basePrice) <= 0)) return "Set a valid base price";
    return "";
  }, [step, filledImages.length, title, category, variants, basePrice]);

  const discountPct = originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
    ? Math.round(((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100) : 0;

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!user) { toast.error("Please log in first"); return; }
    if (!filledImages.length) { toast.error("Add at least one photo"); return; }

    setPosting(true);
    setUploadPct(0);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("marketplace_token") || localStorage.getItem("seller_token");
      const fd = new FormData();

      fd.append("name", title.trim());
      fd.append("description", description.trim());
      fd.append("category", category);
      fd.append("basePrice", basePrice);
      if (originalPrice) fd.append("originalPrice", originalPrice);
      if (brand.trim()) fd.append("brand", brand.trim());
      if (tags.length) fd.append("tags", JSON.stringify(tags));

      fd.append("variants", JSON.stringify(variants.filter((v) => v.sku.trim() && v.name.trim())));
      fd.append("keyFeatures", JSON.stringify(keyFeatures.map(normalize).filter(Boolean)));
      fd.append("specifications", JSON.stringify(specifications.filter((s) => normalize(s.key) && normalize(s.value))));
      fd.append("whatsInBox", JSON.stringify(whatsInBox.map(normalize).filter(Boolean)));

      images.forEach((img) => { if (img?.file) fd.append("images", img.file); });

      await axios.post(`${API}/products`, fd, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined, "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => { if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100)); },
      });

      localStorage.removeItem(DRAFT_KEY);
      setPosted(true);
      toast.success("Ad posted!");
      if (window.navigator?.vibrate) window.navigator.vibrate([50, 30, 80]);
    } catch (err) {
      if (!err.response) toast.error("Network error.");
      else if (err.response.status === 401) toast.error("Session expired.");
      else if (err.response.status === 413) toast.error("Images too large.");
      else toast.error(err.response.data?.message || "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  const goNext = () => {
    setAttemptedNext(true);
    if (!stepValid) return;
    setAttemptedNext(false);
    setStep((s) => Math.min(5, s + 1));
    if (window.navigator?.vibrate) window.navigator.vibrate(12);
  };

  const goBack = () => { setAttemptedNext(false); setStep((s) => Math.max(1, s - 1)); };

  /* ═══ RENDER ═══ */
  return (
    <div className="pa-page pa-glass">

      {/* Topbar */}
      <div className="pa-topbar pa-glass-bar">
        <button type="button" className="pa-topbar-back" onClick={() => navigate(-1)} aria-label="Go back">
          <FiArrowLeft size={18} />
        </button>
        <div className="pa-topbar-center">
          <h1 className="pa-topbar-title">Post an Ad</h1>
          <p className="pa-topbar-sub">Step {step}/5{activeCategory ? ` · ${activeCategory.icon} ${activeCategory.name}` : ""}</p>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {posted ? (
        <div className="pa-success">
          <div className="pa-success-icon"><FiCheckCircle size={42} /></div>
          <h2>Ad Posted! 🎉</h2>
          <p>Your listing is now live. Buyers can see it right away.</p>
          <div className="pa-success-btns">
            <button type="button" className="pa-success-primary" onClick={() => navigate("/minimart")}>Browse Minimart</button>
            <button type="button" className="pa-success-secondary" onClick={() => navigate("/dashboard")}>View My Listings</button>
          </div>
        </div>
      ) : (
        <>
          <StepBar current={step} />

          <div className="pa-body">

            {/* Inline error */}
            {attemptedNext && stepError && (
              <div className="pa-inline-error" role="alert">
                <FiAlertCircle size={16} /> {stepError}
              </div>
            )}

            {/* ═══ STEP 1: PHOTOS ═══ */}
            {step === 1 && (
              <>
                <p className="pa-section-title">📷 Add Photos</p>
                <p className="pa-section-sub">First photo = cover. Drag to reorder. Drop files anywhere.</p>

                {compressing && (
                  <div className="pa-compressing">
                    <div className="pa-spinner-sm" /> Compressing image…
                  </div>
                )}

                <div className="pa-img-grid">
                  {images.map((img, i) => (
                    <ImageSlot key={i} img={img} index={i} isPrimary={i === 0}
                      onAdd={handleAddImage} onRemove={handleRemoveImage}
                      onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} />
                  ))}
                </div>

                <div className="pa-img-tip">
                  <FiAlertCircle size={14} />
                  <div>Max {MAX_IMAGES} photos · {MAX_FILE_MB}MB each · Auto-compressed to {COMPRESS_TARGET_MB}MB<br />Drag images to reorder. First image is the cover.</div>
                </div>

                {filledImages.length > 0 && (
                  <div className="pa-img-stats">
                    {filledImages.length} / {MAX_IMAGES} photos · {(filledImages.reduce((s, i) => s + (i?.file?.size || 0), 0) / 1024 / 1024).toFixed(1)}MB total
                  </div>
                )}
              </>
            )}

            {/* ═══ STEP 2: DETAILS ═══ */}
            {step === 2 && (
              <>
                <div className="pa-section-head">
                  <div>
                    <p className="pa-section-title">📝 Product Details</p>
                    <p className="pa-section-sub">Clear titles rank higher.</p>
                  </div>
                  <button type="button" className="pa-gen-btn" onClick={generateKeyFeatures}>
                    <FiZap size={15} /> Auto-Generate
                  </button>
                </div>

                {/* Title */}
                <div className="pa-field">
                  <label className="pa-label">Title *</label>
                  <input type="text" className={`pa-input ${fieldErrors.title ? "pa-input--error" : ""}`}
                    placeholder='e.g. "iPhone 13 Pro Max 256GB"' value={title} maxLength={80}
                    onChange={(e) => setTitle(e.target.value)} onBlur={() => markTouched("title")} />
                  <div className="pa-field-footer">
                    {fieldErrors.title && <span className="pa-field-error">{fieldErrors.title}</span>}
                    <span className={`pa-char-count ${title.length > 70 ? "pa-char-count--warn" : ""}`}>{title.length}/80</span>
                  </div>
                </div>

                {/* Brand + Tags row */}
                <div className="pa-grid-2">
                  <div className="pa-field">
                    <label className="pa-label">Brand</label>
                    <input type="text" className="pa-input" placeholder='e.g. "Apple"' value={brand} maxLength={40}
                      onChange={(e) => setBrand(e.target.value)} />
                  </div>
                  <div className="pa-field">
                    <label className="pa-label">Tags</label>
                    <div className="pa-tag-input">
                      <FiTag size={14} />
                      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); }
                          if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
                        }}
                        placeholder="press Enter to add" />
                    </div>
                    {tags.length > 0 && (
                      <div className="pa-tags">
                        {tags.map((t) => (
                          <button key={t} type="button" className="pa-tag" onClick={() => removeTag(t)}>
                            {t} <span>×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="pa-field">
                  <label className="pa-label">Description</label>
                  <textarea className="pa-textarea" placeholder="Describe your product…" value={description} maxLength={700}
                    onChange={(e) => setDescription(e.target.value)} />
                  <span className={`pa-char-count ${description.length > 640 ? "pa-char-count--warn" : ""}`}>{description.length}/700</span>
                </div>

                {/* Key Features */}
                <div className="pa-field">
                  <label className="pa-label">Key Features</label>
                  <div className="pa-list-wrap">
                    {keyFeatures.map((item, i) => (
                      <div className="pa-list-row" key={i}>
                        <input className="pa-mini-input" value={item} placeholder='e.g. "5000mAh battery"'
                          onChange={(e) => updateList(setKeyFeatures, i, e.target.value)} />
                        <button type="button" className="pa-mini-btn" onClick={() => removeList(setKeyFeatures, i)}>−</button>
                      </div>
                    ))}
                    <button type="button" className="pa-add-btn" onClick={() => addList(setKeyFeatures, keyFeatures, 10)}>+ Add Feature</button>
                  </div>
                </div>

                {/* Specs */}
                <div className="pa-field">
                  <label className="pa-label">Specifications</label>
                  <div className="pa-list-wrap">
                    {specifications.map((row, i) => (
                      <div className="pa-list-row" key={i}>
                        <div className="pa-spec-grid">
                          <input className="pa-mini-input" value={row.key} placeholder="e.g. RAM"
                            onChange={(e) => { const n = [...specifications]; n[i] = { ...n[i], key: e.target.value }; setSpecifications(n); }} />
                          <input className="pa-mini-input" value={row.value} placeholder="e.g. 8GB"
                            onChange={(e) => { const n = [...specifications]; n[i] = { ...n[i], value: e.target.value }; setSpecifications(n); }} />
                        </div>
                        <button type="button" className="pa-mini-btn" onClick={() => removeList(setSpecifications, i)}>−</button>
                      </div>
                    ))}
                    <button type="button" className="pa-add-btn"
                      onClick={() => setSpecifications((p) => (p.length >= 12 ? p : [...p, { key: "", value: "" }]))}>+ Add Spec</button>
                  </div>
                </div>

                {/* Box */}
                <div className="pa-field">
                  <label className="pa-label">What's in the Box</label>
                  <div className="pa-list-wrap">
                    {whatsInBox.map((item, i) => (
                      <div className="pa-list-row" key={i}>
                        <input className="pa-mini-input" value={item} placeholder='e.g. "1× Charging Cable"'
                          onChange={(e) => updateList(setWhatsInBox, i, e.target.value)} />
                        <button type="button" className="pa-mini-btn" onClick={() => removeList(setWhatsInBox, i)}>−</button>
                      </div>
                    ))}
                    <button type="button" className="pa-add-btn" onClick={() => addList(setWhatsInBox, whatsInBox, 12)}>+ Add Item</button>
                  </div>
                </div>

                {/* Category */}
                <div className="pa-field">
                  <label className="pa-label">Category *</label>
                  {fieldErrors.category && <span className="pa-field-error">{fieldErrors.category}</span>}
                  <div className="pa-cat-grid">
                    {categories.map((c) => (
                      <button key={c.id} type="button"
                        className={`pa-cat-btn ${category === c.id ? "pa-cat-btn--active" : ""}`}
                        onClick={() => { setCategory(c.id); markTouched("category"); }}>
                        <span className="pa-cat-icon">{c.icon}</span>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ═══ STEP 3: VARIANTS ═══ */}
            {step === 3 && (
              <>
                <div className="pa-section-head">
                  <div>
                    <p className="pa-section-title">📦 Product Variants</p>
                    <p className="pa-section-sub">Each variant = unique SKU.</p>
                  </div>
                  <button type="button" className="pa-gen-btn" onClick={() => setShowMatrix(true)}>
                    <FiGrid size={15} /> Matrix Generator
                  </button>
                </div>

                {variants.map((v, i) => {
                  const stock = parseInt(v.stock, 10) || 0;
                  return (
                    <div className="pa-variant-card" key={v.id}>
                      <div className="pa-variant-header">
                        <span className="pa-variant-title">Variant {i + 1}</span>
                        <button type="button" className="pa-variant-delete" onClick={() => removeVariant(i)}>
                          <FiTrash2 size={13} />
                        </button>
                      </div>

                      <div className="pa-variant-grid">
                        <div className="pa-variant-field" style={{ gridColumn: "span 2" }}>
                          <label>Name *</label>
                          <input placeholder='e.g. "Black 128GB"' value={v.name}
                            onChange={(e) => updateVariant(i, "name", e.target.value)}
                            onBlur={() => markTouched(`v_name_${i}`)}
                            className={fieldErrors[`v_name_${i}`] ? "pa-input--error" : ""} />
                          {fieldErrors[`v_name_${i}`] && <span className="pa-field-error">{fieldErrors[`v_name_${i}`]}</span>}
                        </div>
                        <div className="pa-variant-field">
                          <label>SKU *</label>
                          <input placeholder="IP13-BLK-128" value={v.sku}
                            onChange={(e) => updateVariant(i, "sku", e.target.value.toUpperCase())}
                            onBlur={() => markTouched(`v_sku_${i}`)}
                            className={fieldErrors[`v_sku_${i}`] ? "pa-input--error" : ""} />
                          {fieldErrors[`v_sku_${i}`] && <span className="pa-field-error">{fieldErrors[`v_sku_${i}`]}</span>}
                        </div>
                        <div className="pa-variant-field">
                          <label>Price (₦)</label>
                          <input type="text" inputMode="numeric" placeholder="0"
                            value={v.price ? Number(v.price).toLocaleString() : ""}
                            onChange={(e) => updateVariant(i, "price", e.target.value.replace(/\D/g, ""))}
                            onBlur={() => markTouched(`v_price_${i}`)}
                            className={fieldErrors[`v_price_${i}`] ? "pa-input--error" : ""} />
                          {fieldErrors[`v_price_${i}`] && <span className="pa-field-error">{fieldErrors[`v_price_${i}`]}</span>}
                        </div>
                        <div className="pa-variant-field">
                          <label>Stock</label>
                          <input type="number" min="0" value={v.stock}
                            onChange={(e) => updateVariant(i, "stock", e.target.value)} />
                          <span className={`pa-stock-badge ${stock === 0 ? "pa-stock-badge--zero" : stock <= 3 ? "pa-stock-badge--low" : "pa-stock-badge--ok"}`}>
                            {stock === 0 ? "Out of stock" : stock <= 3 ? `Only ${stock} left` : `${stock} in stock`}
                          </span>
                        </div>
                      </div>

                      <p className="pa-attr-label">Attributes</p>
                      <div className="pa-variant-grid">
                        {["color", "size", "storage", "material"].map((attr) => (
                          <div className="pa-variant-field" key={attr}>
                            <label>{attr.charAt(0).toUpperCase() + attr.slice(1)}</label>
                            <input placeholder={attr === "color" ? "Midnight Black" : attr === "size" ? "XL" : attr === "storage" ? "256GB" : "Cotton"}
                              value={v.attributes[attr] || ""}
                              onChange={(e) => updateVariantAttr(i, attr, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {variants.length < 20 && (
                  <button type="button" className="pa-add-btn pa-add-btn--lg" onClick={addVariant}>
                    <FiPlus size={16} /> Add Variant
                  </button>
                )}
              </>
            )}

            {/* ═══ STEP 4: PRICING ═══ */}
            {step === 4 && (
              <>
                <p className="pa-section-title">💰 Pricing</p>
                <p className="pa-section-sub">Set the base price. Variants can override it.</p>

                <div className="pa-delivery-note">
                  🚚 <strong>Delivery handled at checkout</strong> — buyers choose their method when ordering.
                </div>

                <div className="pa-field">
                  <label className="pa-label">Base Price (₦) *</label>
                  <div className="pa-price-wrap">
                    <span className="pa-price-symbol">₦</span>
                    <input className={`pa-price-input ${fieldErrors.basePrice ? "pa-input--error" : ""}`}
                      type="text" inputMode="numeric" placeholder="0"
                      value={basePrice ? Number(basePrice).toLocaleString() : ""}
                      onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ""))}
                      onBlur={() => markTouched("basePrice")} />
                  </div>
                  {fieldErrors.basePrice && <span className="pa-field-error">{fieldErrors.basePrice}</span>}
                </div>

                <div className="pa-field">
                  <label className="pa-label">Original Price (₦) — optional</label>
                  <div className="pa-price-wrap">
                    <span className="pa-price-symbol" style={{ color: "#bbb" }}>₦</span>
                    <input className={`pa-price-input pa-price-input--sm ${fieldErrors.originalPrice ? "pa-input--error" : ""}`}
                      type="text" inputMode="numeric" placeholder="0"
                      value={originalPrice ? Number(originalPrice).toLocaleString() : ""}
                      onChange={(e) => setOriginalPrice(e.target.value.replace(/\D/g, ""))}
                      onBlur={() => markTouched("originalPrice")} />
                  </div>
                  {fieldErrors.originalPrice && <span className="pa-field-error">{fieldErrors.originalPrice}</span>}
                  {discountPct > 0 && (
                    <p className="pa-discount-info">
                      🏷️ Buyer saves ₦{(Number(originalPrice) - Number(basePrice)).toLocaleString()}
                      <span className="pa-discount-badge">-{discountPct}%</span>
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ═══ STEP 5: REVIEW ═══ */}
            {step === 5 && (
              <>
                <p className="pa-section-title">🔍 Review Your Ad</p>
                <p className="pa-section-sub">Everything looks good? Hit Post to go live.</p>

                {posting && (
                  <div className="pa-upload">
                    <div className="pa-upload-row"><span>Uploading…</span><strong>{uploadPct}%</strong></div>
                    <div className="pa-upload-bar"><div className="pa-upload-fill" style={{ width: `${uploadPct}%` }} /></div>
                  </div>
                )}

                {/* Review card */}
                <div className="pa-review-card">
                  <div className="pa-review-img">
                    {filledImages[0] ? <img src={filledImages[0].preview} alt="cover" /> : <FiPackage size={40} />}
                  </div>
                  <div className="pa-review-body">
                    <div className="pa-review-title">{title || "—"}</div>
                    {brand && <div className="pa-review-brand">{brand}</div>}

                    <div className="pa-review-price-row">
                      <span className="pa-review-price">₦{Number(basePrice || 0).toLocaleString()}</span>
                      {originalPrice && <span className="pa-review-original">₦{Number(originalPrice).toLocaleString()}</span>}
                      {discountPct > 0 && <span className="pa-discount-badge">-{discountPct}%</span>}
                    </div>

                    {description && <p className="pa-review-desc">{description.slice(0, 150)}{description.length > 150 ? "…" : ""}</p>}

                    <div className="pa-review-pills">
                      {activeCategory && <span className="pa-review-pill pa-review-pill--cat">{activeCategory.icon} {activeCategory.name}</span>}
                      <span className="pa-review-pill">{filledImages.length} photo{filledImages.length !== 1 ? "s" : ""}</span>
                      <span className="pa-review-pill">{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
                      {tags.length > 0 && <span className="pa-review-pill">🏷️ {tags.length} tag{tags.length !== 1 ? "s" : ""}</span>}
                    </div>

                    {/* Variants */}
                    {variants.filter((v) => v.sku && v.name).length > 0 && (
                      <div className="pa-review-section">
                        <h5>Variants</h5>
                        <div className="pa-variant-review-list">
                          {variants.filter((v) => v.sku && v.name).map((v) => (
                            <div className="pa-variant-review-item" key={v.id}>
                              <span className="pa-variant-review-name">{v.name}</span>
                              <div className="pa-variant-review-right">
                                <span className="pa-variant-review-price">₦{Number(v.price || 0).toLocaleString()}</span>
                                <span className="pa-variant-review-stock">· {v.stock} in stock</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {keyFeatures.some((f) => f.trim()) && (
                      <div className="pa-review-section">
                        <h5>Key Features</h5>
                        <ul>{keyFeatures.filter((f) => f.trim()).map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                    )}

                    {specifications.some((r) => r.key.trim() && r.value.trim()) && (
                      <div className="pa-review-section">
                        <h5>Specifications</h5>
                        <table className="pa-spec-table"><tbody>
                          {specifications.filter((r) => r.key.trim() && r.value.trim()).map((r, i) => (
                            <tr key={i}><td>{r.key}</td><td>{r.value}</td></tr>
                          ))}
                        </tbody></table>
                      </div>
                    )}

                    {whatsInBox.some((f) => f.trim()) && (
                      <div className="pa-review-section">
                        <h5>What's in the Box</h5>
                        <ul>{whatsInBox.filter((f) => f.trim()).map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                    )}

                    {tags.length > 0 && (
                      <div className="pa-review-section">
                        <h5>Tags</h5>
                        <div className="pa-tags">{tags.map((t) => <span key={t} className="pa-tag">{t}</span>)}</div>
                      </div>
                    )}
                  </div>
                </div>

                <button className="pa-submit-btn" disabled={posting || !stepValid} onClick={handleSubmit}>
                  {posting ? <><span className="pa-spinner" />Posting… {uploadPct}%</> : "🚀 Post Ad Now"}
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="pa-footer pa-glass-bar">
            {step > 1 ? (
              <button type="button" className="pa-btn-back" onClick={goBack}><FiChevronLeft size={16} /> Back</button>
            ) : <div />}
            {step < 5 ? (
              <button type="button" className="pa-btn-next" onClick={goNext} disabled={posting || compressing}>
                {compressing ? "Compressing…" : "Continue"} <FiChevronRight size={16} />
              </button>
            ) : <div />}
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
  );
}