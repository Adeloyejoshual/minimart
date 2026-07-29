/**
 * src/pages/AddProduct.jsx
 * Route: /minimart/add
 *       /minimart/add?edit=:productId  ← EDIT MODE
 *
 * v7 — INLINE FIELD ERRORS
 * ─────────────────────────────────────────────────────────────
 *  - Errors show under each field (not just top banner)
 *  - Auto-clear when user starts editing that field
 *  - Top banner only for non-field errors (network, server)
 *  - Same UX as desktop shell
 *
 * v6 — VERIFY BEFORE PAY
 * v5 — EMAIL FROM REGISTRATION
 * v4 — 3-TIER SUBSCRIPTION SUPPORT
 */

import {
  useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ProductComponents              from "./product/components.jsx";
import { TermsCheckbox }              from "./product/components/index.jsx";
import ProgressOverlay                from "../components/ProgressOverlay.jsx";
import WatermarkWarningBanner         from "../components/WatermarkWarningBanner.jsx";
import { locationsByState }           from "../config/locationsByState.js";
import { apiFetch, ApiError }         from "../utils/apiFetch.js";
import { detectUserLocation }         from "../utils/location.js";
import { useFormState, INITIAL_FORM } from "../hooks/useFormState.js";
import { useImageManager }            from "../hooks/useImageManager.js";
import { useSellerLimits }            from "../hooks/useSellerLimits.js";

import "../styles/AddProduct.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API_BASE          = `${import.meta.env.VITE_API_BASE_URL}/api`;
const STORAGE_PAYMENT   = "payment_retry";
const DRAFT_VERSION     = 4;
const MAX_IMAGES        = 6;
const UPLOAD_TIMEOUT    = 120_000;
const PAYMENT_MAX_AGE   = 30 * 60 * 1_000;
const DRAFT_DELAY_MS    = 1_200;
const BRAND_NAME        = "Loemart";
const DESCRIPTION_MIN   = 10;
const REDIRECT_DELAY_MS = 1_500;
const VERIFY_DELAY_MS   = 2_000;
const STEP_DELAY_MS     = 400;

const WM_WARN_EXTRA_DELAY_MS = 3_000;
const UPGRADE_EXTRA_DELAY_MS = 4_000;

const ALLOWED_PAYMENT_HOSTS = new Set([
  "checkout.paystack.com",
  "standard.paystack.com",
]);

const PHONE_RE = /^\+?[0-9]{7,15}$/;

const ERROR_SELECTOR_MAP = [
  { match: "Title",          sel: "#ap-title"               },
  { match: "Description",    sel: "#ap-desc"                },
  { match: "price",          sel: "#ap-price"               },
  { match: "Price",          sel: "#ap-price"               },
  { match: "Category",       sel: ".section:nth-of-type(2)" },
  { match: "Phone",          sel: "#ap-phone"               },
  { match: "WhatsApp",       sel: "#ap-wa"                  },
  { match: "image",          sel: ".ap-image-box"           },
  { match: "state and city", sel: ".detect-location-row"    },
  { match: "Terms",          sel: ".terms-wrapper"          },
  { match: "delivery days",  sel: "#ap-del-from"            },
  { match: "Delivery end",   sel: "#ap-del-to"              },
  { match: "delivery fee",   sel: "#ap-del-fee"             },
];

/* ═══════════════════════════════════════════════════════════════
   ✅ v7: ERROR → FIELD KEY MAPPING
   Sections read `fieldError.field` to show inline errors.
═══════════════════════════════════════════════════════════════ */
const ERROR_FIELD_MAP = [
  { match: "Title",          field: "title"          },
  { match: "Description",    field: "description"    },
  { match: "price",          field: "price"          },
  { match: "Price",          field: "price"          },
  { match: "Category",       field: "category"       },
  { match: "Phone",          field: "phone"          },
  { match: "WhatsApp",       field: "whatsapp"       },
  { match: "image",          field: "images"         },
  { match: "state and city", field: "location"       },
  { match: "Terms",          field: "terms"          },
  { match: "delivery days",  field: "delivery_from"  },
  { match: "Delivery end",   field: "delivery_to"    },
  { match: "delivery fee",   field: "delivery_fee"   },
];

const getFieldFromMessage = (msg) => {
  if (!msg) return null;
  const entry = ERROR_FIELD_MAP.find((e) => msg.includes(e.match));
  return entry?.field ?? null;
};

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const onlyNumbers   = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits    = (v = "") => v.replace(/[^0-9]/g, "");
const toArray       = (v)      => (Array.isArray(v) ? v : []);
const sanitizePhone = (v = "") => v.replace(/[\s\-().]/g, "");
const isValidPhone  = (v)      => !!v && PHONE_RE.test(sanitizePhone(String(v)));

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

/* ═══════════════════════════════════════════════════════════════
   AUTH HELPER
═══════════════════════════════════════════════════════════════ */
const getTokenOrRedirect = (navigate, returnPath) => {
  const token = getToken();
  if (!token) {
    navigate(
      `/login?redirect=${encodeURIComponent(
        returnPath ?? window.location.pathname
      )}`
    );
    return null;
  }
  return token;
};

/* ═══════════════════════════════════════════════════════════════
   PAYMENT HELPERS
═══════════════════════════════════════════════════════════════ */
const safeOpenPayment = (url, onError) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Non-HTTPS URL");
    const hostAllowed = [...ALLOWED_PAYMENT_HOSTS].some(
      (host) =>
        parsed.hostname === host ||
        parsed.hostname.endsWith(`.${host}`)
    );
    if (!hostAllowed)
      throw new Error(`Untrusted host: ${parsed.hostname}`);
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

/* ═══════════════════════════════════════════════════════════════
   IDEMPOTENCY HELPERS
═══════════════════════════════════════════════════════════════ */
const getOrCreateIdempotencyKey = (storageKey) => {
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  return id;
};

const clearIdempotencyKey = (storageKey) =>
  sessionStorage.removeItem(storageKey);

/* ═══════════════════════════════════════════════════════════════
   NETWORK HELPER
═══════════════════════════════════════════════════════════════ */
const multipartRequest = async (
  url,
  method = "POST",
  formData,
  token,
  timeoutMs = UPLOAD_TIMEOUT
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
    throw new ApiError(
      "Cannot reach the server. Check your connection.", 0
    );
  } finally {
    clearTimeout(tid);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok)
    throw new ApiError(
      data?.message ?? `Request failed (${res.status})`,
      res.status,
      data
    );

  return data;
};

