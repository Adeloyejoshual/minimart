import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import ProductComponents from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans }   from "../config/promotions.js";
import { apiFetch, ApiError } from "../utils/apiFetch.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_PAYMENT = "payment_retry";
const API_BASE        = "https://minimart-ivrm.onrender.com/api";
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
    features:         [],   // always array — never string
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

const displayPrice = (v) => {
  const num = Number(v);
  return Number.isNaN(num) || num <= 0
    ? ""
    : new Intl.NumberFormat("en-NG").format(num);
};

const formatLabel = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const getToken = () => localStorage.getItem("token");

/** Always returns a real array — guards against corrupted draft restoring a string */
const toArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Raw multipart POST — never use apiFetch for FormData because apiFetch
 * typically hard-codes Content-Type: application/json, which overwrites the
 * multipart/form-data boundary that the browser must set automatically.
 */
const multipartPost = async (url, formData, token) => {
  const response = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // ← intentionally NO Content-Type — browser sets multipart boundary
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data?.message ?? `Request failed (${response.status})`;
    throw new ApiError(msg, response.status);
  }

  return data;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddProductPage({ user }) {
  // Scope draft to the logged-in user so switching accounts never leaks a
  // previous user's draft into a new session.
  const STORAGE_DRAFT = `product_draft_${user?.id ?? "anon"}`;

  const [form,          setForm]          = useState(INITIAL_FORM);
  const [categories,    setCategories]    = useState([]);
  const [locationState, setLocationState] = useState("");
  const [city,          setCity]          = useState("");
  const [images,        setImages]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedPlan,  setSelectedPlan]  = useState(null);
  const [paymentData,   setPaymentData]   = useState(null);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords,    setDetectedCoords]    = useState(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)) ?? null,
    [categories, form.category_id]
  );

  const options    = selectedCategory?.dynamicOptions ?? {};
  const attributes = form.attributes ?? INITIAL_FORM.attributes;
  const states     = Object.keys(locationsByState ?? {});
  const cities     = locationState ? (locationsByState[locationState] ?? []) : [];

  // ── Feedback ───────────────────────────────────────────────────────────────

  const showError = useCallback((msg) => {
    setError(msg);
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    const t = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(t);
  }, []);

  // ── Load categories ────────────────────────────────────────────────────────

  useEffect(() => {
    apiFetch(`${API_BASE}/addproduct/categories`)
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          setCategories([]);
          showError("Categories data malformed");
        }
      })
      .catch((err) => {
        setCategories([]);
        showError(err.message ?? "Failed to load categories");
      });
  }, [showError]);

  // ── Clear stale payment session ────────────────────────────────────────────

  useEffect(() => {
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  // ── Restore draft ──────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (!saved) return;
      const draft = JSON.parse(saved);

      setForm({
        title:          draft.form?.title          ?? "",
        description:    draft.form?.description    ?? "",
        price:          draft.form?.price          ?? "",
        category_id:    draft.form?.category_id    ?? "",
        subcategory_id: draft.form?.subcategory_id ?? "",
        attributes: {
          ...INITIAL_FORM.attributes,
          ...(draft.form?.attributes ?? {}),
          // Hard guard — never restore features as a string
          features: toArray(draft.form?.attributes?.features),
        },
        delivery: {
          available: draft.form?.delivery?.available ?? false,
          duration: {
            from: draft.form?.delivery?.duration?.from ?? "",
            to:   draft.form?.delivery?.duration?.to   ?? "",
          },
          fee:  draft.form?.delivery?.fee  ?? "",
          note: draft.form?.delivery?.note ?? "",
        },
        contact: {
          phone:         draft.form?.contact?.phone         ?? "",
          whatsapp:      draft.form?.contact?.whatsapp      ?? "",
          whatsapp_link: draft.form?.contact?.whatsapp_link ?? "",
          email:         draft.form?.contact?.email         ?? "",
          preferred:     draft.form?.contact?.preferred     ?? "chat",
        },
      });

      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");
      setSelectedPlan(
        promotionPlans.find((p) => p.id === draft.selectedPlan) ?? null
      );
      showSuccess("Draft restored");
    } catch (err) {
      console.error("Draft restore error:", err);
      showError("Draft restore failed");
    }
  }, [showSuccess, showError]);

  // ── Auto-save draft ────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            form,
            locationState,
            city,
            imagesCount:  images.length,
            selectedPlan: selectedPlan?.id ?? null,
          })
        );
      } catch (err) {
        console.error("Draft save error:", err);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [form, locationState, city, images.length, selectedPlan]);

  // ── Revoke object URLs on unmount ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    };
  }, [images]);

  // ── Form updaters ──────────────────────────────────────────────────────────

  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const updated = { ...prev.attributes, [key]: value };
      if (key === "brand")     updated.model       = "";
      if (key === "condition") updated.used_detail = "";
      return { ...prev, attributes: updated };
    });
  }, []);

  const updateContact = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }, []);

  const updateDelivery = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
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

  /**
   * Coerces features to array before every mutation — prevents character-split
   * bug if state was somehow corrupted.
   */
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
  }, [showSuccess]);

  // ── Location detection ─────────────────────────────────────────────────────

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      showError("Your browser doesn't support location detection");
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;

        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "User-Agent": "minimart-app/1.0" } }
          );
          const data = await res.json();
          const addr = data.address ?? {};

          const rawState =
            addr.state ?? addr.region ?? "";
          const rawCity  =
            addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.county ?? "";

          if (rawState) {
            const matched = Object.keys(locationsByState).find(
              (s) =>
                s.toLowerCase().includes(rawState.toLowerCase()) ||
                rawState.toLowerCase().includes(s.toLowerCase())
            );
            if (matched) {
              setLocationState(matched);

              if (rawCity) {
                const cityList    = locationsByState[matched] ?? [];
                const matchedCity = cityList.find(
                  (c) =>
                    c.toLowerCase().includes(rawCity.toLowerCase()) ||
                    rawCity.toLowerCase().includes(c.toLowerCase())
                );
                if (matchedCity) setCity(matchedCity);
              }
            }
          }

          setDetectedCoords({ latitude, longitude });
          showSuccess("📍 Location detected");
        } catch {
          // Reverse geocode failed — still store raw coords for backend
          setDetectedCoords({ latitude, longitude });
          showSuccess("📍 GPS captured — fill state/city manually");
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        setDetectingLocation(false);
        const messages = {
          1: "Location permission denied",
          2: "Location unavailable",
          3: "Location request timed out",
        };
        showError(messages[err.code] ?? "Location detection failed");
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }, [showError, showSuccess]);

  // ── Image handling ─────────────────────────────────────────────────────────

  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB:        1,
        maxWidthOrHeight: 1280,
        useWebWorker:     true,
      });
    } catch {
      return file;
    }
  };

  const handleImages = useCallback(
    async (files) => {
      if (images.length >= MAX_IMAGES) {
        showError("Maximum 6 images allowed");
        return;
      }
      const remaining  = MAX_IMAGES - images.length;
      const validFiles = Array.from(files)
        .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
        .slice(0, remaining);

      if (!validFiles.length) {
        showError("Please select valid images (under 3 MB each)");
        return;
      }

      try {
        const compressed = await Promise.all(validFiles.map(compressImage));
        const newImages  = compressed.map((file) => ({
          id:      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
        setImages((prev) => [...prev, ...newImages]);
        showSuccess(`${newImages.length} image(s) added`);
      } catch (err) {
        console.error("Image processing error:", err);
        showError("Image processing failed");
      }
    },
    [images.length, showError, showSuccess]
  );

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateForm = useCallback(() => {
    if (!form.title?.trim())                                    return "Title required";
    if (!form.description?.trim())                              return "Description required";
    if (!form.price || Number(form.price) <= 0)                 return "Enter a valid price";
    if (!form.category_id)                                      return "Category required";
    if (!form.contact?.email?.includes("@"))                    return "Enter a valid email address";
    if (!form.contact?.phone || form.contact.phone.length < 10) return "Phone must be at least 10 digits";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10)
                                                                return "WhatsApp number required";
    if (!images.length)                                         return "At least one image is required";
    if (!locationState || !city)                                return "Select your state and city";
    if (!agreedToTerms)                                         return "Please accept the Terms & Conditions";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to   = Number(form.delivery.duration.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return "Enter valid delivery days";
      if (to < from)                                       return "Delivery end must be after start";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
                                                           return "Enter a valid delivery fee";
    }

    return null;
  }, [form, images.length, locationState, city, agreedToTerms]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (loading) return;

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    // ── createProduct ──────────────────────────────────────────────────────
    const createProduct = async (status = "draft") => {
      const token = getToken();
      if (!token) throw new ApiError("Authentication required. Please log in.", 401);

      const safeAttributes = {
        ...attributes,
        features: toArray(attributes.features),
      };

      const fd = new FormData();
      fd.append("title",          form.title.trim());
      fd.append("description",    form.description.trim());
      fd.append("price",          Number(form.price).toFixed(2));
      fd.append("category_id",    form.category_id);
      if (form.subcategory_id)
        fd.append("subcategory_id", form.subcategory_id);
      fd.append("location_state", locationState ?? "");
      fd.append("location_city",  city          ?? "");
      fd.append("status",         status);
      fd.append("is_active",      status === "active" ? "true" : "false");

      if (detectedCoords) {
        fd.append("latitude",  String(detectedCoords.latitude));
        fd.append("longitude", String(detectedCoords.longitude));
      }

      fd.append("attributes",    JSON.stringify(safeAttributes));
      fd.append("delivery",      JSON.stringify(form.delivery));
      fd.append("contact",       JSON.stringify(form.contact));
      fd.append("phone",         form.contact.phone         ?? "");
      fd.append("whatsapp",      form.contact.whatsapp      ?? "");
      fd.append("whatsapp_link", form.contact.whatsapp_link ?? "");

      images.forEach((img) => fd.append("images", img.file));

      // ⚠️  Use raw fetch — NOT apiFetch — for multipart/form-data.
      // apiFetch sets Content-Type: application/json, which destroys the
      // multipart boundary that multer needs on the server.
      const data = await multipartPost(
        `${API_BASE}/addproduct/products`,
        fd,
        token
      );

      if (!data.product?.id)
        throw new ApiError("Product creation response invalid", 500);
      return data.product;
    };

    // ── activateFreePlan ───────────────────────────────────────────────────
    // Free plans do NOT have a promotion_plans DB row — sending null tells
    // the activate route to skip the plan lookup and just set status=active.
    // Sending selectedPlan?.id caused "Promotion plan not found" because
    // the frontend config ID never matched the DB table.
    const activateFreePlan = async (productId) => {
      const token = getToken();
      if (!token) throw new ApiError("Authentication required", 401);

      return apiFetch(
        `${API_BASE}/addproduct/products/${productId}/activate`,
        {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${token}`,
          },
          body: JSON.stringify({ promotion_id: null }),
        }
      );
    };

    // ── initPayment ────────────────────────────────────────────────────────
    const initPayment = async (productId) => {
      const token = getToken();
      if (!token) throw new ApiError("Authentication required", 401);

      // Apply discount if the plan has one — server re-validates this
      const rawPrice = Number(selectedPlan?.price ?? 0);
      const discount = Number(selectedPlan?.discount ?? 0);
      const effectiveAmount = discount > 0
        ? Math.round(rawPrice * (1 - discount / 100))
        : rawPrice;

      const data = await apiFetch(`${API_BASE}/payment/initiate`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          email:      form.contact.email,
          amount:     effectiveAmount,
          plan_id:    selectedPlan?.id,
          product_id: productId,
        }),
      });

      if (!data.authorization_url)
        throw new ApiError("Payment setup failed — please try again", 500);
      return { reference: data.reference, authUrl: data.authorization_url };
    };

    // ── Orchestration ──────────────────────────────────────────────────────

    setLoading(true);
    setError("");
    let product = null;

    try {
      // Fall back to the free plan if the user hasn't explicitly chosen one
      const finalPlan =
        selectedPlan ??
        promotionPlans.find((p) => Number(p.price) === 0) ??
        null;

      if (!finalPlan) {
        throw new ApiError(
          "No promotion plan selected and no free plan is available",
          400
        );
      }

      const isFreePlan = Number(finalPlan.price) === 0;

      product = await createProduct(isFreePlan ? "active" : "draft");

      if (isFreePlan) {
        await activateFreePlan(product.id);
        clearDraft();
        showSuccess("✅ Product live! Redirecting...");
        setTimeout(() => { window.location.href = "/"; }, 1500);
        return;
      }

      const paymentRes     = await initPayment(product.id);
      const paymentSession = {
        reference: paymentRes.reference,
        authUrl:   paymentRes.authUrl,
        planId:    finalPlan.id,
        productId: product.id,
        email:     form.contact.email,
        amount:    Number(finalPlan.price),
        createdAt: Date.now(),
      };

      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentSession));
      setPaymentData(paymentSession);
      showSuccess("💳 Redirecting to payment...");
      window.open(paymentRes.authUrl, "_blank");

    } catch (err) {
      console.error("Submit error:", err);

      // Best-effort cleanup: delete the draft product if payment setup failed
      if (product?.id) {
        const token = getToken();
        if (token) {
          fetch(`${API_BASE}/addproduct/products/${product.id}`, {
            method:  "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch((e) => console.warn("Draft cleanup failed:", e));
        }
      }

      showError(err.message ?? "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

  // ── Props ──────────────────────────────────────────────────────────────────

  const componentProps = {
    form,
    attributes,
    images,
    state: locationState,
    city,
    categories,
    selectedPlan,
    paymentData,
    loading,
    error,
    success,
    states,
    cities,
    options,
    selectedCategory,
    detectedCoords,
    detectingLocation,
    agreedToTerms,
    TermsCheckbox,
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    setState:     setLocationState,
    setCity,
    setSelectedPlan,
    handleImages,
    removeImage,
    handleSubmit,
    clearDraft,
    detectLocation,
    displayPrice,
    formatLabel,
    onlyNumbers,
    onlyDigits,
    INITIAL_FORM,
    promotionPlans,
    MAX_IMAGES,
  };

  return (
    <div className="add-product-container">
      <ProductComponents {...componentProps} />
    </div>
  );
}
