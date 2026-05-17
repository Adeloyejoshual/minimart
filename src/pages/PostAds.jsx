import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiCamera,
  FiTag,
  FiMapPin,
  FiDollarSign,
  FiFileText,
  FiCheckCircle,
  FiTrash2,
  FiAlertCircle,
  FiPackage,
  FiPlus,
  FiList,
  FiSliders,
  FiClipboard,
} from "react-icons/fi";

const API = "https://minimart-ivrm.onrender.com/api";

const CATEGORIES = [
  { label: "Electronics", value: "electronics", emoji: "📱" },
  { label: "Fashion",     value: "fashion",     emoji: "👗" },
  { label: "Food",        value: "food",        emoji: "🍔" },
  { label: "Home",        value: "home",        emoji: "🏠" },
  { label: "Beauty",      value: "beauty",      emoji: "💄" },
  { label: "Sports",      value: "sports",      emoji: "⚽" },
  { label: "Books",       value: "books",       emoji: "📚" },
  { label: "Toys",        value: "toys",        emoji: "🧸" },
  { label: "Vehicles",    value: "vehicles",    emoji: "🚗" },
  { label: "Services",    value: "services",    emoji: "🛠️" },
  { label: "Other",       value: "other",       emoji: "📦" },
];

const CONDITIONS = [
  { label: "Brand New",   value: "new",         desc: "Never used, original packaging" },
  { label: "Used",        value: "used",        desc: "Previously owned, still works well" },
  { label: "Refurbished", value: "refurbished", desc: "Restored to working condition" },
];

const STEPS = [
  { id: 1, label: "Photos",  icon: <FiCamera size={16} /> },
  { id: 2, label: "Details", icon: <FiTag size={16} /> },
  { id: 3, label: "Info",    icon: <FiList size={16} /> },
  { id: 4, label: "Pricing", icon: <FiDollarSign size={16} /> },
  { id: 5, label: "Review",  icon: <FiFileText size={16} /> },
];

