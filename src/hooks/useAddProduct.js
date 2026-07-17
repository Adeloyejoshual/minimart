/**
 * src/hooks/useAddProduct.js
 * All logic for AddProduct — state, effects, handlers, submit.
 * Returns everything the shells (mobile/desktop) need to render.
 */

import {
  useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { locationsByState }       from "../config/locationsByState.js";
import { apiFetch, ApiError }     from "../utils/apiFetch.js";
import { detectUserLocation }     from "../utils/location.js";
import { useFormState, INITIAL_FORM } from "./useFormState.js";
import { useImageManager }        from "./useImageManager.js";
import { useSellerLimits }        from "./useSellerLimits.js";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API_BASE          = `${import.meta.env.VITE_API_BASE_URL}/api`;
const STORAGE_PAYMENT   = "payment_retry";
const DRAFT_VERSION     = 3;
const MAX_IMAGES        = 6;
const UPLOAD_TIMEOUT    = 120_000;
const PAYMENT_MAX_AGE   = 30 * 60 * 1_000;
const DRAFT_DELAY_MS    = 1_200;
const BRAND_NAME        = "Loemart";
const DESCRIPTION_MIN   = 10;
const REDIRECT_DELAY_MS = 1_500;
const VERIFY_DELAY_MS   = 2_000;
const STEP_DELAY_MS     = 400;

const ALLOWED_PAYMENT_HOSTS = new Set([
  "checkout.paystack.com",
  "standard.paystack.com",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

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
export const onlyNumbers   = (v = "") => v.replace(/[^0-9.]/g, "");
export const onlyDigits    = (v = "") => v.replace(/[^0-9]/g,  "");
const toArray              = (v)      => (Array.isArray(v) ? v : []);
const sanitizePhone        = (v = "") => v.replace(/[\s\-().]/g, "");
const isValidPhone         = (v)      => !!v && PHONE_RE.test(sanitizePhone(String(v)));

export const displayPrice = (v) => {
  const n = Number(v);
  return Number.isNaN(n) || n <= 0
    ? ""
    : new Intl.NumberFormat("en-NG").format(n);
};

export const formatLabel = (t) =>
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
    return null;
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

const getOrCreateIdempotencyKey = (storageKey) => {
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  return id;
};

const clearIdempotencyKey = (storageKey) =>
  sessionStorage.removeItem(storageKey);

const multipartRequest = async (
  url, method = "POST", formData, token, timeoutMs = UPLOAD_TIMEOUT
) => {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers : { Authorization: `Bearer ${token}` },
      body    : formData,
      signal  : ctrl.signal,
    });
  } catch (err) {
    if (err.name === "AbortError")
      throw new ApiError("Upload timed out — check your connection", 0);
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
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
    } catch {
      if (import.meta.env.DEV) console.warn("[scrollToError] failed");
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   MAIN HOOK
═══════════════════════════════════════════════════════════════ */
export function useAddProduct({ user }) {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const editId     = searchParams.get("edit") || null;
  const isEditMode = !!editId;

  const STORAGE_DRAFT     = useMemo(
    () => `product_draft_v3_${user?.id ?? "anon"}`,
    [user?.id]
  );
  const IDEMPOTENCY_STORE = useMemo(
    () => `idempotency_${user?.id ?? "anon"}`,
    [user?.id]
  );

  /* ═══════════════════════════════════════════════════════════
     REFS
  ═══════════════════════════════════════════════════════════ */
  const mountedRef      = useRef(true);
  const isSubmittingRef = useRef(false);
  const autoSaveTimer   = useRef(null);
  const timeoutIdsRef   = useRef(new Set());
  const showErrorRef    = useRef(() => {});
  const showSuccessRef  = useRef(() => {});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timeoutIdsRef.current.forEach(clearTimeout);
    };
  }, []);

  /* ═══════════════════════════════════════════════════════════
     CUSTOM HOOKS
  ═══════════════════════════════════════════════════════════ */
  const {
    form, updateForm, updateAttribute, updateContact,
    updateDelivery, updateDeliveryDuration, toggleFeature,
    resetForm, loadForm,
  } = useFormState();

  const {
    images, existingImages, removedImageKeys, totalImageCount,
    compressingCount, compressingTotal,
    loadExistingImages, handleImages, removeImage,
    removeExistingImage, moveImage, moveAllImages, resetImages,
  } = useImageManager({
    showError  : (msg) => showErrorRef.current(msg),
    showSuccess: (msg) => showSuccessRef.current(msg),
  });

  const {
    sellerLimits, limitsLoading, fetchLimits,
    isVerifiedSeller, trialExhausted, trialRemaining,
    dailyRemaining, activeRemaining, cooldownSecs, canPost,
  } = useSellerLimits(API_BASE, isEditMode);

  /* ═══════════════════════════════════════════════════════════
     LOCAL STATE
  ═══════════════════════════════════════════════════════════ */
  const [categories,        setCategories]        = useState([]);
  const [categoriesLoaded,  setCategoriesLoaded]  = useState(false);
  const [promotionPlans,    setPromotionPlans]    = useState([]);
  const [plansLoading,      setPlansLoading]      = useState(!isEditMode);
  const [locationState,     setLocationState]     = useState("");
  const [city,              setCity]              = useState("");
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
  const [editLoading,       setEditLoading]       = useState(isEditMode);
  const [editError,         setEditError]         = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData,  setVerificationData]  = useState(null);

  /* ═══════════════════════════════════════════════════════════
     FEEDBACK
  ═══════════════════════════════════════════════════════════ */
  const showError = useCallback((msg) => {
    if (!mountedRef.current) return;
    setError(msg);
    scrollToError(msg);
    const id = setTimeout(() => {
      if (mountedRef.current) setError("");
      timeoutIdsRef.current.delete(id);
    }, 7_000);
    timeoutIdsRef.current.add(id);
  }, []);

  const showSuccess = useCallback((msg) => {
    if (!mountedRef.current) return;
    setSuccess(msg);
    const id = setTimeout(() => {
      if (mountedRef.current) setSuccess("");
      timeoutIdsRef.current.delete(id);
    }, 5_000);
    timeoutIdsRef.current.add(id);
  }, []);

  useEffect(() => {
    showErrorRef.current   = showError;
    showSuccessRef.current = showSuccess;
  }, [showError, showSuccess]);

  const safeRedirect = useCallback((path, delayMs = REDIRECT_DELAY_MS) => {
    const id = setTimeout(() => {
      if (mountedRef.current) navigate(path);
      timeoutIdsRef.current.delete(id);
    }, delayMs);
    timeoutIdsRef.current.add(id);
  }, [navigate]);

  /* ═══════════════════════════════════════════════════════════
     DERIVED
  ═══════════════════════════════════════════════════════════ */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)) ?? null,
    [categories, form.category_id]
  );
  const options    = useMemo(() => selectedCategory?.dynamicOptions ?? {}, [selectedCategory]);
  const attributes = useMemo(
    () => form.attributes ?? INITIAL_FORM.attributes,
    [form.attributes]
  );
  const states = useMemo(() => Object.keys(locationsByState ?? {}), []);
  const cities = useMemo(
    () => locationState ? (locationsByState[locationState] ?? []) : [],
    [locationState]
  );

  const isSelectedPlanPaid = !!selectedPlan && Number(selectedPlan?.price ?? 0) > 0;

  /* ═══════════════════════════════════════════════════════════
     LOAD CATEGORIES
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    apiFetch(`${API_BASE}/addproduct/categories`)
      .then((data) => {
        if (!mountedRef.current) return;
        setCategories(Array.isArray(data) ? data : []);
        setCategoriesLoaded(true);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setCategories([]);
        setCategoriesLoaded(true);
        showError(err.message ?? "Failed to load categories");
      });
  }, [showError]);

  /* ═══════════════════════════════════════════════════════════
     LOAD PLANS
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isEditMode) { setPlansLoading(false); return; }
    setPlansLoading(true);
    apiFetch(`${API_BASE}/payment/plans`)
      .then((data) => {
        if (!mountedRef.current) return;
        setPromotionPlans(
          data.success && Array.isArray(data.plans) ? data.plans : []
        );
      })
      .catch(() => { if (mountedRef.current) setPromotionPlans([]); })
      .finally(() => { if (mountedRef.current) setPlansLoading(false); });
  }, [isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     LOAD PRODUCT FOR EDIT
  ═══════════════════════════════════════════════════════════ */
  const loadProductForEdit = useCallback(async () => {
    if (!editId) return;
    const token = getTokenOrRedirect(navigate, "/auth?redirect=/dashboard");
    if (!token) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(
        `${API_BASE}/seller-dashboard/products/${editId}`,
        {
          headers: {
            Authorization  : `Bearer ${token}`,
            "Content-Type" : "application/json",
          },
        }
      );
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.message || "Product not found");

      const p = d.product;
      if (!mountedRef.current) return;

      loadForm({ ...p, email: p.contact?.email || user?.email || "" });

      if (p.location_state) setLocationState(p.location_state);
      if (p.location_city)  setCity(p.location_city);

      if (p.latitude && p.longitude) {
        setDetectedCoords({ latitude: p.latitude, longitude: p.longitude });
      }

      if (p.product_images?.length > 0) {
        loadExistingImages(
          p.product_images.map((img) => ({
            id        : img.id,
            url       : img.image_url,
            r2_key    : img.r2_key    || null,
            position  : img.position_order ?? 0,
            is_primary: img.is_primary ?? false,
            isExisting: true,
          }))
        );
      } else if (Array.isArray(p.images) && p.images.length > 0) {
        loadExistingImages(
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
        loadExistingImages([{
          id        : "existing-main",
          url       : p.main_image || p.thumbnail_url,
          r2_key    : null,
          position  : 0,
          is_primary: true,
          isExisting: true,
        }]);
      }

      setAgreedToTerms(true);

    } catch (err) {
      console.error("[useAddProduct] edit load:", err);
      if (mountedRef.current) setEditError(err.message || "Failed to load product");
    } finally {
      if (mountedRef.current) setEditLoading(false);
    }
  }, [editId, navigate, user?.email, loadForm, loadExistingImages]);

  useEffect(() => {
    if (isEditMode && categoriesLoaded) loadProductForEdit();
  }, [isEditMode, categoriesLoaded, loadProductForEdit]);

  /* ═══════════════════════════════════════════════════════════
     RESUME STALE PAYMENT
  ═══════════════════════════════════════════════════════════ */
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
          localStorage.removeItem(STORAGE_PAYMENT); return;
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
                headers : {
                  "Content-Type" : "application/json",
                  Authorization  : `Bearer ${token}`,
                },
                body: JSON.stringify({ reference: session.reference }),
              });
              if (!mountedRef.current) return;
              if (result.status === "success") {
                showSuccess(
                  result.needs_verification
                    ? "Payment confirmed. Redirecting to verification…"
                    : "Your previous payment was confirmed — product is live!"
                );
                if (result.needs_verification) {
                  safeRedirect("/verification", VERIFY_DELAY_MS);
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
  }, [isEditMode, showSuccess, safeRedirect]);

  /* ═══════════════════════════════════════════════════════════
     RESTORE DRAFT
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isEditMode) return;
    if (!categoriesLoaded || plansLoading) return;
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft.version || draft.version < DRAFT_VERSION) {
        localStorage.removeItem(STORAGE_DRAFT); return;
      }
      if (!mountedRef.current) return;

      loadForm(draft.form ?? {});
      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");

      if (draft.selectedPlan) {
        const matched = promotionPlans.find(
          (p) => String(p.id) === String(draft.selectedPlan)
        );
        setSelectedPlan(matched ?? null);
      }
    } catch (err) {
      console.warn("[useAddProduct] draft restore:", err.message);
    }
  }, [isEditMode, categoriesLoaded, plansLoading, STORAGE_DRAFT, loadForm, promotionPlans]);

  /* ═══════════════════════════════════════════════════════════
     AUTO-SAVE DRAFT
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isEditMode) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        localStorage.setItem(STORAGE_DRAFT, JSON.stringify({
          version     : DRAFT_VERSION,
          form,
          locationState,
          city,
          selectedPlan: selectedPlan?.id ?? null,
        }));
      } catch { /* non-critical */ }
    }, DRAFT_DELAY_MS);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [isEditMode, form, locationState, city, selectedPlan, STORAGE_DRAFT]);

  /* ═══════════════════════════════════════════════════════════
     GPS
  ═══════════════════════════════════════════════════════════ */
  const detectLocation = useCallback(async () => {
    if (mountedRef.current) setDetectingLocation(true);
    try {
      const result = await detectUserLocation();
      if (!mountedRef.current) return;
      if (result.state) setLocationState(result.state);
      if (result.city)  setCity(result.city);
      setDetectedCoords({ latitude: result.latitude, longitude: result.longitude });
      showSuccess(
        result.state ? "Location detected" : "GPS captured — fill state/city manually"
      );
    } catch (err) {
      if (!mountedRef.current) return;
      showError(err.message || "Location detection failed");
    } finally {
      if (mountedRef.current) setDetectingLocation(false);
    }
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
    if (d.length > 2000) return "Description must be at most 2000 characters.";

    if (!form.price || Number(form.price) <= 0) return "Enter a valid price.";
    if (Number(form.price) > 1_000_000_000)     return "Price exceeds maximum.";
    if (!form.category_id)                       return "Category required.";

    if (!EMAIL_RE.test(form.contact?.email ?? ""))
      return "Enter a valid email address.";

    if (!isValidPhone(form.contact?.phone))
      return "Phone number must be 7–15 digits (e.g. 08012345678).";

    if (form.contact?.whatsapp && !isValidPhone(form.contact.whatsapp))
      return "WhatsApp number must be 7–15 digits.";

    if (totalImageCount === 0) return "At least one image is required.";

    if (!locationState || !city) return "Select your state and city.";

    if (!isEditMode && !agreedToTerms) return "Please accept the Terms & Conditions.";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to   = Number(form.delivery.duration.to);
      if (!Number.isFinite(from) || from < 1) return "Enter valid delivery start days.";
      if (!Number.isFinite(to)   || to   < 1) return "Enter valid delivery end days.";
      if (to < from)                           return "Delivery end must be after start.";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter a valid delivery fee.";
    }

    return null;
  }, [form, totalImageCount, locationState, city, agreedToTerms, isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     BUILD FORM DATA
  ═══════════════════════════════════════════════════════════ */
  const buildBaseFormData = useCallback(() => {
    const fd = new FormData();
    fd.append("title",          form.title.trim());
    fd.append("description",    form.description.trim());
    fd.append("price",          Number(form.price).toFixed(2));
    fd.append("category_id",    form.category_id);
    if (form.subcategory_id)    fd.append("subcategory_id", form.subcategory_id);
    fd.append("location_state", locationState ?? "");
    fd.append("location_city",  city ?? "");
    fd.append("phone",          sanitizePhone(form.contact.phone    ?? ""));
    fd.append("whatsapp",       sanitizePhone(form.contact.whatsapp ?? ""));
    fd.append("whatsapp_link",  form.contact.whatsapp_link ?? "");
    fd.append("seller_name",    user?.store_name || user?.name || BRAND_NAME);
    fd.append("attributes",     JSON.stringify({
      ...attributes,
      features: toArray(attributes.features),
    }));
    fd.append("delivery",       JSON.stringify(form.delivery));
    fd.append("contact",        JSON.stringify(form.contact));
    if (detectedCoords) {
      fd.append("latitude",  String(detectedCoords.latitude));
      fd.append("longitude", String(detectedCoords.longitude));
    }
    return fd;
  }, [form, attributes, locationState, city, detectedCoords, user]);

  const buildCreateFormData = useCallback((isFreePlan) => {
    const fd = buildBaseFormData();
    fd.append("status",          isFreePlan ? "active" : "draft");
    fd.append("is_active",       isFreePlan ? "true"   : "false");
    fd.append("idempotency_key", getOrCreateIdempotencyKey(IDEMPOTENCY_STORE));
    const imageHashes = images.map((img) => img.hash).filter(Boolean);
    if (imageHashes.length) fd.append("image_hashes", JSON.stringify(imageHashes));
    images.forEach((img) => fd.append("images", img.file));
    return fd;
  }, [buildBaseFormData, images, IDEMPOTENCY_STORE]);

  const buildEditFormData = useCallback(() => {
    const fd = buildBaseFormData();
    fd.append("keep_image_ids",   JSON.stringify(existingImages.map((img) => img.id)));
    if (removedImageKeys.length)
      fd.append("remove_image_keys", JSON.stringify(removedImageKeys));
    images.forEach((img) => fd.append("images", img.file));
    return fd;
  }, [buildBaseFormData, existingImages, removedImageKeys, images]);

  /* ═══════════════════════════════════════════════════════════
     PAYMENT ACTIONS
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
          headers : {
            "Content-Type" : "application/json",
            Authorization  : `Bearer ${token}`,
          },
          body: JSON.stringify({ reference: paymentData.reference }),
        });
      }
    } catch { /* non-critical */ }
    finally {
      localStorage.removeItem(STORAGE_PAYMENT);
      if (mountedRef.current) setPaymentData(null);
      showSuccess("Payment cancelled — listing saved as draft");
    }
  }, [paymentData, showSuccess]);

  /* ═══════════════════════════════════════════════════════════
     CLEAR DRAFT
  ═══════════════════════════════════════════════════════════ */
  const clearDraft = useCallback(() => {
    if (!mountedRef.current) return;
    resetForm();
    resetImages();
    setLocationState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    setDetectedCoords(null);
    setAgreedToTerms(false);
    setNeedsVerification(false);
    setVerificationData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    clearIdempotencyKey(IDEMPOTENCY_STORE);
    showSuccess("Draft cleared");
  }, [STORAGE_DRAFT, IDEMPOTENCY_STORE, resetForm, resetImages, showSuccess]);

  /* ═══════════════════════════════════════════════════════════
     EDIT SUBMIT
  ═══════════════════════════════════════════════════════════ */
  const handleEditSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (!navigator.onLine) { showError("You appear to be offline."); return; }

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
      if (!token) return;

      const fd = buildEditFormData();
      await multipartRequest(
        `${API_BASE}/seller-dashboard/products/${editId}`,
        "PATCH",
        fd,
        token
      );

      if (!mountedRef.current) return;
      setProgressStep("finalizing");
      await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
      if (!mountedRef.current) return;

      setProgressVisible(false);
      showSuccess("Listing updated! Redirecting…");
      safeRedirect("/dashboard");

    } catch (err) {
      if (mountedRef.current) setProgressVisible(false);
      showError(err.message ?? "Update failed — please try again");
    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [editId, validateForm, buildEditFormData, navigate, showError, showSuccess, safeRedirect]);

  /* ═══════════════════════════════════════════════════════════
     CREATE SUBMIT
  ═══════════════════════════════════════════════════════════ */
  const handlePostSuccess = useCallback((responseData) => {
    if (!mountedRef.current) return;
    clearIdempotencyKey(IDEMPOTENCY_STORE);

    const verificationNeeded = responseData?.needs_verification === true;
    const daysRemaining      = responseData?.days_remaining ?? 7;

    if (verificationNeeded) {
      setVerificationData({
        productId   : responseData.product?.id,
        activeUntil : responseData.active_until,
        daysRemaining,
        message     : responseData.verification_message,
        limits      : responseData.limits,
      });
      setNeedsVerification(true);
      showSuccess(`Listing live for ${daysRemaining} days. Redirecting…`);
      safeRedirect("/verification", VERIFY_DELAY_MS);
    } else {
      showSuccess("Product live! Redirecting…");
      safeRedirect("/");
    }
  }, [IDEMPOTENCY_STORE, showSuccess, safeRedirect]);

  const handleCreateSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (!navigator.onLine) { showError("You appear to be offline."); return; }

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
    setProgressStep("compressing");
    setError("");

    let product          = null;
    let paymentInitiated = false;

    try {
      const finalPlan = selectedPlan ??
        promotionPlans.find((p) => Number(p.price) === 0) ?? null;

      if (!finalPlan)
        throw new ApiError(
          plansLoading ? "Plans are still loading" : "No plan available.",
          400
        );

      const isFreePlan = Number(finalPlan.price) === 0;
      const token      = getTokenOrRedirect(navigate, "/minimart/add");
      if (!token) return;

      await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
      if (!mountedRef.current) return;

      setProgressStep("uploading");
      const fd         = buildCreateFormData(isFreePlan);
      const uploadData = await multipartRequest(
        `${API_BASE}/addproduct/products`, "POST", fd, token
      );
      if (!mountedRef.current) return;
      if (!uploadData.product?.id) throw new ApiError("Product creation failed", 500);
      product = uploadData.product;

      fetchLimits();

      if (isFreePlan) {
        setProgressStep("activating");
        const activateRes = await apiFetch(
          `${API_BASE}/addproduct/products/${product.id}/activate`,
          {
            method  : "POST",
            headers : {
              "Content-Type" : "application/json",
              Authorization  : `Bearer ${token}`,
            },
            body: JSON.stringify({ promotion_id: null }),
          }
        );
        if (!mountedRef.current) return;
        setProgressStep("finalizing");
        await new Promise((r) => setTimeout(r, 600));
        if (!mountedRef.current) return;
        setProgressVisible(false);
        handlePostSuccess({
          ...uploadData,
          ...activateRes,
          product: activateRes.product ?? uploadData.product,
        });
        clearDraft();
        return;
      }

      /* ── Paid plan ── */
      setProgressStep("payment");
      const rawPrice     = Number(finalPlan.price);
      const discount     = Number(finalPlan.discount_percent ?? 0);
      const effectiveAmt = Number((rawPrice * (1 - discount / 100)).toFixed(2));

      const payData = await apiFetch(`${API_BASE}/payment/initiate`, {
        method  : "POST",
        headers : {
          "Content-Type" : "application/json",
          Authorization  : `Bearer ${token}`,
        },
        body: JSON.stringify({
          email           : form.contact.email,
          amount          : effectiveAmt,
          plan_id         : String(finalPlan.id),
          product_id      : product.id,
          idempotency_key : getOrCreateIdempotencyKey(IDEMPOTENCY_STORE),
        }),
      });

      if (!payData.authorization_url)
        throw new ApiError("Payment setup failed", 500);

      paymentInitiated = true;

      const session = {
        reference         : payData.reference,
        authUrl           : payData.authorization_url,
        planId            : String(finalPlan.id),
        productId         : product.id,
        email             : form.contact.email,
        amount            : effectiveAmt,
        createdAt         : Date.now(),
        needsVerification : uploadData.needs_verification ?? false,
        activeUntil       : uploadData.active_until       ?? null,
        daysRemaining     : uploadData.days_remaining      ?? null,
      };
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(session));

      setProgressStep("finalizing");
      await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
      if (!mountedRef.current) return;

      setProgressVisible(false);
      setPaymentData(session);
      showSuccess("Redirecting to payment…");
      safeOpenPayment(payData.authorization_url, showError);

    } catch (err) {
      console.error("[useAddProduct] create submit:", err);
      if (mountedRef.current) setProgressVisible(false);

      if (product?.id && !paymentInitiated) {
        const token = getToken();
        if (token) {
          fetch(
            `${API_BASE}/addproduct/products/${product.id}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
          ).catch((e) => console.error("[useAddProduct] cleanup failed:", e));
        }
      }

      showError(err.message ?? "Submission failed — please try again");
      if (err.status === 403) fetchLimits();

    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    validateForm, selectedPlan, promotionPlans, plansLoading,
    buildCreateFormData, clearDraft, showError, showSuccess,
    handlePostSuccess, fetchLimits, navigate,
    form.contact.email, IDEMPOTENCY_STORE,
  ]);

  const handleSubmit = useCallback(
    () => isEditMode ? handleEditSubmit() : handleCreateSubmit(),
    [isEditMode, handleEditSubmit, handleCreateSubmit]
  );

  /* ═══════════════════════════════════════════════════════════
     RETURN — everything shells need
  ═══════════════════════════════════════════════════════════ */
  return {
    /* config */
    MAX_IMAGES,
    API_BASE,
    apiBase: API_BASE,

    /* mode */
    editId,
    isEditMode,

    /* user */
    user,

    /* form state */
    form,
    attributes,
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    resetForm,
    loadForm,

    /* categories */
    categories,
    categoriesLoaded,
    selectedCategory,
    options,

    /* plans */
    promotionPlans,
    plansLoading,
    selectedPlan,
    setSelectedPlan,
    isSelectedPlanPaid,

    /* location */
    state             : locationState,
    setState          : setLocationState,
    city,
    setCity,
    states,
    cities,
    detectLocation,
    detectingLocation,
    detectedCoords,

    /* images */
    images,
    existingImages,
    removedImageKeys,
    totalImageCount,
    compressingCount,
    compressingTotal,
    loadExistingImages,
    handleImages,
    removeImage,
    removeExistingImage,
    moveImage,
    moveAllImages,
    resetImages,

    /* seller limits */
    sellerLimits,
    limitsLoading,
    fetchLimits,
    isVerifiedSeller,
    trialExhausted,
    trialRemaining,
    dailyRemaining,
    activeRemaining,
    cooldownSecs,
    canPost,

    /* feedback */
    error,
    success,
    showError,
    showSuccess,

    /* payment */
    paymentData,
    resumePayment,
    cancelPendingPayment,

    /* submit */
    loading,
    handleSubmit,
    progressVisible,
    progressStep,

    /* edit mode extras */
    editLoading,
    editError,

    /* post-creation */
    needsVerification,
    verificationData,

    /* terms */
    agreedToTerms,
    setAgreedToTerms,

    /* draft */
    clearDraft,

    /* navigation helpers */
    navigate,

    /* formatters (also exported as pure functions) */
    displayPrice,
    formatLabel,
    onlyNumbers,
    onlyDigits,
  };
}