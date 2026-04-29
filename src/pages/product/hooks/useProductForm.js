// src/pages/product/hooks/useProductForm.js
import { useState, useCallback, useMemo } from "react";
import imageCompression from "browser-image-compression";

import {
  fetchCategories,
  createProduct,
  deleteProduct,
} from "../api/productApi.js";
import { initPayment, activateFreeProduct } from "../api/paymentApi.js";
import { promotionPlans } from "../../config/promotions.js";
import { categoryFields } from "../../config/categoryFields.js";

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

const MAX_IMAGES = 6;
const MAX_SIZE = 3 * 1024 * 1024;

const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");

const displayPrice = (v) => {
  const num = Number(v);
  return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
};

export function useProductForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)) || null,
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes || INITIAL_FORM.attributes;

  const normalizeOptions = useCallback((list) => {
    if (!list) return [];
    return Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [];
  }, []);

  const fields = useMemo(() => {
    const backendFields = Array.isArray(options.fields) ? options.fields : [];
    const categoryName = selectedCategory?.name;
    const frontendFields = categoryFields[categoryName] || [];
    return [...new Set([...backendFields, ...frontendFields])].filter(Boolean);
  }, [options.fields, selectedCategory?.name]);

  const optionsMap = useMemo(
    () => ({
      brand: normalizeOptions(options.brands),
      model: options.models || {},
      color: normalizeOptions(options.colors),
      condition: normalizeOptions(options.conditions),
      used_detail: normalizeOptions(options.usedDetails || options.used_details),
      ram: normalizeOptions(options.ram),
      storage: normalizeOptions(options.storage),
      sim: normalizeOptions(options.sim),
      features: Array.isArray(options.features) ? options.features : [],
      year: normalizeOptions(options.years),
      engine: normalizeOptions(options.engines || options.engine),
      fuel_type: normalizeOptions(options.fuel_types || options.fuelType),
      size: normalizeOptions(options.size),
      age_range: normalizeOptions(options.age_range),
      bedrooms: normalizeOptions(options.bedrooms),
      bathrooms: normalizeOptions(options.bathrooms),
      experience_level: normalizeOptions(options.experience_level),
      skills: normalizeOptions(options.skills),
    }),
    [options, normalizeOptions]
  );

  const modelOptions = useMemo(() => {
    if (!options.models || !attributes?.brand) return [];
    const matchKey = Object.keys(options.models).find(
      (k) => k.toLowerCase() === attributes.brand.toLowerCase()
    );
    return normalizeOptions(matchKey ? options.models[matchKey] || [] : []);
  }, [attributes?.brand, options.models, normalizeOptions]);

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // --- API init ---
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // --- Categories ---
  const fetchCat = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch {
      setCategories([]);
      showError("Failed to load categories");
    }
  }, [showError]);

  // Run once
  if (categories.length === 0) {
    fetchCat();
  }

  // --- Form update helpers ---
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

  // --- Validation ---
  const validateForm = useCallback(() => {
    if (!form.title?.trim() || form.title.length < 10)
      return "Title must be at least 10 characters";
    if (!form.description?.trim() || form.description.length < 20)
      return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Valid price required";
    if (!form.category_id) return "Please select a category";
    if (!form.contact?.phone || form.contact.phone.length < 10)
      return "Valid phone required";
    if (!form.contact?.email?.includes("@")) return "Valid email required";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10)
      return "WhatsApp required";

    if (!token) return "No authentication token; please log in again";

    return null;
  }, [form, token]);

  // --- Clear draft ---
  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setSelectedPlan(null);
    showSuccess("Draft cleared");
  }, [showSuccess]);

  // --- Create product + payment flow ---
  const handleSubmit = useCallback(
    async (images, state, city) => {
      if (loading) return;

      const validationError = validateForm();
      if (validationError) return showError(validationError);

      setLoading(true);
      setError("");

      let product = null;

      try {
        const finalPlan = selectedPlan ?? promotionPlans.find((p) => Number(p.price) === 0);
        if (!finalPlan) throw new Error("No promotion plan available");

        const fd = new FormData();
        fd.append("title", form.title.trim());
        fd.append("description", form.description.trim());
        fd.append("price", Number(form.price).toString());
        fd.append("category_id", form.category_id);
        fd.append("subcategory_id", form.subcategory_id || "");
        fd.append("attributes", JSON.stringify(form.attributes));
        fd.append("delivery", JSON.stringify(form.delivery));
        fd.append("contact", JSON.stringify(form.contact));
        fd.append("location_state", state);
        fd.append("location_city", city);

        const compressedFiles = await Promise.all(
          images.map((img) =>
            imageCompression(img.file, {
              maxSizeMB: 1,
              maxWidthOrHeight: 1280,
              useWebWorker: true,
            })
          )
        );
        compressedFiles.forEach((file) => fd.append("images", file));

        product = await createProduct(token, fd);

        if (!product?.id) throw new Error("Failed to create product");

        if (Number(finalPlan.price) === 0) {
          await activateFreeProduct(token, product.id, finalPlan.id);
          clearDraft();
          showSuccess("Product created and published!");
          return;
        }

        const paymentRes = await initPayment(token, {
          email: form.contact.email,
          amount: Number(finalPlan.price),
          plan_id: finalPlan.id,
          product_id: product.id,
        });

        const paymentSession = {
          reference: paymentRes.reference,
          authUrl: paymentRes.authUrl,
          planId: finalPlan.id,
          productId: product.id,
          email: form.contact.email,
          amount: Number(finalPlan.price),
          createdAt: Date.now(),
        };

        setForm((prev) => ({
          ...prev,
          paymentData: paymentSession,
        }));
        showSuccess("Redirecting to payment...");
        window.open(paymentRes.authUrl, "_blank");
      } catch (err) {
        if (product?.id) {
          try {
            await deleteProduct(token, product.id);
          } catch {}
        }
        showError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [
      form,
      selectedPlan,
      validateForm,
      showError,
      showSuccess,
      clearDraft,
      token,
    ]
  );

  return {
    form: {
      ...form,
      priceDisplay: displayPrice(form.price),
      delivery: {
        ...form.delivery,
        feeDisplay: form.delivery.available
          ? displayPrice(form.delivery.fee)
          : "",
      },
    },
    categories,
    categoryOptions: optionsMap,
    fields,
    options,
    attributes,
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    selectedPlan,
    setSelectedPlan,
    handleSubmit,
    clearDraft,
    loading,
    error,
    success,
  };
}