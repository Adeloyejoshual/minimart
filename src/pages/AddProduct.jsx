// FRONTEND
import { promotionPlans } from "../config/promotions.js";

import React, {
  useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import { Link } from "react-router-dom";
import ProductComponents    from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { apiFetch, ApiError } from "../utils/apiFetch.js";
import imageCompression      from "browser-image-compression";
import "../styles/AddProduct.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE        = "https://minimart-ivrm.onrender.com/api";
const STORAGE_PAYMENT = "payment_retry";
const MAX_IMAGES      = 6;
const MAX_SIZE        = 3 * 1024 * 1024; // 3 MB

const INITIAL_FORM = {
  title:          "",
  description:    "",
  price:          "",
  category_id:    "",
  subcategory_id: "",
  attributes: {
    brand:            "",
    model:            "",
    color:            "",
    condition:        "",
    used_detail:      "",
    ram:              "",
    storage:          "",
    sim:              "",
    year:             "",
    engine:           "",
    fuel_type:        "",
    features:         [],
    size:             "",
    age_range:        "",
    bedrooms:         "",
    bathrooms:        "",
    experience_level: "",
    skills:           "",
  },
  delivery: {
    available: false,
    duration:  { from: "", to: "" },
    fee:       "",
    note:      "",
  },
  contact: {
    phone:         "",
    whatsapp:      "",
    whatsapp_link: "",
    email:         "",
    preferred:     "chat",
  },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits  = (v = "") => v.replace(/[^0-9]/g, "");
const toArray     = (v)      => (Array.isArray(v) ? v : []);
const getToken    = ()       => localStorage.getItem("token");

const displayPrice = (v) => {
  const n = Number(v);
  return Number.isNaN(n) || n <= 0
    ? ""
    : new Intl.NumberFormat("en-NG").format(n);
};

const formatLabel = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

/**
 * multipartPost — raw fetch for FormData.
 * Never use apiFetch here: apiFetch sets Content-Type: application/json
 * which destroys the multipart boundary multer needs to read files.
 */
const multipartPost = async (url, formData, token, timeoutMs = 30_000) => {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` }, // NO Content-Type
      body:    formData,
      signal:  ctrl.signal,
    });
  } catch (err) {
    if (err.name === "AbortError")
      throw new ApiError("Upload timed out — check your connection and try again", 0);
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  } finally {
    clearTimeout(tid);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddProductPage({ user }) {
  // Draft key scoped to user — switching accounts never leaks a previous draft
  const STORAGE_DRAFT = `product_draft_${user?.id ?? "anon"}`;

  // ── State ──────────────────────────────────────────────────────────────────
  const [form,             setForm]             = useState(INITIAL_FORM);
  const [categories,       setCategories]       = useState([]);
  const [locationState,    setLocationState]    = useState("");
  const [city,             setCity]             = useState("");
  const [images,           setImages]           = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [selectedPlan,     setSelectedPlan]     = useState(null);
  const [paymentData,      setPaymentData]      = useState(null);
  const [error,            setError]            = useState("");
  const [success,          setSuccess]          = useState("");
  const [agreedToTerms,    setAgreedToTerms]    = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords,   setDetectedCoords]   = useState(null);

  // Hard submit lock — survives React re-renders unlike the `loading` state.
  // Prevents double-submit even if the button is clicked twice before loading renders.
  const isSubmittingRef = useRef(false);
  // Always-current images ref — needed for safe cleanup on unmount
  const imagesRef       = useRef([]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)) ?? null,
    [categories, form.category_id]
  );
  const options    = selectedCategory?.dynamicOptions ?? {};
  const attributes = form.attributes ?? INITIAL_FORM.attributes;
  const states     = Object.keys(locationsByState ?? {});
  const cities     = locationState ? (locationsByState[locationState] ?? []) : [];

  // ── Feedback ───────────────────────────────────────────────────────────────
  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 6000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // ── Load categories ────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(`${API_BASE}/addproduct/categories`)
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) showError("Categories failed to load");
      })
      .catch((err) => {
        setCategories([]);
        showError(err.message ?? "Failed to load categories");
      });
  }, [showError]);

  // ── Resume or clear stale payment session ─────────────────────────────────
  // If the user navigated away mid-payment, restore the session (≤30 min old)
  // so they can complete it without restarting. Otherwise clear it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PAYMENT);
      if (!saved) return;
      const session = JSON.parse(saved);
      if (Date.now() - session.createdAt > 30 * 60 * 1000) {
        localStorage.removeItem(STORAGE_PAYMENT);
        return;
      }
      setPaymentData(session);
      showSuccess("💳 Incomplete payment found — tap 'Complete Payment' to finish");
    } catch {
      localStorage.removeItem(STORAGE_PAYMENT);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore draft ──────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT);
      if (!raw) return;
      const draft = JSON.parse(raw);
      const f = draft.form ?? {};

      setForm({
        title:          f.title          ?? "",
        description:    f.description    ?? "",
        price:          f.price          ?? "",
        category_id:    f.category_id    ?? "",
        subcategory_id: f.subcategory_id ?? "",
        attributes: {
          ...INITIAL_FORM.attributes,
          ...(f.attributes ?? {}),
          features: toArray(f.attributes?.features),
        },
        delivery: {
          available: f.delivery?.available ?? false,
          duration: {
            from: f.delivery?.duration?.from ?? "",
            to:   f.delivery?.duration?.to   ?? "",
          },
          fee:  f.delivery?.fee  ?? "",
          note: f.delivery?.note ?? "",
        },
        contact: {
          phone:         f.contact?.phone         ?? "",
          whatsapp:      f.contact?.whatsapp      ?? "",
          whatsapp_link: f.contact?.whatsapp_link ?? "",
          email:         f.contact?.email         ?? "",
          preferred:     f.contact?.preferred     ?? "chat",
        },
      });
      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");
      
      // Look up the exact plan from our static promotionPlans file based on saved ID
      const savedPlan = promotionPlans.find((p) => String(p.id) === String(draft.selectedPlan));
      setSelectedPlan(savedPlan ?? null);
      
      showSuccess("Draft restored");
    } catch {
      showError("Draft restore failed");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_DRAFT, JSON.stringify({
          form,
          locationState,
          city,
          imagesCount:  images.length,
          selectedPlan: selectedPlan?.id ?? null,
        }));
      } catch { /* storage full — ignore */ }
    }, 1000);
    return () => clearTimeout(t);
  }, [form, locationState, city, images.length, selectedPlan, STORAGE_DRAFT]);

  // ── Revoke object URLs on unmount ─────────────────────────────────────────
  // imagesRef always points to the latest array, so the [] cleanup captures
  // all images that existed at unmount, not just those at mount time.
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    };
  }, []);

  // ── Form updaters ──────────────────────────────────────────────────────────
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
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
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

  // ── Resume payment ─────────────────────────────────────────────────────────
  const resumePayment = useCallback(() => {
    if (!paymentData?.authUrl) return;
    window.open(paymentData.authUrl, "_blank");
  }, [paymentData]);

  // ── Clear draft ────────────────────────────────────────────────────────────
  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setLocationState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    setDetectedCoords(null);
    setAgreedToTerms(false);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    showSuccess("Draft cleared");
  }, [STORAGE_DRAFT, showSuccess]);

  // ── Location detection ─────────────────────────────────────────────────────
  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      showError("Location detection not supported");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "User-Agent": "minimart-app/1.0" } }
          );
          const data = await res.json();
          const addr = data.address ?? {};
          const rawState = addr.state ?? addr.region ?? "";
          const rawCity  = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.county ?? "";

          if (rawState) {
            const matched = Object.keys(locationsByState).find(
              (s) => s.toLowerCase().includes(rawState.toLowerCase()) ||
                     rawState.toLowerCase().includes(s.toLowerCase())
            );
            if (matched) {
              setLocationState(matched);
              const cityList    = locationsByState[matched] ?? [];
              const matchedCity = cityList.find(
                (c) => c.toLowerCase().includes(rawCity.toLowerCase()) ||
                       rawCity.toLowerCase().includes(c.toLowerCase())
              );
              if (matchedCity) setCity(matchedCity);
            }
          }
          setDetectedCoords({ latitude, longitude });
          showSuccess("📍 Location detected");
        } catch {
          setDetectedCoords({ latitude, longitude });
          showSuccess("📍 GPS captured — fill state/city manually");
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        setDetectingLocation(false);
        const msgs = { 1: "Permission denied", 2: "Location unavailable", 3: "Request timed out" };
        showError(msgs[err.code] ?? "Location detection failed");
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }, [showError, showSuccess]);

  // ── Image handling ─────────────────────────────────────────────────────────
  const handleImages = useCallback(async (files) => {
    if (images.length >= MAX_IMAGES) { showError("Maximum 6 images allowed"); return; }
    const remaining  = MAX_IMAGES - images.length;
    const validFiles = Array.from(files)
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
      .slice(0, remaining);

    if (!validFiles.length) { showError("Images must be under 3 MB each"); return; }

    try {
      const compressed = await Promise.all(
        validFiles.map((f) =>
          imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true })
            .catch(() => f)
        )
      );
      const newImages = compressed.map((file) => ({
        id:      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newImages]);
      showSuccess(`${newImages.length} image(s) added`);
    } catch {
      showError("Image processing failed");
    }
  }, [images.length, showError, showSuccess]);

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    if (!form.title?.trim())                                          return "Title required";
    if (!form.description?.trim())                                    return "Description required";
    if (!form.price || Number(form.price) <= 0)                       return "Enter a valid price";
    if (!form.category_id)                                            return "Category required";
    if (!form.contact?.email?.includes("@"))                          return "Enter a valid email";
    if (!form.contact?.phone || form.contact.phone.length < 10)       return "Phone must be at least 10 digits";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10) return "WhatsApp number required";
    if (!images.length)                                               return "At least one image required";
    if (!locationState || !city)                                      return "Select your state and city";
    if (!agreedToTerms)                                               return "Please accept the Terms & Conditions";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to   = Number(form.delivery.duration.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return "Enter valid delivery days";
      if (to < from)                                       return "Delivery end must be after start";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) return "Enter a valid delivery fee";
    }
    return null;
  }, [form, images.length, locationState, city, agreedToTerms]);

  // ── Submit orchestration ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const err = validateForm();
    if (err) { showError(err); isSubmittingRef.current = false; return; }

    setLoading(true);
    setError("");
    let product = null;

    try {
      // Resolve final plan — fall back to free if none selected
      const finalPlan =
        selectedPlan ??
        promotionPlans.find((p) => Number(p.price) === 0) ??
        null;

      if (!finalPlan) throw new ApiError("No promotion plan available in config", 400);

      // Force integer parsing so it passes backend's `cleanInt` verification
      const planIdInt = parseInt(finalPlan.id, 10);
      if (Number.isNaN(planIdInt)) {
        throw new ApiError("Invalid Plan ID in config. IDs must be numeric.", 400);
      }

      const isFreePlan = Number(finalPlan.price) === 0;

      // ── Step 1: Create product ───────────────────────────────────────────
      {
        const token = getToken();
        if (!token) throw new ApiError("Authentication required — please log in", 401);

        const fd = new FormData();
        fd.append("title",          form.title.trim());
        fd.append("description",    form.description.trim());
        fd.append("price",          Number(form.price).toFixed(2));
        fd.append("category_id",    form.category_id);
        if (form.subcategory_id)
          fd.append("subcategory_id", form.subcategory_id);
        fd.append("location_state", locationState ?? "");
        fd.append("location_city",  city ?? "");
        fd.append("status",         isFreePlan ? "active" : "draft");
        fd.append("is_active",      isFreePlan ? "true"   : "false");

        if (detectedCoords) {
          fd.append("latitude",  String(detectedCoords.latitude));
          fd.append("longitude", String(detectedCoords.longitude));
        }

        const safeAttributes = { ...attributes, features: toArray(attributes.features) };
        fd.append("attributes",      JSON.stringify(safeAttributes));
        fd.append("delivery",        JSON.stringify(form.delivery));
        fd.append("contact",         JSON.stringify(form.contact));
        fd.append("phone",           form.contact.phone         ?? "");
        fd.append("whatsapp",        form.contact.whatsapp      ?? "");
        fd.append("whatsapp_link",   form.contact.whatsapp_link ?? "");
        fd.append("idempotency_key", crypto.randomUUID());
        fd.append("seller_name",     user?.store_name || user?.name || "Minimart");
        images.forEach((img) => fd.append("images", img.file));

        const data = await multipartPost(`${API_BASE}/addproduct/products`, fd, token);
        if (!data.product?.id) throw new ApiError("Product creation failed", 500);
        product = data.product;
      }

      // ── Step 2a: Free plan — activate with null promotion_id ────────────
      if (isFreePlan) {
        const token = getToken();
        await apiFetch(`${API_BASE}/addproduct/products/${product.id}/activate`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ promotion_id: null }),
        });
        clearDraft();
        showSuccess("✅ Product live! Redirecting…");
        setTimeout(() => { window.location.href = "/"; }, 1500);
        return;
      }

      // ── Step 2b: Paid plan — initiate Paystack payment ──────────────────
      {
        const token = getToken();
        const rawPrice     = Number(finalPlan.price);
        const discount     = Number(finalPlan.discount ?? 0);
        const effectiveAmt = Number((rawPrice * (1 - discount / 100)).toFixed(2));

        const data = await apiFetch(`${API_BASE}/payment/initiate`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email:      form.contact.email,
            amount:     effectiveAmt,
            plan_id:    planIdInt, // CRITICAL: This is now safely parsed as an Integer
            product_id: product.id,
          }),
        });

        if (!data.authorization_url)
          throw new ApiError("Payment setup failed — please try again", 500);

        const session = {
          reference: data.reference,
          authUrl:   data.authorization_url,
          planId:    planIdInt,
          productId: product.id,
          email:     form.contact.email,
          amount:    effectiveAmt,
          createdAt: Date.now(),
        };
        localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(session));
        setPaymentData(session);
        showSuccess("💳 Redirecting to payment…");
        window.open(data.authorization_url, "_blank");
      }

    } catch (err) {
      console.error("Submit error:", err);

      if (product?.id) {
        const token = getToken();
        if (token) {
          fetch(`${API_BASE}/addproduct/products/${product.id}`, {
            method:  "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
      showError(err.message ?? "Submission failed — please try again");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    loading, validateForm, selectedPlan, form, attributes, images,
    locationState, city, detectedCoords, clearDraft, showError, showSuccess,
    STORAGE_DRAFT, user
  ]);

  // ── Terms checkbox ─────────────────────────────────────────────────────────
  const TermsCheckbox = (
    <div className="terms-checkbox-row">
      <label className="terms-checkbox-label">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
        />
        <span>
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer">
            Terms &amp; Conditions
          </Link>
        </span>
      </label>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="add-product-container">
      <ProductComponents
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
        MAX_IMAGES={MAX_IMAGES}
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
        handleSubmit={handleSubmit}
        clearDraft={clearDraft}
        detectLocation={detectLocation}
        resumePayment={resumePayment}
        displayPrice={displayPrice}
        formatLabel={formatLabel}
        onlyNumbers={onlyNumbers}
        onlyDigits={onlyDigits}
      />
    </div>
  );
}