import { useEffect, useMemo, useState, useCallback } from "react";
import ProductComponents from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

/* ===================== STORAGE KEYS ===================== */
const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

/* ===================== INITIAL STATE ===================== */
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

/* ===================== MAIN COMPONENT ===================== */
export default function AddProductPage() {
  /* ===================== STATE ===================== */
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

  /* ===================== DERIVED STATE ===================== */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] || [] : [];

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)) || null,
    [categories, form.category_id]
  );

  const attributes = form.attributes || INITIAL_FORM.attributes;
  const options = selectedCategory?.dynamicOptions || {};

  /* ===================== UI HELPERS ===================== */
  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }, []);

  const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
  const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");

  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isFinite(num) && num > 0
      ? new Intl.NumberFormat("en-NG").format(num)
      : "";
  };

  /* ===================== FETCH CATEGORIES ===================== */
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        if (!res.ok) throw new Error();

        const data = await res.json();
        setCategories(data);
      } catch {
        setCategories([]);
        showError("Failed to load categories");
      }
    };

    loadCategories();
  }, [showError]);

  /* ===================== DRAFT RESTORE ===================== */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (!saved) return;

      const d = JSON.parse(saved);

      setForm(d.form || INITIAL_FORM);
      setState(d.state || "");
      setCity(d.city || "");
      setSelectedPlan(
        promotionPlans.find((p) => p.id === d.selectedPlan) || null
      );

      showSuccess("Draft restored");
    } catch {
      showError("Failed to restore draft");
    }
  }, [showError, showSuccess]);

  /* ===================== AUTO SAVE DRAFT ===================== */
  useEffect(() => {
    const t = setTimeout(() => {
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
      } catch {}
    }, 800);

    return () => clearTimeout(t);
  }, [form, state, city, images.length, selectedPlan]);

  /* ===================== FORM UPDATES ===================== */
  const updateForm = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttribute = (key, value) =>
    setForm((p) => {
      const attrs = { ...p.attributes, [key]: value };
      if (key === "brand") attrs.model = "";
      if (key === "condition") attrs.used_detail = "";
      return { ...p, attributes: attrs };
    });

  const updateContact = (key, value) =>
    setForm((p) => ({
      ...p,
      contact: { ...p.contact, [key]: value },
    }));

  const updateDelivery = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, [key]: value },
    }));

  const updateDeliveryDuration = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: {
        ...p.delivery,
        duration: { ...p.delivery.duration, [key]: value },
      },
    }));

  const toggleFeature = (feature) =>
    setForm((p) => {
      const list = p.attributes.features || [];
      const exists = list.includes(feature);

      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
            ? list.filter((f) => f !== feature)
            : [...list, feature],
        },
      };
    });

  /* ===================== VALIDATION ===================== */
  const validateForm = useCallback(() => {
    if (!form.title || form.title.length < 10)
      return "Title too short";
    if (!form.description || form.description.length < 20)
      return "Description too short";
    if (!form.price || Number(form.price) <= 0)
      return "Invalid price";
    if (!form.category_id)
      return "Select category";
    if (!form.contact.email?.includes("@"))
      return "Invalid email";
    if (!state || !city)
      return "Select location";
    if (images.length === 0)
      return "Add images";

    return null;
  }, [form, state, city, images.length]);

  /* ===================== CLEAR ===================== */
  const clearDraft = () => {
    setForm(INITIAL_FORM);
    setImages([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    showSuccess("Cleared");
  };

  /* ===================== IMAGE HANDLER ===================== */
  const compress = async (file) =>
    imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
    }).catch(() => file);

  const handleImages = async (files) => {
    const list = Array.from(files || []).slice(0, MAX_IMAGES);

    const processed = await Promise.all(
      list.map(async (file) => ({
        id: Date.now() + Math.random(),
        file: await compress(file),
        preview: URL.createObjectURL(file),
      }))
    );

    setImages((p) => [...p, ...processed]);
    showSuccess(`${processed.length} image(s) added`);
  };

  const removeImage = (id) => {
    setImages((p) => {
      const img = p.find((i) => i.id === id);
      if (img?.preview) URL.revokeObjectURL(img.preview);
      return p.filter((i) => i.id !== id);
    });
  };

  /* ===================== SUBMIT ===================== */
  const handleSubmit = async () => {
    if (loading) return;

    const err = validateForm();
    if (err) return showError(err);

    setLoading(true);

    try {
      const fd = new FormData();

      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("price", form.price);
      fd.append("category_id", form.category_id);
      fd.append("attributes", JSON.stringify(attributes));
      fd.append("delivery", JSON.stringify(form.delivery));
      fd.append("contact", JSON.stringify(form.contact));
      fd.append("location_state", state);
      fd.append("location_city", city);

      const files = await Promise.all(images.map((i) => compress(i.file)));
      files.forEach((f) => fd.append("images", f));

      const token = localStorage.getItem("token");

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showSuccess("Product created!");
      clearDraft();
    } catch (e) {
      showError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  /* ===================== RENDER ===================== */
  return (
    <div className="add-product-container">
      <ProductComponents
        form={form}
        attributes={attributes}
        images={images}
        state={state}
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
        updateForm={updateForm}
        updateAttribute={updateAttribute}
        updateContact={updateContact}
        updateDelivery={updateDelivery}
        updateDeliveryDuration={updateDeliveryDuration}
        toggleFeature={toggleFeature}
        setState={setState}
        setCity={setCity}
        setSelectedPlan={setSelectedPlan}
        handleImages={handleImages}
        removeImage={removeImage}
        handleSubmit={handleSubmit}
        clearDraft={clearDraft}
        displayPrice={displayPrice}
        onlyNumbers={onlyNumbers}
        onlyDigits={onlyDigits}
      />
    </div>
  );
}