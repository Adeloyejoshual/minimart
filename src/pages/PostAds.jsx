import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { FiX, FiChevronLeft, FiChevronRight, FiCheckCircle } from "react-icons/fi";

import categories from "../config/categories";
import "../styles/PostAds.css";

import StepBar      from "./PostAds/StepBar";
import ImageGrid    from "./PostAds/ImageGrid";
import VariantEditor from "./PostAds/VariantEditor";
import PricingStep  from "./PostAds/PricingStep";
import ReviewStep   from "./PostAds/ReviewStep";

/* ─── Constants ─── */
const API       = "https://minimart-ivrm.onrender.com/api";
const DRAFT_KEY = "post-ad-draft-v3";

const BLANK_VARIANT = () => ({
  id: Date.now(),
  sku: "", name: "", price: "", stock: "1",
  attributes: { color: "", size: "", storage: "" },
});

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function PostAds({ user, onClose }) {
  const navigate = useNavigate();

  const [step,    setStep]    = useState(1);
  const [posting, setPosting] = useState(false);
  const [posted,  setPosted]  = useState(false);

  /* ── Images ── */
  const [images, setImages] = useState(Array(5).fill(null));

  /* ── Step 2: Details ── */
  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [category,       setCategory]       = useState("");
  const [keyFeatures,    setKeyFeatures]    = useState([""]);
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [whatsInBox,     setWhatsInBox]     = useState([""]);

  /* ── Step 3: Variants ── */
  const [variants, setVariants] = useState([BLANK_VARIANT()]);

  /* ── Step 4: Pricing ── */
  const [basePrice,     setBasePrice]     = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  /* ── Cleanup object URLs on unmount ── */
  useEffect(() => {
    return () => {
      images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load draft ── */
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

  /* ── Auto-save draft ── */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title, description, category, keyFeatures,
      specifications, whatsInBox, variants, basePrice, originalPrice,
    }));
  }, [title, description, category, keyFeatures, specifications, whatsInBox, variants, basePrice, originalPrice]);

  /* ── Image handlers ── */
  const handleAddImage = useCallback((index, file) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files allowed"); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error("Image must be under 5MB");  return; }
    const preview = URL.createObjectURL(file);
    setImages((prev) => { const next = [...prev]; next[index] = { file, preview }; return next; });
  }, []);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = null;
      return next;
    });
  }, []);

  /* ── List helpers ── */
  const updateList = (setter, i, val) =>
    setter((p) => p.map((x, idx) => (idx === i ? val : x)));
  const addList = (setter, list, limit) => {
    if (list.length < limit) setter((p) => [...p, ""]);
  };
  const removeList = (setter, i) =>
    setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  /* ── Variant helpers ── */
  const updateVariant = (i, field, val) =>
    setVariants((p) => p.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)));

  const updateVariantAttr = (i, attr, val) =>
    setVariants((p) =>
      p.map((v, idx) =>
        idx === i ? { ...v, attributes: { ...v.attributes, [attr]: val } } : v
      )
    );

  const addVariant    = () => setVariants((p) => [...p, BLANK_VARIANT()]);
  const removeVariant = (i) =>
    setVariants((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const filledImages = images.filter(Boolean);

  /* ── Validation ── */
  const canNext = () => {
    if (step === 1) return filledImages.length > 0;
    if (step === 2) return title.trim().length >= 3 && !!category;
    if (step === 3) return variants.every(
      (v) => v.sku.trim() && v.name.trim() && Number(v.price) >= 0
    );
    if (step === 4) { const n = Number(basePrice); return !isNaN(n) && n > 0; }
    if (step === 5) return filledImages.length > 0 && title.trim().length >= 3 && Number(basePrice) > 0;
    return true;
  };

  const discountPct =
    originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
      ? Math.round(((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100)
      : 0;

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!user)                { toast.error("Please log in first");    return; }
    if (!filledImages.length) { toast.error("Add at least one photo"); return; }

    setPosting(true);
    try {
      const token = localStorage.getItem("token");
      const fd    = new FormData();

      fd.append("name",        title.trim());
      fd.append("description", description.trim());
      fd.append("category",    category);
      fd.append("basePrice",   basePrice);
      if (originalPrice) fd.append("originalPrice", originalPrice);

      fd.append("variants",
        JSON.stringify(variants.filter((v) => v.sku.trim() && v.name.trim())));
      fd.append("keyFeatures",
        JSON.stringify(keyFeatures.filter((f) => f.trim())));
      fd.append("specifications",
        JSON.stringify(specifications.filter((s) => s.key.trim() && s.value.trim())));
      fd.append("whatsInBox",
        JSON.stringify(whatsInBox.filter((b) => b.trim())));

      images.forEach((img) => { if (img?.file) fd.append("images", img.file); });

      await axios.post(`${API}/products`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      localStorage.removeItem(DRAFT_KEY);
      setPosted(true);
    } catch (err) {
      if (!err.response)                    toast.error("Network error. Check your internet.");
      else if (err.response.status === 401) toast.error("Session expired. Please log in again.");
      else if (err.response.status === 403) toast.error(err.response.data?.message || "Listing blocked.");
      else if (err.response.status === 413) toast.error("Images too large. Try smaller files.");
      else toast.error(err.response.data?.message || "Failed to post ad. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const activeCategory = categories.find((c) => c.id === category);

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="pa-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="pa-sheet">

        {/* ── Header ── */}
        <div className="pa-header">
          <h2>Post an Ad</h2>
          <button type="button" className="pa-close-btn" onClick={() => onClose?.()}>
            <FiX size={16} />
          </button>
        </div>

        {/* ── Success screen ── */}
        {posted ? (
          <div className="pa-success">
            <div className="pa-success-icon"><FiCheckCircle size={36} /></div>
            <h2>Ad Posted! 🎉</h2>
            <p>Your listing is now live. Buyers can see it right away.</p>
            <div className="pa-success-btns">
              <button
                type="button"
                className="pa-success-primary"
                onClick={() => navigate("/minimart")}
              >
                Browse Minimart
              </button>
              <button
                type="button"
                className="pa-success-secondary"
                onClick={() => navigate("/dashboard")}
              >
                View My Listings
              </button>
            </div>
          </div>
        ) : (
          <>
            <StepBar current={step} />

            <div className="pa-body">

              {/* ── Step 1: Photos ── */}
              {step === 1 && (
                <ImageGrid
                  images={images}
                  onAdd={handleAddImage}
                  onRemove={handleRemoveImage}
                />
              )}

              {/* ── Step 2: Details (kept inline) ── */}
              {step === 2 && (
                <>
                  <p className="pa-section-title">Product Details</p>
                  <p className="pa-section-sub">Clear titles rank higher and get more clicks.</p>

                  <div className="pa-field">
                    <label className="pa-label">Title *</label>
                    <input
                      type="text"
                      className="pa-input"
                      placeholder='e.g. "iPhone 13 Pro Max 256GB"'
                      value={title}
                      maxLength={80}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <p className={`pa-char-count ${title.length > 70 ? "pa-char-count--warn" : ""}`}>
                      {title.length}/80
                    </p>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Description</label>
                    <textarea
                      className="pa-textarea"
                      placeholder="Describe your product — features, condition, what's included..."
                      value={description}
                      maxLength={500}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <p className={`pa-char-count ${description.length > 460 ? "pa-char-count--warn" : ""}`}>
                      {description.length}/500
                    </p>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Key Features</label>
                    <div className="pa-list-wrap">
                      {keyFeatures.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "5000mAh long-life battery"'
                            onChange={(e) => updateList(setKeyFeatures, i, e.target.value)}
                          />
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
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <input
                              className="pa-mini-input"
                              value={row.key}
                              placeholder="e.g. RAM"
                              onChange={(e) => {
                                const next = [...specifications];
                                next[i] = { ...next[i], key: e.target.value };
                                setSpecifications(next);
                              }}
                            />
                            <input
                              className="pa-mini-input"
                              value={row.value}
                              placeholder="e.g. 8GB"
                              onChange={(e) => {
                                const next = [...specifications];
                                next[i] = { ...next[i], value: e.target.value };
                                setSpecifications(next);
                              }}
                            />
                          </div>
                          <div className="pa-row-actions">
                            <button type="button" className="pa-mini-btn"
                              onClick={() => removeList(setSpecifications, i)}>−</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() =>
                          setSpecifications((p) =>
                            p.length >= 10 ? p : [...p, { key: "", value: "" }]
                          )
                        }>
                        + Add Spec
                      </button>
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">What's in the Box</label>
                    <div className="pa-list-wrap">
                      {whatsInBox.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "1× Charging Cable"'
                            onChange={(e) => updateList(setWhatsInBox, i, e.target.value)}
                          />
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
                        <button
                          key={c.id}
                          type="button"
                          className={`pa-cat-btn ${category === c.id ? "pa-cat-btn--active" : ""}`}
                          onClick={() => setCategory(c.id)}
                        >
                          <span className="pa-cat-icon">{c.icon}</span>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 3: Variants ── */}
              {step === 3 && (
                <VariantEditor
                  variants={variants}
                  onUpdate={updateVariant}
                  onUpdateAttr={updateVariantAttr}
                  onAdd={addVariant}
                  onRemove={removeVariant}
                />
              )}

              {/* ── Step 4: Pricing ── */}
              {step === 4 && (
                <PricingStep
                  basePrice={basePrice}
                  setBasePrice={setBasePrice}
                  originalPrice={originalPrice}
                  setOriginalPrice={setOriginalPrice}
                  discountPct={discountPct}
                />
              )}

              {/* ── Step 5: Review ── */}
              {step === 5 && (
                <ReviewStep
                  filledImages={filledImages}
                  title={title}
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
                  onSubmit={handleSubmit}
                />
              )}
            </div>

            {/* ── Footer nav ── */}
            <div className="pa-footer">
              {step > 1 && (
                <button
                  type="button"
                  className="pa-btn-back"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <FiChevronLeft size={16} /> Back
                </button>
              )}
              {step < 5 && (
                <button
                  type="button"
                  className="pa-btn-next"
                  disabled={!canNext()}
                  onClick={() => setStep((s) => s + 1)}
                >
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
