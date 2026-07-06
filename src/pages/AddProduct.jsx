/**
 * src/pages/AddProduct.jsx
 * Route: /minimart/add
 *       /minimart/add?edit=:productId  ← EDIT MODE
 *
 * Changes from v10:
 *  ─ Edit mode: reads ?edit= param, fetches product, pre-fills form
 *  ─ PATCH /api/seller-dashboard/products/:id on submit in edit mode
 *  ─ Existing images shown in edit mode with ability to remove/add
 *  ─ isEditMode flag passed to ProductComponents
 *  ─ Edit submit skips payment flow entirely
 *  ─ Edit submit preserves existing images not removed
 */

import {
  useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ProductComponents from "./product/components.jsx";
import ProgressOverlay   from "../components/ProgressOverlay.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { apiFetch, ApiError } from "../utils/apiFetch.js";
import imageCompression  from "browser-image-compression";
import "../styles/AddProduct.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const STORAGE_PAYMENT    = "payment_retry";
const DRAFT_VERSION      = 3;
const MAX_IMAGES         = 6;
const MAX_SIZE           = 3 * 1024 * 1024;
const DRAFT_DELAY_MS     = 1_200;
const UPLOAD_TIMEOUT     = 120_000;
const PAYMENT_MAX_AGE    = 30 * 60 * 1_000;
const GPS_TIMEOUT        = 10_000;
const GPS_MAX_AGE        = 60_000;
const BRAND_NAME         = "Loemart";
const USER_AGENT         = "loemart-app/1.0";
const DESCRIPTION_MIN    = 10;
const GPS_ROUND_DP       = 4;

const COMPRESS_BUDGET_LOW_END = { maxSizeMB: 0.5, maxWidthOrHeight: 800  };
const COMPRESS_BUDGET_NORMAL  = { maxSizeMB: 1,   maxWidthOrHeight: 1280 };

const ALLOWED_PAYMENT_HOSTS = new Set([
  "checkout.paystack.com",
  "standard.paystack.com",
]);

const PHONE_RE = /^\+?[0-9]{7,15}$/;

/* ─── Initial form ── */
const INITIAL_FORM = Object.freeze({
  title          : "",
  description    : "",
  price          : "",
  category_id    : "",
  subcategory_id : "",
  attributes     : Object.freeze({
    brand : "", model : "", color : "", condition : "",
    used_detail : "", ram : "", storage : "", sim : "",
    year : "", engine : "", fuel_type : "",
    features : Object.freeze([]),
    size : "", age_range : "", bedrooms : "", bathrooms : "",
    experience_level : "", skills : "",
  }),
  delivery : Object.freeze({
    available : false,
    duration  : Object.freeze({ from: "", to: "" }),
    fee : "", note : "",
  }),
  contact : Object.freeze({
    phone : "", whatsapp : "", whatsapp_link : "",
    email : "", preferred : "chat",
  }),
});

const ERROR_SELECTOR_MAP = [
  { match: "Title",          sel: "#ap-title"               },
  { match: "Description",    sel: "#ap-desc"                },
  { match: "price",          sel: "#ap-price"               },
  { match: "Category",       sel: ".section:nth-of-type(2)" },
  { match: "email",          sel: "#ap-email"               },
  { match: "Phone",          sel: "#ap-phone"               },
  { match: "WhatsApp",       sel: "#ap-wa"                  },
  { match: "image",          sel: ".ap-image-box"           },
  { match: "state and city", sel: ".detect-location-row"    },
  { match: "Terms",          sel: ".ap-terms-row"           },
  { match: "delivery days",  sel: "#ap-del-from"            },
  { match: "Delivery end",   sel: "#ap-del-to"              },
  { match: "delivery fee",   sel: "#ap-del-fee"             },
];

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits  = (v = "") => v.replace(/[^0-9]/g,  "");
const toArray     = (v)      => (Array.isArray(v) ? v : []);
const roundGps    = (c)      =>
  Math.round(c * 10 ** GPS_ROUND_DP) / 10 ** GPS_ROUND_DP;

const displayPrice = (v) => {
  const n = Number(v);
  return Number.isNaN(n) || n <= 0
    ? ""
    : new Intl.NumberFormat("en-NG").format(n);
};

const formatLabel = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const getTokenOrRedirect = (navigate, returnPath) => {
  const token = getToken();
  if (!token) {
    navigate(
      `/login?redirect=${encodeURIComponent(returnPath ?? window.location.pathname)}`
    );
    throw new ApiError("Session expired — redirecting to login", 401);
  }
  return token;
};

const safeOpenPayment = (url, onError) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Non-HTTPS URL");
    const hostAllowed = [...ALLOWED_PAYMENT_HOSTS].some(
      (host) =>
        parsed.hostname === host ||
        parsed.hostname.endsWith(`.${host}`)
    );
    if (!hostAllowed) throw new Error(`Untrusted host: ${parsed.hostname}`);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    console.error("[Payment] Blocked unsafe URL:", err.message);
    onError?.("Payment URL invalid — please contact support");
  }
};

const isValidPaymentSession = (obj) =>
  obj &&
  typeof obj.reference === "string" && obj.reference.length > 0 &&
  typeof obj.authUrl   === "string" && obj.authUrl.startsWith("https://") &&
  typeof obj.createdAt === "number";

const verifyImageMagicBytes = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result);
      const hex = Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      resolve(
        hex.startsWith("ffd8ff")   ||
        hex.startsWith("89504e47") ||
        (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250")
      );
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 12));
  });

