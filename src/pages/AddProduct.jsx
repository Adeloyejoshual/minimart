import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
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
  },
  delivery: {
    type: "standard",
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

export default function AddProduct() {
  // Core state
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const imageTimersRef = useRef(new Map());
  const submitRef = useRef(false);

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  // 🔍 Safe UUID generator
  const generateId = useCallback(() => {
    return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }, []);

  const selectedCategory = useMemo(
    () => (Array.isArray(categories) ? categories.find((c) => c.id == form.category_id) : null),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [];

  const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
  const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");

  // ✅ Fixed displayPrice - separate raw vs formatted
  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  };

  const rawPriceDisplay = (v) => v || "";

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase());

  const showError = useCallback((msg) => {
    console.error("❌ Error:", msg);
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    console.log("✅ Success:", msg);
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // 🛡️ Safety: Clear dangerous localStorage on mount
  useEffect(() => {
    const savedPayment = localStorage.getItem(STORAGE_PAYMENT);
    if (savedPayment) {
      console.log("🧹 Cleared dangerous payment data");
      localStorage.removeItem(STORAGE_PAYMENT);
    }
  }, []);

  // 🟦 4. RESTORE PAYMENT SESSION ON RELOAD
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      const isExpired = Date.now() - parsed.createdAt > 30 * 60 * 1000;

      if (isExpired) {
        localStorage.removeItem(STORAGE_PAYMENT);
        showError("Payment session expired. Please start again.");
        return;
      }

      console.log("🔁 Restored payment session:", parsed.reference);
      setPaymentData(parsed);
      showSuccess("Payment session restored. Click 'Go to Payment'.");
    } catch (e) {
      localStorage.removeItem(STORAGE_PAYMENT);
      console.error("Invalid payment session:", e);
    }
  }, [showError, showSuccess]);

  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
    } catch (e) {
      console.warn("Compression failed, using original:", e);
      return file;
    }
  };

  const optionsMap = useMemo(() => ({
    brand: normalizeOptions(options.brands || []),
    model: options.models || {},
    color: normalizeOptions(options.colors || []),
    condition: normalizeOptions(options.conditions || []),
    used_detail: normalizeOptions(options.usedDetails || []),
    ram: normalizeOptions(options.ram || []),
    storage: normalizeOptions(options.storage || []),
    sim: normalizeOptions(options.sim || []),
    features: options.features || [],
    year: normalizeOptions(options.years || []),
    engine: normalizeOptions(options.engines || []),
    fuel_type: normalizeOptions(options.fuel_types || []),
    size: normalizeOptions(options.size || []),
    age_range: normalizeOptions(options.age_range || []),
  }), [options]);

  // ✅ FIXED: Safe fields extraction
  const fields = useMemo(() => {
    const rawFields = selectedCategory?.dynamicOptions?.fields;
    return Array.isArray(rawFields) ? rawFields : [];
  }, [selectedCategory]);

  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const updated = { ...prev.attributes, [key]: value };
      if (key === "brand") updated.model = "";
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
      const features = prev.attributes.features || [];
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

  const validateForm = useCallback(() => {
    if (form.title.length < 10) return "Title must be at least 10 characters";
    if (form.description.length < 20) return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Please enter a valid price";
    if (!form.category_id) return "Please select a category";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Please enter a valid phone number";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Please enter a valid email";
    if (!form.contact.whatsapp || form.contact.whatsapp.length < 10) return "Please enter a valid WhatsApp number";
    if (images.length === 0) return "Please upload at least 1 image";
    if (!state || !city) return "Please select your state and city";

    if (form.delivery.type !== "none" && form.delivery.type !== "pickup") {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Please enter delivery duration";
      if (to < from) return "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) return "Please enter delivery fee";
    }
    return null;
  }, [form, images.length, state, city]);

  // ✅ FIXED: Safe draft saving (no loops)
  useEffect(() => {
    if (loading) return;
    const timeout = setTimeout(() => {
      try {
        const draft = { 
          form, 
          state, 
          city, 
          imagesCount: images.length,
          selectedPlan: selectedPlan?.id || null 
        };
        localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
      } catch (e) {
        console.warn("Draft save failed:", e);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [form.title, form.description, form.price, form.category_id, state, city, selectedPlan?.id, images.length, loading]);

  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    showSuccess("Draft cleared");
  }, [showSuccess]);

  const clearPaymentSession = useCallback(() => {
    localStorage.removeItem(STORAGE_PAYMENT);
    setPaymentData(null);
  }, []);

  const checkPaymentStatus = useCallback(async (reference) => {
    try {
      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/payment/verify/${reference}`
      );
      const data = await res.json();

      if (data.status === "success") {
        clearPaymentSession();
        clearDraft();
        showSuccess("✅ Payment confirmed! Product is now live.");
      }
    } catch (e) {
      console.warn("Payment status check failed:", e);
    }
  }, [clearPaymentSession, clearDraft, showSuccess]);

  useEffect(() => {
    if (!paymentData?.reference) return;

    const interval = setInterval(() => {
      checkPaymentStatus(paymentData.reference);
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentData, checkPaymentStatus]);

  // ✅ FIXED: Safe image handler
  const handleImages = useCallback((files) => {
    if (images.length >= MAX_IMAGES) {
      showError("Maximum 6 images allowed");
      return;
    }
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    const validFiles = fileArray
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
      .slice(0, remaining);

    const newImages = validFiles.map((file) => ({
      id: generateId(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
    showSuccess(`${validFiles.length} image(s) added`);
  }, [images.length, showError, showSuccess, generateId]);

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    const from = dragIndex;
    if (from === null || from === index) return;

    setImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(index, 0, moved);
      return copy;
    });
    setDragIndex(null);
    setIsDragging(false);
  }, [dragIndex]);

  const createProductDraft = async () => {
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("price", Number(form.price).toString());
    fd.append("category_id", form.category_id);
    fd.append("attributes", JSON.stringify(attributes));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact", JSON.stringify(form.contact));
    fd.append("location_state", state);
    fd.append("location_city", city);
    fd.append("promotion_id", selectedPlan?.id || null);

    const imageFiles = images.map((img) => img.file);
    const compressedFiles = await Promise.all(
      imageFiles.map(async (file) => await compressImage(file))
    );
    compressedFiles.forEach((file) => fd.append("images", file));

    const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || "Failed to save product draft");
    }

    return (await res.json()).product;
  };

  const startPayment = async (productId, plan) => {
    const payload = {
      email: form.contact.email,
      planId: plan.id,
      productId,
    };

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/payment/initialize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (!res.ok || !data.success || !data.authorization_url) {
      throw new Error(data.message || "Payment initialization failed");
    }

    const paymentSession = {
      ...payload,
      reference: data.reference,
      authUrl: data.authorization_url,
      createdAt: Date.now(),
    };

    localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentSession));
    return paymentSession;
  };

  const handleSubmit = useCallback(async () => {
    console.log("🚨 handleSubmit MANUALLY TRIGGERED");

    if (loading || submitRef.current) {
      console.log("⛔ Submit blocked (already running)");
      return;
    }
    submitRef.current = true;

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      submitRef.current = false;
      return;
    }

    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    setLoading(true);
    setError("");

    try {
      const product = await createProductDraft();
      const productId = product?.id;
      if (!productId) throw new Error("Failed to create product draft");

      if (finalPlan.price === 0) {
        await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`,
          { method: "POST" }
        );
        clearDraft();
        showSuccess("✅ Product created and activated successfully!");
        return;
      }

      const session = await startPayment(productId, finalPlan);
      setPaymentData(session);
      showSuccess("💳 Payment ready! Click 'Go to Payment' below.");

    } catch (err) {
      console.error("Submit failed:", err);
      showError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      submitRef.current = false;
    }
  }, [form, images, state, city, selectedPlan, validateForm, loading, clearDraft]);

  const manualPaymentRedirect = useCallback(() => {
    if (!paymentData?.authUrl) {
      showError("No payment session available");
      return;
    }
    window.open(paymentData.authUrl, "_blank");
  }, [paymentData, showError]);

  // ✅ FIXED: Safe categories fetch
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error("Categories fetch failed:", e);
        setCategories([]);
        showError("Failed to load categories");
      });
  }, [showError]);

  // Cleanup images
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, [images]);

  const modelOptions = useMemo(() => {
    const brand = attributes.brand;
    if (!brand) return [];
    const models = options.models || {};
    const matchKey = Object.keys(models).find((k) => k.toLowerCase() === brand.toLowerCase());
    return matchKey ? normalizeOptions(models[matchKey]) : [];
  }, [attributes.brand, options.models]);

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] || [] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* Basic Info */}
      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>
        <div className="form-group">
          <label>Product Title <span className="required">*</span></label>
          <input
            placeholder="Enter product title"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Description <span className="required">*</span></label>
          <textarea
            placeholder="Detailed product description"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Price (₦) <span className="required">*</span></label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="10000"
            value={rawPriceDisplay(form.price)}  // ✅ FIXED
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          />
        </div>
      </section>

      {/* Category & Attributes */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>
        <div className="form-group">
          <label>Category <span className="required">*</span></label>
          <DropdownModal
            value={form.category_id}
            onChange={(v) => {
              updateForm("category_id", v);
              updateForm("attributes", INITIAL_FORM.attributes);
            }}
            options={(Array.isArray(categories) ? categories : []).map((c) => ({ 
              id: c?.id || '', 
              name: c?.name || '' 
            }))}  // ✅ FIXED
          />
        </div>

        {optionsMap.brand.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("brand")}</label>
            <DropdownModal
              value={attributes.brand}
              onChange={(v) => updateAttribute("brand", v)}
              options={optionsMap.brand}
            />
          </div>
        )}

        {modelOptions.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("model")}</label>
            <DropdownModal
              value={attributes.model}
              onChange={(v) => updateAttribute("model", v)}
              options={modelOptions}
            />
          </div>
        )}

        {/* ✅ FIXED: Safe fields mapping */}
        {fields.map((field) => {
          if (field === "brand" || field === "model") return null;
          const fieldOptions = optionsMap[field] ?? [];
          if (field !== "features" && fieldOptions.length === 0) return null;
          if (field === "used_detail" && attributes.condition !== "Used") return null;

          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={attributes[field] || ""}
                onChange={(v) => updateAttribute(field, v)}
                options={fieldOptions}
              />
            </div>
          );
        })}

        {/* ✅ FIXED: Safe features mapping */}
        {Array.isArray(optionsMap.features) && optionsMap.features.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline">
              {optionsMap.features
                .slice()
                .sort((a, b) => (a || "").localeCompare(b || ""))
                .map((feature) => (
                  <label key={feature} className="checkbox-inline">
                    <span>{formatLabel(feature)}</span>
                    <input
                      type="checkbox"
                      checked={attributes.features?.includes(feature) || false}
                      onChange={() => toggleFeature(feature)}
                    />
                  </label>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* Contact */}
      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>
        <div className="form-group">
          <label>Email <span className="required">*</span></label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.contact.email}
            onChange={(e) => updateContact("email", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Phone <span className="required">*</span></label>
          <input
            type="text"
            inputMode="tel"
            placeholder="08012345678"
            value={form.contact.phone}
            onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>WhatsApp Number <span className="required">*</span></label>
          <input
            type="text"
            inputMode="tel"
            placeholder="08012345678"
            value={form.contact.whatsapp}
            onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>WhatsApp Link (optional)</label>
          <input
            type="url"
            placeholder="https://wa.me/2348012345678"
            value={form.contact.whatsapp_link}
            onChange={(e) => updateContact("whatsapp_link", e.target.value.trim())}
          />
        </div>
      </section>

      {/* Location & Delivery */}
      <section className="section form-card">
        <h3 className="section-title">Location & Delivery</h3>
        <div className="form-group">
          <label>State <span className="required">*</span></label>
          <DropdownModal
            value={state}
            onChange={setState}
            options={states.map((s) => ({ id: s, name: s }))}
          />
        </div>
        {state && (
          <div className="form-group">
            <label>City <span className="required">*</span></label>
            <DropdownModal
              value={city}
              onChange={setCity}
              options={cities.map((c) => ({ id: c, name: c }))}
            />
          </div>
        )}
        <div className="form-group">
          <label>Delivery Type</label>
          <DropdownModal
            value={form.delivery.type}
            onChange={(value) => updateDelivery("type", value)}  // ✅ FIXED
            options={[
              { id: "none", name: "No delivery" },
              { id: "standard", name: "Standard delivery" },
              { id: "express", name: "Express delivery" },
              { id: "pickup", name: "Pickup only" },
            ]}
          />
        </div>
        {form.delivery.type !== "none" && form.delivery.type !== "pickup" && (
          <div className="delivery-grid sub-grid">
            <div className="form-group">
              <label>From (days) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                value={form.delivery.duration.from}
                onChange={(e) => updateDeliveryDuration("from", onlyDigits(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>To (days) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                value={form.delivery.duration.to}
                onChange={(e) => updateDeliveryDuration("to", onlyDigits(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Fee (₦) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                value={rawPriceDisplay(form.delivery.fee)}  // ✅ FIXED
                onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      {/* Images */}
      <section className="section form-card">
        <h3 className="section-title">Product Images</h3>
        <label className="form-group-label">
          Product Images (max 6, 3MB each) <span className="required">*</span>
        </label>
        <div className="preview-grid-modern image-upload-box">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="preview-thumb"
              draggable
              onClick={() => setActiveImage(img.preview)}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDragIndex(null);
                setIsDragging(false);
              }}
              onDrop={(e) => handleDrop(e, i)}
            >
              <img src={img.preview} alt="" />
              <button onClick={(e) => {
                e.stopPropagation();
                removeImage(img.id);
              }}>
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="add-image-box add-image-btn">
              <input
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) => {
                  handleImages(e.target.files);
                  e.target.value = "";
                }}
              />
              <div>+</div>
              <span>Add Image</span>
            </label>
          )}
        </div>
        {images.length > 0 && <small>{images.length}/6 images</small>}
      </section>

      {/* Promotion Plans */}
      <section className="section form-card">
        <h3 className="section-title">Promotion Plan (Optional)</h3>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="plan-header">
                <strong>{plan.name}</strong>
                <span className="plan-price">₦{displayPrice(plan.price)}</span>
              </div>
              <div className="plan-duration">{plan.duration}</div>
              <ul className="plan-features">
                {plan.features.map((feat, i) => <li key={i}>{feat}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Action Buttons */}
      <div className="button-section section form-card">
        <button 
          className="primary-btn" 
          onClick={handleSubmit} 
          disabled={loading}
        >
          {loading ? "Processing..." : "Create Product"}
        </button>
        {paymentData && (
          <>
            <button 
              className="secondary-btn" 
              onClick={manualPaymentRedirect}
              disabled={loading}
            >
              💳 Go to Payment
            </button>
            <button 
              className="retry-btn" 
              onClick={clearPaymentSession}
              disabled={loading}
            >
              Clear Session
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="form-error">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="form-success">
          <span>✅</span> {success}
        </div>
      )}

      {activeImage && (
        <div className="image-modal" onClick={() => setActiveImage(null)}>
          <img src={activeImage} alt="Full preview" />
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <div className="loading-text">Creating your product...</div>
        </div>
      )}
    </div>
  );
}