function StepBar({ current }) {
  return (
    <div className="pa-stepbar">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={`pa-step ${current === s.id ? "pa-step--active" : ""} ${current > s.id ? "pa-step--done" : ""}`}>
            <div className="pa-step-dot">
              {current > s.id ? <FiCheckCircle size={13} /> : s.icon}
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

function ImageUploadSlot({ preview, onAdd, onRemove, index, isPrimary }) {
  const inputRef = useRef();
  return (
    <div className={`pa-img-slot ${isPrimary ? "pa-img-slot--primary" : ""}`}>
      {preview ? (
        <>
          <img src={preview} alt="preview" className="pa-img-preview" />
          {isPrimary && <span className="pa-img-cover-tag">Cover</span>}
          <button className="pa-img-remove" onClick={() => onRemove(index)}>
            <FiTrash2 size={13} />
          </button>
        </>
      ) : (
        <button className="pa-img-add" onClick={() => inputRef.current.click()}>
          <FiCamera size={isPrimary ? 26 : 20} />
          {isPrimary && <span>Add Cover Photo</span>}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onAdd(index, e.target.files[0])}
      />
    </div>
  );
}

export default function PostAds({ user, onClose, onPosted }) {
  const navigate = useNavigate();
  const [step, setStep]       = useState(1);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted]   = useState(false);

  const [images, setImages]               = useState(Array(5).fill(null));
  const [title, setTitle]                 = useState("");
  const [description, setDescription]     = useState("");
  const [category, setCategory]           = useState("");
  const [condition, setCondition]         = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [features, setFeatures]           = useState([""]);
  const [specs, setSpecs]                 = useState([{ key: "", value: "" }]);
  const [price, setPrice]                 = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [negotiable, setNegotiable]       = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  /* ── Load draft on mount ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adDraft");
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.title)       setTitle(d.title);
      if (d.description) setDescription(d.description);
      if (d.category)    setCategory(d.category);
      if (d.condition)   setCondition(d.condition);
      if (d.conditionNotes) setConditionNotes(d.conditionNotes);
      if (Array.isArray(d.features) && d.features.length) setFeatures(d.features);
      if (Array.isArray(d.specs)    && d.specs.length)    setSpecs(d.specs);
      if (d.price)       setPrice(d.price);
      if (d.originalPrice) setOriginalPrice(d.originalPrice);
      if (typeof d.negotiable === "boolean") setNegotiable(d.negotiable);
      setDraftRestored(true);
    } catch {}
  }, []);

  /* ── Auto-save draft on every change (images excluded — can't serialise File) ── */
  useEffect(() => {
    const draft = { title, description, category, condition, conditionNotes, features, specs, price, originalPrice, negotiable };
    localStorage.setItem("adDraft", JSON.stringify(draft));
  }, [title, description, category, condition, conditionNotes, features, specs, price, originalPrice, negotiable]);

  const handleAddImage = (index, file) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImages((prev) => {
        const next = [...prev];
        next[index] = { file, preview: e.target.result };
        return next;
      });
    };
    reader.readAsDataURL(file);
  };
  const handleRemoveImage = (index) => {
    setImages((prev) => { const next = [...prev]; next[index] = null; return next; });
  };
  const filledImages = images.filter(Boolean);

  const addFeature    = () => setFeatures((f) => [...f, ""]);
  const removeFeature = (i) => setFeatures((f) => f.filter((_, idx) => idx !== i));
  const updateFeature = (i, val) => setFeatures((f) => f.map((x, idx) => idx === i ? val : x));

  const addSpec    = () => setSpecs((s) => [...s, { key: "", value: "" }]);
  const removeSpec = (i) => setSpecs((s) => s.filter((_, idx) => idx !== i));
  const updateSpec = (i, field, val) => setSpecs((s) => s.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  const canNext = () => {
    if (step === 1) return filledImages.length > 0;
    if (step === 2) return title.trim().length >= 3 && category && condition;
    if (step === 3) return true;
    if (step === 4) return price && Number(price) > 0;
    return true;
  };

  /* ── Listing Quality Score ── */
  const getListingScore = () => {
    let score = 0;
    if (filledImages.length >= 1) score += 10;
    if (filledImages.length >= 3) score += 10;
    if (filledImages.length >= 5) score += 5;
    if (title.length >= 20)       score += 15;
    if (description.length >= 50) score += 15;
    if (features.filter((f) => f.trim()).length >= 3) score += 10;
    if (specs.filter((s) => s.key && s.value).length >= 3) score += 10;
    if (conditionNotes.trim().length >= 10) score += 10;
    if (price)    score += 10;
    return Math.min(score, 100);
  };

  const getSuggestions = () => {
    const tips = [];
    if (filledImages.length < 3)  tips.push({ icon: "📸", text: "Add at least 3 photos" });
    if (title.length < 20)        tips.push({ icon: "✏️", text: "Make your title more descriptive (20+ chars)" });
    if (description.length < 50)  tips.push({ icon: "📝", text: "Write a longer description (50+ chars)" });
    if (features.filter((f) => f.trim()).length < 3) tips.push({ icon: "⭐", text: "List at least 3 key features" });
    if (specs.filter((s) => s.key && s.value).length < 3) tips.push({ icon: "📋", text: "Add at least 3 specifications" });
    if (!conditionNotes.trim())   tips.push({ icon: "🔍", text: "Describe the item's condition" });
    return tips;
  };

  const score       = getListingScore();
  const suggestions = getSuggestions();
  const scoreColor  = score >= 80 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#dc2626";
  const scoreLabel  = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Weak";

  const handleSubmit = async () => {
    if (!user) { toast.error("Please log in first"); return; }
    setPosting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("name", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("condition", condition);
      if (conditionNotes.trim()) formData.append("conditionNotes", conditionNotes.trim());
      formData.append("price", price);
      if (originalPrice) formData.append("originalPrice", originalPrice);
      formData.append("negotiable", negotiable);
      const cleanFeatures = features.filter((f) => f.trim());
      if (cleanFeatures.length) formData.append("features", JSON.stringify(cleanFeatures));
      const cleanSpecs = specs.filter((s) => s.key.trim() && s.value.trim());
      if (cleanSpecs.length) formData.append("specs", JSON.stringify(cleanSpecs));
      images.forEach((img) => { if (img) formData.append("images", img.file); });
      await axios.post(`${API}/products`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      localStorage.removeItem("adDraft");
      setPosted(true);
      onPosted?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to post ad. Try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <style>{`
        .pa-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.55);
          z-index: 500; display: flex; align-items: flex-end; justify-content: center;
        }
        @media(min-width:640px){ .pa-overlay{ align-items: center; } }
        .pa-sheet {
          background: #fff; width: 100%; max-width: 580px;
          border-radius: 22px 22px 0 0; max-height: 96vh;
          display: flex; flex-direction: column; overflow: hidden;
          animation: pa-up .28s cubic-bezier(.22,1,.36,1);
        }
        @media(min-width:640px){ .pa-sheet{ border-radius: 22px; max-height: 90vh; } }
        @keyframes pa-up { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }

        .pa-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px; border-bottom: 1px solid #f0eeea; flex-shrink: 0;
        }
        .pa-header h2 {
          font-size: 18px; font-weight: 800;
          background: linear-gradient(135deg,#ff5722,#ff8a00);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .pa-close-btn {
          width: 34px; height: 34px; border-radius: 50%;
          border: 1.5px solid #e8e6e0; background: #fafaf8;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #555; transition: all .15s;
        }
        .pa-close-btn:hover { background: #fee; border-color: #dc2626; color: #dc2626; }

        .pa-stepbar {
          display: flex; align-items: center; padding: 12px 14px;
          background: #fafaf8; border-bottom: 1px solid #f0eeea;
          overflow-x: auto; scrollbar-width: none; flex-shrink: 0;
        }
        .pa-stepbar::-webkit-scrollbar{ display:none; }
        .pa-step { display:flex; flex-direction:column; align-items:center; gap:3px; flex-shrink:0; }
        .pa-step-dot {
          width:30px; height:30px; border-radius:50%; border:2px solid #e8e6e0;
          display:flex; align-items:center; justify-content:center;
          color:#bbb; background:#fff; transition:all .2s;
        }
        .pa-step--active .pa-step-dot { border-color:#ff5722; color:#ff5722; background:#fff4f0; }
        .pa-step--done   .pa-step-dot { border-color:#16a34a; color:#16a34a; background:#f0fdf4; }
        .pa-step-label { font-size:9px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.5px; }
        .pa-step--active .pa-step-label { color:#ff5722; }
        .pa-step--done   .pa-step-label { color:#16a34a; }
        .pa-step-line { flex:1; height:2px; background:#e8e6e0; margin:0 5px; margin-bottom:14px; transition:background .2s; }
        .pa-step-line--done { background:#16a34a; }

        .pa-body { flex:1; overflow-y:auto; padding:20px; scrollbar-width:thin; }
        .pa-section-title { font-size:16px; font-weight:800; color:#1a1a1a; margin-bottom:4px; }
        .pa-section-sub   { font-size:13px; color:#888; margin-bottom:20px; }

        .pa-field { margin-bottom:18px; }
        .pa-label {
          display:flex; align-items:center; gap:6px;
          font-size:12px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.7px; color:#555; margin-bottom:8px;
        }
        .pa-label svg { color:#ff5722; }
        .pa-input, .pa-textarea {
          width:100%; border:1.5px solid #e8e6e0; border-radius:12px;
          padding:12px 14px; font-size:14px; background:#fafaf8; outline:none;
          transition:border-color .15s,background .15s; font-family:inherit; color:#1a1a1a;
        }
        .pa-input:focus, .pa-textarea:focus { border-color:#ff5722; background:#fff; }
        .pa-textarea { resize:vertical; min-height:88px; }
        .pa-char-count { text-align:right; font-size:11px; color:#bbb; margin-top:4px; }
        .pa-char-count--warn { color:#f59e0b; }

        .pa-img-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .pa-img-slot {
          position:relative; aspect-ratio:1; border-radius:14px; overflow:hidden;
          border:2px dashed #e8e6e0; background:#fafaf8; transition:border-color .15s;
        }
        .pa-img-slot--primary { grid-column:span 2; aspect-ratio:16/9; }
        .pa-img-slot:hover { border-color:#ff5722; }
        .pa-img-add {
          width:100%; height:100%; background:none; border:none;
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:8px; color:#ccc; cursor:pointer;
          font-size:13px; font-weight:600; transition:color .15s;
        }
        .pa-img-add:hover { color:#ff5722; }
        .pa-img-preview { width:100%; height:100%; object-fit:cover; }
        .pa-img-cover-tag {
          position:absolute; bottom:8px; left:8px;
          background:rgba(0,0,0,.65); color:#fff;
          font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px;
        }
        .pa-img-remove {
          position:absolute; top:8px; right:8px; width:28px; height:28px;
          border-radius:50%; background:rgba(220,38,38,.9); color:#fff;
          border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
        }
        .pa-img-tip {
          display:flex; align-items:flex-start; gap:8px;
          background:#fff8f0; border:1px solid #ffe0cc; border-radius:10px;
          padding:12px; font-size:12px; color:#c2440c; margin-top:16px; line-height:1.5;
        }

        .pa-cat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .pa-cat-btn {
          display:flex; flex-direction:column; align-items:center; gap:4px;
          padding:12px 8px; border:1.5px solid #e8e6e0; border-radius:12px;
          background:#fafaf8; cursor:pointer; transition:all .15s;
          font-size:12px; font-weight:600; color:#555;
        }
        .pa-cat-btn:hover { border-color:#ff5722; color:#ff5722; background:#fff4f0; }
        .pa-cat-btn--active { border-color:#ff5722; background:#ff5722; color:#fff; }
        .pa-cat-emoji { font-size:22px; line-height:1; }

        .pa-cond-list { display:flex; flex-direction:column; gap:10px; }
        .pa-cond-item {
          display:flex; align-items:center; gap:12px; padding:14px;
          border:1.5px solid #e8e6e0; border-radius:12px;
          background:#fafaf8; cursor:pointer; transition:all .15s;
        }
        .pa-cond-item:hover { border-color:#ff5722; }
        .pa-cond-item--active { border-color:#ff5722; background:#fff4f0; }
        .pa-cond-radio {
          width:20px; height:20px; border-radius:50%; border:2px solid #ddd;
          flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all .15s;
        }
        .pa-cond-item--active .pa-cond-radio { border-color:#ff5722; background:#ff5722; }
        .pa-cond-item--active .pa-cond-radio::after { content:""; width:8px; height:8px; border-radius:50%; background:#fff; }
        .pa-cond-name { font-size:14px; font-weight:700; color:#1a1a1a; }
        .pa-cond-desc { font-size:12px; color:#888; }

        /* condition notes */
        .pa-notes-wrap {
          background:#fffbf0; border:1.5px solid #fde68a;
          border-radius:12px; padding:14px; margin-top:16px;
        }
        .pa-notes-label {
          display:flex; align-items:center; gap:6px;
          font-size:12px; font-weight:700; color:#92400e;
          text-transform:uppercase; letter-spacing:0.7px; margin-bottom:8px;
        }
        .pa-notes-textarea {
          width:100%; border:1.5px solid #fde68a; border-radius:10px;
          padding:10px 12px; font-size:13px; background:#fff; outline:none;
          font-family:inherit; color:#1a1a1a; resize:vertical; min-height:72px;
          transition:border-color .15s;
        }
        .pa-notes-textarea:focus { border-color:#f59e0b; }
        .pa-notes-hint { font-size:11px; color:#a16207; margin-top:5px; }

        /* key features */
        .pa-feature-list { display:flex; flex-direction:column; gap:8px; }
        .pa-feature-row  { display:flex; align-items:center; gap:8px; }
        .pa-feature-input {
          flex:1; border:1.5px solid #e8e6e0; border-radius:10px;
          padding:10px 14px; font-size:14px; background:#fafaf8; outline:none;
          font-family:inherit; color:#1a1a1a; transition:border-color .15s;
        }
        .pa-feature-input:focus { border-color:#ff5722; background:#fff; }
        .pa-feature-input::placeholder { color:#bbb; }
        .pa-feature-remove {
          width:34px; height:34px; border-radius:50%;
          border:1.5px solid #fecaca; background:#fff5f5; color:#dc2626;
          cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;
          transition:all .15s;
        }
        .pa-feature-remove:hover { background:#dc2626; color:#fff; border-color:#dc2626; }
        .pa-add-btn {
          display:flex; align-items:center; gap:6px;
          padding:9px 16px; border-radius:10px;
          border:1.5px dashed #ff5722; background:#fff4f0;
          color:#ff5722; font-size:13px; font-weight:700;
          cursor:pointer; margin-top:8px; transition:all .15s;
        }
        .pa-add-btn:hover { background:#ff5722; color:#fff; }

        /* specs */
        .pa-spec-list { display:flex; flex-direction:column; gap:8px; }
        .pa-spec-row { display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:center; }
        .pa-spec-input {
          border:1.5px solid #e8e6e0; border-radius:10px;
          padding:10px 12px; font-size:13px; background:#fafaf8; outline:none;
          font-family:inherit; color:#1a1a1a; transition:border-color .15s;
        }
        .pa-spec-input:focus { border-color:#ff5722; background:#fff; }
        .pa-spec-input::placeholder { color:#bbb; }
        .pa-spec-headers { display:grid; grid-template-columns:1fr 1fr auto; gap:8px; margin-bottom:4px; }
        .pa-spec-header { font-size:10px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.5px; padding-left:4px; }

        /* pricing */
        .pa-price-wrap { position:relative; }
        .pa-price-symbol { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:16px; font-weight:700; color:#ff5722; }
        .pa-price-input {
          width:100%; height:54px; border:1.5px solid #e8e6e0; border-radius:12px;
          padding:0 14px 0 34px; font-size:20px; font-weight:800; color:#1a1a1a;
          background:#fafaf8; outline:none; transition:border-color .15s;
        }
        .pa-price-input:focus { border-color:#ff5722; background:#fff; }
        .pa-toggle-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:14px; border:1.5px solid #e8e6e0; border-radius:12px; background:#fafaf8;
        }
        .pa-toggle-info h4 { font-size:14px; font-weight:700; }
        .pa-toggle-info p  { font-size:12px; color:#888; }
        .pa-toggle { width:44px; height:24px; border-radius:12px; border:none; cursor:pointer; transition:background .2s; position:relative; background:#e8e6e0; }
        .pa-toggle--on { background:#ff5722; }
        .pa-toggle::after { content:""; position:absolute; width:18px; height:18px; border-radius:50%; background:#fff; top:3px; left:3px; transition:transform .2s; box-shadow:0 1px 4px rgba(0,0,0,.2); }
        .pa-toggle--on::after { transform:translateX(20px); }

        .pa-loc-icon-wrap {
          width:64px; height:64px; border-radius:50%;
          background:#fff4f0; border:2px solid #ffd5c8;
          display:flex; align-items:center; justify-content:center;
          color:#ff5722; margin:0 auto 20px;
        }

        /* review */
        .pa-review-card { border:1.5px solid #e8e6e0; border-radius:16px; overflow:hidden; margin-bottom:16px; }
        .pa-review-img { width:100%; aspect-ratio:16/9; background:#f0eeea; display:flex; align-items:center; justify-content:center; color:#ccc; }
        .pa-review-img img { width:100%; height:100%; object-fit:cover; }
        .pa-review-body { padding:16px; }
        .pa-review-title { font-size:16px; font-weight:800; margin-bottom:4px; }
        .pa-review-price { font-size:22px; font-weight:900; color:#ff5722; margin-bottom:8px; }
        .pa-review-row { display:flex; align-items:center; gap:6px; font-size:12px; color:#888; margin-bottom:4px; }
        .pa-review-pills { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
        .pa-review-pill { padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; background:#f5f4f0; color:#555; }
        .pa-review-pill--cat  { background:#fff4f0; color:#ff5722; }
        .pa-review-pill--cond { background:#f0fdf4; color:#16a34a; }
        .pa-review-section { margin-top:14px; padding-top:14px; border-top:1px solid #f0eeea; }
        .pa-review-section-title { font-size:11px; font-weight:800; color:#aaa; text-transform:uppercase; letter-spacing:0.7px; margin-bottom:8px; display:flex; align-items:center; gap:5px; }
        .pa-review-feature { display:flex; align-items:flex-start; gap:7px; font-size:13px; color:#444; margin-bottom:5px; }
        .pa-review-feature::before { content:"•"; color:#ff5722; font-weight:900; flex-shrink:0; }
        .pa-review-spec-row { display:flex; justify-content:space-between; font-size:12px; padding:5px 0; border-bottom:1px dashed #f0eeea; }
        .pa-review-spec-row:last-child { border-bottom:none; }
        .pa-review-spec-key   { color:#888; font-weight:600; }
        .pa-review-spec-value { color:#1a1a1a; font-weight:700; }
        .pa-review-notes { background:#fffbf0; border:1px solid #fde68a; border-radius:10px; padding:10px 12px; font-size:13px; color:#78350f; line-height:1.5; }

        .pa-submit-btn {
          width:100%; height:52px; border-radius:14px; border:none;
          background:linear-gradient(135deg,#ff5722,#ff8a00);
          color:#fff; font-size:16px; font-weight:800;
          cursor:pointer; transition:opacity .15s,transform .15s;
        }
        .pa-submit-btn:hover { opacity:.92; transform:translateY(-1px); }
        .pa-submit-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }

        .pa-footer { display:flex; gap:10px; padding:14px 20px 20px; border-top:1px solid #f0eeea; flex-shrink:0; }
        .pa-btn-back {
          height:48px; padding:0 20px; border-radius:12px; border:1.5px solid #e8e6e0;
          background:#fff; font-size:14px; font-weight:600; color:#555; cursor:pointer;
          display:flex; align-items:center; gap:6px; transition:all .15s;
        }
        .pa-btn-back:hover { border-color:#ff5722; color:#ff5722; }
        .pa-btn-next {
          flex:1; height:48px; border-radius:12px; border:none; background:#ff5722;
          color:#fff; font-size:15px; font-weight:700; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:6px;
          transition:opacity .15s,transform .15s;
        }
        .pa-btn-next:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
        .pa-btn-next:disabled { opacity:.45; cursor:not-allowed; transform:none; }

        .pa-success {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:40px 28px; text-align:center; gap:14px; min-height:380px;
        }
        .pa-success-icon {
          width:80px; height:80px; border-radius:50%;
          background:linear-gradient(135deg,#16a34a,#22c55e);
          display:flex; align-items:center; justify-content:center; color:#fff;
          animation:pa-pop .4s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes pa-pop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
        .pa-success h2 { font-size:22px; font-weight:900; color:#1a1a1a; }
        .pa-success p  { font-size:14px; color:#888; max-width:280px; line-height:1.6; }
        .pa-success-btns { display:flex; flex-direction:column; gap:10px; width:100%; margin-top:10px; }
        .pa-success-primary { height:50px; border-radius:14px; border:none; background:#ff5722; color:#fff; font-size:15px; font-weight:700; cursor:pointer; }
        .pa-success-secondary { height:50px; border-radius:14px; border:1.5px solid #e8e6e0; background:#fff; color:#555; font-size:14px; font-weight:600; cursor:pointer; }

        .pa-spinner { width:20px; height:20px; display:inline-block; border:2.5px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:pa-spin .7s linear infinite; vertical-align:middle; margin-right:6px; }
        @keyframes pa-spin { to{ transform:rotate(360deg); } }

        /* ── Quality Score Bar ── */
        .pa-quality-bar {
          margin: 0 20px 14px;
          padding: 12px 14px;
          background: #fafaf8;
          border: 1.5px solid #e8e6e0;
          border-radius: 14px;
          flex-shrink: 0;
        }
        .pa-quality-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .pa-quality-label {
          font-size: 12px; font-weight: 700; color: #555;
          display: flex; align-items: center; gap: 6px;
        }
        .pa-quality-pct { font-size: 13px; font-weight: 900; }
        .pa-quality-track {
          height: 6px; background: #e8e6e0; border-radius: 999px;
          overflow: hidden; margin-bottom: 10px;
        }
        .pa-quality-fill {
          height: 100%; border-radius: 999px;
          transition: width .4s cubic-bezier(.22,1,.36,1);
        }
        .pa-quality-tips { display: flex; flex-direction: column; gap: 5px; }
        .pa-quality-tip {
          display: flex; align-items: center; gap: 7px;
          font-size: 11px; color: #888; line-height: 1.4;
        }
        .pa-quality-tip-icon { font-size: 13px; flex-shrink: 0; }

        /* ── Draft Banner ── */
        .pa-draft-banner {
          display: flex; align-items: center; justify-content: space-between;
          background: #fffbeb; border-bottom: 1px solid #fde68a;
          padding: 9px 20px; font-size: 12px; color: #92400e;
          flex-shrink: 0; gap: 8px;
        }
        .pa-draft-banner-left { display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .pa-draft-discard {
          background: none; border: none; color: #92400e; cursor: pointer;
          font-size: 11px; font-weight: 700; text-decoration: underline;
          white-space: nowrap; padding: 0;
        }
      `}</style>

      <div className="pa-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className="pa-sheet">
          <div className="pa-header">
            <h2>Post an Ad</h2>
            <button className="pa-close-btn" onClick={onClose}><FiX size={16} /></button>
          </div>

          {/* ── Draft Restored Banner ── */}
          {draftRestored && !posted && (
            <div className="pa-draft-banner">
              <span className="pa-draft-banner-left">💾 Draft restored — pick up where you left off</span>
              <button
                className="pa-draft-discard"
                onClick={() => {
                  localStorage.removeItem("adDraft");
                  setTitle(""); setDescription(""); setCategory("");
                  setCondition(""); setConditionNotes("");
                  setFeatures([""]); setSpecs([{ key: "", value: "" }]);
                  setPrice(""); setOriginalPrice(""); setNegotiable(false);
                  setDraftRestored(false);
                }}
              >
                Discard
              </button>
            </div>
          )}

          {posted ? (
            <div className="pa-success">
              <div className="pa-success-icon"><FiCheckCircle size={36} /></div>
              <h2>Ad Posted! 🎉</h2>
              <p>Your listing is now live. Buyers in your area can see it right away.</p>
              <div className="pa-success-btns">
                <button className="pa-success-primary" onClick={() => navigate("/minimart")}>Browse Minimart</button>
                <button className="pa-success-secondary" onClick={() => navigate("/dashboard")}>View My Listings</button>
              </div>
            </div>
          ) : (
            <>
              <StepBar current={step} />

              {/* ── Listing Quality Score ── */}
              {score < 100 && suggestions.length > 0 && (
                <div className="pa-quality-bar">
                  <div className="pa-quality-row">
                    <span className="pa-quality-label">📊 Listing Quality</span>
                    <span className="pa-quality-pct" style={{ color: scoreColor }}>
                      {score}% · {scoreLabel}
                    </span>
                  </div>
                  <div className="pa-quality-track">
                    <div
                      className="pa-quality-fill"
                      style={{ width: `${score}%`, background: scoreColor }}
                    />
                  </div>
                  {suggestions.slice(0, 3).map((tip, i) => (
                    <div className="pa-quality-tip" key={i}>
                      <span className="pa-quality-tip-icon">{tip.icon}</span>
                      <span>{tip.text}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pa-body">

                {/* STEP 1 – Photos */}
                {step === 1 && (
                  <>
                    <p className="pa-section-title">Add Photos</p>
                    <p className="pa-section-sub">First photo becomes your cover. More photos = more sales.</p>
                    <div className="pa-img-grid">
                      {images.map((img, i) => (
                        <ImageUploadSlot key={i} index={i} preview={img?.preview}
                          onAdd={handleAddImage} onRemove={handleRemoveImage} isPrimary={i === 0} />
                      ))}
                    </div>
                    <div className="pa-img-tip">
                      <FiAlertCircle size={14} />
                      Use clear, well-lit photos. Avoid watermarks or text overlays. Max 5 photos.
                    </div>
                  </>
                )}

                {/* STEP 2 – Details */}
                {step === 2 && (
                  <>
                    <p className="pa-section-title">Product Details</p>
                    <p className="pa-section-sub">Be specific — clear titles get 3× more views.</p>

                    <div className="pa-field">
                      <label className="pa-label"><FiTag size={13} /> Title *</label>
                      <input className="pa-input"
                        placeholder='e.g. "iPhone 14 Pro Max 256GB Space Black"'
                        value={title} maxLength={80}
                        onChange={(e) => setTitle(e.target.value)} />
                      <p className={`pa-char-count ${title.length > 70 ? "pa-char-count--warn" : ""}`}>{title.length}/80</p>
                    </div>

                    <div className="pa-field">
                      <label className="pa-label"><FiFileText size={13} /> Description</label>
                      <textarea className="pa-textarea"
                        placeholder="Describe your item — what it is, how old it is, what's included..."
                        value={description} maxLength={500}
                        onChange={(e) => setDescription(e.target.value)} />
                      <p className={`pa-char-count ${description.length > 460 ? "pa-char-count--warn" : ""}`}>{description.length}/500</p>
                    </div>

                    <div className="pa-field">
                      <label className="pa-label"><FiTag size={13} /> Category *</label>
                      <div className="pa-cat-grid">
                        {CATEGORIES.map((c) => (
                          <button key={c.value}
                            className={`pa-cat-btn ${category === c.value ? "pa-cat-btn--active" : ""}`}
                            onClick={() => setCategory(c.value)}>
                            <span className="pa-cat-emoji">{c.emoji}</span>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pa-field">
                      <label className="pa-label"><FiClipboard size={13} /> Condition *</label>
                      <div className="pa-cond-list">
                        {CONDITIONS.map((c) => (
                          <div key={c.value}
                            className={`pa-cond-item ${condition === c.value ? "pa-cond-item--active" : ""}`}
                            onClick={() => setCondition(c.value)}>
                            <div className="pa-cond-radio" />
                            <div>
                              <div className="pa-cond-name">{c.label}</div>
                              <div className="pa-cond-desc">{c.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Condition Notes */}
                      {condition && (
                        <div className="pa-notes-wrap">
                          <div className="pa-notes-label">
                            <FiAlertCircle size={12} /> Condition Notes
                          </div>
                          <textarea className="pa-notes-textarea"
                            placeholder={
                              condition === "new"
                                ? "e.g. Still in original sealed box, never opened"
                                : condition === "used"
                                ? "e.g. Minor scratch on back panel, screen is perfect, battery 89%"
                                : "e.g. Professionally refurbished, new battery, 3-month warranty"
                            }
                            value={conditionNotes} maxLength={300}
                            onChange={(e) => setConditionNotes(e.target.value)} />
                          <p className="pa-notes-hint">Be honest — buyers trust transparent sellers more.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* STEP 3 – Key Features & Specs */}
                {step === 3 && (
                  <>
                    <p className="pa-section-title">Features & Specifications</p>
                    <p className="pa-section-sub">Optional but boosts buyer confidence significantly.</p>

                    <div className="pa-field">
                      <label className="pa-label"><FiList size={13} /> Key Features</label>
                      <div className="pa-feature-list">
                        {features.map((feat, i) => (
                          <div className="pa-feature-row" key={i}>
                            <input className="pa-feature-input"
                              placeholder={`e.g. "5000mAh long-life battery"`}
                              value={feat}
                              onChange={(e) => updateFeature(i, e.target.value)} />
                            {features.length > 1 && (
                              <button className="pa-feature-remove" onClick={() => removeFeature(i)}>
                                <FiTrash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {features.length < 8 && (
                        <button className="pa-add-btn" onClick={addFeature}>
                          <FiPlus size={14} /> Add Feature
                        </button>
                      )}
                    </div>

                    <div className="pa-field">
                      <label className="pa-label"><FiSliders size={13} /> Specifications</label>
                      <div className="pa-spec-headers">
                        <span className="pa-spec-header">Name</span>
                        <span className="pa-spec-header">Value</span>
                        <span />
                      </div>
                      <div className="pa-spec-list">
                        {specs.map((spec, i) => (
                          <div className="pa-spec-row" key={i}>
                            <input className="pa-spec-input" placeholder='e.g. "RAM"'
                              value={spec.key} onChange={(e) => updateSpec(i, "key", e.target.value)} />
                            <input className="pa-spec-input" placeholder='e.g. "8GB"'
                              value={spec.value} onChange={(e) => updateSpec(i, "value", e.target.value)} />
                            {specs.length > 1 && (
                              <button className="pa-feature-remove" onClick={() => removeSpec(i)}>
                                <FiTrash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {specs.length < 10 && (
                        <button className="pa-add-btn" onClick={addSpec}>
                          <FiPlus size={14} /> Add Specification
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* STEP 4 – Pricing */}
                {step === 4 && (
                  <>
                    <p className="pa-section-title">Set Your Price</p>
                    <p className="pa-section-sub">Competitive pricing gets faster sales.</p>

                    <div className="pa-field">
                      <label className="pa-label"><FiDollarSign size={13} /> Selling Price (₦) *</label>
                      <div className="pa-price-wrap">
                        <span className="pa-price-symbol">₦</span>
                        <input className="pa-price-input" type="number" placeholder="0"
                          value={price} min={0} onChange={(e) => setPrice(e.target.value)} />
                      </div>
                    </div>

                    <div className="pa-field">
                      <label className="pa-label" style={{ color:"#aaa" }}>
                        <FiDollarSign size={13} /> Original Price (₦) — optional
                      </label>
                      <div className="pa-price-wrap">
                        <span className="pa-price-symbol" style={{ color:"#bbb" }}>₦</span>
                        <input className="pa-price-input" type="number" placeholder="0"
                          value={originalPrice} min={0} style={{ fontSize:16, fontWeight:600 }}
                          onChange={(e) => setOriginalPrice(e.target.value)} />
                      </div>
                      <p style={{ fontSize:12, color:"#888", marginTop:6 }}>Shows a strikethrough discount badge on your listing.</p>
                    </div>

                    <div className="pa-field">
                      <div className="pa-toggle-row">
                        <div className="pa-toggle-info">
                          <h4>Open to Negotiation</h4>
                          <p>Buyers can make offers on your price</p>
                        </div>
                        <button className={`pa-toggle ${negotiable ? "pa-toggle--on" : ""}`}
                          onClick={() => setNegotiable((p) => !p)} />
                      </div>
                    </div>
                  </>
                )}

                {/* STEP 5 – Review */}
                {step === 5 && (
                  <>
                    <p className="pa-section-title">Review Your Ad</p>
                    <p className="pa-section-sub">Looks good? Hit Post Ad to go live instantly.</p>
                    <div className="pa-review-card">
                      <div className="pa-review-img">
                        {filledImages[0] ? <img src={filledImages[0].preview} alt="cover" /> : <FiPackage size={40} />}
                      </div>
                      <div className="pa-review-body">
                        <div className="pa-review-title">{title || "—"}</div>
                        <div className="pa-review-price">₦{Number(price || 0).toLocaleString()}</div>


                        {description && (
                          <p style={{ fontSize:13, color:"#555", lineHeight:1.5, marginTop:8 }}>
                            {description.slice(0, 120)}{description.length > 120 ? "..." : ""}
                          </p>
                        )}

                        <div className="pa-review-pills">
                          <span className="pa-review-pill pa-review-pill--cat">
                            {CATEGORIES.find((c) => c.value === category)?.emoji}{" "}
                            {CATEGORIES.find((c) => c.value === category)?.label}
                          </span>
                          <span className="pa-review-pill pa-review-pill--cond">
                            {CONDITIONS.find((c) => c.value === condition)?.label}
                          </span>
                          {negotiable && <span className="pa-review-pill">Negotiable</span>}
                          <span className="pa-review-pill">{filledImages.length} photo{filledImages.length !== 1 ? "s" : ""}</span>
                        </div>

                        {features.some((f) => f.trim()) && (
                          <div className="pa-review-section">
                            <div className="pa-review-section-title"><FiList size={11} /> Key Features</div>
                            {features.filter((f) => f.trim()).map((f, i) => (
                              <div className="pa-review-feature" key={i}>{f}</div>
                            ))}
                          </div>
                        )}

                        {specs.some((s) => s.key.trim() && s.value.trim()) && (
                          <div className="pa-review-section">
                            <div className="pa-review-section-title"><FiSliders size={11} /> Specifications</div>
                            {specs.filter((s) => s.key.trim() && s.value.trim()).map((s, i) => (
                              <div className="pa-review-spec-row" key={i}>
                                <span className="pa-review-spec-key">{s.key}</span>
                                <span className="pa-review-spec-value">{s.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {conditionNotes.trim() && (
                          <div className="pa-review-section">
                            <div className="pa-review-section-title"><FiAlertCircle size={11} /> Condition Notes</div>
                            <div className="pa-review-notes">{conditionNotes}</div>
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

              <div className="pa-footer">
                {step > 1 && (
                  <button className="pa-btn-back" onClick={() => setStep((s) => s - 1)}>
                    <FiChevronLeft size={16} /> Back
                  </button>
                )}
                {step < 5 && (
                  <button className="pa-btn-next" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
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
