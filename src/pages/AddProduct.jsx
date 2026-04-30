import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import ProductComponents from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: {
    brand: "",
    model: "",
    color: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    sim: "",
    year: "",
    engine: "",
    fuel_type: "",
    features: [],
    size: "",
    age_range: "",
    bedrooms: "",
    bathrooms: "",
    experience_level: "",
    skills: "",
  },
  delivery: {
    available: false,
    duration: { from: "", to: "" },
    fee: "",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    whatsapp_link: "",
    email: "",
    preferred: "chat",
  },
};

export default function AddProductPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)) || null,
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes || INITIAL_FORM.attributes;

  const states = Object.keys(locationsByState || {});
  const cities = state ? (locationsByState[state] || []) : [];

  // ✅ Utilities
  const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
  const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");
  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0
      ? ""
      : new Intl.NumberFormat("en-NG").format(num);
  };
  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase());

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // ✅ Effects
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          setCategories([]);
          showError("Categories data malformed");
        }
      })
      .catch(() => {
        setCategories([]);
        showError("Failed to load categories");
      });
  }, [showError]);

  useEffect(() => {
    const savedPayment = localStorage.getItem(STORAGE_PAYMENT);
    if (savedPayment) {
      localStorage.removeItem(STORAGE_PAYMENT);
    }
  }, []);

  // ✅ Draft restore
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (!saved) return;

      const draft = JSON.parse(saved);
      setForm({
        title: draft.form?.title ?? "",
        description: draft.form?.description ?? "",
        price: draft.form?.price ?? "",
        category_id: draft.form?.category_id ?? "",
        subcategory_id: draft.form?.subcategory_id ?? "",
        attributes: {
          ...INITIAL_FORM.attributes,
          ...(draft.form?.attributes || {}),
        },
        delivery: {
          available: draft.form?.delivery?.available ?? false,
          duration: {
            from: draft.form?.delivery?.duration?.from ?? "",
            to: draft.form?.delivery?.duration?.to ?? "",
          },
          fee: draft.form?.delivery?.fee ?? "",
          note: draft.form?.delivery?.note ?? "",
        },
        contact: {
          phone: draft.form?.contact?.phone ?? "",
          whatsapp: draft.form?.contact?.whatsapp ?? "",
          whatsapp_link: draft.form?.contact?.whatsapp_link ?? "",
          email: draft.form?.contact?.email ?? "",
          preferred: draft.form?.contact?.preferred ?? "chat",
        },
      });
      setState(draft.state || "");
      setCity(draft.city || "");
      setSelectedPlan(
        promotionPlans.find((p) => p.id === draft.selectedPlan) || null
      );
      showSuccess("Draft restored");
    } catch (err) {
      console.error("Draft restore error:", err);
      showError("Draft restore failed");
    }
  }, [showSuccess, showError]);

  // ✅ Auto-save draft
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            form,
            state,
            city,
            imagesCount: images.length,
            selectedPlan: selectedPlan?.id || null,
          })
        );
      } catch (err) {
        console.error("Draft save error:", err);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [form, state, city, images.length, selectedPlan?.id]);

  // ✅ Form handlers
  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const updated = { ...prev.attributes, [key]: value };
      if (key === "brand") updated.model = "";
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
      const features = prev.attributes?.features || [];
      const exists = features.includes(feature);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: exists
            ? features.filter((f) => f !== feature)
            : [...features, feature],
        },
      };
    });
  }, []);

  // ✅ Basic validation
  const validateForm = useCallback(() => {
    if (!form.title?.trim()) return "Title required";
    if (!form.description?.trim()) return "Description required";
    if (!form.price || Number(form.price) <= 0)
      return "Enter a valid price";
    if (!form.category_id) return "Category required";
    if (!form.contact?.phone || form.contact.phone.length < 10)
      return "Phone number must be at least 10 digits";
    if (!form.contact?.email?.includes("@"))
      return "Enter a valid email address";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10)
      return "WhatsApp number required";
    if (images.length === 0) return "Upload at least 1 image";
    if (!state || !city) return "Select your state and city";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to))
        return "Enter valid delivery days";
      if (to < from) return "Delivery end must be after start";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter valid delivery fee";
    }
    return null;
  }, [form, images.length, state, city]);

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

  // ✅ Image handling
  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
    } catch (err) {
      console.warn("Image compression failed, falling back to original:", err);
      return file;
    }
  };

  const handleImages = useCallback(async (files) => {
    const currentCount = images.length;
    if (currentCount >= MAX_IMAGES) {
      showError("Maximum 6 images allowed");
      return;
    }

    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - currentCount;
    const validFiles = fileArray
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
      .slice(0, remaining);

    if (validFiles.length === 0) {
      showError("Please select valid images (under 3MB each)");
      return;
    }

    try {
      const compressed = await Promise.all(validFiles.map(compressImage));
      const newImages = compressed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newImages]);
      showSuccess(`${newImages.length} image(s) added`);
    } catch (err) {
      console.error("Image processing error:", err);
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

  // ✅ Post to product API
  const createProduct = async () => {
    const fd = new FormData();

    // CockroachDB required fields
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("price", Number(form.price).toFixed(2));
    fd.append("category_id", form.category_id);
    fd.append("subcategory_id", form.subcategory_id || "");
    fd.append("location_state", state || "");
    fd.append("location_city", city || "");
    fd.append("status", "draft");
    fd.append("is_active", "true");

    // JSONB fields
    fd.append("attributes", JSON.stringify(attributes));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact", JSON.stringify(form.contact));

    // Extra top‑level contact fields
    fd.append("phone", form.contact.phone || "");
    fd.append("whatsapp", form.contact.whatsapp || "");
    fd.append("whatsapp_link", form.contact.whatsapp_link || "");

    // Optional media metadata (JSONB)
    const compressedFiles = await Promise.all(
      images.map((img) => compressImage(img.file))
    );
    const media = {
      images: compressedFiles.map((file, i) => ({
        id: `img_${Date.now()}_${i}`,
        filename: file.name,
        size: file.size,
        mime_type: file.type,
      })),
      videos: [],
    };
    fd.append("media", JSON.stringify(media));
    compressedFiles.forEach((file) => fd.append("images[]", file));

    const token = localStorage.getItem("token");
    if (!token) throw new Error("Authentication required. Please log in.");

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/marketplace/products",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      }
    );

    const text = await res.text();
    if (!res.ok) {
      let message;
      try {
        const err = JSON.parse(text);
        message = err.message || err.error || `HTTP ${res.status}`;
      } catch (_) {
        message = text.substring(0, 100) || `HTTP ${res.status}`;
      }
      throw new Error(message);
    }

    const { product } = JSON.parse(text);
    if (!product || !product.id) {
      throw new Error("Product creation response invalid");
    }

    return product;
  };

  // ✅ Initiate payment (Paystack / Stripe)
  const initPayment = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Authentication required");

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/payment/initiate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: form.contact.email,
          amount: Number(selectedPlan?.price || 0),
          plan_id: selectedPlan?.id,
          product_id: productId,
        }),
      }
    );

    const text = await res.text();
    const data = JSON.parse(text);

    if (!res.ok || !data.success || !data.authorization_url) {
      throw new Error(data.message || "Payment setup failed");
    }

    return {
      reference: data.reference,
      authUrl: data.authorization_url,
    };
  };

  // ✅ Activate free plan (no payment)
  const activateFreePlan = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Authentication required");

    const res = await fetch(
      `https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promotion_id: selectedPlan?.id || null }),
      }
    );

    const text = await res.text();
    const data = JSON.parse(text);

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Activation failed");
    }

    return data;
  };

  // ✅ Submit handler
  const handleSubmit = useCallback(async () => {
    if (loading) return;

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    let product = null;

    try {
      const finalPlan =
        selectedPlan ||
        promotionPlans.find((p) => Number(p.price) === 0);
      if (!finalPlan) {
        throw new Error("No promotion plan available");
      }

      product = await createProduct();
      if (!product?.id) {
        throw new Error("Product creation failed");
      }

      if (Number(finalPlan.price) === 0) {
        await activateFreePlan(product.id);
        clearDraft();
        showSuccess("✅ Product created and published successfully!");
        return;
      }

      // Paid plan flow
      const paymentRes = await initPayment(product.id);
      const paymentSession = {
        reference: paymentRes.reference,
        authUrl: paymentRes.authUrl,
        planId: finalPlan.id,
        productId: product.id,
        email: form.contact.email,
        amount: Number(finalPlan.price),
        createdAt: Date.now(),
      };

      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentSession));
      setPaymentData(paymentSession);
      showSuccess("💳 Redirecting to payment...");
      window.open(paymentRes.authUrl, "_blank");
    } catch (err) {
      console.error("Submit error:", err);
      // Best effort cleanup
      if (product?.id) {
        try {
          const token = localStorage.getItem("token");
          await fetch(
            `https://minimart-ivrm.onrender.com/api/marketplace/products/${product.id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        } catch (cleanupErr) {
          console.warn("Cleanup failed:", cleanupErr);
        }
      }
      showError(err.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    validateForm,
    selectedPlan,
    form.contact.email,
    clearDraft,
    showError,
    showSuccess,
  ]);

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    };
  }, [images]);

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
  };

  return (
    <div className="add-product-container">
      <ProductComponents {...componentProps} />
    </div>
  );
}