/* ═══════════════════════════════════════════════════════════════
   SCROLL TO ERROR
═══════════════════════════════════════════════════════════════ */
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
   VERIFY BEFORE PAY MODAL
═══════════════════════════════════════════════════════════════ */
function VerifyBeforePayModal({ onVerify, onCancel, onFreePlan }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="ap-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vbp-title"
      onClick={handleOverlayClick}
    >
      <div className="ap-modal">
        <div className="ap-modal-icon" aria-hidden="true">🔒</div>
        <h2 id="vbp-title" className="ap-modal-title">
          Verify Your Identity First
        </h2>
        <p className="ap-modal-message">
          You need to verify your identity before purchasing
          a promotion plan. Verification is free and only
          takes a few minutes.
        </p>
        <ul className="ap-modal-list">
          <li>✅ Post up to 500 listings</li>
          <li>✅ Listings active for 30 days</li>
          <li>✅ Access all paid promotion plans</li>
          <li>✅ Build buyer trust with a verified badge</li>
        </ul>
        <div className="ap-modal-actions">
          <button type="button" className="primary-btn" onClick={onVerify}>
            Verify My Account
          </button>
          <button type="button" className="outline-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p className="ap-modal-hint">
          Want to post now?{" "}
          <button type="button" className="link-btn" onClick={onFreePlan}>
            Use the free plan instead
          </button>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AddProduct({ user }) {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const editId     = searchParams.get("edit") || null;
  const isEditMode = !!editId;

  const STORAGE_DRAFT = useMemo(
    () => `product_draft_v4_${user?.id ?? "anon"}`,
    [user?.id]
  );
  const IDEMPOTENCY_STORE = useMemo(
    () => `idempotency_${user?.id ?? "anon"}`,
    [user?.id]
  );

  /* ─── Refs ─── */
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

  /* ─── Custom hooks ─── */
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

  /* ─── Seller limits ─── */
  const {
    sellerLimits, limitsLoading, fetchLimits,
    isVerifiedSeller, trialExhausted, trialRemaining,
    dailyRemaining, activeRemaining, cooldownSecs, canPost,
  } = useSellerLimits(API_BASE, isEditMode);

  const tier              = sellerLimits?.tier               ?? "unverified";
  const isSubscriber      = sellerLimits?.is_subscriber      ?? false;
  const lifetimeExhausted = sellerLimits?.lifetime_exhausted ?? false;
  const lifetimeRemaining = sellerLimits?.lifetime_remaining ?? null;
  const lifetimeUsed      = sellerLimits?.lifetime_used      ?? 0;
  const lifetimeMax       = sellerLimits?.lifetime_max       ?? null;
  const upgradeTo         = sellerLimits?.upgrade_to         ?? null;
  const upgradeUrl        = sellerLimits?.upgrade_url        ?? null;

  /* ─── Local state ─── */
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

  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [subscriptionData,  setSubscriptionData]  = useState(null);

  const [watermarkWarnings, setWatermarkWarnings] = useState([]);
  const [watermarkNotice,   setWatermarkNotice]   = useState("");

  const [showVerifyBeforePay, setShowVerifyBeforePay] = useState(false);

  /* ─── ✅ v7: Field-level error state ─── */
  const [fieldError, setFieldError] = useState({ field: null, message: "" });

  /* ─── Field error helpers ─── */
  const clearFieldError = useCallback((field) => {
    setFieldError((prev) =>
      prev.field === field || !field
        ? { field: null, message: "" }
        : prev
    );
  }, []);

  const clearAllFieldErrors = useCallback(() => {
    setFieldError({ field: null, message: "" });
  }, []);

  /* ─── Feedback (now also sets field error) ─── */
  const showError = useCallback((msg) => {
    if (!mountedRef.current) return;
    setError(msg);

    /* ✅ Also set field-level error if we can map it */
    const field = getFieldFromMessage(msg);
    if (field) {
      setFieldError({ field, message: msg });
    } else {
      setFieldError({ field: null, message: "" });
    }

    scrollToError(msg);
    const id = setTimeout(() => {
      if (mountedRef.current) {
        setError("");
        setFieldError({ field: null, message: "" });
      }
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

  const safeRedirect = useCallback(
    (path, delayMs = REDIRECT_DELAY_MS) => {
      const id = setTimeout(() => {
        if (mountedRef.current) navigate(path);
        timeoutIdsRef.current.delete(id);
      }, delayMs);
      timeoutIdsRef.current.add(id);
    },
    [navigate]
  );

  const dismissWatermarkWarnings = useCallback(() => {
    setWatermarkWarnings([]);
    setWatermarkNotice("");
  }, []);

  /* ═══════════════════════════════════════════════════════════
     ✅ v7: WRAPPED UPDATERS — auto-clear field errors on edit
  ═══════════════════════════════════════════════════════════ */
  const updateFormWithClear = useCallback((key, value) => {
    updateForm(key, value);
    const map = {
      title       : "title",
      description : "description",
      price       : "price",
      category_id : "category",
    };
    const errKey = map[key];
    if (errKey) clearFieldError(errKey);
  }, [updateForm, clearFieldError]);

  const updateContactWithClear = useCallback((key, value) => {
    updateContact(key, value);
    if (key === "phone")    clearFieldError("phone");
    if (key === "whatsapp") clearFieldError("whatsapp");
  }, [updateContact, clearFieldError]);

  const setLocationStateWithClear = useCallback((val) => {
    setLocationState(val);
    if (val) clearFieldError("location");
  }, [clearFieldError]);

  const setCityWithClear = useCallback((val) => {
    setCity(val);
    if (val) clearFieldError("location");
  }, [clearFieldError]);

  const setAgreedToTermsWithClear = useCallback((val) => {
    setAgreedToTerms(val);
    if (typeof val !== "function" && val) clearFieldError("terms");
  }, [clearFieldError]);

  const updateDeliveryWithClear = useCallback((key, value) => {
    updateDelivery(key, value);
    if (key === "fee")       clearFieldError("delivery_fee");
    if (key === "available") clearAllFieldErrors();
  }, [updateDelivery, clearFieldError, clearAllFieldErrors]);

  const updateDeliveryDurationWithClear = useCallback((key, value) => {
    updateDeliveryDuration(key, value);
    if (key === "from") clearFieldError("delivery_from");
    if (key === "to")   clearFieldError("delivery_to");
  }, [updateDeliveryDuration, clearFieldError]);

  /* ─── Derived ─── */
  const selectedCategory = useMemo(
    () =>
      categories.find(
        (c) => String(c.id) === String(form.category_id)
      ) ?? null,
    [categories, form.category_id]
  );
  const options    = useMemo(
    () => selectedCategory?.dynamicOptions ?? {},
    [selectedCategory]
  );
  const attributes = useMemo(
    () => form.attributes ?? INITIAL_FORM.attributes,
    [form.attributes]
  );
  const states = useMemo(() => Object.keys(locationsByState ?? {}), []);
  const cities = useMemo(
    () => (locationState ? locationsByState[locationState] ?? [] : []),
    [locationState]
  );

  const isSelectedPlanPaid =
    !!selectedPlan && Number(selectedPlan?.price ?? 0) > 0;

  /* ═══════════════════════════════════════════════════════════
     AUTO-SET EMAIL
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (user?.email) {
      updateContact("email", user.email);
    }
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .catch(() => {
        if (mountedRef.current) setPromotionPlans([]);
      })
      .finally(() => {
        if (mountedRef.current) setPlansLoading(false);
      });
  }, [isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     LOAD PRODUCT FOR EDIT
  ═══════════════════════════════════════════════════════════ */
  const loadProductForEdit = useCallback(async () => {
    if (!editId) return;
    const token = getTokenOrRedirect(
      navigate, "/auth?redirect=/dashboard"
    );
    if (!token) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(
        `${API_BASE}/seller-dashboard/products/${editId}`,
        {
          headers: {
            Authorization : `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const d = await res.json();
      if (!res.ok || !d.success)
        throw new Error(d.message || "Product not found");

      const p = d.product;
      if (!mountedRef.current) return;

      loadForm({ ...p });

      if (p.location_state) setLocationState(p.location_state);
      if (p.location_city)  setCity(p.location_city);

      if (p.latitude && p.longitude) {
        setDetectedCoords({
          latitude : p.latitude,
          longitude: p.longitude,
        });
      }

      if (p.product_images?.length > 0) {
        loadExistingImages(
          p.product_images.map((img) => ({
            id        : img.id,
            url       : img.image_url,
            r2_key    : img.r2_key          || null,
            position  : img.position_order  ?? 0,
            is_primary: img.is_primary      ?? false,
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
      console.error("[AddProduct] edit load:", err);
      if (mountedRef.current)
        setEditError(err.message || "Failed to load product");
    } finally {
      if (mountedRef.current) setEditLoading(false);
    }
  }, [editId, navigate, loadForm, loadExistingImages]);

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
          showSuccess(
            "Incomplete payment found — tap 'Complete Payment' to finish"
          );
          return;
        }

        if (session.reference) {
          const token = getToken();
          if (token) {
            try {
              const result = await apiFetch(`${API_BASE}/payment/verify`, {
                method : "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization : `Bearer ${token}`,
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
                if (result.needs_verification)
                  safeRedirect("/verification", VERIFY_DELAY_MS);
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

      const { form: draftForm = {} } = draft;
      const { contact, ...restForm } = draftForm;
      const contactWithoutEmail = contact
        ? { ...contact, email: user?.email ?? "" }
        : { email: user?.email ?? "" };

      loadForm({ ...restForm, contact: contactWithoutEmail });
      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");

      if (draft.selectedPlan) {
        const matched = promotionPlans.find(
          (p) => String(p.id) === String(draft.selectedPlan)
        );
        setSelectedPlan(matched ?? null);
      }
    } catch (err) {
      console.warn("[AddProduct] draft restore:", err.message);
    }
  }, [
    isEditMode, categoriesLoaded, plansLoading,
    STORAGE_DRAFT, loadForm, promotionPlans, user?.email,
  ]);

  /* ═══════════════════════════════════════════════════════════
     AUTO-SAVE DRAFT
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isEditMode) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        const { contact, ...restForm } = form;
        const contactWithoutEmail = contact
          ? (({ email, ...rest }) => rest)(contact)
          : {};

        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            version     : DRAFT_VERSION,
            form        : { ...restForm, contact: contactWithoutEmail },
            locationState,
            city,
            selectedPlan: selectedPlan?.id ?? null,
          })
        );
      } catch { /* non-critical */ }
    }, DRAFT_DELAY_MS);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isEditMode, form, locationState, city, selectedPlan, STORAGE_DRAFT]);

  /* ═══════════════════════════════════════════════════════════
     GPS
  ═══════════════════════════════════════════════════════════ */
  const detectLocation = useCallback(async () => {
    if (mountedRef.current) setDetectingLocation(true);
    try {
      const result = await detectUserLocation();
      if (!mountedRef.current) return;

      let matchedState = "";
      if (result.state) {
        const availableStates = Object.keys(locationsByState ?? {});
        const detected = String(result.state).trim();
        matchedState =
          availableStates.find(
            (s) => s.toLowerCase() === detected.toLowerCase()
          ) ??
          availableStates.find(
            (s) =>
              s.toLowerCase() ===
              detected.toLowerCase().replace(/\s*state$/i, "")
          ) ??
          availableStates.find(
            (s) =>
              detected.toLowerCase().includes(s.toLowerCase()) ||
              s.toLowerCase().includes(detected.toLowerCase())
          ) ??
          "";
      }

      let matchedCity = "";
      if (matchedState && result.city) {
        const availableCities = locationsByState[matchedState] ?? [];
        const detected = String(result.city).trim();
        matchedCity =
          availableCities.find(
            (c) => c.toLowerCase() === detected.toLowerCase()
          ) ??
          availableCities.find(
            (c) =>
              detected.toLowerCase().includes(c.toLowerCase()) ||
              c.toLowerCase().includes(detected.toLowerCase())
          ) ??
          "";
      }

      if (matchedState) {
        setLocationState(matchedState);
        clearFieldError("location");
      }
      if (matchedCity) setCity(matchedCity);

      setDetectedCoords({
        latitude : result.latitude,
        longitude: result.longitude,
      });

      if (matchedState && matchedCity) {
        showSuccess("Location detected");
      } else if (matchedState) {
        showSuccess(
          `State detected: ${matchedState} — please pick your city`
        );
      } else if (result.state) {
        showError(
          `Detected "${result.state}" but not in our list — please select manually`
        );
      } else {
        showSuccess("GPS captured — fill state/city manually");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      showError(err.message || "Location detection failed");
    } finally {
      if (mountedRef.current) setDetectingLocation(false);
    }
  }, [showError, showSuccess, clearFieldError]);

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

    if (!form.price || Number(form.price) <= 0)
      return "Enter a valid price.";
    if (Number(form.price) > 1_000_000_000)
      return "Price exceeds maximum.";

    if (!form.category_id)
      return "Category required.";

    if (!isValidPhone(form.contact?.phone))
      return "Phone number must be 7–15 digits (e.g. 08012345678).";

    if (form.contact?.whatsapp && !isValidPhone(form.contact.whatsapp))
      return "WhatsApp number must be 7–15 digits.";

    if (totalImageCount === 0)
      return "At least one image is required.";

    if (!locationState || !city)
      return "Select your state and city.";

    if (!isEditMode && !agreedToTerms)
      return "Please accept the Terms & Conditions.";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to   = Number(form.delivery.duration.to);
      if (!Number.isFinite(from) || from < 1)
        return "Enter valid delivery start days.";
      if (!Number.isFinite(to) || to < 1)
        return "Enter valid delivery end days.";
      if (to < from)
        return "Delivery end must be after start.";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter a valid delivery fee.";
    }

    return null;
  }, [
    form, totalImageCount, locationState,
    city, agreedToTerms, isEditMode,
  ]);

  /* ═══════════════════════════════════════════════════════════
     BUILD FORM DATA
  ═══════════════════════════════════════════════════════════ */
  const buildBaseFormData = useCallback(() => {
    const fd = new FormData();
    fd.append("title",         form.title.trim());
    fd.append("description",   form.description.trim());
    fd.append("price",         Number(form.price).toFixed(2));
    fd.append("category_id",   form.category_id);
    if (form.subcategory_id)
      fd.append("subcategory_id", form.subcategory_id);
    fd.append("location_state", locationState ?? "");
    fd.append("location_city",  city ?? "");
    fd.append("phone",          sanitizePhone(form.contact.phone    ?? ""));
    fd.append("whatsapp",       sanitizePhone(form.contact.whatsapp ?? ""));
    fd.append("whatsapp_link",  form.contact.whatsapp_link ?? "");
    fd.append("seller_name",    user?.store_name || user?.name || BRAND_NAME);

    fd.append("attributes", JSON.stringify({
      ...attributes,
      features: toArray(attributes.features),
    }));
    fd.append("delivery", JSON.stringify(form.delivery));

    const { email: _email, ...contactWithoutEmail } = form.contact ?? {};
    fd.append("contact", JSON.stringify(contactWithoutEmail));

    if (detectedCoords) {
      fd.append("latitude",  String(detectedCoords.latitude));
      fd.append("longitude", String(detectedCoords.longitude));
    }
    return fd;
  }, [form, attributes, locationState, city, detectedCoords, user]);

  const buildCreateFormData = useCallback(
    (isFreePlan) => {
      const fd = buildBaseFormData();
      fd.append("status",    isFreePlan ? "active" : "draft");
      fd.append("is_active", isFreePlan ? "true"   : "false");
      fd.append(
        "idempotency_key",
        getOrCreateIdempotencyKey(IDEMPOTENCY_STORE)
      );
      const imageHashes = images.map((img) => img.hash).filter(Boolean);
      if (imageHashes.length)
        fd.append("image_hashes", JSON.stringify(imageHashes));
      images.forEach((img) => fd.append("images", img.file));
      return fd;
    },
    [buildBaseFormData, images, IDEMPOTENCY_STORE]
  );

  const buildEditFormData = useCallback(() => {
    const fd = buildBaseFormData();
    fd.append(
      "keep_image_ids",
      JSON.stringify(existingImages.map((img) => img.id))
    );
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
          method : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization : `Bearer ${token}`,
          },
          body: JSON.stringify({ reference: paymentData.reference }),
        });
      }
    } catch { /* non-critical */ } finally {
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
    setNeedsSubscription(false);
    setSubscriptionData(null);
    setWatermarkWarnings([]);
    setWatermarkNotice("");
    setShowVerifyBeforePay(false);
    clearAllFieldErrors();
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    clearIdempotencyKey(IDEMPOTENCY_STORE);

    if (user?.email) updateContact("email", user.email);

    showSuccess("Draft cleared");
  }, [
    STORAGE_DRAFT, IDEMPOTENCY_STORE,
    resetForm, resetImages, showSuccess,
    user?.email, updateContact, clearAllFieldErrors,
  ]);

  /* ═══════════════════════════════════════════════════════════
     POST SUCCESS HANDLER
  ═══════════════════════════════════════════════════════════ */
  const handlePostSuccess = useCallback(
    (responseData) => {
      if (!mountedRef.current) return;
      clearIdempotencyKey(IDEMPOTENCY_STORE);

      const verificationNeeded = responseData?.needs_verification === true;
      const daysRemaining      = responseData?.days_remaining ?? 7;
      const respTier           = responseData?.tier           ?? tier;
      const respIsSubscriber   = responseData?.is_subscriber  ?? isSubscriber;

      const warnings = Array.isArray(responseData?.watermark_warnings)
        ? responseData.watermark_warnings
        : [];
      const notice = responseData?.watermark_notice ?? "";

      if (warnings.length > 0) {
        setWatermarkWarnings(warnings);
        setWatermarkNotice(notice);
      }

      const upgradeMessage = responseData?.upgrade_message ?? null;
      const upgradeToNext  = responseData?.upgrade_to      ?? null;
      const upgradeUrlNext = responseData?.upgrade_url     ?? "/subscribe";

      const showSubscribeUpsell =
        upgradeToNext === "subscriber" &&
        respTier === "verified" &&
        !respIsSubscriber;

      if (showSubscribeUpsell) {
        setSubscriptionData({
          message     : upgradeMessage,
          upgradeUrl  : upgradeUrlNext,
          lifetimeUsed: responseData?.limits?.lifetime_used ?? lifetimeUsed,
          lifetimeMax : responseData?.limits?.lifetime_max  ?? 500,
        });
        setNeedsSubscription(true);
      }

      const extraDelay =
        (warnings.length > 0 ? WM_WARN_EXTRA_DELAY_MS : 0) +
        (showSubscribeUpsell ? UPGRADE_EXTRA_DELAY_MS  : 0);

      if (verificationNeeded) {
        setVerificationData({
          productId    : responseData.product?.id,
          activeUntil  : responseData.active_until,
          daysRemaining,
          message      : responseData.verification_message,
          limits       : responseData.limits,
        });
        setNeedsVerification(true);
        showSuccess(
          warnings.length > 0
            ? `Listing live for ${daysRemaining} days. Review the photo tip below.`
            : `Listing live for ${daysRemaining} days. Redirecting…`
        );
        safeRedirect("/verification", VERIFY_DELAY_MS + extraDelay);
      } else if (showSubscribeUpsell) {
        showSuccess(
          respIsSubscriber
            ? "Product live! Redirecting…"
            : "Product live! You've reached your 500-listing limit."
        );
      } else {
        showSuccess(
          warnings.length > 0
            ? "Product live! Review the photo tip below."
            : respIsSubscriber
              ? "Product live permanently!"
              : "Product live! Redirecting…"
        );
        safeRedirect("/", REDIRECT_DELAY_MS + extraDelay);
      }
    },
    [
      IDEMPOTENCY_STORE, showSuccess, safeRedirect,
      tier, isSubscriber, lifetimeUsed,
    ]
  );

  /* ═══════════════════════════════════════════════════════════
     EDIT SUBMIT
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

    clearAllFieldErrors();
    setProgressVisible(true);
    setProgressStep("uploading");
    setError("");

    try {
      const token = getTokenOrRedirect(
        navigate,
        `/minimart/add?edit=${editId}`
      );
      if (!token) return;

      const fd = buildEditFormData();

      await multipartRequest(
        `${API_BASE}/addproduct/products/${editId}`,
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

      const msg =
        err?.status === 404
          ? "Listing not found — it may have been deleted."
          : err?.status === 403
          ? "You don't have permission to edit this listing."
          : err?.status === 409
          ? err.message
          : err?.status === 413
          ? "Images are too large. Please compress and retry."
          : err.message ?? "Update failed — please try again.";

      showError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    editId, validateForm, buildEditFormData,
    navigate, showError, showSuccess, safeRedirect, clearAllFieldErrors,
  ]);

  /* ═══════════════════════════════════════════════════════════
     CREATE SUBMIT — CORE
  ═══════════════════════════════════════════════════════════ */
  const runCreateSubmit = useCallback(async (forcedPlan = null) => {
    if (!navigator.onLine) {
      showError("You appear to be offline.");
      return;
    }

    setLoading(true);

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    clearAllFieldErrors();
    setWatermarkWarnings([]);
    setWatermarkNotice("");
    setNeedsSubscription(false);
    setSubscriptionData(null);
    setProgressVisible(true);
    setProgressStep("compressing");
    setError("");

    let product          = null;
    let paymentInitiated = false;

    try {
      const finalPlan =
        forcedPlan ??
        selectedPlan ??
        promotionPlans.find((p) => Number(p.price) === 0) ??
        null;

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
        `${API_BASE}/addproduct/products`,
        "POST",
        fd,
        token
      );
      if (!mountedRef.current) return;
      if (!uploadData.product?.id)
        throw new ApiError("Product creation failed", 500);
      product = uploadData.product;

      fetchLimits();

      if (isFreePlan) {
        setProgressStep("activating");
        const activateRes = await apiFetch(
          `${API_BASE}/addproduct/products/${product.id}/activate`,
          {
            method : "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization : `Bearer ${token}`,
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

      setProgressStep("payment");
      const rawPrice     = Number(finalPlan.price);
      const discount     = Number(finalPlan.discount_percent ?? 0);
      const effectiveAmt = Number(
        (rawPrice * (1 - discount / 100)).toFixed(2)
      );

      const userEmail = user?.email ?? "";

      const payData = await apiFetch(`${API_BASE}/payment/initiate`, {
        method : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization : `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(userEmail ? { email: userEmail } : {}),
          amount         : effectiveAmt,
          plan_id        : String(finalPlan.id),
          product_id     : product.id,
          idempotency_key: getOrCreateIdempotencyKey(IDEMPOTENCY_STORE),
        }),
      });

      if (!payData.authorization_url)
        throw new ApiError("Payment setup failed", 500);

      paymentInitiated = true;

      const session = {
        reference        : payData.reference,
        authUrl          : payData.authorization_url,
        planId           : String(finalPlan.id),
        productId        : product.id,
        amount           : effectiveAmt,
        createdAt        : Date.now(),
        needsVerification: uploadData.needs_verification ?? false,
        activeUntil      : uploadData.active_until       ?? null,
        daysRemaining    : uploadData.days_remaining     ?? null,
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
      console.error("[AddProduct] create submit:", err);
      if (mountedRef.current) setProgressVisible(false);

      if (err?.status === 400 && err?.data?.reason === "watermark_policy") {
        const blockedIndexes = Array.isArray(err.data?.blocked_images)
          ? err.data.blocked_images
          : [];
        setWatermarkWarnings(
          blockedIndexes.length > 0
            ? blockedIndexes.map((index) => ({
                imageIndex: index,
                competitor: null,
                message   : err.message,
                isBlocked : true,
              }))
            : [{ imageIndex: null, competitor: null,
                 message: err.message, isBlocked: true }]
        );
        setWatermarkNotice(
          "Please replace the flagged photo(s) with original images and try again."
        );
        requestAnimationFrame(() => {
          document
            .querySelector(".wm-banner")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        showError(
          err.message ??
          "One or more photos were rejected. Please replace them and try again."
        );

      } else if (
        err?.status === 403 &&
        err?.data?.upgrade_required === true
      ) {
        const upTo  = err.data?.upgrade_to  ?? "verified";
        const upUrl = err.data?.upgrade_url ?? "/verification";

        if (upTo === "subscriber") {
          setSubscriptionData({
            message     : err.message ?? "You've reached your 500-listing limit.",
            upgradeUrl  : upUrl,
            lifetimeUsed: err.data?.lifetime_used ?? lifetimeUsed,
            lifetimeMax : err.data?.lifetime_max  ?? 500,
          });
          setNeedsSubscription(true);
        } else {
          setVerificationData({
            message     : err.message ?? "You've used all free trial listings.",
            upgradeUrl  : upUrl,
            lifetimeUsed: err.data?.lifetime_used ?? lifetimeUsed,
            lifetimeMax : err.data?.lifetime_max  ?? 3,
          });
          setNeedsVerification(true);
        }
        showError(err.message ?? "Posting limit reached.");

      } else {
        showError(err.message ?? "Submission failed — please try again");
      }

      if (product?.id && !paymentInitiated) {
        const token = getToken();
        if (token) {
          fetch(`${API_BASE}/addproduct/products/${product.id}`, {
            method : "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch((e) =>
            console.error("[AddProduct] cleanup failed:", e)
          );
        }
      }

      if (err?.status === 403) fetchLimits();

    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    validateForm, selectedPlan, promotionPlans, plansLoading,
    buildCreateFormData, clearDraft, showError, showSuccess,
    handlePostSuccess, fetchLimits, navigate,
    IDEMPOTENCY_STORE, lifetimeUsed, user?.email, clearAllFieldErrors,
  ]);

  /* ═══════════════════════════════════════════════════════════
     CREATE SUBMIT — ENTRY
  ═══════════════════════════════════════════════════════════ */
  const handleCreateSubmit = useCallback(() => {
    if (isSubmittingRef.current) return;

    const finalPlan =
      selectedPlan ??
      promotionPlans.find((p) => Number(p.price) === 0) ??
      null;

    const isPaidPlan = !!finalPlan && Number(finalPlan.price) > 0;

    if (isPaidPlan && !isVerifiedSeller) {
      setShowVerifyBeforePay(true);
      return;
    }

    isSubmittingRef.current = true;
    runCreateSubmit();
  }, [
    selectedPlan, promotionPlans,
    isVerifiedSeller, runCreateSubmit,
  ]);

  const handleVerifyBeforePayVerify = useCallback(() => {
    setShowVerifyBeforePay(false);
    navigate("/verification");
  }, [navigate]);

  const handleVerifyBeforePayCancel = useCallback(() => {
    setShowVerifyBeforePay(false);
  }, []);

  const handleVerifyBeforePayFreePlan = useCallback(() => {
    setShowVerifyBeforePay(false);
    const freePlan = promotionPlans.find(
      (p) => Number(p.price) === 0
    ) ?? null;
    setSelectedPlan(freePlan);
    isSubmittingRef.current = true;
    runCreateSubmit(freePlan);
  }, [promotionPlans, runCreateSubmit]);

  const handleSubmit = useCallback(
    () => (isEditMode ? handleEditSubmit() : handleCreateSubmit()),
    [isEditMode, handleEditSubmit, handleCreateSubmit]
  );

  /* ═══════════════════════════════════════════════════════════
     TERMS CHECKBOX
  ═══════════════════════════════════════════════════════════ */
  const termsCheckboxEl = useMemo(
    () => (
      <TermsCheckbox
        checked={agreedToTerms}
        onChange={setAgreedToTermsWithClear}
      />
    ),
    [agreedToTerms, setAgreedToTermsWithClear]
  );

  /* ═══════════════════════════════════════════════════════════
     EDIT LOADING / ERROR STATES
  ═══════════════════════════════════════════════════════════ */
  if (isEditMode && editLoading) {
    return (
      <div className="apd-page">
        <div className="ap-edit-loading">
          <div className="ap-edit-loading-spinner" />
          <p>Loading listing…</p>
        </div>
      </div>
    );
  }

  if (isEditMode && editError) {
    return (
      <div className="apd-page">
        <div className="ap-edit-error">
          <span>⚠️</span>
          <h2>Could not load listing</h2>
          <p>{editError}</p>
          <button onClick={() => navigate("/dashboard")}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="apd-page">

      {showVerifyBeforePay && !isEditMode && (
        <VerifyBeforePayModal
          onVerify   ={handleVerifyBeforePayVerify}
          onCancel   ={handleVerifyBeforePayCancel}
          onFreePlan ={handleVerifyBeforePayFreePlan}
        />
      )}

      <ProgressOverlay
        visible={progressVisible}
        step={progressStep}
        isPaid={isSelectedPlanPaid}
      />

      {compressingTotal > 0 && (
        <div
          className="compression-progress"
          role="status"
          aria-live="polite"
        >
          <span className="btn-spin-svg" aria-hidden="true" />
          Compressing image {compressingCount + 1} of {compressingTotal}…
        </div>
      )}

      {watermarkWarnings.length > 0 && (
        <WatermarkWarningBanner
          warnings={watermarkWarnings}
          notice={watermarkNotice}
          onDismiss={
            watermarkWarnings.some((w) => w.isBlocked)
              ? undefined
              : dismissWatermarkWarnings
          }
        />
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
        TermsCheckbox={termsCheckboxEl}
        promotionPlans={promotionPlans}
        plansLoading={plansLoading}
        MAX_IMAGES={MAX_IMAGES}

        /* ─ edit mode ─ */
        isEditMode={isEditMode}
        editId={editId}
        existingImages={existingImages}
        removeExistingImage={removeExistingImage}
        totalImageCount={totalImageCount}

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

        /* ─ 3-tier fields ─ */
        tier={tier}
        isSubscriber={isSubscriber}
        lifetimeExhausted={lifetimeExhausted}
        lifetimeRemaining={lifetimeRemaining}
        lifetimeUsed={lifetimeUsed}
        lifetimeMax={lifetimeMax}
        upgradeTo={upgradeTo}
        upgradeUrl={upgradeUrl}

        /* ─ post-creation upsells ─ */
        needsVerification={needsVerification}
        verificationData={verificationData}
        needsSubscription={needsSubscription}
        subscriptionData={subscriptionData}

        /* ─ watermark ─ */
        watermarkWarnings={watermarkWarnings}
        watermarkNotice={watermarkNotice}

        /* ─ ✅ v7: inline field errors ─ */
        fieldError={fieldError}
        clearFieldError={clearFieldError}
        clearAllFieldErrors={clearAllFieldErrors}

        /* ─ handlers (wrapped with field-error clearing) ─ */
        updateForm={updateFormWithClear}
        updateAttribute={updateAttribute}
        updateContact={updateContactWithClear}
        updateDelivery={updateDeliveryWithClear}
        updateDeliveryDuration={updateDeliveryDurationWithClear}
        toggleFeature={toggleFeature}
        setState={setLocationStateWithClear}
        setCity={setCityWithClear}
        setSelectedPlan={setSelectedPlan}
        handleImages={handleImages}
        removeImage={removeImage}
        moveImage={moveAllImages}
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