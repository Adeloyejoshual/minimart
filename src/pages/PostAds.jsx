/**
 * src/pages/PostAds.jsx
 * Route: /minimart/post-ad
 *
 * Multi-step ad posting flow.
 * v2.4 — Title 255, Paste formatters, SKU generator, Optional Variant Names
 */

import {
  useEffect, useMemo, useState,
  useCallback, useRef, memo,
} from "react";
import { useNavigate }  from "react-router-dom";
import axios            from "axios";
import toast            from "react-hot-toast";
import imageCompression from "browser-image-compression";

import CategoryPicker from "./PostAds/CategoryPicker";
import ImageGrid      from "./PostAds/ImageGrid";
import VariantEditor  from "./PostAds/VariantEditor";
import ReviewStep     from "./PostAds/ReviewStep";
import PricingStep    from "./PostAds/PricingStep";
import StepBar        from "./PostAds/StepBar";
import "../styles/PostAds.css";

const API        = import.meta.env.VITE_API_BASE_URL;
const SUBMIT_URL = `${API}/api/products`;

const DRAFT_KEY       = "post-ad-draft-v10";
const MAX_IMAGES      = 8;
const MAX_FILE_MB     = 5;
const MAX_VARIANTS    = 20;
const COMPRESS_TARGET = 0.5;
const MAX_FEATURES    = 10;
const MAX_SPECS       = 12;
const MAX_BOX_ITEMS   = 12;
const MAX_TAGS        = 8;
const MAX_TAG_LEN     = 24;

const MAX_TITLE_LEN   = 255;
const TITLE_WARN_AT   = 230;
const MIN_TITLE_LEN   = 3;
const MAX_DESC_LEN    = 2500;
const DESC_WARN_AT    = 2300;
const TOTAL_STEPS     = 5;

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconArrowLeft = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);
const IconChevronLeft = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
);
const IconChevronRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
);
const IconCheck = ({ size = 42 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);
const IconZap = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);
const IconTag = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
);
const IconShield = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const IconAlertTriangle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9"  x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const IconAlertCircle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8"  x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);
const IconCamera = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
);
const IconFileText = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
);
const IconPackage = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="16.5" y1="9.4"  x2="7.5"  y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
);
const IconDollarSign = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1"  x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);
const IconXSmall = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6"  x2="6"  y2="18" /><line x1="6"  y1="6"  x2="18" y2="18" /></svg>
);
const IconPlusSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5"  x2="12" y2="19" /><line x1="5"  y1="12" x2="19" y2="12" /></svg>
);
const IconPlusCircle = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
);

const PROHIBITED_PATTERNS = [
  { pattern: /\b(gun|pistol|rifle|shotgun|firearm|weapon|ammo|ammunition|explosive|bomb|grenade|machete)\b/i, category: "Weapons & Dangerous Items" },
  { pattern: /\b(cocaine|heroin|meth|cannabis|marijuana|weed|narcotic|tramadol abuse|codeine syrup)\b/i,      category: "Illegal Drugs" },
  { pattern: /\b(replica watch|fake|counterfeit|knockoff|pirated|bootleg)\b/i,                                category: "Counterfeit Items" },
  { pattern: /\b(human trafficking|organ for sale|kidney for sale|blood for sale)\b/i,                        category: "Human Trafficking" },
  { pattern: /\b(ponzi|advance fee|investment scheme|pay upfront)\b/i,                                        category: "Scam / Fraud" },
  { pattern: /\b(escort service|sex service|adult only service)\b/i,                                          category: "Adult Services" },
  { pattern: /\b(ivory|rhino horn|tiger skin|poached)\b/i,                                                    category: "Illegal Wildlife" },
  { pattern: /\b(stolen goods|chop shop|IMEI removed|serial removed)\b/i,                                     category: "Stolen Goods" },
];

const SUSPICIOUS_PATTERNS = [
  { pattern: /\b(no questions asked|cash only|no receipt|as is no return)\b/i, label: "Suspicious terms" },
  { pattern: /\b(whatsapp only|telegram only|contact outside)\b/i,             label: "Off-platform contact" },
  { pattern: /\b(urgent sale|leaving country|emergency sale)\b/i,              label: "Urgency pressure tactic" },
];

/* ══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */
const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();
const uniq      = (arr)    => [...new Set(arr.filter(Boolean))];

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* ── Smart SKU generator ── */
const generateSku = (productTitle = "", attributes = {}) => {
  const titlePart = normalize(productTitle)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join("") || "PRD";

  const attrParts = Object.values(attributes)
    .filter(Boolean)
    .map((v) => normalize(v).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase())
    .filter(Boolean);

  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return [titlePart, ...attrParts, rand].filter(Boolean).join("-");
};

const BLANK_VARIANT = (title = "") => {
  const v = {
    id        : newId(),
    sku       : "",
    name      : "",
    price     : "",
    stock     : "1",
    attributes: { color: "", size: "", storage: "", material: "" },
  };
  v.sku = generateSku(title, v.attributes);
  return v;
};

