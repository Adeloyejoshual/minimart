import React, {
  useEffect, useMemo, useState,
  useCallback, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import {
  FiChevronLeft, FiChevronRight, FiCheckCircle, FiArrowLeft,
  FiZap, FiTag, FiPackage, FiDollarSign,
  FiFileText, FiShield, FiAlertTriangle, FiAlertCircle,
  FiCamera,
} from "react-icons/fi";

import categories    from "../config/categories";
import ImageGrid     from "./PostAds/ImageGrid";
import VariantEditor from "./PostAds/VariantEditor";
import ReviewStep    from "./PostAds/ReviewStep";
import PricingStep   from "./PostAds/PricingStep";
import StepBar       from "./PostAds/StepBar";
import "../styles/PostAds.css";

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const API             = "https://minimart-ivrm.onrender.com/api";
const DRAFT_KEY       = "post-ad-draft-v8";
const MAX_IMAGES      = 6;
const MAX_FILE_MB     = 5;
const MAX_VARIANTS    = 20;
const COMPRESS_TARGET = 0.5;

/* ═══════════════════════════════════════════════
   STABLE UUID
═══════════════════════════════════════════════ */
function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ═══════════════════════════════════════════════
   BLANK VARIANT
═══════════════════════════════════════════════ */
const BLANK_VARIANT = () => ({
  id:         newId(),
  sku:        "",
  name:       "",
  price:      "",
  stock:      "1",
  attributes: { color: "", size: "", storage: "", material: "" },
});

/* ═══════════════════════════════════════════════
   PROHIBITED SCANNER
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
  { pattern: /\b(no questions asked|cash only|no receipt|as is no return)\b/i, label: "Suspicious terms"        },
  { pattern: /\b(whatsapp only|telegram only|contact outside)\b/i,             label: "Off-platform contact"    },
  { pattern: /\b(urgent sale|leaving country|emergency sale)\b/i,              label: "Urgency pressure tactic" },
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
   SHA-256 FILE HASH
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
   HELPERS
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

  if (t.includes("new") || d.includes("brand new"))     features.push("Brand new condition");
  if (t.includes("original") || d.includes("original")) features.push("100% original product");
  if (d.includes("warranty"))                            features.push("Warranty included");
  if (d.includes("delivery") || d.includes("shipping")) features.push("Fast delivery available");
  if (d.includes("negotiable"))                          features.push("Price negotiable");

  if (/(iphone|samsung|tecno|infinix|xiaomi|pixel|redmi|oppo|vivo)/i.test(t)) {
    features.push("Fast performance for daily use");
    if (/(128|256|512)\s?gb/i.test(t))              features.push("Large storage capacity");
    if (d.includes("battery") || d.includes("mah")) features.push("Long-lasting battery life");
    if (d.includes("camera"))                        features.push("High-quality camera system");
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
   PROHIBITED BANNER
═══════════════════════════════════════════════ */
const ProhibitedBanner = memo(({ result, scanDone }) => {
  if (!scanDone || !result) return null;
  const { blocked, suspicious } = result;

  if (!blocked.length && !suspicious.length) {
    return (
      <div style={{
        display:"flex", alignItems:"center", gap:"8px",
        padding:"10px 14px", borderRadius:"12px",
        background:"rgba(16,185,129,0.08)",
        border:"1px solid rgba(16,185,129,0.2)",
        backdropFilter:"blur(8px)",
        marginBottom:"14px", fontSize:"12px",
        fontWeight:700, color:"#065f46",
      }}>
        <FiShield size={14} style={{ flexShrink:0 }} />
        ✅ Content scan passed — no prohibited items detected
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"14px" }}>
      {blocked.length > 0 && (
        <div style={{ padding:"14px 16px", borderRadius:"14px", background:"rgba(220,38,38,0.08)", border:"1.5px solid rgba(220,38,38,0.25)", backdropFilter:"blur(8px)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
            <FiAlertTriangle size={16} color="#dc2626" />
            <span style={{ fontWeight:800, fontSize:"13px", color:"#991b1b" }}>🚫 Prohibited Content Detected</span>
            <span style={{ marginLeft:"auto", background:"#dc2626", color:"#fff", fontSize:"10px", fontWeight:900, padding:"2px 7px", borderRadius:"5px" }}>
              BLOCKED
            </span>
          </div>
          {blocked.map((b, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"10px", background:"rgba(220,38,38,0.06)", fontSize:"12px", marginBottom:"4px" }}>
              <span style={{ padding:"2px 8px", borderRadius:"6px", background:"rgba(220,38,38,0.12)", color:"#991b1b", fontWeight:800, fontSize:"11px" }}>{b.category}</span>
              <span style={{ color:"#991b1b", fontWeight:700 }}>"{b.text}"</span>
            </div>
          ))}
          <p style={{ margin:"10px 0 0", fontSize:"12px", fontWeight:600, color:"#991b1b", lineHeight:1.5 }}>
            Remove prohibited content before continuing.
          </p>
        </div>
      )}
      {suspicious.length > 0 && (
        <div style={{ padding:"12px 14px", borderRadius:"14px", background:"rgba(245,158,11,0.08)", border:"1.5px solid rgba(245,158,11,0.2)", backdropFilter:"blur(8px)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
            <FiAlertCircle size={15} color="#d97706" />
            <span style={{ fontWeight:800, fontSize:"13px", color:"#92400e" }}>⚠️ Suspicious Terms</span>
            <span style={{ marginLeft:"auto", background:"rgba(245,158,11,0.15)", color:"#92400e", fontSize:"10px", fontWeight:900, padding:"2px 7px", borderRadius:"5px" }}>
              WARNING
            </span>
          </div>
          {suspicious.map((s, i) => (
            <div key={i} style={{ fontSize:"12px", color:"#92400e", fontWeight:600, marginBottom:"4px" }}>
              • {s.label}: <em>"{s.text}"</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function PostAds({ user }) {
  const navigate = useNavigate();

  /* ── Step / UI ── */
  const [step,           setStep]           = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [posting,        setPosting]        = useState(false);
  const [posted,         setPosted]         = useState(false);
  const [uploadPct,      setUploadPct]      = useState(0);
  const [compressing,    setCompressing]    = useState(false);
  const [lastSaved,      setLastSaved]      = useState(null);
  const [attemptedNext,  setAttemptedNext]  = useState(false);

  /* ── Images ── */
  const [images,       setImages]       = useState(Array(MAX_IMAGES).fill(null));
  const [imageHashes,  setImageHashes]  = useState({});
  const [slotStatuses, setSlotStatuses] = useState({});

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
  const [touched, setTouched] = useState({});

  /* ── Prohibited ── */
  const [scanResult, setScanResult] = useState(null);
  const [scanDone,   setScanDone]   = useState(false);

  /* ── Derived ── */
  const filledImages   = useMemo(() => images.filter(Boolean), [images]);
  const activeCategory = useMemo(() => categories.find((c) => c.id === category), [category]);

  const discountPct = useMemo(() =>
    originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
      ? Math.round(((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100)
      : 0,
    [originalPrice, basePrice]
  );

  /* ── Image duplicate slots ── */
  const duplicateSlots = useMemo(() => {
    const seen  = new Map();
    const dupes = [];
    Object.entries(imageHashes).forEach(([idx, hash]) => {
      if (!hash) return;
      if (seen.has(hash)) {
        dupes.push(Number(idx));
        dupes.push(seen.get(hash));
      } else {
        seen.set(hash, Number(idx));
      }
    });
    return [...new Set(dupes)];
  }, [imageHashes]);

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
      if (d.step)                       setStep(d.step);
      if (Array.isArray(d.completedSteps)) setCompletedSteps(d.completedSteps);
      if (d.title)                      setTitle(d.title);
      if (d.brand)                      setBrand(d.brand);
      if (Array.isArray(d.tags))        setTags(d.tags);
      if (d.description)                setDescription(d.description);
      if (d.category)                   setCategory(d.category);
      if (d.keyFeatures?.length)        setKeyFeatures(d.keyFeatures);
      if (d.specifications?.length)     setSpecifications(d.specifications);
      if (d.whatsInBox?.length)         setWhatsInBox(d.whatsInBox);
      if (d.variants?.length)           setVariants(d.variants);
      if (d.basePrice)                  setBasePrice(d.basePrice);
      if (d.originalPrice)              setOriginalPrice(d.originalPrice);
    } catch {}
  }, []);

  /* Auto-save draft — includes completedSteps */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, completedSteps,
      title, brand, tags, description, category,
      keyFeatures, specifications, whatsInBox, variants,
      basePrice, originalPrice,
    }));
    setLastSaved(Date.now());
  }, [
    step, completedSteps,
    title, brand, tags, description, category,
    keyFeatures, specifications, whatsInBox, variants,
    basePrice, originalPrice,
  ]);

  /* Prohibited scan */
  useEffect(() => {
    if (!title && !description && !keyFeatures.some((f) => f.trim())) {
      setScanResult(null);
      setScanDone(false);
      return;
    }
    const result = scanContent({ title, description, keyFeatures });
    setScanResult(result);
    setScanDone(true);
    if (result.blocked.length > 0) toast.error(`🚫 Prohibited: ${result.blocked[0].category}`);
  }, [title, description, keyFeatures]);

  /* Edit-step events from ReviewStep */
  useEffect(() => {
    const handler = (e) => setStep(e.detail);
    window.addEventListener("pa-edit-step", handler);
    return () => window.removeEventListener("pa-edit-step", handler);
  }, []);

  /* ═══ Image handlers ═══ */

  const handleAddImage = useCallback(async (index, file, extraFiles = []) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Max ${MAX_FILE_MB}MB per image`); return; }

    setCompressing(true);
    setSlotStatuses((p) => ({ ...p, [index]: "compressing" }));

    try {
      const hash = await hashFile(file);

      const duplicate = Object.entries(imageHashes).find(
        ([idx, h]) => h === hash && Number(idx) !== index
      );

      if (duplicate) {
        toast.error(`Photo already in slot ${Number(duplicate[0]) + 1}`);
        setSlotStatuses((p) => ({ ...p, [index]: "idle" }));
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

      setImageHashes((prev)  => ({ ...prev, [index]: hash   }));
      setSlotStatuses((prev) => ({ ...prev, [index]: "done" }));

      if (wasCompressed) {
        toast.success(`Compressed — saved ${((file.size - compressed.size) / 1024).toFixed(0)} KB`);
      }

      if (extraFiles?.length) {
        let nextSlot = index + 1;
        for (const extra of extraFiles) {
          while (nextSlot < images.length && images[nextSlot] !== null) nextSlot++;
          if (nextSlot >= images.length) break;
          handleAddImage(nextSlot, extra);
          nextSlot++;
        }
      }
    } catch {
      setSlotStatuses((p) => ({ ...p, [index]: "error" }));
      toast.error("Failed to process image");
    } finally {
      setCompressing(false);
    }
  }, [imageHashes, images]);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = null;
      return next;
    });
    setImageHashes((prev)  => { const n = { ...prev }; delete n[index]; return n; });
    setSlotStatuses((prev) => { const n = { ...prev }; delete n[index]; return n; });
  }, []);

  const handleReorder = useCallback((from, to) => {
    setImages((prev) => {
      const next = [...prev]; [next[from], next[to]] = [next[to], next[from]]; return next;
    });
    setImageHashes((prev) => {
      const n = { ...prev }; [n[from], n[to]] = [n[to], n[from]]; return n;
    });
    setSlotStatuses((prev) => {
      const n = { ...prev }; [n[from], n[to]] = [n[to], n[from]]; return n;
    });
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

  const addVariant = useCallback(() => {
    setVariants((p) => p.length >= MAX_VARIANTS ? p : [...p, BLANK_VARIANT()]);
  }, []);

  const removeVariant = useCallback((i) =>
    setVariants((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i))), []);

  const duplicateVariant = useCallback((i) => {
    setVariants((p) => {
      if (p.length >= MAX_VARIANTS) { toast.error(`Max ${MAX_VARIANTS} variants`); return p; }
      const copy = { ...p[i], id: newId(), sku: p[i].sku ? `${p[i].sku}-COPY` : "" };
      const next = [...p];
      next.splice(i + 1, 0, copy);
      return next;
    });
    toast.success("Variant duplicated");
  }, []);

  /* ═══ Tags ═══ */

  const commitTag = useCallback(() => {
    const t = normalize(tagInput).toLowerCase();
    if (!t || t.length > 24) return;
    if (tags.includes(t))  { setTagInput(""); return; }
    if (tags.length >= 8)  { toast.error("Max 8 tags"); return; }
    setTags((p) => [...p, t]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((t) =>
    setTags((p) => p.filter((x) => x !== t)), []);

  /* ═══ Smart feature generator ═══ */

  const generateKeyFeatures = useCallback(() => {
    const gen = guessFeatures({
      title, categoryName: activeCategory?.name,
      description, specs: specifications,
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
    if (filledImages.length === 0)                               e.images    = "Add at least 1 photo";
    if (touched.title    && title.trim().length < 3)             e.title     = "Title must be at least 3 characters";
    if (touched.title    && title.trim().length > 80)            e.title     = "Title too long";
    if (touched.category && !category)                           e.category  = "Select a category";
    if (touched.basePrice) {
      const n = Number(basePrice);
      if (!basePrice || isNaN(n) || n <= 0)                      e.basePrice = "Enter a valid price";
    }
    if (touched.originalPrice && originalPrice) {
      if (Number(originalPrice) <= Number(basePrice))            e.originalPrice = "Should be higher than base price";
    }
    variants.forEach((v, i) => {
      if (touched[`v_sku_${i}`]   && !v.sku.trim())             e[`v_sku_${i}`]   = "Required";
      if (touched[`v_name_${i}`]  && !v.name.trim())            e[`v_name_${i}`]  = "Required";
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
    if (step === 3 && !variants.every((v) => v.sku.trim() && v.name.trim()))
      return "Fill SKU and name for each variant";
    if (step === 4 && (!basePrice || Number(basePrice) <= 0)) return "Set a valid base price";
    return "";
  }, [step, filledImages.length, title, category, variants, basePrice]);

  /* ═══ Navigation ═══ */

  /* Mark step as completed + advance */
  const goNext = useCallback(() => {
    setAttemptedNext(true);
    if (!stepValid) return;
    if (scanResult?.blocked.length > 0) {
      toast.error("Remove prohibited content before continuing");
      return;
    }

    /* Mark current step as completed */
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev : [...prev, step]
    );

    setAttemptedNext(false);
    setStep((s) => Math.min(5, s + 1));
    window.navigator?.vibrate?.(12);
  }, [stepValid, scanResult, step]);

  const goBack = useCallback(() => {
    setAttemptedNext(false);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  /* StepBar click navigation */
  const handleStepClick = useCallback((targetStep) => {
    /* Allow: going back, jumping to a completed step,
       or advancing to next if current step is valid */
    if (
      targetStep < step ||
      completedSteps.includes(targetStep) ||
      (targetStep === step + 1 && stepValid)
    ) {
      setStep(targetStep);
      setAttemptedNext(false);
    } else {
      setAttemptedNext(true);
      toast.error("Complete the current step first");
    }
  }, [step, completedSteps, stepValid]);

  /* ═══ Submit ═══ */

  const handleSubmit = useCallback(async () => {
    if (!user)                { toast.error("Please log in first");    return; }
    if (!filledImages.length) { toast.error("Add at least one photo"); return; }
    if (scanResult?.blocked.length > 0) {
      toast.error("Remove prohibited content first"); return;
    }

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
      if (originalPrice) fd.append("originalPrice", originalPrice);
      if (brand.trim())  fd.append("brand",         brand.trim());
      if (tags.length)   fd.append("tags",          JSON.stringify(tags));

      fd.append("variants",
        JSON.stringify(variants.filter((v) => v.sku.trim() && v.name.trim())));
      fd.append("keyFeatures",
        JSON.stringify(keyFeatures.map(normalize).filter(Boolean)));
      fd.append("specifications",
        JSON.stringify(specifications.filter((s) => normalize(s.key) && normalize(s.value))));
      fd.append("whatsInBox",
        JSON.stringify(whatsInBox.map(normalize).filter(Boolean)));

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
              Step {step}/5
              {activeCategory ? ` · ${activeCategory.icon} ${activeCategory.name}` : ""}
            </p>
          </div>
          <div style={{ width:36 }} aria-hidden="true" />
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
            {/* ── New StepBar with completedSteps + click nav ── */}
            <StepBar
              current={step}
              completedSteps={completedSteps}
              onStepClick={handleStepClick}
            />

            <main className="pa-body" id="pa-main">

              {/* Inline step error */}
              {attemptedNext && stepError && (
                <div className="pa-inline-error" role="alert" aria-live="assertive">
                  <FiAlertCircle size={16} /> {stepError}
                </div>
              )}

              {/* Prohibited banner */}
              {step >= 2 && <ProhibitedBanner result={scanResult} scanDone={scanDone} />}

              {/* ───── STEP 1: PHOTOS ───── */}
              {step === 1 && (
                <section aria-label="Add photos">
                  <ImageGrid
                    images={images}
                    onAdd={handleAddImage}
                    onRemove={handleRemoveImage}
                    onReorder={handleReorder}
                    compressing={compressing}
                    slotStatuses={slotStatuses}
                    duplicates={duplicateSlots}
                  />
                </section>
              )}

              {/* ───── STEP 2: DETAILS ───── */}
              {step === 2 && (
                <section aria-label="Product details">
                  <div className="pa-section-head">
                    <div>
                      <p className="pa-section-title">📝 Product Details</p>
                      <p className="pa-section-sub">Clear titles rank higher.</p>
                    </div>
                    <button type="button" className="pa-gen-btn"
                      onClick={generateKeyFeatures}
                      aria-label="Auto-generate key features">
                      <FiZap size={15} aria-hidden="true" /> Auto-Generate
                    </button>
                  </div>

                  {/* Title */}
                  <div className="pa-field">
                    <label className="pa-label" htmlFor="pa-title">Title *</label>
                    <input
                      id="pa-title" type="text"
                      className={`pa-input ${fieldErrors.title ? "pa-input--error" : ""}`}
                      placeholder='e.g. "iPhone 13 Pro Max 256GB"'
                      value={title} maxLength={80}
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
                      <input id="pa-brand" type="text" className="pa-input"
                        placeholder='e.g. "Apple"' value={brand} maxLength={40}
                        onChange={(e) => setBrand(e.target.value)} />
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
                            <button key={t} type="button" className="pa-tag"
                              role="listitem" aria-label={`Remove tag: ${t}`}
                              onClick={() => removeTag(t)}>
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
                    <textarea id="pa-desc" className="pa-textarea"
                      placeholder="Describe your product…" value={description} maxLength={700}
                      onChange={(e) => setDescription(e.target.value)} />
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
                          <input className="pa-mini-input" value={item}
                            placeholder='e.g. "5000mAh battery"'
                            aria-label={`Key feature ${i + 1}`}
                            onChange={(e) => updateList(setKeyFeatures, i, e.target.value)} />
                          <button type="button" className="pa-mini-btn"
                            aria-label={`Remove feature ${i + 1}`}
                            onClick={() => removeList(setKeyFeatures, i)}>−</button>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() => addList(setKeyFeatures, keyFeatures, 10)}>
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
                            <input className="pa-mini-input" value={row.key}
                              placeholder="e.g. RAM" aria-label={`Spec ${i + 1} name`}
                              onChange={(e) => {
                                const n = [...specifications];
                                n[i] = { ...n[i], key: e.target.value };
                                setSpecifications(n);
                              }} />
                            <input className="pa-mini-input" value={row.value}
                              placeholder="e.g. 8GB" aria-label={`Spec ${i + 1} value`}
                              onChange={(e) => {
                                const n = [...specifications];
                                n[i] = { ...n[i], value: e.target.value };
                                setSpecifications(n);
                              }} />
                          </div>
                          <button type="button" className="pa-mini-btn"
                            aria-label={`Remove spec ${i + 1}`}
                            onClick={() => removeList(setSpecifications, i)}>−</button>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() => setSpecifications((p) =>
                          p.length >= 12 ? p : [...p, { key:"", value:"" }]
                        )}>
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
                          <input className="pa-mini-input" value={item}
                            placeholder='e.g. "1× Charging Cable"'
                            aria-label={`Box item ${i + 1}`}
                            onChange={(e) => updateList(setWhatsInBox, i, e.target.value)} />
                          <button type="button" className="pa-mini-btn"
                            aria-label={`Remove box item ${i + 1}`}
                            onClick={() => removeList(setWhatsInBox, i)}>−</button>
                        </div>
                      ))}
                      <button type="button" className="pa-add-btn"
                        onClick={() => addList(setWhatsInBox, whatsInBox, 12)}>
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
                    <div className="pa-cat-grid" role="radiogroup" aria-labelledby="pa-cat-label">
                      {categories.map((c) => (
                        <button key={c.id} type="button" role="radio"
                          aria-checked={category === c.id}
                          className={`pa-cat-btn ${category === c.id ? "pa-cat-btn--active" : ""}`}
                          onClick={() => { setCategory(c.id); markTouched("category"); }}>
                          <span className="pa-cat-icon" aria-hidden="true">{c.icon}</span>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ───── STEP 3: VARIANTS ───── */}
              {step === 3 && (
                <section aria-label="Product variants">
                  <VariantEditor
                    variants={variants}
                    onUpdate={updateVariant}
                    onUpdateAttr={updateVariantAttr}
                    onAdd={addVariant}
                    onRemove={removeVariant}
                    onDuplicate={duplicateVariant}
                    onBulkReplace={(newVariants) => setVariants(newVariants)}
                    errors={fieldErrors}
                    onBlur={markTouched}
                    title={title}
                    categoryName={activeCategory?.name ?? ""}
                  />
                </section>
              )}

              {/* ───── STEP 4: PRICING ───── */}
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

              {/* ───── STEP 5: REVIEW ───── */}
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

            {/* ── Footer ── */}
            <div className="pa-footer pa-glass-bar" role="navigation" aria-label="Step navigation">
              {step > 1 ? (
                <button type="button" className="pa-btn-back"
                  onClick={goBack} aria-label="Go to previous step">
                  <FiChevronLeft size={16} aria-hidden="true" /> Back
                </button>
              ) : <div aria-hidden="true" />}

              {step < 5 ? (
                <button type="button" className="pa-btn-next"
                  onClick={goNext}
                  disabled={posting || compressing}
                  aria-label={compressing ? "Compressing, please wait" : "Go to next step"}>
                  {compressing ? "Compressing…" : "Continue"}
                  <FiChevronRight size={16} aria-hidden="true" />
                </button>
              ) : <div aria-hidden="true" />}
            </div>
          </>
        )}
      </div>
    </>
  );
}