import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiX, FiChevronLeft, FiChevronRight, FiCamera,
  FiTag, FiDollarSign, FiFileText, FiCheckCircle,
  FiTrash2, FiAlertCircle, FiPackage, FiPlus,
} from "react-icons/fi";
import categories from "../config/categories";

const API       = "https://minimart-ivrm.onrender.com/api";
const DRAFT_KEY = "post-ad-draft-v3";

/* ─────────────────── Constants ─────────────────── */
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
  attributes: { color: "", size: "", storage: "" },
});

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
function ImageSlot({ preview, onAdd, onRemove, index, isPrimary }) {
  const ref = React.useRef();
  return (
    <div className={`pa-img-slot ${isPrimary ? "pa-img-slot--primary" : ""}`}>
      {preview ? (
        <>
          <img src={preview} alt="preview" className="pa-img-preview" />
          {isPrimary && <span className="pa-img-cover-tag">Cover</span>}
          <button type="button" className="pa-img-remove" onClick={() => onRemove(index)}>
            <FiTrash2 size={13} />
          </button>
        </>
      ) : (
        <button type="button" className="pa-img-add" onClick={() => ref.current.click()}>
          <FiCamera size={isPrimary ? 26 : 20} />
          {isPrimary && <span>Add Cover Photo</span>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onAdd(index, e.target.files[0])} />
    </div>
  );
}

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
      title, description, category, keyFeatures, specifications,
      whatsInBox, variants, basePrice, originalPrice,
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
  const updateList = (setter, i, val) => setter((p) => p.map((x, idx) => idx === i ? val : x));
  const addList    = (setter, list, limit) => { if (list.length < limit) setter((p) => [...p, ""]); };
  const removeList = (setter, i) => setter((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i));

  /* ── Variant helpers ── */
  const updateVariant = (i, field, val) =>
    setVariants((p) => p.map((v, idx) => idx === i ? { ...v, [field]: val } : v));

  const updateVariantAttr = (i, attr, val) =>
    setVariants((p) => p.map((v, idx) =>
      idx === i ? { ...v, attributes: { ...v.attributes, [attr]: val } } : v
    ));

  const addVariant    = () => setVariants((p) => [...p, BLANK_VARIANT()]);
  const removeVariant = (i) => setVariants((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i));

  const filledImages = images.filter(Boolean);

  /* ── Validation ── */
  const canNext = () => {
    if (step === 1) return filledImages.length > 0;
    if (step === 2) return title.trim().length >= 3 && !!category;
    if (step === 3) return variants.every((v) => v.sku.trim() && v.name.trim() && Number(v.price) >= 0);
    const n = Number(basePrice);
    if (step === 4) return !isNaN(n) && n > 0;
    if (step === 5) return filledImages.length > 0 && title.trim().length >= 3 && Number(basePrice) > 0;
    return true;
  };

  const discountPct = originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
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
      fd.append("category",    category);           // now sends the UUID id
      fd.append("basePrice",   basePrice);
      if (originalPrice) fd.append("originalPrice", originalPrice);

      fd.append("variants",       JSON.stringify(variants.filter((v) => v.sku.trim() && v.name.trim())));
      fd.append("keyFeatures",    JSON.stringify(keyFeatures.filter((f) => f.trim())));
      fd.append("specifications", JSON.stringify(specifications.filter((s) => s.key.trim() && s.value.trim())));
      fd.append("whatsInBox",     JSON.stringify(whatsInBox.filter((b) => b.trim())));

      images.forEach((img) => { if (img?.file) fd.append("images", img.file); });

      await axios.post(`${API}/products`, fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
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

  /* ── Active category helper ── */
  const activeCategory = categories.find((c) => c.id === category);

  return (
    <>
      <style>{`
        .pa-overlay{
          position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;
          display:flex;align-items:flex-end;justify-content:center;
        }
        @media(min-width:640px){.pa-overlay{align-items:center;}}

        .pa-sheet{
          background:#fff;width:100%;max-width:580px;
          border-radius:22px 22px 0 0;max-height:96vh;
          display:flex;flex-direction:column;overflow:hidden;
          animation:pa-up .28s cubic-bezier(.22,1,.36,1);
        }
        @media(min-width:640px){.pa-sheet{border-radius:22px;max-height:90vh;}}
        @keyframes pa-up{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}

        /* Header */
        .pa-header{
          display:flex;align-items:center;justify-content:space-between;
          padding:18px 20px 14px;border-bottom:1px solid #f0eeea;flex-shrink:0;
        }
        .pa-header h2{
          font-size:18px;font-weight:800;
          background:linear-gradient(135deg,#ff5722,#ff8a00);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        }
        .pa-close-btn{
          width:34px;height:34px;border-radius:50%;
          border:1.5px solid #e8e6e0;background:#fafaf8;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#555;transition:all .15s;
        }
        .pa-close-btn:hover{background:#fee;border-color:#dc2626;color:#dc2626;}

        /* Stepbar */
        .pa-stepbar{
          display:flex;align-items:center;padding:14px 16px;
          background:#fafaf8;border-bottom:1px solid #f0eeea;
          overflow-x:auto;scrollbar-width:none;flex-shrink:0;
        }
        .pa-stepbar::-webkit-scrollbar{display:none;}
        .pa-step{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}
        .pa-step-dot{
          width:32px;height:32px;border-radius:50%;border:2px solid #e8e6e0;
          display:flex;align-items:center;justify-content:center;
          color:#bbb;background:#fff;transition:all .2s;
        }
        .pa-step--active .pa-step-dot{border-color:#ff5722;color:#ff5722;background:#fff4f0;}
        .pa-step--done   .pa-step-dot{border-color:#16a34a;color:#16a34a;background:#f0fdf4;}
        .pa-step-label{font-size:10px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:.5px;}
        .pa-step--active .pa-step-label{color:#ff5722;}
        .pa-step--done   .pa-step-label{color:#16a34a;}
        .pa-step-line{flex:1;height:2px;background:#e8e6e0;margin:0 6px;margin-bottom:16px;transition:background .2s;}
        .pa-step-line--done{background:#16a34a;}

        /* Body */
        .pa-body{flex:1;overflow-y:auto;padding:20px;scrollbar-width:thin;}
        .pa-section-title{font-size:16px;font-weight:800;color:#1a1a1a;margin-bottom:4px;}
        .pa-section-sub  {font-size:13px;color:#888;margin-bottom:20px;}

        /* Images */
        .pa-img-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .pa-img-slot{
          position:relative;aspect-ratio:1;border-radius:14px;
          overflow:hidden;border:2px dashed #e8e6e0;background:#fafaf8;transition:border-color .15s;
        }
        .pa-img-slot--primary{grid-column:span 2;aspect-ratio:16/9;}
        .pa-img-slot:hover{border-color:#ff5722;}
        .pa-img-add{
          width:100%;height:100%;background:none;border:none;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:8px;color:#ccc;cursor:pointer;font-size:13px;font-weight:600;transition:color .15s;
        }
        .pa-img-add:hover{color:#ff5722;}
        .pa-img-preview{width:100%;height:100%;object-fit:cover;}
        .pa-img-cover-tag{
          position:absolute;bottom:8px;left:8px;
          background:rgba(0,0,0,.65);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;
        }
        .pa-img-remove{
          position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;
          background:rgba(220,38,38,.9);color:#fff;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;transition:transform .15s;
        }
        .pa-img-remove:hover{transform:scale(1.1);}
        .pa-img-tip{
          display:flex;align-items:flex-start;gap:8px;
          background:#fff8f0;border:1px solid #ffe0cc;border-radius:10px;
          padding:12px;font-size:12px;color:#c2440c;margin-top:16px;line-height:1.5;
        }

        /* Fields */
        .pa-field{margin-bottom:18px;}
        .pa-label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#888;margin-bottom:7px;}
        .pa-input,.pa-textarea{
          width:100%;border:1.5px solid #e8e6e0;border-radius:12px;
          padding:12px 14px;font-size:14px;background:#fafaf8;
          outline:none;font-family:inherit;color:#1a1a1a;transition:border-color .15s;
        }
        .pa-input:focus,.pa-textarea:focus{border-color:#ff5722;background:#fff;}
        .pa-textarea{resize:vertical;min-height:90px;}
        .pa-char-count{text-align:right;font-size:11px;color:#bbb;margin-top:4px;}
        .pa-char-count--warn{color:#f59e0b;}

        /* Category */
        .pa-cat-grid{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:8px;
        }
        @media(min-width:480px){.pa-cat-grid{grid-template-columns:repeat(4,1fr);}}
        .pa-cat-btn{
          display:flex;flex-direction:column;align-items:center;gap:4px;
          padding:10px 6px;border:1.5px solid #e8e6e0;border-radius:12px;
          background:#fafaf8;cursor:pointer;font-size:11px;font-weight:600;
          color:#555;transition:all .15s;text-align:center;line-height:1.3;
        }
        .pa-cat-btn:hover{border-color:#ff5722;color:#ff5722;}
        .pa-cat-btn--active{border-color:#ff5722;background:#ff5722;color:#fff;}
        .pa-cat-icon{font-size:20px;line-height:1;}

        /* List inputs */
        .pa-list-wrap{border:1.5px solid #e8e6e0;border-radius:14px;padding:12px;background:#fafaf8;}
        .pa-list-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;align-items:center;}
        .pa-list-row:last-of-type{margin-bottom:0;}
        .pa-mini-input{
          width:100%;border:1.5px solid #e8e6e0;border-radius:10px;
          padding:10px 12px;background:#fff;outline:none;
          font-size:13px;font-family:inherit;color:#1a1a1a;transition:border-color .15s;
        }
        .pa-mini-input:focus{border-color:#ff5722;}
        .pa-row-actions{display:flex;gap:6px;align-items:center;}
        .pa-mini-btn{
          border:1.5px solid #e8e6e0;background:#fff;border-radius:10px;
          width:38px;height:38px;cursor:pointer;font-size:18px;font-weight:700;color:#888;
          display:flex;align-items:center;justify-content:center;transition:all .15s;
        }
        .pa-mini-btn:hover{border-color:#dc2626;color:#dc2626;}
        .pa-add-btn{
          width:100%;margin-top:10px;height:40px;border-radius:10px;
          border:1.5px dashed #d8d4cc;background:#fff;
          cursor:pointer;font-size:13px;font-weight:700;color:#ff5722;transition:all .15s;
        }
        .pa-add-btn:hover{border-color:#ff5722;background:#fff4f0;}

        /* Variant cards */
        .pa-variant-card{
          border:1.5px solid #e8e6e0;border-radius:16px;
          padding:16px;background:#fafaf8;margin-bottom:12px;
          animation:pa-fadein .2s ease;
        }
        @keyframes pa-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .pa-variant-header{
          display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;
        }
        .pa-variant-title{font-size:13px;font-weight:800;color:#1a1a1a;}
        .pa-variant-delete{
          width:30px;height:30px;border-radius:50%;border:1.5px solid #fecaca;
          background:#fff;color:#dc2626;cursor:pointer;
          display:flex;align-items:center;justify-content:center;transition:all .15s;
        }
        .pa-variant-delete:hover{background:#fee;transform:scale(1.1);}
        .pa-variant-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .pa-variant-field label{display:block;font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
        .pa-variant-field input{
          width:100%;border:1.5px solid #e8e6e0;border-radius:10px;
          padding:9px 12px;font-size:13px;background:#fff;outline:none;font-family:inherit;transition:border-color .15s;
        }
        .pa-variant-field input:focus{border-color:#ff5722;background:#fff;}
        .pa-stock-badge{
          display:inline-flex;align-items:center;gap:4px;
          font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;margin-top:4px;
        }
        .pa-stock-badge--ok   {background:#f0fdf4;color:#16a34a;}
        .pa-stock-badge--low  {background:#fffbeb;color:#d97706;}
        .pa-stock-badge--zero {background:#fff5f5;color:#dc2626;}

        /* Price */
        .pa-price-wrap{position:relative;}
        .pa-price-symbol{
          position:absolute;left:14px;top:50%;transform:translateY(-50%);
          font-size:16px;font-weight:700;color:#ff5722;
        }
        .pa-price-input{
          width:100%;height:54px;border:1.5px solid #e8e6e0;border-radius:12px;
          padding:0 14px 0 34px;font-size:20px;font-weight:800;
          color:#1a1a1a;background:#fafaf8;outline:none;transition:border-color .15s;
        }
        .pa-price-input:focus{border-color:#ff5722;background:#fff;}
        .pa-discount-badge{
          display:inline-block;background:#dc2626;color:#fff;
          font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;margin-left:6px;
        }
        .pa-delivery-note{
          display:flex;align-items:flex-start;gap:8px;
          background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
          padding:11px 14px;font-size:12px;color:#166534;line-height:1.5;margin-bottom:18px;
        }

        /* Review */
        .pa-review-card{border:1.5px solid #e8e6e0;border-radius:16px;overflow:hidden;margin-bottom:20px;}
        .pa-review-img{
          width:100%;aspect-ratio:16/9;background:#f0eeea;
          display:flex;align-items:center;justify-content:center;color:#ccc;
        }
        .pa-review-img img{width:100%;height:100%;object-fit:cover;}
        .pa-review-body{padding:16px;}
        .pa-review-title{font-size:16px;font-weight:800;margin-bottom:4px;}
        .pa-review-price{font-size:22px;font-weight:900;color:#ff5722;}
        .pa-review-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
        .pa-review-pill{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:#f5f4f0;color:#555;}
        .pa-review-pill--cat{background:#fff4f0;color:#ff5722;}
        .pa-review-section{margin-top:12px;padding-top:12px;border-top:1px solid #f0eeea;}
        .pa-review-section h5{margin-bottom:6px;font-size:12px;text-transform:uppercase;letter-spacing:.7px;color:#888;}
        .pa-review-section ul{margin:0;padding-left:18px;color:#555;font-size:13px;line-height:1.6;}
        .pa-review-section li{margin-bottom:4px;}
        .pa-spec-table{width:100%;border-collapse:collapse;font-size:13px;}
        .pa-spec-table td{padding:5px 6px;color:#555;vertical-align:top;}
        .pa-spec-table td:first-child{color:#888;font-weight:600;width:42%;}

        /* Variant review chips */
        .pa-variant-review-list{display:flex;flex-direction:column;gap:8px;}
        .pa-variant-review-item{
          display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;
          padding:10px 12px;background:#f5f4f0;border-radius:10px;font-size:12px;
        }
        .pa-variant-review-name{font-weight:700;color:#1a1a1a;}
        .pa-variant-review-right{display:flex;gap:8px;align-items:center;}
        .pa-variant-review-price{font-weight:800;color:#ff5722;}
        .pa-variant-review-stock{color:#888;}

        /* Submit */
        .pa-submit-btn{
          width:100%;height:52px;border-radius:14px;border:none;
          background:linear-gradient(135deg,#ff5722,#ff8a00);
          color:#fff;font-size:16px;font-weight:800;cursor:pointer;
          transition:opacity .15s,transform .15s;
        }
        .pa-submit-btn:hover:not(:disabled){opacity:.92;transform:translateY(-1px);}
        .pa-submit-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}

        /* Footer */
        .pa-footer{display:flex;gap:10px;padding:14px 20px 20px;border-top:1px solid #f0eeea;flex-shrink:0;}
        .pa-btn-back{
          height:48px;padding:0 20px;border-radius:12px;
          border:1.5px solid #e8e6e0;background:#fff;font-size:14px;font-weight:600;color:#555;cursor:pointer;
          display:flex;align-items:center;gap:6px;transition:all .15s;
        }
        .pa-btn-back:hover{border-color:#ff5722;color:#ff5722;}
        .pa-btn-next{
          flex:1;height:48px;border-radius:12px;border:none;background:#ff5722;
          color:#fff;font-size:15px;font-weight:700;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s,transform .15s;
        }
        .pa-btn-next:hover:not(:disabled){opacity:.9;transform:translateY(-1px);}
        .pa-btn-next:disabled{opacity:.45;cursor:not-allowed;transform:none;}

        /* Success */
        .pa-success{
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:40px 28px;text-align:center;gap:14px;min-height:360px;
        }
        .pa-success-icon{
          width:80px;height:80px;border-radius:50%;
          background:linear-gradient(135deg,#16a34a,#22c55e);
          display:flex;align-items:center;justify-content:center;color:#fff;
          animation:pa-pop .4s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes pa-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
        .pa-success h2{font-size:22px;font-weight:900;color:#1a1a1a;}
        .pa-success p{font-size:14px;color:#888;max-width:280px;line-height:1.6;}
        .pa-success-btns{display:flex;flex-direction:column;gap:10px;width:100%;margin-top:10px;}
        .pa-success-primary{height:50px;border-radius:14px;border:none;background:#ff5722;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}
        .pa-success-secondary{height:50px;border-radius:14px;border:1.5px solid #e8e6e0;background:#fff;color:#555;font-size:14px;font-weight:600;cursor:pointer;}

        /* Spinner */
        .pa-spinner{
          display:inline-block;width:20px;height:20px;
          border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;
          border-radius:50%;animation:pa-spin .7s linear infinite;
          vertical-align:middle;margin-right:6px;
        }
        @keyframes pa-spin{to{transform:rotate(360deg);}}
      `}</style>

      <div className="pa-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className="pa-sheet">

          {/* Header */}
          <div className="pa-header">
            <h2>Post an Ad</h2>
            <button type="button" className="pa-close-btn" onClick={() => onClose?.()}>
              <FiX size={16} />
            </button>
          </div>

          {/* Success */}
          {posted ? (
            <div className="pa-success">
              <div className="pa-success-icon"><FiCheckCircle size={36} /></div>
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
              <div className="pa-body">

                {/* ───── STEP 1: Photos ───── */}
                {step === 1 && (
                  <>
                    <p className="pa-section-title">Add Photos</p>
                    <p className="pa-section-sub">First photo = cover. More photos = more trust.</p>
                    <div className="pa-img-grid">
                      {images.map((img, i) => (
                        <ImageSlot key={i} index={i} preview={img?.preview}
                          onAdd={handleAddImage} onRemove={handleRemoveImage} isPrimary={i === 0} />
                      ))}
                    </div>
                    <div className="pa-img-tip">
                      <FiAlertCircle size={14} />
                      Well-lit photos only. No watermarks. Max 5 photos · 5MB each.
                    </div>
                  </>
                )}

                {/* ───── STEP 2: Details ───── */}
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
                        placeholder="Describe your product — features, condition, what's included..."
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
                              placeholder='e.g. "5000mAh long-life battery"'
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
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                              <input className="pa-mini-input" value={row.key} placeholder="e.g. RAM"
                                onChange={(e) => {
                                  const next = [...specifications];
                                  next[i] = { ...next[i], key: e.target.value };
                                  setSpecifications(next);
                                }} />
                              <input className="pa-mini-input" value={row.value} placeholder="e.g. 8GB"
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
                          onClick={() => setSpecifications((p) => p.length >= 10 ? p : [...p, { key:"", value:"" }])}>
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

                    {/* ── Category ── */}
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

                {/* ───── STEP 3: Variants ───── */}
                {step === 3 && (
                  <>
                    <p className="pa-section-title">Product Variants</p>
                    <p className="pa-section-sub">Each variant is a unique SKU — different colour, size, storage, etc.</p>

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

                          <div className="pa-variant-grid" style={{ marginBottom:10 }}>
                            <div className="pa-variant-field" style={{ gridColumn:"span 2" }}>
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
                                stock === 0 ? "pa-stock-badge--zero" :
                                stock <= 3  ? "pa-stock-badge--low"  : "pa-stock-badge--ok"
                              }`}>
                                {stock === 0 ? "Out of stock" : stock <= 3 ? `Only ${stock} left!` : `${stock} in stock`}
                              </span>
                            </div>
                          </div>

                          <p style={{ fontSize:11, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>
                            Attributes (fill what applies)
                          </p>
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
                              <input placeholder='e.g. "256GB"' value={v.attributes.storage}
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
                      <button type="button" className="pa-add-btn" style={{ height:48, fontSize:14 }}
                        onClick={addVariant}>
                        <FiPlus size={15} style={{ verticalAlign:"middle", marginRight:6 }} />
                        Add Another Variant
                      </button>
                    )}
                  </>
                )}

                {/* ───── STEP 4: Pricing ───── */}
                {step === 4 && (
                  <>
                    <p className="pa-section-title">Base Price</p>
                    <p className="pa-section-sub">Set the default price. Individual variants can have their own.</p>

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
                        <span className="pa-price-symbol" style={{ color:"#bbb" }}>₦</span>
                        <input className="pa-price-input" type="text" inputMode="numeric" placeholder="0"
                          style={{ fontSize:16, fontWeight:600 }}
                          value={originalPrice ? Number(originalPrice).toLocaleString() : ""}
                          onChange={(e) => setOriginalPrice(e.target.value.replace(/\D/g, ""))} />
                      </div>
                      {discountPct > 0 && (
                        <p style={{ fontSize:12, color:"#16a34a", fontWeight:600, marginTop:6 }}>
                          🏷️ Buyer saves ₦{(Number(originalPrice) - Number(basePrice)).toLocaleString()}
                          <span className="pa-discount-badge">-{discountPct}%</span>
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* ───── STEP 5: Review ───── */}
                {step === 5 && (
                  <>
                    <p className="pa-section-title">Review Your Ad</p>
                    <p className="pa-section-sub">Looks good? Hit Post Ad to go live instantly.</p>

                    <div className="pa-review-card">
                      <div className="pa-review-img">
                        {filledImages[0]
                          ? <img src={filledImages[0].preview} alt="cover" />
                          : <FiPackage size={40} />}
                      </div>
                      <div className="pa-review-body">
                        <div className="pa-review-title">{title || "—"}</div>

                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginTop:4, marginBottom:8 }}>
                          <span className="pa-review-price">₦{Number(basePrice || 0).toLocaleString()}</span>
                          {originalPrice && (
                            <span style={{ textDecoration:"line-through", color:"#bbb", fontSize:13 }}>
                              ₦{Number(originalPrice).toLocaleString()}
                            </span>
                          )}
                          {discountPct > 0 && <span className="pa-discount-badge">-{discountPct}%</span>}
                        </div>

                        {description && (
                          <p style={{ fontSize:13, color:"#555", lineHeight:1.5, marginBottom:8 }}>
                            {description.slice(0, 120)}{description.length > 120 ? "..." : ""}
                          </p>
                        )}

                        <div className="pa-review-pills">
                          {/* ── Now uses categories from config ── */}
                          <span className="pa-review-pill pa-review-pill--cat">
                            {activeCategory?.icon}{" "}
                            {activeCategory?.name || category}
                          </span>
                          <span className="pa-review-pill">
                            {filledImages.length} photo{filledImages.length !== 1 ? "s" : ""}
                          </span>
                          <span className="pa-review-pill">
                            {variants.length} variant{variants.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Variants */}
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

                    <button className="pa-submit-btn" disabled={posting} onClick={handleSubmit}>
                      {posting ? <><span className="pa-spinner" />Posting...</> : "🚀 Post Ad Now"}
                    </button>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="pa-footer">
                {step > 1 && (
                  <button type="button" className="pa-btn-back" onClick={() => setStep((s) => s - 1)}>
                    <FiChevronLeft size={16} /> Back
                  </button>
                )}
                {step < 5 && (
                  <button type="button" className="pa-btn-next" disabled={!canNext()}
                    onClick={() => setStep((s) => s + 1)}>
                    Continue <FiChevronRight size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}