/* ── Paste helpers ── */
const htmlToPlainWithBold = (html) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  tmp.querySelectorAll("strong, b").forEach((el) => {
    el.replaceWith(`**${el.textContent}**`);
  });

  tmp.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  tmp.querySelectorAll("p, div, li").forEach((el) => el.append("\n"));

  return tmp.textContent
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};

const splitPastedLines = (text) =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^[\s•\-–—*]+/, "").trim())
    .filter(Boolean);

function getSellerToken() {
  const KEYS = ["sellerToken", "seller_token", "market_token", "sellerAuthToken", "seller_auth_token"];
  for (const key of KEYS) {
    const val = localStorage.getItem(key);
    if (val) return val;
  }
  return null;
}

const scanContent = ({ title = "", description = "", keyFeatures = [] }) => {
  const corpus = [title, description, ...keyFeatures].join(" ");
  return {
    blocked: PROHIBITED_PATTERNS.filter((r) => r.pattern.test(corpus)).map((r) => ({ text: corpus.match(r.pattern)?.[0] ?? "flagged", category: r.category })),
    suspicious: SUSPICIOUS_PATTERNS.filter((r) => r.pattern.test(corpus)).map((r) => ({ text: corpus.match(r.pattern)?.[0] ?? "flagged", label: r.label })),
  };
};

const hashFile = async (file) => {
  try {
    const buf    = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
};

const compressImage = async (file) => {
  if (file.size <= COMPRESS_TARGET * 1024 * 1024) return file;
  try {
    return await imageCompression(file, { maxSizeMB: COMPRESS_TARGET, maxWidthOrHeight: 1920, useWebWorker: true, fileType: file.type });
  } catch {
    return file;
  }
};

const guessFeatures = ({ title, categoryName, description, specs }) => {
  const t         = normalize(title).toLowerCase();
  const d         = normalize(description).toLowerCase();
  const specPairs = (specs || []).filter((x) => normalize(x.key) && normalize(x.value)).map((x) => `${normalize(x.key)}: ${normalize(x.value)}`);

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
    features.push("Smooth multitasking for work and school");
    if (d.includes("ssd") || specPairs.join(" ").includes("ssd")) features.push("Fast SSD storage");
    if (d.includes("ram") || /(8|16|32)\s?gb\s?ram/i.test(t)) features.push("Powerful RAM");
  }
  if (/(nike|adidas|puma|gucci|zara)/i.test(t)) {
    features.push("Premium brand quality");
    features.push("Stylish and trendy design");
  }
  if (categoryName) features.push(`Great for ${categoryName.toLowerCase()} shoppers`);
  specPairs.slice(0, 5).forEach((s) => features.push(s));

  return uniq(features).filter((x) => x.length >= 6 && x.length <= 60).slice(0, MAX_FEATURES);
};

function hasDuplicateSkus(variants) {
  const seen = new Set();
  for (const v of variants) {
    const sku = v.sku?.trim().toUpperCase();
    if (!sku) continue;
    if (seen.has(sku)) return true;
    seen.add(sku);
  }
  return false;
}

const STEP_META = [
  { label: "Photos",   Icon: IconCamera },
  { label: "Details",  Icon: IconFileText },
  { label: "Variants", Icon: IconPackage },
  { label: "Pricing",  Icon: IconDollarSign },
  { label: "Review",   Icon: IconCheck },
];

const ProhibitedBanner = memo(function ProhibitedBanner({ result, scanDone }) {
  if (!scanDone || !result) return null;
  const { blocked, suspicious } = result;

  if (!blocked.length && !suspicious.length) {
    return (
      <div className="pa-scan-pass" role="status" aria-live="polite">
        <IconShield size={14} /><span>Content scan passed — no prohibited items detected</span>
      </div>
    );
  }

  return (
    <div className="pa-scan-wrap">
      {blocked.length > 0 && (
        <div className="pa-scan-blocked" role="alert" aria-live="assertive">
          <div className="pa-scan-header">
            <IconAlertTriangle size={16} />
            <span className="pa-scan-title">Prohibited Content Detected</span>
            <span className="pa-scan-badge pa-scan-badge--blocked">BLOCKED</span>
          </div>
          {blocked.map((b, i) => (
            <div key={i} className="pa-scan-row"><span className="pa-scan-category">{b.category}</span><span className="pa-scan-term">"{b.text}"</span></div>
          ))}
          <p className="pa-scan-note">Remove prohibited content before continuing.</p>
        </div>
      )}
      {suspicious.length > 0 && (
        <div className="pa-scan-suspicious" role="alert" aria-live="polite">
          <div className="pa-scan-header">
            <IconAlertCircle size={15} />
            <span className="pa-scan-title">Suspicious Terms Detected</span>
            <span className="pa-scan-badge pa-scan-badge--warn">WARNING</span>
          </div>
          {suspicious.map((s, i) => (
            <div key={i} className="pa-scan-row pa-scan-row--warn"><span>{s.label}:</span><em>"{s.text}"</em></div>
          ))}
        </div>
      )}
    </div>
  );
});

