/**
 * src/pages/PostAds.jsx
 * Route: /minimart/post-ad
 *
 * Multi-step ad posting flow:
 * Step 1 — Photos
 * Step 2 — Details (title, category, description, features, specs)
 * Step 3 — Variants
 * Step 4 — Pricing
 * Step 5 — Review & Submit
 *
 * Features:
 * - Image compression + SHA-256 duplicate detection
 * - Prohibited content scanner
 * - Smart feature generator
 * - Auto-save draft to localStorage
 * - Upload progress tracking
 * - Double-submit guard (ref + server-side inFlight)
 * - Client-side duplicate SKU detection blocks step 3 → 4
 */

import {
  useEffect, useMemo, useState,
  useCallback, useRef, memo,
} from "react";
import { useNavigate }  from "react-router-dom";
import axios            from "axios";
import toast            from "react-hot-toast";
import imageCompression from "browser-image-compression";

import categories    from "../config/categories";
import ImageGrid     from "./PostAds/ImageGrid";
import VariantEditor from "./PostAds/VariantEditor";
import ReviewStep    from "./PostAds/ReviewStep";
import PricingStep   from "./PostAds/PricingStep";
import StepBar       from "./PostAds/StepBar";
import "../styles/PostAds.css";

/* ══════════════════════════════════════════════════════════════
   ENV
══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const DRAFT_KEY       = "post-ad-draft-v9";
const MAX_IMAGES      = 8;
const MAX_FILE_MB     = 5;
const MAX_VARIANTS    = 20;
const COMPRESS_TARGET = 0.5;
const MAX_FEATURES    = 10;
const MAX_SPECS       = 12;
const MAX_BOX_ITEMS   = 12;
const MAX_TAGS        = 8;
const MAX_TAG_LEN     = 24;
const TOTAL_STEPS     = 5;

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconArrowLeft = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const IconChevronLeft = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconCheck = ({ size = 42 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconZap = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconTag = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconShield = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconAlertTriangle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9"  x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconAlertCircle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8"  x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCamera = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconFileText = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconPackage = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="16.5" y1="9.4"  x2="7.5"  y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconDollarSign = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="12" y1="1"  x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconXSmall = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    aria-hidden="true">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const IconPlusSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    aria-hidden="true">
    <line x1="12" y1="5"  x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   PROHIBITED CONTENT PATTERNS
══════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */
const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();
const uniq      = (arr)    => [...new Set(arr.filter(Boolean))];

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const BLANK_VARIANT = () => ({
  id        : newId(),
  sku       : "",
  name      : "",
  price     : "",
  stock     : "1",
  attributes: { color: "", size: "", storage: "", material: "" },
});

const getAuthToken = () =>
  localStorage.getItem("token")             ||
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("seller_token");

/* ── Content scanner ── */
const scanContent = ({ title = "", description = "", keyFeatures = [] }) => {
  const corpus     = [title, description, ...keyFeatures].join(" ");
  const blocked    = PROHIBITED_PATTERNS
    .filter((r)  => r.pattern.test(corpus))
    .map((r)     => ({ text: corpus.match(r.pattern)?.[0] ?? "flagged", category: r.category }));
  const suspicious = SUSPICIOUS_PATTERNS
    .filter((r)  => r.pattern.test(corpus))
    .map((r)     => ({ text: corpus.match(r.pattern)?.[0] ?? "flagged", label: r.label }));
  return { blocked, suspicious };
};

/* ── SHA-256 file hash ── */
const hashFile = async (file) => {
  try {
    const buf    = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
};

/* ── Image compression ── */
const compressImage = async (file) => {
  if (file.size <= COMPRESS_TARGET * 1024 * 1024) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB       : COMPRESS_TARGET,
      maxWidthOrHeight: 1920,
      useWebWorker    : true,
      fileType        : file.type,
    });
  } catch {
    return file;
  }
};

