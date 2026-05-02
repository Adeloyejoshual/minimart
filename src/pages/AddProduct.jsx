import React, { useEffect, useMemo, useState, useCallback } from "react";
import ProductComponents from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import { apiFetch, ApiError } from "../utils/apiFetch.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT   = "product_draft";
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

// ─── Pure helpers (defined outside component — never recreated) ───────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddProductPage() {
  const [form,         setForm]         = useState(INITIAL_FORM);
  const [categories,   setCategories]   = useState([]);
  const [state,        setState]        = useState("");
  const [city,         setCity]         = useState("");
  const [images,       setImages]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData,  setPaymentData]  = useState(null);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)) ?? null,
    [categories, form.category_id]
  );

  const options    = selectedCategory?.dynamicOptions ?? {};
  const attributes = form.attributes ?? INITIAL_FORM.attributes;
  const states     = Object.keys(locationsByState ?? {});
  const cities     = state ? (locationsByState[state] ?? []) : [];

  // ── Feedback helpers ───────────────────────────────────────────────────────

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // ── Load categories ────────────────────────────────────────────────────────

  useEffect(() => {
    apiFetch(`${API_BASE}/marketplace/categories`)
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
        showError(err.message);
      });
  }, [showError]);

  // ── Clear stale payment session on mount ───────────────────────────────────

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

      setState(draft.state ?? "");
      setCity(draft.city   ?? "");
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
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            form,
            state,
            city,
            imagesCount:  images.length,
            selectedPlan: selectedPlan?.id ?? null,
          })
        );
      } catch (err) {
        console.error("Draft save error:", err);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [form, state, city, images.length, selectedPlan]);

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

  const toggleFeature = useCallback((feature) => {
    setForm((prev) => {
      const features = prev.attributes?.features ?? [];
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
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    showSuccess("Draft cleared successfully");
  }, [showSuccess]);

  // ── Image handling ─────────────────────────────────────────────────────────

  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB:        1,
        maxWidthOrHeight: 1280,
        useWebWorker:     true,
      });
    } catch (err) {
      console.warn("Compression failed, using original:", err);
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
    if (!form.title?.trim())
      return "Title required";
    if (!form.description?.trim())
      return "Description required";
    if (!form.price || Number(form.price) <= 0)
      return "Enter a valid price";
    if (!form.category_id)
      return "Category required";
    if (!form.contact?.phone || form.contact.phone.length < 10)
      return "Phone number must be at least 10 digits";
    if (!form.contact?.email?.includes("@"))
      return "Enter a valid email address";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10)
      return "WhatsApp number required";
    if (!images.length)
      return "At least one image is required";
    if (!state || !city)
      return "Select your state and city";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to   = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to))
        return "Enter valid delivery days";
      if (to < from)
        return "Delivery end must be after start";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter valid delivery fee";
    }

    return null;
  }, [form, images.length, state, city]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  //
  //  createProduct / initPayment / activateFreePlan are defined INSIDE
  //  handleSubmit so they always close over the current render's state
  //  values (form, images, state, city, selectedPlan) and never go stale.

  const handleSubmit = async () => {
    if (loading) return;

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    // ── createProduct ──────────────────────────────────────────────────────
    const createProduct = async (status = "draft") => {
      if (!images.length) throw new ApiError("At least one image is required", 400);

      const token = getToken();
      if (!token) throw new ApiError("Authentication required. Please log in.", 401);

      const fd = new FormData();
      fd.append("title",       form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("price",       Number(form.price).toFixed(2));
      fd.append("category_id", form.category_id);

      if (form.subcategory_id) fd.append("subcategory_id", form.subcategory_id);

      fd.append("location_state", state ?? "");
      fd.append("location_city",  city  ?? "");
      fd.append("status",         status);
      fd.append("is_active",      status === "active" ? "true" : "false");

      fd.append("attributes",    JSON.stringify(attributes));
      fd.append("delivery",      JSON.stringify(form.delivery));
      fd.append("contact",       JSON.stringify(form.contact));
      fd.append("phone",         form.contact.phone         ?? "");
      fd.append("whatsapp",      form.contact.whatsapp      ?? "");
      fd.append("whatsapp_link", form.contact.whatsapp_link ?? "");

      images.forEach((img) => fd.append("images", img.file));

      // Note: do NOT manually set Content-Type when sending FormData.
      // The browser must set it (with the multipart boundary) automatically.
      const data = await apiFetch(`${API_BASE}/marketplace/products`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });

      if (!data.product?.id) throw new ApiError("Product creation response invalid", 500);
      return data.product;
    };

    // ── initPayment ────────────────────────────────────────────────────────
    const initPayment = async (productId) => {
      const token = getToken();
      if (!token) throw new ApiError("Authentication required", 401);

      const data = await apiFetch(`${API_BASE}/payment/initiate`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          email:      form.contact.email,
          amount:     Number(selectedPlan?.price ?? 0),
          plan_id:    selectedPlan?.id,
          product_id: productId,
        }),
      });

      if (!data.authorization_url) throw new ApiError("Payment setup failed", 500);
      return { reference: data.reference, authUrl: data.authorization_url };
    };

    // ── activateFreePlan ───────────────────────────────────────────────────
    const activateFreePlan = async (productId) => {
      const token = getToken();
      if (!token) throw new ApiError("Authentication required", 401);

      return apiFetch(
        `${API_BASE}/marketplace/products/${productId}/activate`,
        {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${token}`,
          },
          body: JSON.stringify({ promotion_id: selectedPlan?.id ?? null }),
        }
      );
    };

    // ── Orchestration ──────────────────────────────────────────────────────

    setLoading(true);
    setError("");
    let product = null;

    try {
      const finalPlan =
        selectedPlan ?? promotionPlans.find((p) => Number(p.price) === 0);

      if (!finalPlan) throw new ApiError("No promotion plan available", 400);

      const isFreePlan = Number(finalPlan.price) === 0;

      product = await createProduct(isFreePlan ? "active" : "draft");
      if (!product?.id) throw new ApiError("Product creation failed", 500);

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

      // Best-effort cleanup — delete orphaned product if anything after
      // createProduct threw (e.g. payment init failed).
      if (product?.id) {
        const token = getToken();
        if (token) {
          fetch(`${API_BASE}/marketplace/products/${product.id}`, {
            method:  "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch((cleanupErr) => console.warn("Cleanup failed:", cleanupErr));
        }
      }

      showError(err.message ?? "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Props passed to presentational layer ──────────────────────────────────

  const componentProps = {
    form,
    attributes,
    images,
    state,
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
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    setState,
    setCity,
    setSelectedPlan,
    handleImages,
    removeImage,
    handleSubmit,
    clearDraft,
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
