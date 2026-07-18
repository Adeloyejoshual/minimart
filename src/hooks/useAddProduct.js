/**
 * src/hooks/useAddProduct.ts
 * All logic for AddProduct — state, effects, handlers, submit.
 * Returns everything the shells (mobile/desktop) need to render.
 */

import {
  useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { locationsByState }           from "../config/locationsByState.js";
import { apiFetch, ApiError }         from "../utils/apiFetch.js";
import { detectUserLocation }         from "../utils/location.js";
import { useFormState, INITIAL_FORM } from "./useFormState.js";
import { useImageManager }            from "./useImageManager.js";
import { useSellerLimits }            from "./useSellerLimits.js";

import type {
  AddProductContextValue,
  Contact,
  DeliveryDuration,
  ExistingImage,
  NewImage,
  PaymentSession,
  ProductForm,
  PromotionPlan,
  SellerLimits,
  VerificationData,
} from "./useAddProductContext.jsx";

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

interface ErrorSelectorEntry {
  match : string;
  sel   : string;
}

const ERROR_SELECTOR_MAP: ErrorSelectorEntry[] = [
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
export const onlyNumbers = (v = ""): string => v.replace(/[^0-9.]/g, "");
export const onlyDigits  = (v = ""): string => v.replace(/[^0-9]/g, "");

const toArray       = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : []);
const sanitizePhone = (v = ""):  string    => v.replace(/[\s\-().]/g, "");
const isValidPhone  = (v: unknown): boolean =>
  !!v && PHONE_RE.test(sanitizePhone(String(v)));

export const displayPrice = (v: number | string): string => {
  const n = Number(v);
  return Number.isNaN(n) || n <= 0
    ? ""
    : new Intl.NumberFormat("en-NG").format(n);
};

export const formatLabel = (t: string): string =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const getToken = (): string | null =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const getTokenOrRedirect = (
  navigate  : (path: string) => void,
  returnPath: string
): string | null => {
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

const safeOpenPayment = (url: string, onError?: (msg: string) => void): void => {
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Payment] Blocked unsafe URL:", msg);
    onError?.("Payment URL invalid — please contact support");
  }
};

const isValidPaymentSession = (obj: unknown): obj is PaymentSession =>
  !!obj &&
  typeof (obj as PaymentSession).reference === "string" &&
  (obj as PaymentSession).reference.length > 0 &&
  typeof (obj as PaymentSession).authUrl === "string" &&
  (obj as PaymentSession).authUrl.startsWith("https://") &&
  typeof (obj as PaymentSession).createdAt === "number";

const getOrCreateIdempotencyKey = (storageKey: string): string => {
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  return id;
};

const clearIdempotencyKey = (storageKey: string): void =>
  sessionStorage.removeItem(storageKey);

const multipartRequest = async (
  url      : string,
  method   : string = "POST",
  formData : FormData,
  token    : string,
  timeoutMs: number = UPLOAD_TIMEOUT
): Promise<Record<string, unknown>> => {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers : { Authorization: `Bearer ${token}` },
      body    : formData,
      signal  : ctrl.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError")
      throw new ApiError("Upload timed out — check your connection", 0);
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  } finally {
    clearTimeout(tid);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      (data as Record<string, string>)?.message ??
        `Request failed (${res.status})`,
      res.status
    );
  return data as Record<string, unknown>;
};