/* ── Smart feature generator ── */
const guessFeatures = ({ title, categoryName, description, specs }) => {
  const t         = normalize(title).toLowerCase();
  const d         = normalize(description).toLowerCase();
  const specPairs = (specs || [])
    .filter((x) => normalize(x.key) && normalize(x.value))
    .map((x)    => `${normalize(x.key)}: ${normalize(x.value)}`);

  const features = [];

  if (t.includes("new")      || d.includes("brand new"))  features.push("Brand new condition");
  if (t.includes("original") || d.includes("original"))   features.push("100% original product");
  if (d.includes("warranty"))                              features.push("Warranty included");
  if (d.includes("delivery") || d.includes("shipping"))   features.push("Fast delivery available");
  if (d.includes("negotiable"))                            features.push("Price negotiable");

  if (/(iphone|samsung|tecno|infinix|xiaomi|pixel|redmi|oppo|vivo)/i.test(t)) {
    features.push("Fast performance for daily use");
    if (/(128|256|512)\s?gb/i.test(t))              features.push("Large storage capacity");
    if (d.includes("battery") || d.includes("mah")) features.push("Long-lasting battery life");
    if (d.includes("camera"))                        features.push("High-quality camera system");
  }

  if (/(laptop|macbook|hp|dell|lenovo|asus|acer|thinkpad)/i.test(t)) {
    features.push("Smooth multitasking for work and school");
    if (d.includes("ssd") || specPairs.join(" ").includes("ssd")) features.push("Fast SSD storage");
    if (d.includes("ram") || /(8|16|32)\s?gb\s?ram/i.test(t))    features.push("Powerful RAM");
  }

  if (/(nike|adidas|puma|gucci|zara)/i.test(t)) {
    features.push("Premium brand quality");
    features.push("Stylish and trendy design");
  }

  if (categoryName) features.push(`Great for ${categoryName.toLowerCase()} shoppers`);
  specPairs.slice(0, 5).forEach((s) => features.push(s));

  return uniq(features)
    .filter((x) => x.length >= 6 && x.length <= 60)
    .slice(0, MAX_FEATURES);
};

/* ── Duplicate SKU check (client side) ── */
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

/* ══════════════════════════════════════════════════════════════
   STEP META
══════════════════════════════════════════════════════════════ */
const STEP_META = [
  { label: "Photos",   Icon: IconCamera     },
  { label: "Details",  Icon: IconFileText   },
  { label: "Variants", Icon: IconPackage    },
  { label: "Pricing",  Icon: IconDollarSign },
  { label: "Review",   Icon: IconCheck      },
];