export default function PostAds() {
  const navigate      = useNavigate();
  const submittingRef = useRef(false);

  const [step,           setStep]           = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [posting,        setPosting]        = useState(false);
  const [posted,         setPosted]         = useState(false);
  const [uploadPct,      setUploadPct]      = useState(0);
  const [compressing,    setCompressing]    = useState(false);
  const [lastSaved,      setLastSaved]      = useState(null);
  const [attemptedNext,  setAttemptedNext]  = useState(false);

  const [images,       setImages]       = useState(Array(MAX_IMAGES).fill(null));
  const [imageHashes,  setImageHashes]  = useState({});
  const [slotStatuses, setSlotStatuses] = useState({});

  const [title,          setTitle]          = useState("");
  const [brand,          setBrand]          = useState("");
  const [tags,           setTags]           = useState([]);
  const [tagInput,       setTagInput]       = useState("");
  const [description,    setDescription]    = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [keyFeatures,    setKeyFeatures]    = useState([""]);
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [whatsInBox,     setWhatsInBox]     = useState([""]);

  const [variants, setVariants] = useState([BLANK_VARIANT()]);

  const [basePrice,     setBasePrice]     = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  const [touched, setTouched] = useState({});

  const [scanResult, setScanResult] = useState(null);
  const [scanDone,   setScanDone]   = useState(false);

  const filledImages   = useMemo(() => images.filter(Boolean), [images]);
  const activeCategory = selectedCategory;

  const discountPct = useMemo(() =>
    originalPrice && basePrice && Number(originalPrice) > Number(basePrice)
      ? Math.round(((Number(originalPrice) - Number(basePrice)) / Number(originalPrice)) * 100)
      : 0,
    [originalPrice, basePrice]
  );

  const duplicateSlots = useMemo(() => {
    const seen = new Map(), dupes = [];
    Object.entries(imageHashes).forEach(([idx, hash]) => {
      if (!hash) return;
      if (seen.has(hash)) { dupes.push(Number(idx)); dupes.push(seen.get(hash)); }
      else { seen.set(hash, Number(idx)); }
    });
    return [...new Set(dupes)];
  }, [imageHashes]);

  const duplicateSkuExists = useMemo(() => hasDuplicateSkus(variants), [variants]);

  useEffect(() => {
    return () => images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.step) setStep(d.step);
      if (Array.isArray(d.completedSteps)) setCompletedSteps(d.completedSteps);
      if (d.title) setTitle(d.title);
      if (d.brand) setBrand(d.brand);
      if (Array.isArray(d.tags)) setTags(d.tags);
      if (d.description) setDescription(d.description);
      if (d.selectedCategory?.id && d.selectedCategory?.name) setSelectedCategory(d.selectedCategory);
      if (d.keyFeatures?.length) setKeyFeatures(d.keyFeatures);
      if (d.specifications?.length) setSpecifications(d.specifications);
      if (d.whatsInBox?.length) setWhatsInBox(d.whatsInBox);
      if (d.variants?.length) setVariants(d.variants);
      if (d.basePrice) setBasePrice(d.basePrice);
      if (d.originalPrice) setOriginalPrice(d.originalPrice);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (posted) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, completedSteps, title, brand, tags, description, selectedCategory,
      keyFeatures, specifications, whatsInBox, variants, basePrice, originalPrice,
    }));
    setLastSaved(Date.now());
  }, [step, completedSteps, title, brand, tags, description, selectedCategory, keyFeatures, specifications, whatsInBox, variants, basePrice, originalPrice, posted]);

  useEffect(() => {
    if (!title && !description && !keyFeatures.some((f) => f.trim())) {
      setScanResult(null); setScanDone(false); return;
    }
    const result = scanContent({ title, description, keyFeatures });
    setScanResult(result);
    setScanDone(true);
    if (result.blocked.length > 0) toast.error(`Prohibited: ${result.blocked[0].category}`);
  }, [title, description, keyFeatures]);

  useEffect(() => {
    const handler = (e) => setStep(e.detail);
    window.addEventListener("pa-edit-step", handler);
    return () => window.removeEventListener("pa-edit-step", handler);
  }, []);

  const handlePostAnother = useCallback(() => {
    images.forEach((img) => { if (img?.preview) URL.revokeObjectURL(img.preview); });
    localStorage.removeItem(DRAFT_KEY);
    setImages(Array(MAX_IMAGES).fill(null)); setImageHashes({}); setSlotStatuses({});
    setTitle(""); setBrand(""); setTags([]); setTagInput(""); setDescription(""); setSelectedCategory(null);
    setKeyFeatures([""]); setSpecifications([{ key: "", value: "" }]); setWhatsInBox([""]);
    setVariants([BLANK_VARIANT("")]); setBasePrice(""); setOriginalPrice("");
    setTouched({}); setScanResult(null); setScanDone(false); setCompletedSteps([]);
    setAttemptedNext(false); setUploadPct(0);
    setStep(1); setPosted(false);
    toast.success("Ready to post another ad!");
  }, [images]);

  const handleAddImage = useCallback(async (index, file, extraFiles = []) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Max ${MAX_FILE_MB} MB per image`); return; }
    setCompressing(true); setSlotStatuses((p) => ({ ...p, [index]: "compressing" }));

    try {
      const hash = await hashFile(file);
      const duplicate = Object.entries(imageHashes).find(([idx, h]) => h === hash && Number(idx) !== index);
      if (duplicate) { toast.error(`Photo already in slot ${Number(duplicate[0]) + 1}`); setSlotStatuses((p) => ({ ...p, [index]: "idle" })); return; }

      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);
      const wasCompressed = compressed.size < file.size;

      setImages((prev) => {
        const next = [...prev];
        if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
        next[index] = { file: compressed, preview, compressed: wasCompressed };
        return next;
      });
      setImageHashes((prev)  => ({ ...prev, [index]: hash   }));
      setSlotStatuses((prev) => ({ ...prev, [index]: "done" }));

      if (wasCompressed) toast.success(`Compressed — saved ${((file.size - compressed.size) / 1024).toFixed(0)} KB`);

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
      setSlotStatuses((p) => ({ ...p, [index]: "error" })); toast.error("Failed to process image");
    } finally { setCompressing(false); }
  }, [imageHashes, images]);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = null; return next;
    });
    setImageHashes((prev)  => { const n = { ...prev }; delete n[index]; return n; });
    setSlotStatuses((prev) => { const n = { ...prev }; delete n[index]; return n; });
  }, []);

  const handleReorder = useCallback((from, to) => {
    setImages((prev) => { const next = [...prev]; [next[from], next[to]] = [next[to], next[from]]; return next; });
    setImageHashes((prev) => { const n = { ...prev }; [n[from], n[to]] = [n[to], n[from]]; return n; });
    setSlotStatuses((prev) => { const n = { ...prev }; [n[from], n[to]] = [n[to], n[from]]; return n; });
  }, []);

  const updateList = useCallback((setter, i, val) => setter((p) => p.map((x, idx) => (idx === i ? val : x))), []);
  const addList    = useCallback((setter, list, limit) => { if (list.length < limit) setter((p) => [...p, ""]); }, []);
  const removeList = useCallback((setter, i) => setter((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i)), []);

  const updateVariant = useCallback((i, field, val) => setVariants((p) => p.map((v, idx) => idx === i ? { ...v, [field]: val } : v)), []);
  const updateVariantAttr = useCallback((i, attr, val) => setVariants((p) => p.map((v, idx) => idx === i ? { ...v, attributes: { ...v.attributes, [attr]: val } } : v)), []);
  const addVariant = useCallback(() => {
    setVariants((p) => {
      if (p.length >= MAX_VARIANTS) return p;
      return [...p, BLANK_VARIANT(title)];
    });
  }, [title]);
  const removeVariant = useCallback((i) => setVariants((p) => p.length <= 1 ? p : p.filter((_, idx) => idx !== i)), []);
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

  const regenerateVariantSku = useCallback((i) => {
    setVariants((p) => p.map((v, idx) => idx === i ? { ...v, sku: generateSku(title, v.attributes) } : v));
    toast.success("SKU regenerated");
  }, [title]);

  const commitTag = useCallback(() => {
    const t = normalize(tagInput).toLowerCase();
    if (!t || t.length > MAX_TAG_LEN) return;
    if (tags.includes(t)) { setTagInput(""); return; }
    if (tags.length >= MAX_TAGS) { toast.error(`Max ${MAX_TAGS} tags`); return; }
    setTags((p) => [...p, t]); setTagInput("");
  }, [tagInput, tags]);
  const removeTag = useCallback((t) => setTags((p) => p.filter((x) => x !== t)), []);

  const generateKeyFeatures = useCallback(() => {
    const gen = guessFeatures({ title, categoryName: activeCategory?.name, description, specs: specifications });
    if (!gen.length) { toast.error("Add a title or description first"); return; }
    const existing = keyFeatures.map(normalize).filter(Boolean);
    setKeyFeatures(uniq([...existing, ...gen]).slice(0, MAX_FEATURES) || [""]);
    toast.success(`${gen.length} features generated`); window.navigator?.vibrate?.(15);
  }, [title, activeCategory, description, specifications, keyFeatures]);

  const markTouched = useCallback((field) => setTouched((p) => ({ ...p, [field]: true })), []);

  const fieldErrors = useMemo(() => {
    const e = {};
    if (filledImages.length === 0) e.images = "Add at least 1 photo";
    if (touched.title && title.trim().length < MIN_TITLE_LEN) e.title = `Title must be at least ${MIN_TITLE_LEN} characters`;
    if (touched.title && title.trim().length > MAX_TITLE_LEN) e.title = `Title must be ${MAX_TITLE_LEN} characters or fewer`;
    if (touched.category && !selectedCategory) e.category = "Select a category";
    if (touched.basePrice) {
      const n = Number(basePrice);
      if (!basePrice || isNaN(n) || n <= 0) e.basePrice = "Enter a valid price";
    }
    if (touched.originalPrice && originalPrice) {
      if (Number(originalPrice) <= Number(basePrice)) e.originalPrice = "Should be higher than the base price";
    }
    variants.forEach((v, i) => {
      if (touched[`v_sku_${i}`] && !v.sku.trim()) e[`v_sku_${i}`] = "Required";
      // Name is completely optional now, no validation check here
      if (touched[`v_price_${i}`] && (isNaN(Number(v.price)) || Number(v.price) < 0)) e[`v_price_${i}`] = "Invalid price";
    });
    return e;
  }, [touched, title, selectedCategory, filledImages.length, variants, basePrice, originalPrice]);

  const stepValid = useMemo(() => {
    if (step === 1) return filledImages.length > 0;
    if (step === 2) return title.trim().length >= MIN_TITLE_LEN && title.trim().length <= MAX_TITLE_LEN && !!selectedCategory;
    if (step === 3) return variants.every((v) => v.sku.trim() && Number(v.price) >= 0) && !duplicateSkuExists;
    if (step === 4) return !isNaN(Number(basePrice)) && Number(basePrice) > 0;
    if (step === 5) return filledImages.length > 0 && title.trim().length >= MIN_TITLE_LEN && title.trim().length <= MAX_TITLE_LEN && Number(basePrice) > 0;
    return true;
  }, [step, filledImages.length, title, selectedCategory, variants, basePrice, duplicateSkuExists]);

  const stepError = useMemo(() => {
    if (step === 1 && filledImages.length === 0) return "Add at least one photo";
    if (step === 2 && title.trim().length < MIN_TITLE_LEN) return `Title needs at least ${MIN_TITLE_LEN} characters`;
    if (step === 2 && title.trim().length > MAX_TITLE_LEN) return `Title must be ${MAX_TITLE_LEN} characters or fewer`;
    if (step === 2 && !selectedCategory) return "Pick a category";
    if (step === 3 && duplicateSkuExists) return "Two or more variants share the same SKU — each SKU must be unique";
    if (step === 3 && !variants.every((v) => v.sku.trim())) return "Fill in the SKU for each variant";
    if (step === 4 && (!basePrice || Number(basePrice) <= 0)) return "Set a valid base price";
    return "";
  }, [step, filledImages.length, title, selectedCategory, variants, basePrice, duplicateSkuExists]);

  const goNext = useCallback(() => {
    setAttemptedNext(true);
    if (!stepValid) return;
    if (scanResult?.blocked.length > 0) { toast.error("Remove prohibited content before continuing"); return; }
    setCompletedSteps((prev) => prev.includes(step) ? prev : [...prev, step]);
    setAttemptedNext(false); setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    window.navigator?.vibrate?.(12);
  }, [stepValid, scanResult, step]);

  const goBack = useCallback(() => { setAttemptedNext(false); setStep((s) => Math.max(1, s - 1)); }, []);

  const handleStepClick = useCallback((targetStep) => {
    if (targetStep < step || completedSteps.includes(targetStep) || (targetStep === step + 1 && stepValid)) {
      setStep(targetStep); setAttemptedNext(false);
    } else {
      setAttemptedNext(true); toast.error("Complete the current step first");
    }
  }, [step, completedSteps, stepValid]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    const token = getSellerToken();
    if (!token) { submittingRef.current = false; toast.error("Seller session not found."); navigate("/seller/login"); return; }
    if (!filledImages.length) { submittingRef.current = false; toast.error("Add at least one photo"); return; }
    if (scanResult?.blocked.length > 0) { submittingRef.current = false; toast.error("Remove prohibited content first"); return; }
    if (duplicateSkuExists) { submittingRef.current = false; toast.error("Fix duplicate variant SKUs"); return; }
    if (!selectedCategory) { submittingRef.current = false; toast.error("Please select a category"); return; }
    if (title.trim().length > MAX_TITLE_LEN) { submittingRef.current = false; toast.error(`Title too long`); return; }

    setPosting(true); setUploadPct(0);

    try {
      const fd = new FormData();
      fd.append("name", title.trim());
      fd.append("description", description.trim());
      fd.append("category_id", selectedCategory.id);
      fd.append("category", selectedCategory.name);
      fd.append("basePrice", basePrice);
      if (originalPrice) fd.append("originalPrice", originalPrice);
      if (brand.trim()) fd.append("brand", brand.trim());
      if (tags.length) fd.append("tags", JSON.stringify(tags));

      // Filter variants: must have SKU (Name is optional)
      fd.append("variants", JSON.stringify(variants.filter((v) => v.sku.trim())));
      fd.append("keyFeatures", JSON.stringify(keyFeatures.map(normalize).filter(Boolean)));
      fd.append("specifications", JSON.stringify(specifications.filter((s) => normalize(s.key) && normalize(s.value))));
      fd.append("whatsInBox", JSON.stringify(whatsInBox.map(normalize).filter(Boolean)));

      images.forEach((img) => { if (img?.file) fd.append("images", img.file); });

      await axios.post(SUBMIT_URL, fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => { if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100)); },
      });

      localStorage.removeItem(DRAFT_KEY);
      setPosted(true);
      toast.success("Ad posted! It will go live after review.");
      window.navigator?.vibrate?.([50, 30, 80]);
    } catch (err) {
      if (!err.response) toast.error("Network error.");
      else if (err.response.status === 401) { toast.error("Session expired."); navigate("/seller/login"); }
      else toast.error(err.response.data?.message || "Failed to post ad.");
    } finally {
      setPosting(false); submittingRef.current = false;
    }
  }, [filledImages, scanResult, duplicateSkuExists, selectedCategory, title, description, basePrice, originalPrice, brand, tags, variants, keyFeatures, specifications, whatsInBox, images, navigate]);

  return (
    <>
      <a href="#pa-main" className="pa-skip-link">Skip to main content</a>
      <div className="pa-page pa-glass">
        <header className="pa-topbar pa-glass-bar">
          <button type="button" className="pa-topbar-back" onClick={() => navigate(-1)} aria-label="Go back"><IconArrowLeft size={18} /></button>
          <div className="pa-topbar-center">
            <h1 className="pa-topbar-title">Post an Ad</h1>
            <p className="pa-topbar-sub">{posted ? "Success" : `Step ${step} of ${TOTAL_STEPS}`}{!posted && activeCategory ? ` — ${activeCategory.name}` : ""}</p>
          </div>
          <div style={{ width: 36 }} aria-hidden="true" />
        </header>

        {posted ? (
          <div className="pa-success" role="alert" aria-live="polite">
            <div className="pa-success-icon"><IconCheck size={42} /></div>
            <h2 className="pa-success-title">Ad Posted!</h2>
            <p className="pa-success-sub">Your listing has been submitted for review.</p>
            <div className="pa-success-btns">
              <button type="button" className="pa-success-primary" onClick={handlePostAnother}><IconPlusCircle size={18} /><span>Post Another Ad</span></button>
              <button type="button" className="pa-success-secondary" onClick={() => navigate("/seller/dashboard")}>View My Listings</button>
              <button type="button" className="pa-success-ghost" onClick={() => navigate("/minimart")}>Browse Marketplace</button>
            </div>
          </div>
        ) : (
          <>
            <StepBar current={step} completedSteps={completedSteps} onStepClick={handleStepClick} stepMeta={STEP_META} />
            <main className="pa-body" id="pa-main">
              {attemptedNext && stepError && (
                <div className="pa-inline-error" role="alert" aria-live="assertive"><IconAlertCircle size={16} /><span>{stepError}</span></div>
              )}
              {step >= 2 && <ProhibitedBanner result={scanResult} scanDone={scanDone} />}

              {step === 1 && (
                <section aria-labelledby="pa-step1-heading">
                  <div className="pa-section-head"><IconCamera size={18} /><h2 id="pa-step1-heading" className="pa-section-title">Add Photos</h2></div>
                  <p className="pa-section-sub">Up to {MAX_IMAGES} photos. First photo is your cover image.</p>
                  <ImageGrid images={images} onAdd={handleAddImage} onRemove={handleRemoveImage} onReorder={handleReorder} compressing={compressing} slotStatuses={slotStatuses} duplicates={duplicateSlots} maxImages={MAX_IMAGES} />
                </section>
              )}

              {step === 2 && (
                <section aria-labelledby="pa-step2-heading">
                  <div className="pa-section-head">
                    <IconFileText size={18} /><h2 id="pa-step2-heading" className="pa-section-title">Product Details</h2>
                    <button type="button" className="pa-gen-btn" onClick={generateKeyFeatures}><IconZap size={14} /><span>Auto-Generate Features</span></button>
                  </div>
                  <p className="pa-section-sub">Clear titles and detailed descriptions rank higher in search.</p>

                  <div className="pa-field">
                    <label className="pa-label" htmlFor="pa-title">Title <span aria-hidden="true">*</span></label>
                    <input id="pa-title" type="text" className={`pa-input${fieldErrors.title ? " pa-input--error" : ""}`} placeholder='e.g. "iPhone 13 Pro Max"' value={title} maxLength={MAX_TITLE_LEN} onChange={(e) => setTitle(e.target.value)} onBlur={() => markTouched("title")} />
                    <div className="pa-field-footer">
                      {fieldErrors.title && <span className="pa-field-error" role="alert">{fieldErrors.title}</span>}
                      <span className={`pa-char-count${title.length > TITLE_WARN_AT ? " pa-char-count--warn" : ""}`}>{title.length}/{MAX_TITLE_LEN}</span>
                    </div>
                  </div>

                  <div className="pa-grid-2">
                    <div className="pa-field">
                      <label className="pa-label" htmlFor="pa-brand">Brand</label>
                      <input id="pa-brand" type="text" className="pa-input" placeholder='e.g. "Apple"' value={brand} maxLength={40} onChange={(e) => setBrand(e.target.value)} />
                    </div>
                    <div className="pa-field">
                      <label className="pa-label" htmlFor="pa-tag-input">Tags <span className="pa-label-hint">{tags.length}/{MAX_TAGS}</span></label>
                      <div className="pa-tag-input-wrap">
                        <IconTag size={13} />
                        <input id="pa-tag-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Press Enter to add" onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); } if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1]); }} />
                      </div>
                      {tags.length > 0 && <div className="pa-tags" role="list">{tags.map((t) => <button key={t} type="button" className="pa-tag" onClick={() => removeTag(t)}>{t}<span className="pa-tag-x"><IconXSmall /></span></button>)}</div>}
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label" htmlFor="pa-desc">Description <span className="pa-label-hint">{description.length}/{MAX_DESC_LEN}</span></label>
                    <textarea
                      id="pa-desc"
                      className="pa-textarea pa-textarea--large"
                      rows={10}
                      placeholder="Describe your product in detail..."
                      value={description}
                      maxLength={MAX_DESC_LEN}
                      onChange={(e) => setDescription(e.target.value)}
                      onPaste={(e) => {
                        const html = e.clipboardData.getData("text/html");
                        const plain = e.clipboardData.getData("text/plain");
                        if (html && html !== plain) {
                          e.preventDefault();
                          const cleaned = htmlToPlainWithBold(html);
                          const el = e.target;
                          const start = el.selectionStart;
                          const end = el.selectionEnd;
                          const next = (description.slice(0, start) + cleaned + description.slice(end)).slice(0, MAX_DESC_LEN);
                          setDescription(next);
                          requestAnimationFrame(() => { const pos = start + cleaned.length; el.setSelectionRange(pos, pos); });
                        }
                      }}
                    />
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Key Features <span className="pa-label-hint">{keyFeatures.filter(Boolean).length}/{MAX_FEATURES}</span></label>
                    <div className="pa-list-wrap">
                      {keyFeatures.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "5000 mAh battery"'
                            onChange={(e) => updateList(setKeyFeatures, i, e.target.value)}
                            onPaste={(e) => {
                              const lines = splitPastedLines(e.clipboardData.getData("text/plain"));
                              if (lines.length > 1) {
                                e.preventDefault();
                                setKeyFeatures((prev) => {
                                  const next = [...prev]; next[i] = lines[0]; next.splice(i + 1, 0, ...lines.slice(1));
                                  return next.slice(0, MAX_FEATURES);
                                });
                                toast.success(`${Math.min(lines.length, MAX_FEATURES - i)} features pasted`);
                              }
                            }}
                          />
                          <button type="button" className="pa-mini-btn pa-mini-btn--remove" onClick={() => removeList(setKeyFeatures, i)}><IconXSmall /></button>
                        </div>
                      ))}
                      {keyFeatures.length < MAX_FEATURES && <button type="button" className="pa-add-btn" onClick={() => addList(setKeyFeatures, keyFeatures, MAX_FEATURES)}><IconPlusSmall /> Add Feature</button>}
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">Specifications <span className="pa-label-hint">{specifications.filter((s) => s.key && s.value).length}/{MAX_SPECS}</span></label>
                    <div className="pa-list-wrap">
                      {specifications.map((row, i) => (
                        <div className="pa-list-row" key={i}>
                          <div className="pa-spec-grid">
                            <input className="pa-mini-input" value={row.key} placeholder="e.g. RAM" onChange={(e) => { const n = [...specifications]; n[i] = { ...n[i], key: e.target.value }; setSpecifications(n); }} />
                            <input className="pa-mini-input" value={row.value} placeholder="e.g. 8 GB" onChange={(e) => { const n = [...specifications]; n[i] = { ...n[i], value: e.target.value }; setSpecifications(n); }} />
                          </div>
                          <button type="button" className="pa-mini-btn pa-mini-btn--remove" onClick={() => removeList(setSpecifications, i)}><IconXSmall /></button>
                        </div>
                      ))}
                      {specifications.length < MAX_SPECS && <button type="button" className="pa-add-btn" onClick={() => setSpecifications((p) => p.length >= MAX_SPECS ? p : [...p, { key: "", value: "" }])}><IconPlusSmall /> Add Specification</button>}
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label">What's in the Box <span className="pa-label-hint">{whatsInBox.filter(Boolean).length}/{MAX_BOX_ITEMS}</span></label>
                    <div className="pa-list-wrap">
                      {whatsInBox.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "1x Charging Cable"'
                            onChange={(e) => updateList(setWhatsInBox, i, e.target.value)}
                            onPaste={(e) => {
                              const lines = splitPastedLines(e.clipboardData.getData("text/plain"));
                              if (lines.length > 1) {
                                e.preventDefault();
                                setWhatsInBox((prev) => {
                                  const next = [...prev]; next[i] = lines[0]; next.splice(i + 1, 0, ...lines.slice(1));
                                  return next.slice(0, MAX_BOX_ITEMS);
                                });
                                toast.success(`${Math.min(lines.length, MAX_BOX_ITEMS - i)} items pasted`);
                              }
                            }}
                          />
                          <button type="button" className="pa-mini-btn pa-mini-btn--remove" onClick={() => removeList(setWhatsInBox, i)}><IconXSmall /></button>
                        </div>
                      ))}
                      {whatsInBox.length < MAX_BOX_ITEMS && <button type="button" className="pa-add-btn" onClick={() => addList(setWhatsInBox, whatsInBox, MAX_BOX_ITEMS)}><IconPlusSmall /> Add Item</button>}
                    </div>
                  </div>

                  <div className="pa-field">
                    <label className="pa-label" id="pa-cat-label">Category <span aria-hidden="true">*</span></label>
                    {fieldErrors.category && <span className="pa-field-error" role="alert">{fieldErrors.category}</span>}
                    <CategoryPicker value={selectedCategory} onSelect={(node) => { setSelectedCategory(node); markTouched("category"); }} error={!!fieldErrors.category} />
                    {selectedCategory?.path?.length > 0 && <p className="pa-cat-breadcrumb" aria-live="polite">{selectedCategory.path.join(" › ")}</p>}
                  </div>
                </section>
              )}

              {step === 3 && (
                <section aria-labelledby="pa-step3-heading">
                  <div className="pa-section-head"><IconPackage size={18} /><h2 id="pa-step3-heading" className="pa-section-title">Variants</h2></div>
                  <p className="pa-section-sub">Add variants for different sizes, colours, or storage options.</p>
                  <VariantEditor
                    variants={variants}
                    onUpdate={updateVariant}
                    onUpdateAttr={updateVariantAttr}
                    onAdd={addVariant}
                    onRemove={removeVariant}
                    onDuplicate={duplicateVariant}
                    onRegenerateSku={regenerateVariantSku}
                    onBulkReplace={(v) => setVariants(v)}
                    errors={fieldErrors}
                    onBlur={markTouched}
                    title={title}
                    categoryName={activeCategory?.name ?? ""}
                    maxVariants={MAX_VARIANTS}
                  />
                </section>
              )}

              {step === 4 && (
                <section aria-labelledby="pa-step4-heading">
                  <div className="pa-section-head"><IconDollarSign size={18} /><h2 id="pa-step4-heading" className="pa-section-title">Pricing</h2></div>
                  <p className="pa-section-sub">Set a competitive price to attract more buyers.</p>
                  <PricingStep basePrice={basePrice} setBasePrice={setBasePrice} originalPrice={originalPrice} setOriginalPrice={setOriginalPrice} discountPct={discountPct} errors={fieldErrors} touched={touched} onBlur={markTouched} />
                </section>
              )}

              {step === 5 && (
                <section aria-labelledby="pa-step5-heading">
                  <div className="pa-section-head"><IconCheck size={18} /><h2 id="pa-step5-heading" className="pa-section-title">Review & Submit</h2></div>
                  <p className="pa-section-sub">Check everything looks right before submitting.</p>
                  <ReviewStep filledImages={filledImages} title={title} brand={brand} tags={tags} basePrice={basePrice} originalPrice={originalPrice} discountPct={discountPct} description={description} category={selectedCategory?.name ?? ""} activeCategory={activeCategory} variants={variants} keyFeatures={keyFeatures} specifications={specifications} whatsInBox={whatsInBox} posting={posting} uploadPct={uploadPct} onSubmit={handleSubmit} lastSaved={lastSaved} prohibitedResult={scanResult} scanDone={scanDone} />
                </section>
              )}
            </main>

            <nav className="pa-footer pa-glass-bar">
              {step > 1 ? <button type="button" className="pa-btn-back" onClick={goBack}><IconChevronLeft size={16} /><span>Back</span></button> : <div />}
              {step < TOTAL_STEPS ? <button type="button" className="pa-btn-next" onClick={goNext} disabled={posting || compressing}><span>{compressing ? "Compressing..." : "Continue"}</span><IconChevronRight size={16} /></button> : <div />}
            </nav>
          </>
        )}
      </div>
    </>
  );
}