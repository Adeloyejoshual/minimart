import React, {
  useEffect, useState, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiX, FiChevronLeft, FiChevronRight, FiSave,
} from "react-icons/fi";

import { API, DRAFT_KEY, STEPS, BLANK_VARIANT } from "../components/add-product/constants";
import { compressImage }   from "../components/add-product/utils";
import StepBar             from "../components/add-product/StepBar";
import QualityMeter        from "../components/add-product/QualityMeter";
import ImageUploader       from "../components/add-product/ImageUploader";
import ProductInfoStep     from "../components/add-product/ProductInfoStep";
import CategoryStep        from "../components/add-product/CategoryStep";
import VariantsStep        from "../components/add-product/VariantsStep";
import PricingStep         from "../components/add-product/PricingStep";
import ReviewStep          from "../components/add-product/ReviewStep";
import SuccessScreen       from "../components/add-product/SuccessScreen";

import "../styles/PostAds.css";

const SLOTS = 8;

export default function AddProduct({ user, onClose }) {
  const navigate = useNavigate();

  /* ── UI ── */
  const [step,        setStep]        = useState(1);
  const [submitting,  setSubmitting]  = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitted,   setSubmitted]   = useState(null);

  /* ── Images ── */
  const [images,      setImages]      = useState(Array(SLOTS).fill(null));
  const [compressing, setCompressing] = useState(Array(SLOTS).fill(false));

  /* ── Core fields ── */
  const [name,           setName]           = useState("");
  const [description,    setDescription]    = useState("");
  const [categoryId,     setCategoryId]     = useState("");
  const [brandId,        setBrandId]        = useState("");
  const [warranty,       setWarranty]       = useState("");
  const [returnPolicy,   setReturnPolicy]   = useState("");
  const [deliveryNote,   setDeliveryNote]   = useState("");
  const [tags,           setTags]           = useState("");
  const [keyFeatures,    setKeyFeatures]    = useState([""]);
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [whatsInBox,     setWhatsInBox]     = useState([""]);
  const [variants,       setVariants]       = useState([BLANK_VARIANT()]);
  const [basePrice,      setBasePrice]      = useState("");
  const [originalPrice,  setOriginalPrice]  = useState("");
  const [scheduledAt,    setScheduledAt]    = useState("");

  /* ── Category attributes ── */
  const [catAttribDefs,   setCatAttribDefs]   = useState([]);
  const [catAttribValues, setCatAttribValues] = useState({});
  const [loadingAttribs,  setLoadingAttribs]  = useState(false);

  /* ── Brands ── */
  const [brands, setBrands] = useState([]);

  /* ── Derived ── */
  const filledImages     = images.filter(Boolean);
  const isAnyCompressing = compressing.some(Boolean);

  const discountPct =
    originalPrice &&
    basePrice &&
    Number(originalPrice) > Number(basePrice)
      ? Math.round(
          ((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100
        )
      : 0;

  /* ── Quality score ── */
  const liveQuality = useMemo(() => {
    let score = 0;
    const words = name.trim().split(/\s+/).length;
    if (words >= 3) score += 4;
    if (words >= 6) score += 4;
    if (words >= 9) score += 4;
    const chars = description.trim().length;
    if (chars >= 50)  score += 5;
    if (chars >= 150) score += 7;
    if (chars >= 400) score += 8;
    score += Math.min(20, filledImages.length * 4);
    score += Math.min(10, variants.filter((v) => v.sku.trim()).length * 5);
    score += Math.min(8,  keyFeatures.filter((f) => f.trim()).length * 2);
    score += Math.min(8,  specifications.filter((s) => s.key.trim()).length * 2);
    score += Math.min(
      8,
      Object.values(catAttribValues).filter((v) => String(v).trim()).length * 2
    );
    if (brandId)         score += 5;
    if (warranty.trim()) score += 4;
    score += Math.min(5, tags.split(",").filter((t) => t.trim()).length);
    return Math.min(100, score);
  }, [
    name, description, filledImages.length, variants,
    keyFeatures, specifications, catAttribValues,
    brandId, warranty, tags,
  ]);

  /* ── Load brands ── */
  useEffect(() => {
    axios
      .get(`${API}/vendor/products/brands`)
      .then((r) => setBrands(r.data.brands || []))
      .catch(() => {});
  }, []);

  /* ── Load category attributes ── */
  useEffect(() => {
    if (!categoryId) {
      setCatAttribDefs([]);
      setCatAttribValues({});
      return;
    }
    setLoadingAttribs(true);
    axios
      .get(`${API}/vendor/products/category-attributes/${categoryId}`)
      .then((r) => {
        setCatAttribDefs(r.data.attributes || []);
        setCatAttribValues({});
      })
      .catch(() => setCatAttribDefs([]))
      .finally(() => setLoadingAttribs(false));
  }, [categoryId]);

  /* ── Restore draft ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.name)                   setName(d.name);
      if (d.description)            setDescription(d.description);
      if (d.categoryId)             setCategoryId(d.categoryId);
      if (d.brandId)                setBrandId(d.brandId);
      if (d.warranty)               setWarranty(d.warranty);
      if (d.returnPolicy)           setReturnPolicy(d.returnPolicy);
      if (d.deliveryNote)           setDeliveryNote(d.deliveryNote);
      if (d.tags)                   setTags(d.tags);
      if (d.keyFeatures?.length)    setKeyFeatures(d.keyFeatures);
      if (d.specifications?.length) setSpecifications(d.specifications);
      if (d.whatsInBox?.length)     setWhatsInBox(d.whatsInBox);
      if (d.variants?.length)       setVariants(d.variants);
      if (d.basePrice)              setBasePrice(d.basePrice);
      if (d.originalPrice)          setOriginalPrice(d.originalPrice);
      if (d.catAttribValues)        setCatAttribValues(d.catAttribValues);
    } catch { /* ignore corrupt draft */ }
  }, []);

  /* ── Auto-save draft ── */
  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name, description, categoryId, brandId,
        warranty, returnPolicy, deliveryNote, tags,
        keyFeatures, specifications, whatsInBox,
        variants, basePrice, originalPrice, catAttribValues,
      })
    );
  }, [
    name, description, categoryId, brandId,
    warranty, returnPolicy, deliveryNote, tags,
    keyFeatures, specifications, whatsInBox,
    variants, basePrice, originalPrice, catAttribValues,
  ]);

  /* ── Cleanup preview URLs ── */
  useEffect(
    () => () => images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); }),
    []
  );

  /* ── Image handlers ── */
  const handleAddImage = useCallback(async (index, file) => {
    if (!file.type.startsWith("image/")) { toast.error("Images only"); return; }
    setCompressing((p) => { const n = [...p]; n[index] = true;  return n; });
    try {
      const compressed = await compressImage(file);
      const preview    = URL.createObjectURL(compressed);
      setImages((p) => {
        if (p[index]?.preview) URL.revokeObjectURL(p[index].preview);
        const n = [...p];
        n[index] = { file: compressed, preview };
        return n;
      });
    } catch (err) {
      toast.error(err.message || "Could not process image");
    } finally {
      setCompressing((p) => { const n = [...p]; n[index] = false; return n; });
    }
  }, []);

  const handleRemoveImage = useCallback((index) => {
    setImages((p) => {
      const n = [...p];
      if (n[index]?.preview) URL.revokeObjectURL(n[index].preview);
      n[index] = null;
      return n;
    });
  }, []);

  /* ── Step validation ── */
  const canNext = () => {
    if (step === 1) return filledImages.length > 0 && !isAnyCompressing;
    if (step === 2) return name.trim().length >= 3;
    if (step === 3) {
      if (!categoryId) return false;
      return catAttribDefs
        .filter((a) => a.is_required)
        .every((a) => catAttribValues[a.field_key]?.trim());
    }
    if (step === 4) return variants.every(
      (v) => v.sku.trim() && v.name.trim() && Number(v.price) >= 0
    );
    if (step === 5) return Number(basePrice) > 0;
    if (step === 6)
      return filledImages.length > 0 &&
        name.trim().length >= 3 &&
        Number(basePrice) > 0 &&
        !!categoryId;
    return true;
  };

  /* ── Build FormData ── */
  const buildFormData = (isDraft = false) => {
    const fd = new FormData();
    fd.append("name",             name.trim());
    fd.append("description",      description.trim());
    fd.append("categoryId",       categoryId);
    fd.append("basePrice",        basePrice);
    fd.append("saveDraft",        isDraft ? "true" : "false");
    if (brandId)       fd.append("brandId",           brandId);
    if (originalPrice) fd.append("originalPrice",     originalPrice);
    if (warranty)      fd.append("warranty",          warranty.trim());
    if (returnPolicy)  fd.append("returnPolicy",      returnPolicy.trim());
    if (deliveryNote)  fd.append("deliveryNote",      deliveryNote.trim());
    if (scheduledAt)   fd.append("scheduledAt",       scheduledAt);
    if (tags.trim())   fd.append("tags",              tags);
    fd.append("categoryAttributes", JSON.stringify(catAttribValues));
    fd.append("keyFeatures",     JSON.stringify(keyFeatures.filter((f) => f.trim())));
    fd.append("specifications",  JSON.stringify(
      specifications.filter((s) => s.key.trim() && s.value.trim())
    ));
    fd.append("whatsInBox",      JSON.stringify(whatsInBox.filter((b) => b.trim())));
    fd.append("variants",        JSON.stringify(
      variants.filter((v) => v.sku.trim() && v.name.trim())
    ));
    images.forEach((img) => { if (img?.file) fd.append("images", img.file); });
    return fd;
  };

  /* ── Save draft ── */
  const handleSaveDraft = async () => {
    if (!user) { toast.error("Please log in first"); return; }
    setSavingDraft(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/vendor/products`, buildFormData(true), {
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Draft saved ✅");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!user)                { toast.error("Please log in first");     return; }
    if (!filledImages.length) { toast.error("Add at least one photo");  return; }
    if (isAnyCompressing)     { toast.error("Images still processing"); return; }

    setSubmitting(true);
    try {
      const token    = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API}/vendor/products`,
        buildFormData(false),
        {
          headers: {
            Authorization:  `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      localStorage.removeItem(DRAFT_KEY);
      setSubmitted(data);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (!err.response)                    toast.error("Network error.");
      else if (err.response.status === 401) toast.error("Session expired.");
      else if (err.response.status === 403) toast.error(msg || "Product blocked.");
      else if (err.response.status === 409) toast.error("Duplicate SKU detected.");
      else if (err.response.status === 413) toast.error("Images too large.");
      else                                  toast.error(msg || "Failed to add product.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    setSubmitted(null);
    setStep(1);
    setImages(Array(SLOTS).fill(null));
    setName(""); setDescription(""); setCategoryId(""); setBrandId("");
    setWarranty(""); setReturnPolicy(""); setDeliveryNote("");
    setTags(""); setScheduledAt("");
    setKeyFeatures([""]); setSpecifications([{ key: "", value: "" }]);
    setWhatsInBox([""]); setVariants([BLANK_VARIANT()]);
    setBasePrice(""); setOriginalPrice("");
    setCatAttribDefs([]); setCatAttribValues({});
  };

  /* ═══════════════════════════════
     RENDER
  ═══════════════════════════════ */
  return (
    <div
      className="ap-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="ap-sheet">

        {/* ── Header ── */}
        <div className="ap-header">
          <div>
            <h2>Add Product</h2>
            <span className="ap-header-sub">Minimart Vendor Portal</span>
          </div>
          <div className="ap-header-actions">
            {!submitted && (
              <button
                type="button"
                className="ap-btn-ghost"
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft
                  ? <><span className="ap-spinner-xs" /> Saving…</>
                  : <><FiSave size={13} /> Save Draft</>}
              </button>
            )}
            <button
              type="button"
              className="ap-close-btn"
              onClick={() => onClose?.()}
            >
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* ── Success screen ── */}
        {submitted && (
          <SuccessScreen
            status={submitted.status}
            onAddAnother={handleReset}
            navigate={navigate}
          />
        )}

        {/* ── Multi-step form ── */}
        {!submitted && (
          <>
            <StepBar current={step} />

            {step >= 2 && (
              <div className="ap-meta-bar">
                <QualityMeter score={liveQuality} />
              </div>
            )}

            <div className="ap-body">

              {step === 1 && (
                <ImageUploader
                  images={images}
                  compressing={compressing}
                  onAdd={handleAddImage}
                  onRemove={handleRemoveImage}
                />
              )}

              {step === 2 && (
                <ProductInfoStep
                  name={name}                   setName={setName}
                  description={description}     setDescription={setDescription}
                  brandId={brandId}             setBrandId={setBrandId}
                  warranty={warranty}           setWarranty={setWarranty}
                  returnPolicy={returnPolicy}   setReturnPolicy={setReturnPolicy}
                  deliveryNote={deliveryNote}   setDeliveryNote={setDeliveryNote}
                  tags={tags}                   setTags={setTags}
                  keyFeatures={keyFeatures}     setKeyFeatures={setKeyFeatures}
                  specifications={specifications} setSpecifications={setSpecifications}
                  whatsInBox={whatsInBox}       setWhatsInBox={setWhatsInBox}
                  brands={brands}
                />
              )}

              {step === 3 && (
                <CategoryStep
                  categoryId={categoryId}         setCategoryId={setCategoryId}
                  catAttribDefs={catAttribDefs}
                  catAttribValues={catAttribValues} setCatAttribValues={setCatAttribValues}
                  loadingAttribs={loadingAttribs}
                />
              )}

              {step === 4 && (
                <VariantsStep
                  variants={variants}
                  setVariants={setVariants}
                />
              )}

              {step === 5 && (
                <PricingStep
                  basePrice={basePrice}         setBasePrice={setBasePrice}
                  originalPrice={originalPrice} setOriginalPrice={setOriginalPrice}
                  scheduledAt={scheduledAt}     setScheduledAt={setScheduledAt}
                  discountPct={discountPct}
                />
              )}

              {step === 6 && (
                <ReviewStep
                  name={name}
                  basePrice={basePrice}
                  originalPrice={originalPrice}
                  discountPct={discountPct}
                  categoryId={categoryId}
                  filledImages={filledImages}
                  variants={variants}
                  brandId={brandId}
                  brands={brands}
                  catAttribValues={catAttribValues}
                  catAttribDefs={catAttribDefs}
                  scheduledAt={scheduledAt}
                  liveQuality={liveQuality}
                  submitting={submitting}
                  canSubmit={canNext()}
                  onSubmit={handleSubmit}
                />
              )}

            </div>

            {/* ── Footer navigation ── */}
            <div className="ap-footer">
              {step > 1 && (
                <button
                  type="button"
                  className="ap-btn-back"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <FiChevronLeft size={15} /> Back
                </button>
              )}

              <div className="ap-step-counter">
                Step {step} of {STEPS.length}
              </div>

              {step < STEPS.length && (
                <button
                  type="button"
                  className="ap-btn-next"
                  disabled={!canNext()}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue <FiChevronRight size={15} />
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}