const hashImageFile = async (file) => {
  try {
    const buf  = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
};

const getNetworkBudget = () => {
  const conn =
    navigator?.connection ??
    navigator?.mozConnection ??
    navigator?.webkitConnection;
  if (!conn) return COMPRESS_BUDGET_NORMAL;
  const slow =
    conn.effectiveType === "2g"      ||
    conn.effectiveType === "slow-2g" ||
    conn.saveData                    ||
    conn.downlink < 1;
  return slow ? COMPRESS_BUDGET_LOW_END : COMPRESS_BUDGET_NORMAL;
};

const getOrCreateIdempotencyKey = (storageKey) => {
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  return id;
};

const clearIdempotencyKey = (storageKey) =>
  sessionStorage.removeItem(storageKey);

const multipartPost = async (
  url, formData, token, timeoutMs = UPLOAD_TIMEOUT
) => {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method  : "POST",
      headers : { Authorization: `Bearer ${token}` },
      body    : formData,
      signal  : ctrl.signal,
    });
  } catch (err) {
    if (err.name === "AbortError")
      throw new ApiError(
        "Upload timed out — check your connection and try again", 0
      );
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  } finally {
    clearTimeout(tid);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      data?.message ?? `Request failed (${res.status})`, res.status
    );
  return data;
};

/* ── PATCH with multipart (for edit with new images) ── */
const multipartPatch = async (
  url, formData, token, timeoutMs = UPLOAD_TIMEOUT
) => {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method  : "PATCH",
      headers : { Authorization: `Bearer ${token}` },
      body    : formData,
      signal  : ctrl.signal,
    });
  } catch (err) {
    if (err.name === "AbortError")
      throw new ApiError("Upload timed out — try again", 0);
    throw new ApiError("Cannot reach the server.", 0);
  } finally {
    clearTimeout(tid);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status);
  return data;
};

const scrollToError = (msg) => {
  if (!msg) return;
  const entry = ERROR_SELECTOR_MAP.find((e) => msg.includes(e.match));
  const sel   = entry?.sel ?? ".ap-error-banner";
  requestAnimationFrame(() => {
    try {
      const el = document.querySelector(sel);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        setTimeout(() => el.focus({ preventScroll: true }), 350);
      }
      el.classList.add("ap-field-flash");
      setTimeout(() => el.classList.remove("ap-field-flash"), 2_000);
    } catch { /* scroll is nice-to-have */ }
  });
};

const isValidPhone = (value) => {
  if (!value) return false;
  return PHONE_RE.test(String(value).replace(/[\s\-().]/g, ""));
};