/* ══════════════════════════════════════════════════════════════
   PROHIBITED BANNER
══════════════════════════════════════════════════════════════ */
const ProhibitedBanner = memo(function ProhibitedBanner({ result, scanDone }) {
  if (!scanDone || !result) return null;

  const { blocked, suspicious } = result;

  if (!blocked.length && !suspicious.length) {
    return (
      <div className="pa-scan-pass" role="status" aria-live="polite">
        <IconShield size={14} />
        <span>Content scan passed — no prohibited items detected</span>
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
            <div key={i} className="pa-scan-row">
              <span className="pa-scan-category">{b.category}</span>
              <span className="pa-scan-term">"{b.text}"</span>
            </div>
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
            <div key={i} className="pa-scan-row pa-scan-row--warn">
              <span>{s.label}:</span>
              <em>"{s.text}"</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function PostAds({ user }) {
  const navigate      = useNavigate();
  const submittingRef = useRef(false); // double-submit guard

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

  /* Client-side duplicate SKU flag — blocks step 3 → 4 */
  const duplicateSkuExists = useMemo(
    () => hasDuplicateSkus(variants),
    [variants]
  );

  /* ════════════════════════════════════════════════════════════
     LIFECYCLE
  ════════════════════════════════════════════════════════════ */

  /* Cleanup blob URLs on unmount */
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
      if (d.step)                          setStep(d.step);
      if (Array.isArray(d.completedSteps)) setCompletedSteps(d.completedSteps);
      if (d.title)                         setTitle(d.title);
      if (d.brand)                         setBrand(d.brand);
      if (Array.isArray(d.tags))           setTags(d.tags);
      if (d.description)                   setDescription(d.description);
      if (d.category)                      setCategory(d.category);
      if (d.keyFeatures?.length)           setKeyFeatures(d.keyFeatures);
      if (d.specifications?.length)        setSpecifications(d.specifications);
      if (d.whatsInBox?.length)            setWhatsInBox(d.whatsInBox);
      if (d.variants?.length)              setVariants(d.variants);
      if (d.basePrice)                     setBasePrice(d.basePrice);
      if (d.originalPrice)                 setOriginalPrice(d.originalPrice);
    } catch { /* silently ignore corrupt draft */ }
  }, []);

  /* Auto-save draft */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, completedSteps,
      title, brand, tags, description, category,
      keyFeatures, specifications, whatsInBox,
      variants, basePrice, originalPrice,
    }));
    setLastSaved(Date.now());
  }, [
    step, completedSteps,
    title, brand, tags, description, category,
    keyFeatures, specifications, whatsInBox,
    variants, basePrice, originalPrice,
  ]);

  /* Prohibited content scan */
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
      toast.error(`Prohibited: ${result.blocked[0].category}`);
    }
  }, [title, description, keyFeatures]);

  /* Edit-step events from ReviewStep */
  useEffect(() => {
    const handler = (e) => setStep(e.detail);
    window.addEventListener("pa-edit-step", handler);
    return () => window.removeEventListener("pa-edit-step", handler);
  }, []);

  /* ════════════════════════════════════════════════════════════
     IMAGE HANDLERS
  ════════════════════════════════════════════════════════════ */
  const handleAddImage = useCallback(async (index, file, extraFiles = []) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Max ${MAX_FILE_MB} MB per image`);
      return;
    }

    setCompressing(true);
    setSlotStatuses((p) => ({ ...p, [index]: "compressing" }));

    try {
      const hash      = await hashFile(file);
      const duplicate = Object.entries(imageHashes).find(
        ([idx, h]) => h === hash && Number(idx) !== index
      );

      if (duplicate) {
        toast.error(`Photo already in slot ${Number(duplicate[0]) + 1}`);
        setSlotStatuses((p) => ({ ...p, [index]: "idle" }));
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
        toast.success(
          `Compressed — saved ${((file.size - compressed.size) / 1024).toFixed(0)} KB`
        );
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
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setImageHashes((prev) => {
      const n = { ...prev };
      [n[from], n[to]] = [n[to], n[from]];
      return n;
    });
    setSlotStatuses((prev) => {
      const n = { ...prev };
      [n[from], n[to]] = [n[to], n[from]];
      return n;
    });
    toast.success("Image reordered");
  }, []);

  /* ════════════════════════════════════════════════════════════
     LIST HELPERS
  ════════════════════════════════════════════════════════════ */
  const updateList = useCallback((setter, i, val) =>
    setter((p) => p.map((x, idx) => (idx === i ? val : x))), []);

  const addList = useCallback((setter, list, limit) => {
    if (list.length < limit) setter((p) => [...p, ""]);
  }, []);

  const removeList = useCallback((setter, i) =>
    setter((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i))), []);

  /* ════════════════════════════════════════════════════════════
     VARIANT HELPERS
  ════════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════════
     TAGS
  ════════════════════════════════════════════════════════════ */
  const commitTag = useCallback(() => {
    const t = normalize(tagInput).toLowerCase();
    if (!t || t.length > MAX_TAG_LEN) return;
    if (tags.includes(t))        { setTagInput(""); return; }
    if (tags.length >= MAX_TAGS) { toast.error(`Max ${MAX_TAGS} tags`); return; }
    setTags((p) => [...p, t]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((t) =>
    setTags((p) => p.filter((x) => x !== t)), []);

  /* ════════════════════════════════════════════════════════════
     SMART FEATURE GENERATOR
  ════════════════════════════════════════════════════════════ */
  const generateKeyFeatures = useCallback(() => {
    const gen = guessFeatures({
      title,
      categoryName: activeCategory?.name,
      description,
      specs       : specifications,
    });
    if (!gen.length) { toast.error("Add a title or description first"); return; }
    const existing = keyFeatures.map(normalize).filter(Boolean);
    setKeyFeatures(uniq([...existing, ...gen]).slice(0, MAX_FEATURES) || [""]);
    toast.success(`${gen.length} features generated`);
    window.navigator?.vibrate?.(15);
  }, [title, activeCategory, description, specifications, keyFeatures]);

  /* ════════════════════════════════════════════════════════════
     VALIDATION
  ════════════════════════════════════════════════════════════ */
  const markTouched = useCallback((field) =>
    setTouched((p) => ({ ...p, [field]: true })), []);

  const fieldErrors = useMemo(() => {
    const e = {};

    if (filledImages.length === 0)
      e.images = "Add at least 1 photo";

    if (touched.title && title.trim().length < 3)
      e.title = "Title must be at least 3 characters";
    if (touched.title && title.trim().length > 80)
      e.title = "Title is too long";

    if (touched.category && !category)
      e.category = "Select a category";

    if (touched.basePrice) {
      const n = Number(basePrice);
      if (!basePrice || isNaN(n) || n <= 0)
        e.basePrice = "Enter a valid price";
    }

    if (touched.originalPrice && originalPrice) {
      if (Number(originalPrice) <= Number(basePrice))
        e.originalPrice = "Should be higher than the base price";
    }

    variants.forEach((v, i) => {
      if (touched[`v_sku_${i}`]   && !v.sku.trim())
        e[`v_sku_${i}`]   = "Required";
      if (touched[`v_name_${i}`]  && !v.name.trim())
        e[`v_name_${i}`]  = "Required";
      if (touched[`v_price_${i}`] && (isNaN(Number(v.price)) || Number(v.price) < 0))
        e[`v_price_${i}`] = "Invalid price";
    });

    return e;
  }, [touched, title, category, filledImages.length, variants, basePrice, originalPrice]);

  const stepValid = useMemo(() => {
    if (step === 1) return filledImages.length > 0;
    if (step === 2) return title.trim().length >= 3 && !!category;
    if (step === 3) return (
      variants.every((v) => v.sku.trim() && v.name.trim() && Number(v.price) >= 0) &&
      !duplicateSkuExists
    );
    if (step === 4) return !isNaN(Number(basePrice)) && Number(basePrice) > 0;
    if (step === 5) return (
      filledImages.length > 0 &&
      title.trim().length >= 3 &&
      Number(basePrice) > 0
    );
    return true;
  }, [step, filledImages.length, title, category, variants, basePrice, duplicateSkuExists]);

  const stepError = useMemo(() => {
    if (step === 1 && filledImages.length === 0)
      return "Add at least one photo";
    if (step === 2 && title.trim().length < 3)
      return "Title needs at least 3 characters";
    if (step === 2 && !category)
      return "Pick a category";
    if (step === 3 && duplicateSkuExists)
      return "Two or more variants share the same SKU — each SKU must be unique";
    if (step === 3 && !variants.every((v) => v.sku.trim() && v.name.trim()))
      return "Fill in the SKU and name for each variant";
    if (step === 4 && (!basePrice || Number(basePrice) <= 0))
      return "Set a valid base price";
    return "";
  }, [step, filledImages.length, title, category, variants, basePrice, duplicateSkuExists]);

  /* ════════════════════════════════════════════════════════════
     NAVIGATION
  ════════════════════════════════════════════════════════════ */
  const goNext = useCallback(() => {
    setAttemptedNext(true);
    if (!stepValid) return;
    if (scanResult?.blocked.length > 0) {
      toast.error("Remove prohibited content before continuing");
      return;
    }
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev : [...prev, step]
    );
    setAttemptedNext(false);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    window.navigator?.vibrate?.(12);
  }, [stepValid, scanResult, step]);

  const goBack = useCallback(() => {
    setAttemptedNext(false);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const handleStepClick = useCallback((targetStep) => {
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

  /* ════════════════════════════════════════════════════════════
     SUBMIT
  ════════════════════════════════════════════════════════════ */
  const handleSubmit = useCallback(async () => {

    /* ── Double-submit guard ── */
    if (submittingRef.current) return;
    submittingRef.current = true;

    /* ── Pre-flight checks ── */
    if (!user) {
      submittingRef.current = false;
      toast.error("Please log in first");
      return;
    }
    if (!filledImages.length) {
      submittingRef.current = false;
      toast.error("Add at least one photo");
      return;
    }
    if (scanResult?.blocked.length > 0) {
      submittingRef.current = false;
      toast.error("Remove prohibited content first");
      return;
    }
    if (duplicateSkuExists) {
      submittingRef.current = false;
      toast.error("Fix duplicate variant SKUs before submitting");
      return;
    }

    setPosting(true);
    setUploadPct(0);

    try {
      const token = getAuthToken();
      const fd    = new FormData();

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
          Authorization : token ? `Bearer ${token}` : undefined,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100));
        },
      });

      localStorage.removeItem(DRAFT_KEY);
      setPosted(true);
      toast.success("Ad posted successfully");
      window.navigator?.vibrate?.([50, 30, 80]);

    } catch (err) {
      if (!err.response)
        toast.error("Network error. Check your connection.");
      else if (err.response.status === 401)
        toast.error("Session expired. Please log in again.");
      else if (err.response.status === 409)
        toast.error(err.response.data?.message || "A duplicate was detected. Check your title.");
      else if (err.response.status === 413)
        toast.error("Images are too large.");
      else if (err.response.status === 422)
        toast.error(err.response.data?.message || "Check your inputs and try again.");
      else if (err.response.status === 429)
        toast.error("Already submitting. Please wait a moment.");
      else
        toast.error(err.response.data?.message || "Failed to post ad. Please try again.");
    } finally {
      setPosting(false);
      submittingRef.current = false; // always release the guard
    }
  }, [
    user, filledImages, scanResult, duplicateSkuExists,
    title, description, category, basePrice, originalPrice,
    brand, tags, variants, keyFeatures, specifications, whatsInBox, images,
  ]);

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      <a href="#pa-main" className="pa-skip-link">Skip to main content</a>

      <div className="pa-page pa-glass">

        {/* ── Topbar ── */}
        <header className="pa-topbar pa-glass-bar">
          <button
            type="button"
            className="pa-topbar-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <IconArrowLeft size={18} />
          </button>

          <div className="pa-topbar-center">
            <h1 className="pa-topbar-title">Post an Ad</h1>
            <p className="pa-topbar-sub">
              Step {step} of {TOTAL_STEPS}
              {activeCategory ? ` — ${activeCategory.name}` : ""}
            </p>
          </div>

          <div style={{ width: 36 }} aria-hidden="true" />
        </header>

        {/* ── Success screen ── */}
        {posted ? (
          <div className="pa-success" role="alert" aria-live="polite">
            <div className="pa-success-icon">
              <IconCheck size={42} />
            </div>
            <h2 className="pa-success-title">Ad Posted</h2>
            <p className="pa-success-sub">
              Your listing has been submitted for review.
              You will be notified once it is approved.
            </p>
            <div className="pa-success-btns">
              <button
                type="button"
                className="pa-success-primary"
                onClick={() => navigate("/minimart")}
              >
                Browse Marketplace
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
            <StepBar
              current={step}
              completedSteps={completedSteps}
              onStepClick={handleStepClick}
              stepMeta={STEP_META}
            />

            <main className="pa-body" id="pa-main">

              {/* Inline step error */}
              {attemptedNext && stepError && (
                <div className="pa-inline-error" role="alert" aria-live="assertive">
                  <IconAlertCircle size={16} />
                  <span>{stepError}</span>
                </div>
              )}

              {/* Prohibited banner */}
              {step >= 2 && (
                <ProhibitedBanner result={scanResult} scanDone={scanDone} />
              )}

              {/* ════════════════════════
                  STEP 1 — PHOTOS
              ════════════════════════ */}
              {step === 1 && (
                <section aria-labelledby="pa-step1-heading">
                  <div className="pa-section-head">
                    <IconCamera size={18} />
                    <h2 id="pa-step1-heading" className="pa-section-title">
                      Add Photos
                    </h2>
                  </div>
                  <p className="pa-section-sub">
                    Up to {MAX_IMAGES} photos. First photo is your cover image.
                  </p>
                  <ImageGrid
                    images={images}
                    onAdd={handleAddImage}
                    onRemove={handleRemoveImage}
                    onReorder={handleReorder}
                    compressing={compressing}
                    slotStatuses={slotStatuses}
                    duplicates={duplicateSlots}
                    maxImages={MAX_IMAGES}
                  />
                </section>
              )}

              {/* ════════════════════════
                  STEP 2 — DETAILS
              ════════════════════════ */}
              {step === 2 && (
                <section aria-labelledby="pa-step2-heading">
                  <div className="pa-section-head">
                    <IconFileText size={18} />
                    <h2 id="pa-step2-heading" className="pa-section-title">
                      Product Details
                    </h2>
                    <button
                      type="button"
                      className="pa-gen-btn"
                      onClick={generateKeyFeatures}
                      aria-label="Auto-generate key features"
                    >
                      <IconZap size={14} />
                      <span>Auto-Generate Features</span>
                    </button>
                  </div>
                  <p className="pa-section-sub">
                    Clear titles and detailed descriptions rank higher in search.
                  </p>

                  {/* Title */}
                  <div className="pa-field">
                    <label className="pa-label" htmlFor="pa-title">
                      Title <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="pa-title"
                      type="text"
                      className={`pa-input${fieldErrors.title ? " pa-input--error" : ""}`}
                      placeholder='e.g. "iPhone 13 Pro Max 256 GB"'
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
                      <span className={`pa-char-count${title.length > 70 ? " pa-char-count--warn" : ""}`}>
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
                      <label className="pa-label" htmlFor="pa-tag-input">
                        Tags
                        <span className="pa-label-hint">{tags.length}/{MAX_TAGS}</span>
                      </label>
                      <div className="pa-tag-input-wrap">
                        <IconTag size={13} />
                        <input
                          id="pa-tag-input"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          aria-label="Type a tag and press Enter to add"
                          placeholder="Press Enter to add"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              commitTag();
                            }
                            if (e.key === "Backspace" && !tagInput && tags.length) {
                              removeTag(tags[tags.length - 1]);
                            }
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
                              {t}
                              <span className="pa-tag-x" aria-hidden="true">
                                <IconXSmall />
                              </span>
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
                      placeholder="Describe your product — condition, features, usage history..."
                      value={description}
                      maxLength={700}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <span className={`pa-char-count${description.length > 640 ? " pa-char-count--warn" : ""}`}>
                      {description.length}/700
                    </span>
                  </div>

                  {/* Key Features */}
                  <div className="pa-field">
                    <label className="pa-label">
                      Key Features
                      <span className="pa-label-hint">
                        {keyFeatures.filter(Boolean).length}/{MAX_FEATURES}
                      </span>
                    </label>
                    <div className="pa-list-wrap">
                      {keyFeatures.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "5000 mAh battery"'
                            aria-label={`Key feature ${i + 1}`}
                            onChange={(e) => updateList(setKeyFeatures, i, e.target.value)}
                          />
                          <button
                            type="button"
                            className="pa-mini-btn pa-mini-btn--remove"
                            aria-label={`Remove feature ${i + 1}`}
                            onClick={() => removeList(setKeyFeatures, i)}
                          >
                            <IconXSmall />
                          </button>
                        </div>
                      ))}
                      {keyFeatures.length < MAX_FEATURES && (
                        <button
                          type="button"
                          className="pa-add-btn"
                          onClick={() => addList(setKeyFeatures, keyFeatures, MAX_FEATURES)}
                        >
                          <IconPlusSmall /> Add Feature
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="pa-field">
                    <label className="pa-label">
                      Specifications
                      <span className="pa-label-hint">
                        {specifications.filter((s) => s.key && s.value).length}/{MAX_SPECS}
                      </span>
                    </label>
                    <div className="pa-list-wrap">
                      {specifications.map((row, i) => (
                        <div className="pa-list-row" key={i}>
                          <div className="pa-spec-grid">
                            <input
                              className="pa-mini-input"
                              value={row.key}
                              placeholder="e.g. RAM"
                              aria-label={`Specification ${i + 1} name`}
                              onChange={(e) => {
                                const n = [...specifications];
                                n[i] = { ...n[i], key: e.target.value };
                                setSpecifications(n);
                              }}
                            />
                            <input
                              className="pa-mini-input"
                              value={row.value}
                              placeholder="e.g. 8 GB"
                              aria-label={`Specification ${i + 1} value`}
                              onChange={(e) => {
                                const n = [...specifications];
                                n[i] = { ...n[i], value: e.target.value };
                                setSpecifications(n);
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="pa-mini-btn pa-mini-btn--remove"
                            aria-label={`Remove specification ${i + 1}`}
                            onClick={() => removeList(setSpecifications, i)}
                          >
                            <IconXSmall />
                          </button>
                        </div>
                      ))}
                      {specifications.length < MAX_SPECS && (
                        <button
                          type="button"
                          className="pa-add-btn"
                          onClick={() =>
                            setSpecifications((p) =>
                              p.length >= MAX_SPECS ? p : [...p, { key: "", value: "" }]
                            )
                          }
                        >
                          <IconPlusSmall /> Add Specification
                        </button>
                      )}
                    </div>
                  </div>

                  {/* What's in the Box */}
                  <div className="pa-field">
                    <label className="pa-label">
                      What's in the Box
                      <span className="pa-label-hint">
                        {whatsInBox.filter(Boolean).length}/{MAX_BOX_ITEMS}
                      </span>
                    </label>
                    <div className="pa-list-wrap">
                      {whatsInBox.map((item, i) => (
                        <div className="pa-list-row" key={i}>
                          <input
                            className="pa-mini-input"
                            value={item}
                            placeholder='e.g. "1x Charging Cable"'
                            aria-label={`Box item ${i + 1}`}
                            onChange={(e) => updateList(setWhatsInBox, i, e.target.value)}
                          />
                          <button
                            type="button"
                            className="pa-mini-btn pa-mini-btn--remove"
                            aria-label={`Remove box item ${i + 1}`}
                            onClick={() => removeList(setWhatsInBox, i)}
                          >
                            <IconXSmall />
                          </button>
                        </div>
                      ))}
                      {whatsInBox.length < MAX_BOX_ITEMS && (
                        <button
                          type="button"
                          className="pa-add-btn"
                          onClick={() => addList(setWhatsInBox, whatsInBox, MAX_BOX_ITEMS)}
                        >
                          <IconPlusSmall /> Add Item
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="pa-field">
                    <label className="pa-label" id="pa-cat-label">
                      Category <span aria-hidden="true">*</span>
                    </label>
                    {fieldErrors.category && (
                      <span className="pa-field-error" role="alert">
                        {fieldErrors.category}
                      </span>
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
                          className={`pa-cat-btn${category === c.id ? " pa-cat-btn--active" : ""}`}
                          onClick={() => { setCategory(c.id); markTouched("category"); }}
                        >
                          {c.icon && (
                            <span className="pa-cat-icon" aria-hidden="true">{c.icon}</span>
                          )}
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ════════════════════════
                  STEP 3 — VARIANTS
              ════════════════════════ */}
              {step === 3 && (
                <section aria-labelledby="pa-step3-heading">
                  <div className="pa-section-head">
                    <IconPackage size={18} />
                    <h2 id="pa-step3-heading" className="pa-section-title">
                      Variants
                    </h2>
                  </div>
                  <p className="pa-section-sub">
                    Add variants for different sizes, colours, or storage options.
                  </p>
                  <VariantEditor
                    variants={variants}
                    onUpdate={updateVariant}
                    onUpdateAttr={updateVariantAttr}
                    onAdd={addVariant}
                    onRemove={removeVariant}
                    onDuplicate={duplicateVariant}
                    onBulkReplace={(v) => setVariants(v)}
                    errors={fieldErrors}
                    onBlur={markTouched}
                    title={title}
                    categoryName={activeCategory?.name ?? ""}
                    maxVariants={MAX_VARIANTS}
                  />
                </section>
              )}

              {/* ════════════════════════
                  STEP 4 — PRICING
              ════════════════════════ */}
              {step === 4 && (
                <section aria-labelledby="pa-step4-heading">
                  <div className="pa-section-head">
                    <IconDollarSign size={18} />
                    <h2 id="pa-step4-heading" className="pa-section-title">
                      Pricing
                    </h2>
                  </div>
                  <p className="pa-section-sub">
                    Set a competitive price to attract more buyers.
                  </p>
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

              {/* ════════════════════════
                  STEP 5 — REVIEW
              ════════════════════════ */}
              {step === 5 && (
                <section aria-labelledby="pa-step5-heading">
                  <div className="pa-section-head">
                    <IconCheck size={18} />
                    <h2 id="pa-step5-heading" className="pa-section-title">
                      Review & Submit
                    </h2>
                  </div>
                  <p className="pa-section-sub">
                    Check everything looks right before submitting.
                  </p>
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

            {/* ── Footer Navigation ── */}
            <nav className="pa-footer pa-glass-bar" aria-label="Step navigation">
              {step > 1 ? (
                <button
                  type="button"
                  className="pa-btn-back"
                  onClick={goBack}
                  aria-label="Go to previous step"
                >
                  <IconChevronLeft size={16} />
                  <span>Back</span>
                </button>
              ) : (
                <div aria-hidden="true" />
              )}

              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  className="pa-btn-next"
                  onClick={goNext}
                  disabled={posting || compressing}
                  aria-label={
                    compressing
                      ? "Compressing images, please wait"
                      : "Continue to next step"
                  }
                >
                  <span>{compressing ? "Compressing..." : "Continue"}</span>
                  <IconChevronRight size={16} />
                </button>
              ) : (
                <div aria-hidden="true" />
              )}
            </nav>
          </>
        )}
      </div>
    </>
  );
}