const scrollToError = (msg: string): void => {
  if (!msg) return;
  const entry = ERROR_SELECTOR_MAP.find((e) => msg.includes(e.match));
  const sel   = entry?.sel ?? ".ap-error-banner";
  requestAnimationFrame(() => {
    try {
      const el = document.querySelector(sel);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (["INPUT", "TEXTAREA", "SELECT"].includes((el as HTMLElement).tagName)) {
        setTimeout(
          () => (el as HTMLElement).focus({ preventScroll: true }),
          350
        );
      }
      el.classList.add("ap-field-flash");
      setTimeout(() => el.classList.remove("ap-field-flash"), 2_000);
    } catch {
      if (import.meta.env.DEV) console.warn("[scrollToError] failed");
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   HOOK PROPS
═══════════════════════════════════════════════════════════════ */
interface User {
  id?         : string | number;
  email?      : string;
  name?       : string;
  store_name? : string;
}

interface UseAddProductProps {
  user?: User;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN HOOK
═══════════════════════════════════════════════════════════════ */
export function useAddProduct({
  user,
}: UseAddProductProps): AddProductContextValue {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

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

  /* ═══════════════════════════════════════════════════════════
     REFS
  ═══════════════════════════════════════════════════════════ */
  const mountedRef      = useRef(true);
  const isSubmittingRef = useRef(false);
  const autoSaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutIdsRef   = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );
  const showErrorRef   = useRef<(msg: string) => void>(() => {});
  const showSuccessRef = useRef<(msg: string) => void>(() => {});

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
    showError  : (msg: string) => showErrorRef.current(msg),
    showSuccess: (msg: string) => showSuccessRef.current(msg),
  });

  const {
    sellerLimits, limitsLoading, fetchLimits,
    isVerifiedSeller, trialExhausted, trialRemaining,
    dailyRemaining, activeRemaining, cooldownSecs, canPost,
  } = useSellerLimits(API_BASE, isEditMode);

  /* ═══════════════════════════════════════════════════════════
     LOCAL STATE
  ═══════════════════════════════════════════════════════════ */
  const [categories,        setCategories]        = useState<unknown[]>([]);
  const [categoriesLoaded,  setCategoriesLoaded]  = useState(false);
  const [promotionPlans,    setPromotionPlans]    = useState<PromotionPlan[]>([]);
  const [plansLoading,      setPlansLoading]      = useState(!isEditMode);
  const [locationState,     setLocationState]     = useState("");
  const [city,              setCity]              = useState("");
  const [loading,           setLoading]           = useState(false);
  const [selectedPlan,      setSelectedPlan]      = useState<PromotionPlan | null>(null);
  const [paymentData,       setPaymentData]       = useState<PaymentSession | null>(null);
  const [error,             setError]             = useState("");
  const [success,           setSuccess]           = useState("");
  const [agreedToTerms,     setAgreedToTerms]     = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords,    setDetectedCoords]    = useState<{
    latitude : number;
    longitude: number;
  } | null>(null);
  const [progressVisible,   setProgressVisible]   = useState(false);
  const [progressStep,      setProgressStep]      = useState("compressing");
  const [editLoading,       setEditLoading]       = useState(isEditMode);
  const [editError,         setEditError]         = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData,  setVerificationData]  = useState<VerificationData | null>(null);

  /* ═══════════════════════════════════════════════════════════
     FEEDBACK
  ═══════════════════════════════════════════════════════════ */
  const showError = useCallback((msg: string) => {
    if (!mountedRef.current) return;
    setError(msg);
    scrollToError(msg);
    const id = setTimeout(() => {
      if (mountedRef.current) setError("");
      timeoutIdsRef.current.delete(id);
    }, 7_000);
    timeoutIdsRef.current.add(id);
  }, []);

  const showSuccess = useCallback((msg: string) => {
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
    (path: string, delayMs: number = REDIRECT_DELAY_MS) => {
      const id = setTimeout(() => {
        if (mountedRef.current) navigate(path);
        timeoutIdsRef.current.delete(id);
      }, delayMs);
      timeoutIdsRef.current.add(id);
    },
    [navigate]
  );

  /* ═══════════════════════════════════════════════════════════
     DERIVED
  ═══════════════════════════════════════════════════════════ */
  const selectedCategory = useMemo(
    () =>
      (categories as Array<{ id: string | number; dynamicOptions?: Record<string, unknown> }>)
        .find((c) => String(c.id) === String(form.category_id)) ?? null,
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
    () =>
      locationState
        ? (locationsByState as Record<string, string[]>)[locationState] ?? []
        : [],
    [locationState]
  );

  const isSelectedPlanPaid =
    !!selectedPlan && Number(selectedPlan?.price ?? 0) > 0;

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
      .catch((err: Error) => {
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
      .then((data: unknown) => {
        if (!mountedRef.current) return;
        const d = data as { success: boolean; plans?: PromotionPlan[] };
        setPromotionPlans(
          d.success && Array.isArray(d.plans) ? d.plans : []
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
      const d = await res.json() as {
        success : boolean;
        message?: string;
        product : Record<string, unknown>;
      };
      if (!res.ok || !d.success)
        throw new Error(d.message || "Product not found");

      const p = d.product;
      if (!mountedRef.current) return;

      loadForm({
        ...(p as Partial<ProductForm>),
        contact: {
          ...((p.contact as Contact) ?? {}),
          email:
            (p.contact as Contact)?.email ||
            user?.email ||
            "",
        },
      });

      if (p.location_state) setLocationState(p.location_state as string);
      if (p.location_city)  setCity(p.location_city as string);

      if (p.latitude && p.longitude) {
        setDetectedCoords({
          latitude : p.latitude  as number,
          longitude: p.longitude as number,
        });
      }

      /* Load existing images */
      const productImages = p.product_images as Array<{
        id             : string;
        image_url      : string;
        r2_key?        : string;
        position_order?: number;
        is_primary?    : boolean;
      }>;

      if (productImages?.length > 0) {
        loadExistingImages(
          productImages.map((img) => ({
            id        : img.id,
            url       : img.image_url,
            r2_key    : img.r2_key    ?? null,
            position  : img.position_order ?? 0,
            is_primary: img.is_primary     ?? false,
            isExisting: true as const,
          }))
        );
      } else if (Array.isArray(p.images) && (p.images as unknown[]).length > 0) {
        loadExistingImages(
          (p.images as Array<string | { url?: string; key?: string }>).map(
            (img, i) => ({
              id        : `existing-${i}`,
              url       : typeof img === "string" ? img : img?.url ?? "",
              r2_key    : typeof img === "string" ? null : img?.key ?? null,
              position  : i,
              is_primary: i === 0,
              isExisting: true as const,
            })
          )
        );
      } else if (p.main_image || p.thumbnail_url) {
        loadExistingImages([{
          id        : "existing-main",
          url       : (p.main_image ?? p.thumbnail_url) as string,
          r2_key    : null,
          position  : 0,
          is_primary: true,
          isExisting: true as const,
        }]);
      }

      setAgreedToTerms(true);

    } catch (err) {
      console.error("[useAddProduct] edit load:", err);
      if (mountedRef.current)
        setEditError((err as Error).message || "Failed to load product");
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

        let session: unknown;
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
                method  : "POST",
                headers : {
                  "Content-Type" : "application/json",
                  Authorization  : `Bearer ${token}`,
                },
                body: JSON.stringify({ reference: session.reference }),
              }) as { status: string; needs_verification?: boolean };

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
      const draft = JSON.parse(raw) as {
        version      : number;
        form         : Partial<ProductForm>;
        locationState: string;
        city         : string;
        selectedPlan : string | null;
      };
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
      console.warn("[useAddProduct] draft restore:", (err as Error).message);
    }
  }, [
    isEditMode, categoriesLoaded, plansLoading,
    STORAGE_DRAFT, loadForm, promotionPlans,
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
        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            version     : DRAFT_VERSION,
            form,
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
      const result = await detectUserLocation() as {
        state?    : string;
        city?     : string;
        latitude  : number;
        longitude : number;
      };
      if (!mountedRef.current) return;
      if (result.state) setLocationState(result.state);
      if (result.city)  setCity(result.city);
      setDetectedCoords({
        latitude : result.latitude,
        longitude: result.longitude,
      });
      showSuccess(
        result.state
          ? "Location detected"
          : "GPS captured — fill state/city manually"
      );
    } catch (err) {
      if (!mountedRef.current) return;
      showError((err as Error).message || "Location detection failed");
    } finally {
      if (mountedRef.current) setDetectingLocation(false);
    }
  }, [showError, showSuccess]);

  /* ═══════════════════════════════════════════════════════════
     VALIDATION
  ═══════════════════════════════════════════════════════════ */
  const validateForm = useCallback((): string | null => {
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

    if (!EMAIL_RE.test(form.contact?.email ?? ""))
      return "Enter a valid email address.";
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
  }, [form, totalImageCount, locationState, city, agreedToTerms, isEditMode]);

  /* ═══════════════════════════════════════════════════════════
     BUILD FORM DATA
  ═══════════════════════════════════════════════════════════ */
  const buildBaseFormData = useCallback((): FormData => {
    const fd = new FormData();
    fd.append("title",          form.title.trim());
    fd.append("description",    form.description.trim());
    fd.append("price",          Number(form.price).toFixed(2));
    fd.append("category_id",    String(form.category_id));
    if (form.subcategory_id)
      fd.append("subcategory_id", String(form.subcategory_id));
    fd.append("location_state", locationState ?? "");
    fd.append("location_city",  city ?? "");
    fd.append("phone",          sanitizePhone(form.contact.phone    ?? ""));
    fd.append("whatsapp",       sanitizePhone(form.contact.whatsapp ?? ""));
    fd.append("whatsapp_link",  form.contact.whatsapp_link ?? "");
    fd.append("seller_name",    user?.store_name || user?.name || BRAND_NAME);
    fd.append("attributes",     JSON.stringify({
      ...attributes,
      features: toArray((attributes as { features?: unknown }).features),
    }));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact",  JSON.stringify(form.contact));
    if (detectedCoords) {
      fd.append("latitude",  String(detectedCoords.latitude));
      fd.append("longitude", String(detectedCoords.longitude));
    }
    return fd;
  }, [form, attributes, locationState, city, detectedCoords, user]);

  const buildCreateFormData = useCallback(
    (isFreePlan: boolean): FormData => {
      const fd = buildBaseFormData();
      fd.append("status",          isFreePlan ? "active" : "draft");
      fd.append("is_active",       isFreePlan ? "true"   : "false");
      fd.append("idempotency_key", getOrCreateIdempotencyKey(IDEMPOTENCY_STORE));
      const imageHashes = (images as NewImage[])
        .map((img) => img.hash)
        .filter(Boolean) as string[];
      if (imageHashes.length)
        fd.append("image_hashes", JSON.stringify(imageHashes));
      (images as NewImage[]).forEach((img) => fd.append("images", img.file));
      return fd;
    },
    [buildBaseFormData, images, IDEMPOTENCY_STORE]
  );

  const buildEditFormData = useCallback((): FormData => {
    const fd = buildBaseFormData();
    fd.append(
      "keep_image_ids",
      JSON.stringify((existingImages as ExistingImage[]).map((img) => img.id))
    );
    if ((removedImageKeys as string[]).length)
      fd.append(
        "remove_image_keys",
        JSON.stringify(removedImageKeys)
      );
    (images as NewImage[]).forEach((img) => fd.append("images", img.file));
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
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    clearIdempotencyKey(IDEMPOTENCY_STORE);
    showSuccess("Draft cleared");
  }, [STORAGE_DRAFT, IDEMPOTENCY_STORE, resetForm, resetImages, showSuccess]);

  /* ═══════════════════════════════════════════════════════════
     EDIT SUBMIT
     PATCH /api/addproduct/products/:id  ← routes/editproduct.js
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
      const token = getTokenOrRedirect(
        navigate,
        `/minimart/add?edit=${editId}`
      );
      if (!token) return;

      const fd = buildEditFormData();

      await multipartRequest(
        `${API_BASE}/addproduct/products/${editId}`,   // ✅ correct
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

      const e     = err as ApiError & { status?: number };
      const msg =
        e?.status === 404 ? "Listing not found — it may have been deleted."
        : e?.status === 403 ? "You don't have permission to edit this listing."
        : e?.status === 409 ? e.message
        : e?.status === 413 ? "Images are too large. Please compress and retry."
        : e.message ?? "Update failed — please try again.";

      showError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    editId, validateForm, buildEditFormData,
    navigate, showError, showSuccess, safeRedirect,
  ]);

  /* ═══════════════════════════════════════════════════════════
     CREATE SUBMIT
  ═══════════════════════════════════════════════════════════ */
  const handlePostSuccess = useCallback(
    (responseData: Record<string, unknown>) => {
      if (!mountedRef.current) return;
      clearIdempotencyKey(IDEMPOTENCY_STORE);

      const verificationNeeded = responseData?.needs_verification === true;
      const daysRemaining      = (responseData?.days_remaining as number) ?? 7;

      if (verificationNeeded) {
        setVerificationData({
          productId    : (responseData.product as { id: string })?.id,
          activeUntil  : (responseData.active_until as string) ?? null,
          daysRemaining,
          message      : responseData.verification_message as string | undefined,
          limits       : responseData.limits as Record<string, unknown> | undefined,
        });
        setNeedsVerification(true);
        showSuccess(`Listing live for ${daysRemaining} days. Redirecting…`);
        safeRedirect("/verification", VERIFY_DELAY_MS);
      } else {
        showSuccess("Product live! Redirecting…");
        safeRedirect("/");
      }
    },
    [IDEMPOTENCY_STORE, showSuccess, safeRedirect]
  );

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

    let product: { id: string } | null = null;
    let paymentInitiated = false;

    try {
      const finalPlan =
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
      if (!(uploadData.product as { id?: string })?.id)
        throw new ApiError("Product creation failed", 500);
      product = uploadData.product as { id: string };

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
        ) as Record<string, unknown>;

        if (!mountedRef.current) return;
        setProgressStep("finalizing");
        await new Promise((r) => setTimeout(r, 600));
        if (!mountedRef.current) return;

        setProgressVisible(false);
        handlePostSuccess({
          ...uploadData,
          ...activateRes,
          product: (activateRes.product as Record<string, unknown>) ??
            uploadData.product,
        });
        clearDraft();
        return;
      }

      /* ── Paid plan ── */
      setProgressStep("payment");
      const rawPrice     = Number(finalPlan.price);
      const discount     = Number(finalPlan.discount_percent ?? 0);
      const effectiveAmt = Number(
        (rawPrice * (1 - discount / 100)).toFixed(2)
      );

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
      }) as { authorization_url?: string; reference?: string };

      if (!payData.authorization_url)
        throw new ApiError("Payment setup failed", 500);

      paymentInitiated = true;

      const session: PaymentSession = {
        reference        : payData.reference ?? "",
        authUrl          : payData.authorization_url,
        planId           : String(finalPlan.id),
        productId        : product.id,
        email            : form.contact.email,
        amount           : effectiveAmt,
        createdAt        : Date.now(),
        needsVerification: (uploadData.needs_verification as boolean) ?? false,
        activeUntil      : (uploadData.active_until as string)   ?? null,
        daysRemaining    : (uploadData.days_remaining as number)  ?? null,
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

      /* Clean up orphaned product */
      if (product?.id && !paymentInitiated) {
        const token = getToken();
        if (token) {
          fetch(`${API_BASE}/addproduct/products/${product.id}`, {
            method  : "DELETE",
            headers : { Authorization: `Bearer ${token}` },
          }).catch((e: Error) =>
            console.error("[useAddProduct] cleanup failed:", e)
          );
        }
      }

      showError((err as Error).message ?? "Submission failed — please try again");
      if ((err as ApiError).status === 403) fetchLimits();

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
    () => (isEditMode ? handleEditSubmit() : handleCreateSubmit()),
    [isEditMode, handleEditSubmit, handleCreateSubmit]
  );

  /* ═══════════════════════════════════════════════════════════
     RETURN
  ═══════════════════════════════════════════════════════════ */
  return {
    /* config */
    MAX_IMAGES,
    apiBase : API_BASE,

    /* mode */
    editId,
    isEditMode,
    editLoading,
    editError,

    /* navigation */
    navigate,

    /* form */
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
    locationState,
    city,
    setLocationState,
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
    sellerLimits      : sellerLimits as SellerLimits | null,
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

    /* progress */
    loading,
    progressVisible,
    progressStep,

    /* verification */
    needsVerification,
    verificationData,

    /* terms */
    agreedToTerms,
    setAgreedToTerms,

    /* draft */
    clearDraft,

    /* submit */
    handleSubmit,

    /* formatters */
    displayPrice,
    formatLabel,
    onlyNumbers,
    onlyDigits,
  } satisfies AddProductContextValue;
}