const sanitizePhone = (v = "") => v.replace(/[\s\-().]/g, "");
const freshForm = () => structuredClone(INITIAL_FORM);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AddProduct({ user }) {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  /* ── Edit mode ── */
  const editId     = searchParams.get("edit") || null;
  const isEditMode = !!editId;

  const STORAGE_DRAFT = useMemo(
    () => `product_draft_v3_${user?.id ?? "anon"}`,
    [user?.id]
  );
  const IDEMPOTENCY_STORE = useMemo(
    () => `idempotency_${user?.id ?? "anon"}`,
    [user?.id]
  );

  /* ─── Core state ── */
  const [form,              setForm]              = useState(freshForm);
  const [categories,        setCategories]        = useState([]);
  const [promotionPlans,    setPromotionPlans]    = useState([]);
  const [plansLoading,      setPlansLoading]      = useState(true);
  const [locationState,     setLocationState]     = useState("");
  const [city,              setCity]              = useState("");
  const [images,            setImages]            = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [selectedPlan,      setSelectedPlan]      = useState(null);
  const [paymentData,       setPaymentData]       = useState(null);
  const [error,             setError]             = useState("");
  const [success,           setSuccess]           = useState("");
  const [agreedToTerms,     setAgreedToTerms]     = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords,    setDetectedCoords]    = useState(null);
  const [progressVisible,   setProgressVisible]   = useState(false);
  const [progressStep,      setProgressStep]      = useState("compressing");

  /* ─── Edit mode state ── */
  const [editLoading,      setEditLoading]      = useState(isEditMode);
  const [editError,        setEditError]        = useState(null);
  const [existingImages,   setExistingImages]   = useState([]); // images already on server
  const [removedImageKeys, setRemovedImageKeys] = useState([]); // r2_keys to delete

  /* ─── Seller limits ── */
  const [sellerLimits,  setSellerLimits]  = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  /* ─── Post-creation ── */
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData,  setVerificationData]  = useState(null);

  /* ─── Image compression progress ── */
  const [compressingCount, setCompressingCount] = useState(0);
  const [compressingTotal, setCompressingTotal] = useState(0);

  /* ─── Refs ── */
  const mountedRef      = useRef(true);
  const isSubmittingRef = useRef(false);
  const imagesRef       = useRef([]);
  const imagesLengthRef = useRef(0);
  const autoSaveTimer   = useRef(null);
  const sessionHashSet  = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    imagesLengthRef.current = images.length;
  }, [images.length]);

  /* ─── Derived ── */
  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)) ?? null,
    [categories, form.category_id]
  );
  const options = useMemo(
    () => selectedCategory?.dynamicOptions ?? {},
    [selectedCategory]
  );
  const attributes = useMemo(
    () => form.attributes ?? INITIAL_FORM.attributes,
    [form.attributes]
  );
  const states = useMemo(() => Object.keys(locationsByState ?? {}), []);
  const cities = useMemo(
    () => locationState ? (locationsByState[locationState] ?? []) : [],
    [locationState]
  );
  const isSelectedPlanPaid =
    !!selectedPlan && Number(selectedPlan?.price ?? 0) > 0;

  /* ── Limit derivations ── */
  const isVerifiedSeller = sellerLimits?.seller_verified  ?? false;
  const trialExhausted   = sellerLimits?.trial_exhausted  ?? false;
  const trialRemaining   = sellerLimits?.trial_remaining  ?? null;
  const dailyRemaining   = sellerLimits?.daily_remaining  ?? null;
  const activeRemaining  = sellerLimits?.active_remaining ?? null;
  const cooldownSecs     = sellerLimits?.cooldown_seconds ?? 0;

  const canPost = useMemo(() => {
    /* Edit mode — always allowed, not creating new listing */
    if (isEditMode) return true;
    if (!sellerLimits)  return true;
    if (trialExhausted) return false;
    const dailyOk  = dailyRemaining  === null || dailyRemaining  > 0;
    const activeOk = activeRemaining === null || activeRemaining > 0;
    return dailyOk && activeOk && cooldownSecs === 0;
  }, [isEditMode, sellerLimits, trialExhausted, dailyRemaining, activeRemaining, cooldownSecs]);

  /* ─── Feedback ── */
  const showError = useCallback((msg) => {
    if (!mountedRef.current) return;
    setError(msg);
    scrollToError(msg);
    setTimeout(() => { if (mountedRef.current) setError(""); }, 7_000);
  }, []);

  const showSuccess = useCallback((msg) => {
    if (!mountedRef.current) return;
    setSuccess(msg);
    setTimeout(() => { if (mountedRef.current) setSuccess(""); }, 5_000);
  }, []);

  /* ─── Fetch limits ── */
  const fetchLimits = useCallback(() => {
    /* Skip limits fetch in edit mode — not needed */
    if (isEditMode) { setLimitsLoading(false); return; }
    const token = getToken();
    if (!token) { setLimitsLoading(false); return; }
    setLimitsLoading(true);
    apiFetch(`${API_BASE}/addproduct/seller/limits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((d) => { if (d.success && mountedRef.current) setSellerLimits(d); })
      .catch((err) => console.warn("[AddProduct] limits:", err.message))
      .finally(() => { if (mountedRef.current) setLimitsLoading(false); });
  }, [isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     LOAD PRODUCT FOR EDIT
  ═══════════════════════════════════════════════════════════ */
  const loadProductForEdit = useCallback(async () => {
    if (!editId) return;
    const token = getToken();
    if (!token) { navigate("/auth?redirect=/dashboard"); return; }

    setEditLoading(true);
    setEditError(null);

    try {
      console.log("[AddProduct] Loading product for edit:", editId);
      const res = await fetch(
        `${API_BASE}/seller-dashboard/products/${editId}`,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      const d = await res.json();

      if (!res.ok || !d.success) {
        throw new Error(d.message || "Product not found");
      }

      const p = d.product;
      if (!mountedRef.current) return;

      console.log("[AddProduct] Product loaded:", p.title);

      /* ── Pre-fill form ── */
      setForm({
        title          : p.title          || "",
        description    : p.description    || "",
        price          : String(p.price   || ""),
        category_id    : String(p.category_id    || ""),
        subcategory_id : String(p.subcategory_id || ""),
        attributes     : {
          ...structuredClone(INITIAL_FORM.attributes),
          ...(typeof p.attributes === "object" && p.attributes !== null
            ? p.attributes : {}),
          features: toArray(p.attributes?.features),
        },
        delivery: {
          available : p.delivery?.available ?? false,
          duration  : {
            from : p.delivery?.duration?.from ?? "",
            to   : p.delivery?.duration?.to   ?? "",
          },
          fee  : p.delivery?.fee  ?? "",
          note : p.delivery?.note ?? "",
        },
        contact: {
          phone         : p.phone         || p.contact?.phone         || "",
          whatsapp      : p.whatsapp      || p.contact?.whatsapp      || "",
          whatsapp_link : p.whatsapp_link || p.contact?.whatsapp_link || "",
          email         : p.contact?.email || user?.email             || "",
          preferred     : p.contact?.preferred || "chat",
        },
      });

      /* ── Pre-fill location ── */
      if (p.location_state) setLocationState(p.location_state);
      if (p.location_city)  setCity(p.location_city);

      /* ── Pre-fill coordinates ── */
      if (p.latitude && p.longitude) {
        setDetectedCoords({ latitude: p.latitude, longitude: p.longitude });
      }

      /* ── Pre-fill existing images ── */
      if (p.product_images && p.product_images.length > 0) {
        /* Use product_images table data (has r2_key) */
        setExistingImages(
          p.product_images.map((img) => ({
            id        : img.id,
            url       : img.image_url,
            r2_key    : img.r2_key    || null,
            position  : img.position_order ?? 0,
            is_primary: img.is_primary ?? false,
            /* Mark as existing (not a new upload) */
            isExisting: true,
          }))
        );
      } else if (Array.isArray(p.images) && p.images.length > 0) {
        /* Fallback to images JSONB */
        setExistingImages(
          p.images.map((img, i) => ({
            id        : `existing-${i}`,
            url       : typeof img === "string" ? img : img?.url || "",
            r2_key    : img?.key || null,
            position  : i,
            is_primary: i === 0,
            isExisting: true,
          }))
        );
      } else if (p.main_image || p.thumbnail_url) {
        /* Fallback to main_image */
        setExistingImages([{
          id        : "existing-main",
          url       : p.main_image || p.thumbnail_url,
          r2_key    : null,
          position  : 0,
          is_primary: true,
          isExisting: true,
        }]);
      }

      /* Auto-agree to terms in edit mode */
      setAgreedToTerms(true);

    } catch (err) {
      console.error("[AddProduct] edit load error:", err);
      if (mountedRef.current) {
        setEditError(err.message || "Failed to load product");
      }
    } finally {
      if (mountedRef.current) setEditLoading(false);
    }
  }, [editId, navigate, user?.email]);

  /* ─── Load categories ── */
  useEffect(() => {
    apiFetch(`${API_BASE}/addproduct/categories`)
      .then((data) => {
        if (!mountedRef.current) return;
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setCategories([]);
        showError(err.message ?? "Failed to load categories");
      });
  }, [showError]);

  /* ─── Load limits (skip in edit mode) ── */
  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  /* ─── Cooldown auto-refresh ── */
  useEffect(() => {
    if (!cooldownSecs || cooldownSecs <= 0) return;
    const tid = setTimeout(fetchLimits, (cooldownSecs + 2) * 1_000);
    return () => clearTimeout(tid);
  }, [cooldownSecs, fetchLimits]);

  /* ─── Load plans (skip in edit mode) ── */
  useEffect(() => {
    if (isEditMode) { setPlansLoading(false); return; }
    setPlansLoading(true);
    apiFetch(`${API_BASE}/payment/plans`)
      .then((data) => {
        if (!mountedRef.current) return;
        if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setPromotionPlans(data.plans);
        } else {
          setPromotionPlans([]);
        }
      })
      .catch(() => { if (mountedRef.current) setPromotionPlans([]); })
      .finally(() => { if (mountedRef.current) setPlansLoading(false); });
  }, [isEditMode, showError]);

  /* ─── Load product for edit (after categories ready) ── */
  useEffect(() => {
    if (isEditMode && categories.length > 0) {
      loadProductForEdit();
    }
  }, [isEditMode, categories.length, loadProductForEdit]);

  /* ─── Resume stale payment (skip in edit mode) ── */
  useEffect(() => {
    if (isEditMode) return;
    const check = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_PAYMENT);
        if (!saved) return;
        let session;
        try { session = JSON.parse(saved); }
        catch { localStorage.removeItem(STORAGE_PAYMENT); return; }

        if (!isValidPaymentSession(session)) {
          localStorage.removeItem(STORAGE_PAYMENT);
          return;
        }

        const ageMs = Date.now() - session.createdAt;
        if (ageMs <= PAYMENT_MAX_AGE) {
          if (mountedRef.current) setPaymentData(session);
          showSuccess("Incomplete payment found — tap 'Complete Payment' to finish");
          return;
        }

        if (session.reference) {
          const token = getToken();
          if (token) {
            try {
              const result = await apiFetch(`${API_BASE}/payment/verify`, {
                method  : "POST",
                headers : { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body    : JSON.stringify({ reference: session.reference }),
              });
              if (!mountedRef.current) return;
              if (result.status === "success") {
                showSuccess(result.needs_verification
                  ? "Payment confirmed. Redirecting to verification…"
                  : "Your previous payment was confirmed — product is live!"
                );
                if (result.needs_verification) {
                  setTimeout(() => { if (mountedRef.current) navigate("/verification"); }, 2_000);
                }
              }
            } catch { /* non-critical */ }
          }
        }

        localStorage.removeItem(STORAGE_PAYMENT);
        if (mountedRef.current) setPaymentData(null);
      } catch {
        localStorage.removeItem(STORAGE_PAYMENT);
      }
    };
    check();
  }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Restore draft (skip in edit mode) ── */
  const categoriesReady = categories.length > 0;
  const dataReady       = !plansLoading && categoriesReady;

  useEffect(() => {
    if (isEditMode) return; // don't restore draft when editing
    if (!dataReady) return;
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft.version || draft.version < DRAFT_VERSION) {
        localStorage.removeItem(STORAGE_DRAFT);
        return;
      }
      if (!mountedRef.current) return;

      const f = draft.form ?? {};
      setForm({
        title          : f.title          ?? "",
        description    : f.description    ?? "",
        price          : f.price          ?? "",
        category_id    : f.category_id    ?? "",
        subcategory_id : f.subcategory_id ?? "",
        attributes     : {
          ...structuredClone(INITIAL_FORM.attributes),
          ...(f.attributes ?? {}),
          features : toArray(f.attributes?.features),
        },
        delivery : {
          available : f.delivery?.available ?? false,
          duration  : { from: f.delivery?.duration?.from ?? "", to: f.delivery?.duration?.to ?? "" },
          fee  : f.delivery?.fee  ?? "",
          note : f.delivery?.note ?? "",
        },
        contact : {
          phone         : f.contact?.phone         ?? "",
          whatsapp      : f.contact?.whatsapp      ?? "",
          whatsapp_link : f.contact?.whatsapp_link ?? "",
          email         : f.contact?.email         ?? "",
          preferred     : f.contact?.preferred     ?? "chat",
        },
      });
      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");
      if (draft.selectedPlan) {
        const matched = promotionPlans.find((p) => String(p.id) === String(draft.selectedPlan));
        setSelectedPlan(matched ?? null);
      }
    } catch (err) {
      console.warn("[AddProduct] draft restore failed:", err.message);
    }
  }, [dataReady, isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Auto-save draft (skip in edit mode) ── */
  useEffect(() => {
    if (isEditMode) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        localStorage.setItem(STORAGE_DRAFT, JSON.stringify({
          version      : DRAFT_VERSION,
          form,
          locationState,
          city,
          imagesCount  : images.length,
          selectedPlan : selectedPlan?.id ?? null,
        }));
      } catch { /* non-critical */ }
    }, DRAFT_DELAY_MS);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [isEditMode, form, locationState, city, images.length, selectedPlan, STORAGE_DRAFT]);

  /* ─── Revoke object URLs on unmount ── */
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => {
    imagesRef.current.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
  }, []);

  /* ═══════════════════════════════════════════════════════════
     FORM UPDATERS
  ═══════════════════════════════════════════════════════════ */
  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const next = { ...prev.attributes, [key]: value };
      if (key === "brand")     next.model       = "";
      if (key === "condition") next.used_detail = "";
      return { ...prev, attributes: next };
    });
  }, []);

  const updateContact = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, contact: { ...prev.contact, [key]: value } }));
  }, []);

  const updateDelivery = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, delivery: { ...prev.delivery, [key]: value } }));
  }, []);

  const updateDeliveryDuration = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, duration: { ...prev.delivery.duration, [key]: value } },
    }));
  }, []);

  const toggleFeature = useCallback((feature) => {
    setForm((prev) => {
      const features = toArray(prev.attributes?.features);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: features.includes(feature)
            ? features.filter((f) => f !== feature)
            : [...features, feature],
        },
      };
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════
     EXISTING IMAGE HANDLERS  (edit mode)
  ═══════════════════════════════════════════════════════════ */
  const removeExistingImage = useCallback((imgId) => {
    setExistingImages((prev) => {
      const target = prev.find((x) => x.id === imgId);
      /* Track r2_key for server-side deletion */
      if (target?.r2_key) {
        setRemovedImageKeys((keys) => [...keys, target.r2_key]);
      }
      return prev.filter((x) => x.id !== imgId);
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════
     IMAGE HANDLING
  ═══════════════════════════════════════════════════════════ */
  const totalImageCount = images.length + existingImages.length;

  const handleImages = useCallback(async (files) => {
    if (!mountedRef.current) return;

    if (totalImageCount >= MAX_IMAGES) {
      showError("Maximum 6 images allowed");
      return;
    }

    const sizeFiltered = Array.from(files).filter((f) => f.size <= MAX_SIZE);
    if (!sizeFiltered.length) {
      showError("Images must be under 3 MB each");
      return;
    }

    const verified = await Promise.all(
      sizeFiltered.map(async (f) => ({ file: f, valid: await verifyImageMagicBytes(f) }))
    );
    const validFiles = verified.filter((v) => v.valid).map((v) => v.file);
    if (!validFiles.length) {
      showError("Only real JPEG, PNG, or WebP images allowed (max 3 MB)");
      return;
    }

    const budget = getNetworkBudget();
    if (mountedRef.current) { setCompressingTotal(validFiles.length); setCompressingCount(0); }

    const newImages = [];
    for (const file of validFiles) {
      if (!mountedRef.current) break;
      try {
        const compressed = await imageCompression(file, { ...budget, useWebWorker: true }).catch(() => file);
        const hash = await hashImageFile(compressed);
        if (sessionHashSet.current.has(hash)) {
          if (mountedRef.current) setCompressingCount((p) => p + 1);
          continue;
        }
        sessionHashSet.current.add(hash);
        newImages.push({
          id      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file    : compressed,
          preview : URL.createObjectURL(compressed),
          hash,
          isNew   : true,
        });
      } catch { /* skip malformed */ }
      if (mountedRef.current) setCompressingCount((p) => p + 1);
    }

    if (!mountedRef.current) return;

    setImages((prev) => {
      const remaining = MAX_IMAGES - totalImageCount;
      if (remaining <= 0) return prev;
      return [...prev, ...newImages.slice(0, remaining)];
    });

    setCompressingTotal(0);
    setCompressingCount(0);
    if (newImages.length > 0) showSuccess(`${newImages.length} image(s) added`);
  }, [showError, showSuccess, totalImageCount]);

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      if (target?.hash)    sessionHashSet.current.delete(target.hash);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const moveImage = useCallback((fromIndex, toIndex) => {
    setImages((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
      const next    = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════
     PAYMENT HELPERS (create mode only)
  ═══════════════════════════════════════════════════════════ */
  const resumePayment = useCallback(() => {
    if (!paymentData?.authUrl) return;
    safeOpenPayment(paymentData.authUrl, showError);
  }, [paymentData, showError]);

  const cancelPendingPayment = useCallback(async () => {
    if (!paymentData?.reference) {
      localStorage.removeItem(STORAGE_PAYMENT);
      if (mountedRef.current) setPaymentData(null);
      return;
    }
    try {
      const token = getToken();
      if (token) {
        await apiFetch(`${API_BASE}/payment/verify`, {
          method  : "POST",
          headers : { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body    : JSON.stringify({ reference: paymentData.reference }),
        });
      }
    } catch { /* non-critical */ }
    finally {
      localStorage.removeItem(STORAGE_PAYMENT);
      if (mountedRef.current) setPaymentData(null);
      showSuccess("Payment cancelled — listing saved as draft");
    }
  }, [paymentData, showSuccess]);

  const clearDraft = useCallback(() => {
    if (!mountedRef.current) return;
    setForm(freshForm());
    setImages([]);
    setLocationState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    setDetectedCoords(null);
    setAgreedToTerms(false);
    setNeedsVerification(false);
    setVerificationData(null);
    sessionHashSet.current.clear();
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    clearIdempotencyKey(IDEMPOTENCY_STORE);
    showSuccess("Draft cleared");
  }, [STORAGE_DRAFT, IDEMPOTENCY_STORE, showSuccess]);

  /* ═══════════════════════════════════════════════════════════
     GPS
  ═══════════════════════════════════════════════════════════ */
  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) { showError("Location detection not supported"); return; }
    if (mountedRef.current) setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "User-Agent": USER_AGENT } }
          );
          const data     = await res.json();
          const addr     = data.address ?? {};
          const rawState = addr.state   ?? addr.region  ?? "";
          const rawCity  = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.county ?? "";

          if (!mountedRef.current) return;

          if (rawState) {
            const matched = Object.keys(locationsByState).find(
              (s) => s.toLowerCase().includes(rawState.toLowerCase()) || rawState.toLowerCase().includes(s.toLowerCase())
            );
            if (matched) {
              setLocationState(matched);
              const matchedCity = (locationsByState[matched] ?? []).find(
                (c) => c.toLowerCase().includes(rawCity.toLowerCase()) || rawCity.toLowerCase().includes(c.toLowerCase())
              );
              if (matchedCity) setCity(matchedCity);
            }
          }
          setDetectedCoords({ latitude: roundGps(latitude), longitude: roundGps(longitude) });
          showSuccess("Location detected");
        } catch {
          if (!mountedRef.current) return;
          setDetectedCoords({ latitude: roundGps(latitude), longitude: roundGps(longitude) });
          showSuccess("GPS captured — fill state/city manually");
        } finally {
          if (mountedRef.current) setDetectingLocation(false);
        }
      },
      (err) => {
        if (!mountedRef.current) return;
        setDetectingLocation(false);
        const msgs = { 1: "Permission denied", 2: "Location unavailable", 3: "Request timed out" };
        showError(msgs[err.code] ?? "Location detection failed");
      },
      { timeout: GPS_TIMEOUT, maximumAge: GPS_MAX_AGE }
    );
  }, [showError, showSuccess]);

  /* ═══════════════════════════════════════════════════════════
     VALIDATION
  ═══════════════════════════════════════════════════════════ */
  const validateForm = useCallback(() => {
    const t = form.title?.trim() ?? "";
    if (!t)             return "Title required.";
    if (t.length > 120) return "Title must be at most 120 characters.";

    const d = form.description?.trim() ?? "";
    if (d.length < DESCRIPTION_MIN)
      return `Description must be at least ${DESCRIPTION_MIN} characters.`;
    if (d.length > 2000)
      return "Description must be at most 2000 characters.";

    if (!form.price || Number(form.price) <= 0) return "Enter a valid price.";
    if (Number(form.price) > 1_000_000_000) return "Price exceeds maximum.";
    if (!form.category_id) return "Category required.";
    if (!form.contact?.email?.includes("@")) return "Enter a valid email address.";
    if (!isValidPhone(form.contact?.phone)) return "Phone number must be 7–15 digits.";
    if (form.contact?.whatsapp && !isValidPhone(form.contact.whatsapp))
      return "WhatsApp number must be 7–15 digits.";

    /* Images — in edit mode, existing images count */
    const totalImgs = images.length + existingImages.length;
    if (!totalImgs) return "At least one image is required.";

    if (!locationState || !city) return "Select your state and city.";

    /* Terms — skip in edit mode (auto-agreed) */
    if (!isEditMode && !agreedToTerms) return "Please accept the Terms & Conditions.";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to   = Number(form.delivery.duration.to);
      if (!Number.isFinite(from) || from < 1) return "Enter valid delivery days.";
      if (!Number.isFinite(to)   || to   < 1) return "Enter valid delivery days.";
      if (to < from)                           return "Delivery end must be after start.";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter a valid delivery fee.";
    }

    return null;
  }, [form, images.length, existingImages.length, locationState, city, agreedToTerms, isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     EDIT SUBMIT  (PATCH to dashboard endpoint)
  ═══════════════════════════════════════════════════════════ */
  const handleEditSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (!navigator.onLine) {
      showError("You appear to be offline.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      isSubmittingRef.current = false;
      setLoading(false);
      return;
    }

    setProgressVisible(true);
    setProgressStep("uploading");
    setError("");

    try {
      const token = getTokenOrRedirect(navigate, `/minimart/add?edit=${editId}`);

      /* Build multipart form data for edit */
      const fd = new FormData();
      fd.append("title",          form.title.trim());
      fd.append("description",    form.description.trim());
      fd.append("price",          Number(form.price).toFixed(2));
      fd.append("category_id",    form.category_id);
      if (form.subcategory_id)    fd.append("subcategory_id", form.subcategory_id);
      fd.append("location_state", locationState ?? "");
      fd.append("location_city",  city ?? "");

      if (detectedCoords) {
        fd.append("latitude",  String(detectedCoords.latitude));
        fd.append("longitude", String(detectedCoords.longitude));
      }

      fd.append("attributes",  JSON.stringify({ ...attributes, features: toArray(attributes.features) }));
      fd.append("delivery",    JSON.stringify(form.delivery));
      fd.append("contact",     JSON.stringify(form.contact));
      fd.append("phone",       sanitizePhone(form.contact.phone    ?? ""));
      fd.append("whatsapp",    sanitizePhone(form.contact.whatsapp ?? ""));
      fd.append("whatsapp_link", form.contact.whatsapp_link ?? "");
      fd.append("seller_name", user?.store_name || user?.name || BRAND_NAME);

      /* Tell backend which images to keep (existing) */
      fd.append("keep_image_ids", JSON.stringify(existingImages.map((img) => img.id)));

      /* Tell backend which R2 keys to delete */
      if (removedImageKeys.length > 0) {
        fd.append("remove_image_keys", JSON.stringify(removedImageKeys));
      }

      /* Attach new image files */
      images.forEach((img) => fd.append("images", img.file));

      setProgressStep("uploading");

      const data = await multipartPatch(
        `${API_BASE}/seller-dashboard/products/${editId}`,
        fd,
        token
      );

      if (!mountedRef.current) return;

      setProgressStep("finalizing");
      await new Promise((r) => setTimeout(r, 400));
      if (!mountedRef.current) return;

      setProgressVisible(false);
      showSuccess("Listing updated! Redirecting…");

      setTimeout(() => {
        if (mountedRef.current) navigate("/dashboard");
      }, 1_500);

    } catch (err) {
      console.error("[AddProduct] edit submit:", err);
      if (mountedRef.current) setProgressVisible(false);
      showError(err.message ?? "Update failed — please try again");
    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    editId, form, attributes, images, existingImages, removedImageKeys,
    locationState, city, detectedCoords, validateForm,
    navigate, showError, showSuccess, user,
  ]);

  /* ═══════════════════════════════════════════════════════════
     CREATE SUBMIT (original flow)
  ═══════════════════════════════════════════════════════════ */
  const handlePostSuccess = useCallback((responseData) => {
    if (!mountedRef.current) return;
    clearIdempotencyKey(IDEMPOTENCY_STORE);

    const verificationNeeded = responseData?.needs_verification === true;
    const daysRemaining      = responseData?.days_remaining ?? 7;

    if (verificationNeeded) {
      setVerificationData({
        productId     : responseData.product?.id,
        activeUntil   : responseData.active_until,
        daysRemaining,
        message       : responseData.verification_message,
        limits        : responseData.limits,
      });
      setNeedsVerification(true);
      showSuccess(`Listing is live for ${daysRemaining} days. Redirecting…`);
      setTimeout(() => { if (mountedRef.current) navigate("/verification"); }, 2_000);
    } else {
      showSuccess("Product live! Redirecting…");
      setTimeout(() => { if (mountedRef.current) navigate("/"); }, 1_500);
    }
  }, [navigate, IDEMPOTENCY_STORE, showSuccess]);

  const buildFormData = useCallback((token, finalPlan, isFreePlan) => {
    const fd = new FormData();
    fd.append("title",           form.title.trim());
    fd.append("description",     form.description.trim());
    fd.append("price",           Number(form.price).toFixed(2));
    fd.append("category_id",     form.category_id);
    if (form.subcategory_id)     fd.append("subcategory_id", form.subcategory_id);
    fd.append("location_state",  locationState ?? "");
    fd.append("location_city",   city ?? "");
    fd.append("status",          isFreePlan ? "active" : "draft");
    fd.append("is_active",       isFreePlan ? "true"   : "false");
    if (detectedCoords) {
      fd.append("latitude",  String(detectedCoords.latitude));
      fd.append("longitude", String(detectedCoords.longitude));
    }
    fd.append("attributes",      JSON.stringify({ ...attributes, features: toArray(attributes.features) }));
    fd.append("delivery",        JSON.stringify(form.delivery));
    fd.append("contact",         JSON.stringify(form.contact));
    fd.append("phone",           sanitizePhone(form.contact.phone    ?? ""));
    fd.append("whatsapp",        sanitizePhone(form.contact.whatsapp ?? ""));
    fd.append("whatsapp_link",   form.contact.whatsapp_link ?? "");
    fd.append("idempotency_key", getOrCreateIdempotencyKey(IDEMPOTENCY_STORE));
    fd.append("seller_name",     user?.store_name || user?.name || BRAND_NAME);
    const imageHashes = images.map((img) => img.hash).filter(Boolean);
    if (imageHashes.length) fd.append("image_hashes", JSON.stringify(imageHashes));
    images.forEach((img) => fd.append("images", img.file));
    return fd;
  }, [form, attributes, images, locationState, city, detectedCoords, IDEMPOTENCY_STORE, user]);

  const runActivation = useCallback(async (productId, uploadData, token) => {
    const activateRes = await apiFetch(
      `${API_BASE}/addproduct/products/${productId}/activate`,
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ promotion_id: null }) }
    );
    if (!mountedRef.current) return null;
    return { ...uploadData, ...activateRes, product: activateRes.product ?? uploadData.product };
  }, []);

  const runPayment = useCallback(async (product, finalPlan, uploadData, token) => {
    const rawPrice     = Number(finalPlan.price);
    const discount     = Number(finalPlan.discount_percent ?? 0);
    const effectiveAmt = Number((rawPrice * (1 - discount / 100)).toFixed(2));
    const planId       = String(finalPlan.id);

    const payData = await apiFetch(`${API_BASE}/payment/initiate`, {
      method  : "POST",
      headers : { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body    : JSON.stringify({ email: form.contact.email, amount: effectiveAmt, plan_id: planId, product_id: product.id, idempotency_key: getOrCreateIdempotencyKey(IDEMPOTENCY_STORE) }),
    });

    if (!payData.authorization_url) throw new ApiError("Payment setup failed", 500);

    const session = {
      reference: payData.reference, authUrl: payData.authorization_url,
      planId, productId: product.id, email: form.contact.email, amount: effectiveAmt,
      createdAt: Date.now(), needsVerification: uploadData.needs_verification ?? false,
      activeUntil: uploadData.active_until ?? null, daysRemaining: uploadData.days_remaining ?? null,
    };
    localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(session));
    return { authUrl: payData.authorization_url, session };
  }, [form.contact.email, IDEMPOTENCY_STORE]);

  const handleCreateSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (!navigator.onLine) { showError("You appear to be offline."); return; }

    isSubmittingRef.current = true;
    if (mountedRef.current) setLoading(true);

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      isSubmittingRef.current = false;
      if (mountedRef.current) setLoading(false);
      return;
    }

    if (mountedRef.current) { setProgressVisible(true); setProgressStep("compressing"); setError(""); }

    let product = null;
    let paymentInitiated = false;

    try {
      const finalPlan = selectedPlan ?? promotionPlans.find((p) => Number(p.price) === 0) ?? null;
      if (!finalPlan) throw new ApiError(plansLoading ? "Plans are still loading" : "No promotion plan available.", 400);

      const isFreePlan = Number(finalPlan.price) === 0;
      const token = getTokenOrRedirect(navigate, "/minimart/add");

      await new Promise((r) => setTimeout(r, 400));
      if (!mountedRef.current) return;
      if (mountedRef.current) setProgressStep("uploading");

      const fd         = buildFormData(token, finalPlan, isFreePlan);
      const uploadData = await multipartPost(`${API_BASE}/addproduct/products`, fd, token);
      if (!mountedRef.current) return;
      if (!uploadData.product?.id) throw new ApiError("Product creation failed", 500);
      product = uploadData.product;

      fetchLimits();

      if (isFreePlan) {
        if (mountedRef.current) setProgressStep("activating");
        const merged = await runActivation(product.id, uploadData, token);
        if (!mountedRef.current) return;
        if (mountedRef.current) { setProgressStep("finalizing"); await new Promise((r) => setTimeout(r, 600)); if (!mountedRef.current) return; setProgressVisible(false); }
        handlePostSuccess(merged);
        clearDraft();
        return;
      }

      if (mountedRef.current) setProgressStep("payment");
      const { authUrl, session } = await runPayment(product, finalPlan, uploadData, token);
      if (!mountedRef.current) return;
      paymentInitiated = true;

      if (mountedRef.current) {
        setProgressStep("finalizing");
        await new Promise((r) => setTimeout(r, 400));
        if (!mountedRef.current) return;
        setProgressVisible(false);
        setPaymentData(session);
      }
      showSuccess("Redirecting to payment…");
      safeOpenPayment(authUrl, showError);

    } catch (err) {
      console.error("[AddProduct] create submit:", err);
      if (mountedRef.current) setProgressVisible(false);

      if (product?.id && !paymentInitiated) {
        const token = getToken();
        if (token) fetch(`${API_BASE}/addproduct/products/${product.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
      showError(err.message ?? "Submission failed — please try again");
      if (err.status === 403 || err.statusCode === 403) fetchLimits();
    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    validateForm, selectedPlan, promotionPlans, plansLoading,
    buildFormData, runActivation, runPayment,
    clearDraft, showError, showSuccess, handlePostSuccess, fetchLimits, navigate,
  ]);

  /* ── Route to correct submit ── */
  const handleSubmit = useCallback(() => {
    if (isEditMode) return handleEditSubmit();
    return handleCreateSubmit();
  }, [isEditMode, handleEditSubmit, handleCreateSubmit]);

  /* ═══════════════════════════════════════════════════════════
     TERMS CHECKBOX
  ═══════════════════════════════════════════════════════════ */
  const TermsCheckbox = useMemo(() => (
    <div className="ap-terms-row">
      <label
        className="ap-terms-label"
        onClick={(e) => {
          if (e.target.tagName === "A") return;
          e.preventDefault();
          setAgreedToTerms((v) => !v);
        }}
      >
        <span
          className={`ap-terms-box ${agreedToTerms ? "ap-terms-box--on" : ""}`}
          role="checkbox"
          aria-checked={agreedToTerms}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAgreedToTerms((v) => !v); }
          }}
        >
          {agreedToTerms && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </span>
        <input type="checkbox" checked={agreedToTerms} onChange={() => {}} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} aria-hidden="true" tabIndex={-1} />
        <span className="ap-terms-text">
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            Terms &amp; Conditions
          </Link>
        </span>
      </label>
    </div>
  ), [agreedToTerms]);

  /* ═══════════════════════════════════════════════════════════
     EDIT LOADING / ERROR STATES
  ═══════════════════════════════════════════════════════════ */
  if (isEditMode && editLoading) {
    return (
      <div className="ap-page">
        <div className="ap-edit-loading">
          <div className="ap-edit-loading-spinner" />
          <p>Loading listing…</p>
        </div>
      </div>
    );
  }

  if (isEditMode && editError) {
    return (
      <div className="ap-page">
        <div className="ap-edit-error">
          <span>⚠️</span>
          <h2>Could not load listing</h2>
          <p>{editError}</p>
          <button onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="ap-page">
      <ProgressOverlay
        visible={progressVisible}
        step={progressStep}
        isPaid={isSelectedPlanPaid}
      />

      {compressingTotal > 0 && (
        <div className="compression-progress" role="status" aria-live="polite">
          <span className="btn-spin-svg" aria-hidden="true" />
          Compressing image {compressingCount + 1} of {compressingTotal}…
        </div>
      )}

      <ProductComponents
        /* ─ data ─ */
        form={form}
        attributes={attributes}
        images={images}
        state={locationState}
        city={city}
        categories={categories}
        selectedPlan={selectedPlan}
        paymentData={paymentData}
        loading={loading}
        error={error}
        success={success}
        states={states}
        cities={cities}
        options={options}
        selectedCategory={selectedCategory}
        detectedCoords={detectedCoords}
        detectingLocation={detectingLocation}
        agreedToTerms={agreedToTerms}
        TermsCheckbox={TermsCheckbox}
        INITIAL_FORM={INITIAL_FORM}
        promotionPlans={promotionPlans}
        plansLoading={plansLoading}
        MAX_IMAGES={MAX_IMAGES}

        /* ─ edit mode ─ */
        isEditMode={isEditMode}
        editId={editId}
        existingImages={existingImages}
        removeExistingImage={removeExistingImage}

        /* ─ seller limits ─ */
        sellerLimits={sellerLimits}
        limitsLoading={limitsLoading}
        isVerifiedSeller={isVerifiedSeller}
        canPost={canPost}
        dailyRemaining={dailyRemaining}
        activeRemaining={activeRemaining}
        cooldownSecs={cooldownSecs}
        trialExhausted={trialExhausted}
        trialRemaining={trialRemaining}

        /* ─ post-creation ─ */
        needsVerification={needsVerification}
        verificationData={verificationData}

        /* ─ handlers ─ */
        updateForm={updateForm}
        updateAttribute={updateAttribute}
        updateContact={updateContact}
        updateDelivery={updateDelivery}
        updateDeliveryDuration={updateDeliveryDuration}
        toggleFeature={toggleFeature}
        setState={setLocationState}
        setCity={setCity}
        setSelectedPlan={setSelectedPlan}
        handleImages={handleImages}
        removeImage={removeImage}
        moveImage={moveImage}
        handleSubmit={handleSubmit}
        clearDraft={isEditMode ? null : clearDraft}
        detectLocation={detectLocation}
        resumePayment={isEditMode ? null : resumePayment}
        cancelPendingPayment={isEditMode ? null : cancelPendingPayment}

        /* ─ formatters ─ */
        displayPrice={displayPrice}
        formatLabel={formatLabel}
        onlyNumbers={onlyNumbers}
        onlyDigits={onlyDigits}

        /* ─ API base ─ */
        apiBase={API_BASE}
      />
    </div>
  );
}