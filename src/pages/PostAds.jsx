import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiX, FiChevronLeft, FiChevronRight, FiCamera,
  FiTag, FiDollarSign, FiFileText, FiCheckCircle,
  FiTrash2, FiAlertCircle, FiPackage, FiPlus, FiClock,
} from "react-icons/fi";
import categories from "../config/categories";
import "../styles/PostAds.css";

const API       = "https://minimart-ivrm.onrender.com/api";
const DRAFT_KEY = "post-ad-draft-v3";

const STEPS = [
  { id: 1, label: "Photos",   icon: <FiCamera size={16} /> },
  { id: 2, label: "Details",  icon: <FiTag size={16} /> },
  { id: 3, label: "Variants", icon: <FiPackage size={16} /> },
  { id: 4, label: "Pricing",  icon: <FiDollarSign size={16} /> },
  { id: 5, label: "Review",   icon: <FiFileText size={16} /> },
];

const BLANK_VARIANT = () => ({
  id: Date.now(),
  sku: "", name: "", price: "", stock: "1",
  attributes: { color: "", size: "", storage: "", material: "" },
});

/* ─────────────────── Image compression ─────────────────── */
function compressImage(file, { maxWidth = 1200, quality = 0.75, maxBytes = 3 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`Image must be under ${maxBytes / 1024 / 1024} MB`));
      return;
    }
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width  = maxWidth;
      }
      const canvas  = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          resolve(new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".webp"),
            { type: "image/webp", lastModified: Date.now() }
          ));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("Failed to load image")); };
    img.src = objUrl;
  });
}

/* ─────────────────── Step bar ─────────────────── */
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

/* ─────────────────── Image slot ─────────────────── */
function ImageSlot({ preview, compressing, onAdd, onRemove, index, isPrimary }) {
  const ref = useRef();
  return (
    <div className={`pa-img-slot ${isPrimary ? "pa-img-slot--primary" : ""}`}>
      {compressing ? (
        <div className="pa-img-compressing">
          <div className="pa-img-compress-spinner" />
          <span>Optimising…</span>
        </div>
      ) : preview ? (
        <>
          <img src={preview} alt="preview" className="pa-img-preview" />
          {isPrimary && <span className="pa-img-cover-tag">Cover</span>}
          <button type="button" className="pa-img-remove" onClick={() => onRemove(index)}>
            <FiTrash2 size={13} />
          </button>
        </>
      ) : (
        <button type="button" className="pa-img-add" onClick={() => ref.current.click()}>
          <FiCamera size={isPrimary ? 28 : 20} />
          {isPrimary && <span>Add Cover Photo</span>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onAdd(index, e.target.files[0])} />
    </div>
  );
}

/* ─────────────────── Pending success screen ─────────────────── */
function PendingSuccess({ onClose, navigate }) {
  return (
    <div className="pa-success">
      {/* Amber clock icon instead of green checkmark */}
      <div className="pa-success-icon pa-success-icon--pending">
        <FiClock size={36} />
      </div>

      <h2>Ad Submitted! ⏳</h2>
      <p>Your listing is under review. We'll notify you once it's approved.</p>

      {/* Review pipeline steps */}
      <div className="pa-pending-steps">
        <div className="pa-pending-step">
          <div className="pa-pending-step-dot pa-pending-step-dot--done">✓</div>
          <div className="pa-pending-step-text">
            <strong>Submitted</strong>
            <span>Your ad has been received</span>
          </div>
        </div>
        <div className="pa-pending-step">
          <div className="pa-pending-step-dot pa-pending-step-dot--current">2</div>
          <div className="pa-pending-step-text">
            <strong>Under Review</strong>
            <span>Admin is checking your listing — usually within 24 h</span>
          </div>
        </div>
        <div className="pa-pending-step">
          <div className="pa-pending-step-dot pa-pending-step-dot--next">3</div>
          <div className="pa-pending-step-text">
            <strong>Goes Live</strong>
            <span>Buyers can see and purchase your item</span>
          </div>
        </div>
      </div>

      {/* What to expect tip */}
      <div className="pa-moderation-tip">
        <span className="pa-moderation-tip-icon">💡</span>
        <span>
          <strong>What to expect:</strong> If approved, your ad goes live automatically.
          If rejected, you'll see the reason in <em>My Listings</em> and can edit and resubmit.
        </span>
      </div>

      <div className="pa-success-btns">
        <button
          type="button"
          className="pa-success-primary"
          onClick={() => navigate("/dashboard")}
        >
          View My Listings
        </button>
        <button
          type="button"
          className="pa-success-secondary"
          onClick={() => onClose?.()}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function PostAds({ user, onClose }) {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(1);
  const [posting, setPosting] = useState(false);

  /*
   * posted: false | "pending" | "approved"
   * We keep "approved" path in case your backend ever fast-tracks
   * trusted sellers, but today it will always be "pending".
   */
  const [posted, setPosted] = useState(false);

  const TOTAL_SLOTS = 6;
  const [images,      setImages]      = useState(Array(TOTAL_SLOTS).fill(null));
  const [compressing, setCompressing] = useState(Array(TOTAL_SLOTS).fill(false));

  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [category,       setCategory]       = useState("");
  const [keyFeatures,    setKeyFeatures]    = useState([""]);
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [whatsInBox,     setWhatsInBox]     = useState([""]);
  const [variants,       setVariants]       = useState([BLANK_VARIANT()]);
  const [basePrice,      setBasePrice]      = useState("");
  const [originalPrice,  setOriginalPrice]  = useState("");

  useEffect(() => {
    return () => {
      images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.title)                  setTitle(d.title);
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

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title, description, category, keyFeatures,
      specifications, whatsInBox, variants, basePrice, originalPrice,
    }));
  }, [title, description, category, keyFeatures,
      specifications, whatsInBox, variants, basePrice, originalPrice]);

  /* ── Image handlers ── */
  const handleAddImage = useCallback(async (index, file) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed"); return; }
    if (file.size > 3 * 1024 * 1024)    { toast.error("Image must be under 3 MB");     return; }

    setCompressing((prev) => { const n = [...prev]; n[index] = true;  return n; });
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, quality: 0.75, maxBytes: 3 * 1024 * 1024 });
      const preview    = URL.createObjectURL(compressed);
      setImages((prev) => {
        if (prev[index]?.preview) URL.revokeObjectURL(prev[index].preview);
        const n = [...prev]; n[index] = { file: compressed, preview }; return n;
      });
      const savedPct = Math.round((1 - compressed.size / file.size) * 100);
      if (savedPct >= 20) toast.success(`Photo optimised — ${savedPct}% smaller 🎉`, { duration: 2500 });
    } catch (err) {
      toast.error(err.message || "Could not process image");
    } finally {
      setCompressing((prev) => { const n = [...prev]; n[index] = false; return n; });
    }
  }, []);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => {
      const n = [...prev];
      if (n[index]?.preview) URL.revokeObjectURL(n[index].preview);
      n[index] = null;
      return n;
    });
  }, []);

  const updateList = (setter, i, val) => setter((p) => p.map((x, idx) => idx === i ? val : x));
  const addList    = (setter, list, limit) => { if (list.length < limit) setter((p) => [...p, ""]); };
  const removeList = (setter, i) => setter((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i));

  const updateVariant     = (i, field, val) =>
    setVariants((p) => p.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  const updateVariantAttr = (i, attr, val) =>
    setVariants((p) => p.map((v, idx) =>
      idx === i ? { ...v, attributes: { ...v.attributes, [attr]: val } } : v));
  const addVariant    = () => setVariants((p) => [...p, BLANK_VARIANT()]);
  const removeVariant = (i) => setVariants((p) =>
    p.length <= 1 ? p : p.filter((_, idx) => idx !== i));

  const filledImages     = images.filter(Boolean);
  const isAnyCompressing = compressing.some(Boolean);

  const discountPct =
    originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
      ? Math.round(((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100)
      : 0;

  const activeCategory = categories.find((c) => c.id === category);

  const canNext = () => {
    if (step === 1) return filledImages.length > 0 && !isAnyCompressing;
    if (step === 2) return title.trim().length >= 3 && !!category;
    if (step === 3) return variants.every((v) => v.sku.trim() && v.name.trim() && Number(v.price) >= 0);
    if (step === 4) return !isNaN(Number(basePrice)) && Number(basePrice) > 0;
    if (step === 5) return filledImages.length > 0 && title.trim().length >= 3 && Number(basePrice) > 0;
    return true;
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!user)                { toast.error("Please log in first");    return; }
    if (!filledImages.length) { toast.error("Add at least one photo"); return; }
    if (isAnyCompressing)     { toast.error("Images still optimising — please wait"); return; }

    setPosting(true);
    try {
      const token = localStorage.getItem("token");
      const fd    = new FormData();

      fd.append("name",           title.trim());
      fd.append("description",    description.trim());
      fd.append("category",       category);
      fd.append("basePrice",      basePrice);
      if (originalPrice) fd.append("originalPrice", originalPrice);

      fd.append("variants",       JSON.stringify(variants.filter((v) => v.sku.trim() && v.name.trim())));
      fd.append("keyFeatures",    JSON.stringify(keyFeatures.filter((f) => f.trim())));
      fd.append("specifications", JSON.stringify(specifications.filter((s) => s.key.trim() && s.value.trim())));
      fd.append("whatsInBox",     JSON.stringify(whatsInBox.filter((b) => b.trim())));

      images.forEach((img) => { if (img?.file) fd.append("images", img.file); });

      const { data } = await axios.post(`${API}/products`, fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });

      localStorage.removeItem(DRAFT_KEY);

      /*
       * Backend always returns status: "pending".
       * We read it from the response so if you ever add
       * trusted-seller fast-tracking, the UI adapts automatically.
       */
      setPosted(data.status || "pending");
    } catch (err) {
      if (!err.response)                    toast.error("Network error. Check your internet.");
      else if (err.response.status === 401) toast.error("Session expired. Please log in again.");
      else if (err.response.status === 403) toast.error(err.response.data?.message || "Listing blocked.");
      else if (err.response.status === 413) toast.error("Images too large. Try different photos.");
      else                                   toast.error(err.response.data?.message || "Failed to post ad.");
    } finally {
      setPosting(false);
    }
  };

  /* ════════════════════════════════════════════════════
      RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div className="pa-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="pa-sheet">

        <div className="pa-header">
          <h2>Post an Ad</h2>
          <button type="button" className="pa-close-btn" onClick={() => onClose?.()}>
            <FiX size={16} />
          </button>
        </div>

        {/* ── Posted — show moderation pending screen ── */}
        {posted === "pending" && (
          <PendingSuccess onClose={onClose} navigate={navigate} />
        )}

        {/* ── Posted — approved (future fast-track path) ── */}
        {posted === "approved" && (
          <div className="pa-success">
            <div className="pa-success-icon"><FiCheckCircle size={36} /></div>
            <h2>Ad Live! 🎉</h2>
            <p>Your listing is now visible to buyers.</p>
            <div className="pa-success-btns">
              <button type="button" className="pa-success-primary"
                onClick={() => navigate("/minimart")}>Browse Minimart</button>
              <button type="button" className="pa-success-secondary"
                onClick={() => navigate("/dashboard")}>My Listings</button>
            </div>
          </div>
        )}

        {/* ── Not yet posted — show the form ── */}
        {!posted && (
          <>
            <StepBar current={step} />
            <div className="pa-body">

              {/* ══ STEP 1 — Photos ══ */}
              {step === 1 && (
                <>
                  <p className="pa-section-title">Add Photos</p>
                  <p className="pa-section-sub">
                    First photo is your cover. Add up to 5 more for extra detail.
                  </p>
                  <div className="pa-img-cover-row">
                    <ImageSlot index={0} preview={images[0]?.preview}
                      compressing={compressing[0]} onAdd={handleAddImage}
                      onRemove={handleRemoveImage} isPrimary />
                  </div>
                  <p className="pa-img-extra-label">Additional Photos</p>
                  <div className="pa-img-extra-grid">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <ImageSlot key={i} index={i} preview={images[i]?.preview}
                        compressing={compressing[i]} onAdd={handleAddImage}
                        onRemove={handleRemoveImage} isPrimary={false} />
                    ))}
                  </div>
                  <div className="pa-img-tip">
                    <FiAlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    Well-lit, watermark-free photos only. Max 3 MB each.
                  </div>
                  <div className="pa-webp-badge">
                    ✨ Auto-compressed to WebP — max 1200 px, 75% quality.
                  </div>
                </>
              )}

              {/* ══ STEP 2 — Details ══ */}
              {step === 2 && (
                <>
                  <p className="pa-section-title">Product Details</p>
                  <p className="pa-section-sub">Clear titles rank higher and get more clicks.</p>

                  <div className="pa-field">
                    <label className="pa-label">Title *</label>
                    <input type="text" className="pa-input"
                      placeholder='e.g. "iPhone 13 Pro Max 256GB"'
                      value={title} maxLength={80}
                      onChange={(e) => setTitle(e.target.value)} />
                    <p className={`pa-char-count ${title.length > 70 ? "pa-char-count--warn" : ""}`}>
                      {title.length}/80
                    </p>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Description</label>
                    <textarea className="pa-textarea"
                      placeholder="Describe your product — features, condition, what's included…"
                      value={description} maxLength={500}
                      onChange={(e) => setDescription(e.target.value)} />
                    <p className={`pa-char-count ${description.length > 460 ? "pa-char-count--warn" : ""}`}>
                      {description.length}/500
                    </p>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Key Features</label>
                    <div className="pa-list-wrap">
                      {keyFeatures.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input className="pa-mini-input" value={item}
                            placeholder='e.g. "5000 mAh long-life battery"'
                            onChange={(e) => updateList(setKeyFeatures, i, e.target.value)} />
                          <div className="pa-row-actions">
                            <button type="button" className="pa-mini-btn"
                              onClick={() => removeList(setKeyFeatures, i)}>−</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() => addList(setKeyFeatures, keyFeatures, 8)}>
                        + Add Feature
                      </button>
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Specifications</label>
                    <div className="pa-list-wrap">
                      {specifications.map((row, i) => (
                        <div className="pa-list-row" key={i}>
                          <div className="pa-spec-row-inputs">
                            <input className="pa-mini-input" value={row.key} placeholder="e.g. RAM"
                              onChange={(e) => {
                                const next = [...specifications];
                                next[i] = { ...next[i], key: e.target.value };
                                setSpecifications(next);
                              }} />
                            <input className="pa-mini-input" value={row.value} placeholder="e.g. 8 GB"
                              onChange={(e) => {
                                const next = [...specifications];
                                next[i] = { ...next[i], value: e.target.value };
                                setSpecifications(next);
                              }} />
                          </div>
                          <div className="pa-row-actions">
                            <button type="button" className="pa-mini-btn"
                              onClick={() => removeList(setSpecifications, i)}>−</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() => setSpecifications((p) =>
                          p.length >= 10 ? p : [...p, { key: "", value: "" }])}>
                        + Add Spec
                      </button>
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">What's in the Box</label>
                    <div className="pa-list-wrap">
                      {whatsInBox.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input className="pa-mini-input" value={item}
                            placeholder='e.g. "1× Charging Cable"'
                            onChange={(e) => updateList(setWhatsInBox, i, e.target.value)} />
                          <div className="pa-row-actions">
                            <button type="button" className="pa-mini-btn"
                              onClick={() => removeList(setWhatsInBox, i)}>−</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() => addList(setWhatsInBox, whatsInBox, 10)}>
                        + Add Box Item
                      </button>
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Category *</label>
                    <div className="pa-cat-grid">
                      {categories.map((c) => (
                        <button key={c.id} type="button"
                          className={`pa-cat-btn ${category === c.id ? "pa-cat-btn--active" : ""}`}
                          onClick={() => setCategory(c.id)}>
                          <span className="pa-cat-icon">{c.icon}</span>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ══ STEP 3 — Variants ══ */}
              {step === 3 && (
                <>
                  <p className="pa-section-title">Product Variants</p>
                  <p className="pa-section-sub">
                    Each variant is a unique SKU — different colour, size, storage, etc.
                  </p>

                  {variants.map((v, i) => {
                    const stock = parseInt(v.stock, 10) || 0;
                    return (
                      <div className="pa-variant-card" key={v.id}>
                        <div className="pa-variant-header">
                          <span className="pa-variant-title">Variant {i + 1}</span>
                          <button type="button" className="pa-variant-delete"
                            onClick={() => removeVariant(i)}>
                            <FiTrash2 size={13} />
                          </button>
                        </div>

                        <div className="pa-variant-grid" style={{ marginBottom: 10 }}>
                          <div className="pa-variant-field pa-variant-field--full">
                            <label>Variant Name *</label>
                            <input placeholder='e.g. "Black 128GB"' value={v.name}
                              onChange={(e) => updateVariant(i, "name", e.target.value)} />
                          </div>
                          <div className="pa-variant-field">
                            <label>SKU *</label>
                            <input placeholder='e.g. "IP13-BLK-128"' value={v.sku}
                              onChange={(e) => updateVariant(i, "sku", e.target.value.toUpperCase())} />
                          </div>
                          <div className="pa-variant-field">
                            <label>Price (₦) *</label>
                            <input type="text" inputMode="numeric" placeholder="0"
                              value={v.price ? Number(v.price).toLocaleString() : ""}
                              onChange={(e) => updateVariant(i, "price", e.target.value.replace(/\D/g, ""))} />
                          </div>
                          <div className="pa-variant-field">
                            <label>Stock Qty</label>
                            <input type="number" min="0" placeholder="1" value={v.stock}
                              onChange={(e) => updateVariant(i, "stock", e.target.value)} />
                            <span className={`pa-stock-badge ${
                              stock === 0 ? "pa-stock-badge--zero"
                              : stock <= 3 ? "pa-stock-badge--low"
                              : "pa-stock-badge--ok"
                            }`}>
                              {stock === 0 ? "Out of stock"
                                : stock <= 3 ? `Only ${stock} left!`
                                : `${stock} in stock`}
                            </span>
                          </div>
                        </div>

                        <p className="pa-attr-label">Attributes (fill what applies)</p>
                        <div className="pa-variant-grid">
                          <div className="pa-variant-field">
                            <label>Color</label>
                            <input placeholder='e.g. "Midnight Black"' value={v.attributes.color}
                              onChange={(e) => updateVariantAttr(i, "color", e.target.value)} />
                          </div>
                          <div className="pa-variant-field">
                            <label>Size</label>
                            <input placeholder='e.g. "XL" or "42"' value={v.attributes.size}
                              onChange={(e) => updateVariantAttr(i, "size", e.target.value)} />
                          </div>
                          <div className="pa-variant-field">
                            <label>Storage</label>
                            <input placeholder='e.g. "256 GB"' value={v.attributes.storage}
                              onChange={(e) => updateVariantAttr(i, "storage", e.target.value)} />
                          </div>
                          <div className="pa-variant-field">
                            <label>Material</label>
                            <input placeholder='e.g. "Cotton"' value={v.attributes.material || ""}
                              onChange={(e) => updateVariantAttr(i, "material", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {variants.length < 10 && (
                    <button type="button" className="pa-add-btn pa-add-btn--lg" onClick={addVariant}>
                      <FiPlus size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                      Add Another Variant
                    </button>
                  )}
                </>
              )}

              {/* ══ STEP 4 — Pricing ══ */}
              {step === 4 && (
                <>
                  <p className="pa-section-title">Base Price</p>
                  <p className="pa-section-sub">
                    Set the default price. Individual variants can override this.
                  </p>

                  <div className="pa-delivery-note">
                    🚚 <strong>Delivery handled at checkout</strong> — buyers choose their method when ordering.
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Base Price (₦) *</label>
                    <div className="pa-price-wrap">
                      <span className="pa-price-symbol">₦</span>
                      <input className="pa-price-input" type="text" inputMode="numeric" placeholder="0"
                        value={basePrice ? Number(basePrice).toLocaleString() : ""}
                        onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ""))} />
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Original Price (₦) — optional</label>
                    <div className="pa-price-wrap">
                      <span className="pa-price-symbol pa-price-symbol--muted">₦</span>
                      <input className="pa-price-input pa-price-input--secondary"
                        type="text" inputMode="numeric" placeholder="0"
                        value={originalPrice ? Number(originalPrice).toLocaleString() : ""}
                        onChange={(e) => setOriginalPrice(e.target.value.replace(/\D/g, ""))} />
                    </div>
                    {discountPct > 0 && (
                      <p className="pa-discount-note">
                        🏷️ Buyer saves ₦{(Number(originalPrice) - Number(basePrice)).toLocaleString()}
                        <span className="pa-discount-badge">-{discountPct}%</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ══ STEP 5 — Review ══ */}
              {step === 5 && (
                <>
                  <p className="pa-section-title">Review Your Ad</p>
                  <p className="pa-section-sub">Looks good? Hit Submit for Review to send it to admin.</p>

                  {/* Moderation notice — visible on review step */}
                  <div className="pa-moderation-tip" style={{ marginBottom: 16 }}>
                    <span className="pa-moderation-tip-icon">⏳</span>
                    <span>
                      Your ad will be reviewed by our team before it goes live.
                      This usually takes <strong>under 24 hours</strong>.
                    </span>
                  </div>

                  <div className="pa-review-card">
                    <div className="pa-review-img">
                      {filledImages[0]
                        ? <img src={filledImages[0].preview} alt="cover" />
                        : <FiPackage size={40} />}
                    </div>
                    <div className="pa-review-body">
                      <div className="pa-review-title">{title || "—"}</div>

                      <div className="pa-review-price-row">
                        <span className="pa-review-price">₦{Number(basePrice || 0).toLocaleString()}</span>
                        {originalPrice && (
                          <span className="pa-review-original">₦{Number(originalPrice).toLocaleString()}</span>
                        )}
                        {discountPct > 0 && <span className="pa-discount-badge">-{discountPct}%</span>}
                      </div>

                      {description && (
                        <p className="pa-review-desc">
                          {description.slice(0, 120)}{description.length > 120 ? "…" : ""}
                        </p>
                      )}

                      <div className="pa-review-pills">
                        <span className="pa-review-pill pa-review-pill--cat">
                          {activeCategory?.icon} {activeCategory?.name || category}
                        </span>
                        <span className="pa-review-pill">
                          {filledImages.length} photo{filledImages.length !== 1 ? "s" : ""}
                        </span>
                        <span className="pa-review-pill">
                          {variants.length} variant{variants.length !== 1 ? "s" : ""}
                        </span>
                        {/* Status preview pill */}
                        <span className="pa-status-pill pa-status-pill--pending">
                          <FiClock size={10} /> Pending review
                        </span>
                      </div>

                      <div className="pa-review-section">
                        <h5>Variants / SKUs</h5>
                        <div className="pa-variant-review-list">
                          {variants.filter((v) => v.sku && v.name).map((v) => (
                            <div className="pa-variant-review-item" key={v.id}>
                              <span className="pa-variant-review-name">{v.name}</span>
                              <div className="pa-variant-review-right">
                                <span className="pa-variant-review-price">
                                  ₦{Number(v.price || 0).toLocaleString()}
                                </span>
                                <span className="pa-variant-review-stock">· {v.stock} in stock</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {keyFeatures.some((f) => f.trim()) && (
                        <div className="pa-review-section">
                          <h5>Key Features</h5>
                          <ul>
                            {keyFeatures.filter((f) => f.trim()).map((f, i) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                      )}

                      {specifications.some((r) => r.key.trim() && r.value.trim()) && (
                        <div className="pa-review-section">
                          <h5>Specifications</h5>
                          <table className="pa-spec-table">
                            <tbody>
                              {specifications.filter((r) => r.key.trim() && r.value.trim()).map((r, i) => (
                                <tr key={i}><td>{r.key}</td><td>{r.value}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {whatsInBox.some((f) => f.trim()) && (
                        <div className="pa-review-section">
                          <h5>What's in the Box</h5>
                          <ul>
                            {whatsInBox.filter((f) => f.trim()).map((f, i) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <button className="pa-submit-btn" disabled={posting || !canNext()} onClick={handleSubmit}>
                    {posting
                      ? <><span className="pa-spinner" />Submitting…</>
                      : "📋 Submit for Review"}
                  </button>
                </>
              )}
            </div>

            <div className="pa-footer">
              {step > 1 && (
                <button type="button" className="pa-btn-back" onClick={() => setStep((s) => s - 1)}>
                  <FiChevronLeft size={16} /> Back
                </button>
              )}
              {step < 5 && (
                <button type="button" className="pa-btn-next"
                  disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                  Continue <FiChevronRight size={16} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}