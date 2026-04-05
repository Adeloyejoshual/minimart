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
    email: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
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
  const [dragIndex, setDragIndex] = useState(null); // 🔧 6. Added
  const imageTimersRef = useRef(new Map());

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  /* ================= FIXED UTILITIES ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id == form.category_id), // 🔧 9. Fixed
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [];

  // 🔧 1. FIXED regex
  const onlyNumbers = (v = "") => v.replace(/[^d.]/g, "");
  const onlyDigits = (v = "") => v.replace(/D/g, "");
  
  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  };
  
  // 🔧 1. FIXED label formatting
  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase());

  // 🔧 2. Added missing helpers
  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }, []);

  // 🔧 3. Added missing image compression
  const compressImage = async (file) => {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });
  };

  /* ================= DYNAMIC OPTIONS ================= */
  const optionsMap = useMemo(() => {
    const map = {};
    Object.keys(options || {}).forEach((key) => {
      if (key === "models") return;
      if (key === "model") {
        const modelsForBrand = brand && options.model?.[brand] ? options.model[brand] : [];
        map.model = normalizeOptions(modelsForBrand);
        return;
      }
      map[key] = normalizeOptions(options[key] || []);
    });
    return map;
  }, [options, brand, normalizeOptions]);

  const sortedFeatures = useMemo(() => 
    [...(options.features || [])].sort((a, b) => a.localeCompare(b)),
  [options.features]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [options]);

  /* ================= FORM UPDATERS ================= */
  const updateForm = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const updateAttribute = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [key]: value, ...(key === "brand" && { model: "" }) },
    }));
  const updateContact = (key, value) =>
    setForm((p) => ({ ...p, contact: { ...p.contact, [key]: value } }));
  const updateDelivery = (key, value) =>
    setForm((p) => ({ ...p, delivery: { ...p.delivery, [key]: value } }));
  const updateDeliveryDuration = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, duration: { ...p.delivery.duration, [key]: value } },
    }));
  const toggleFeature = (feature) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      const exists = list.includes(feature);
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists ? list.filter((f) => f !== feature) : [...list, feature],
        },
      };
    });
  };

  /* ================= VALIDATION ================= */
  const validateForm = () => {
    if (form.title.length < 10) return "Title must be at least 10 characters";
    if (form.description.length < 20) return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Please enter a valid price";
    if (!form.category_id) return "Please select a category";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Please enter a valid phone number";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Please enter a valid email";
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
  };

  /* ================= DRAFT ================= */
  const saveDraft = useCallback(() => {
    if (loading) return;
    const draft = { form, state, city, selectedPlan: selectedPlan?.id || null };
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [form, state, city, selectedPlan, loading]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(draft.form || INITIAL_FORM);
        setState(draft.state || "");
        setCity(draft.city || "");
        if (draft.selectedPlan !== null) {
          const plan = promotionPlans.find((p) => p.id === draft.selectedPlan);
          setSelectedPlan(plan || null);
        }
      }
    } catch (e) {
      console.error("Draft load failed:", e);
    }
  }, []);

  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    setError("");
    setSuccess("");
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  /* ================= IMAGE HANDLING ================= */
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
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
  }, [images.length]); // 🔧 4. Fixed dependency

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  // 🔧 6. Fixed mobile drag
  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    const from = dragIndex;
    if (from === null) return;

    setImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(index, 0, moved);
      return copy;
    });

    setDragIndex(null);
    setIsDragging(false);
  }, [dragIndex]);

  const handleTouchStart = useCallback((e, index) => {
    const timer = setTimeout(() => {
      e.preventDefault();
      setIsDragging(true);
      setDragIndex(index); // 🔧 6. Fixed
    }, 500);
    e.currentTarget.dataset.timer = String(timer);
  }, []);

  const handleLongPressEnd = useCallback((e) => {
    const timerId = e.currentTarget?.dataset.timer;
    if (timerId) {
      clearTimeout(Number(timerId));
      delete e.currentTarget.dataset.timer;
    }
    setIsDragging(false);
  }, []);

  /* ================= API ================= */
  const createProductDraft = async () => {
    const fd = new FormData();
    const payload = {
      ...form,
      price: Number(form.price),
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
      promotion_plan: selectedPlan?.id || null,
    };

    Object.entries(payload)
      .filter(([_, v]) => v !== null && v !== undefined && v !== "")
      .forEach(([k, v]) => fd.append(k, String(v)));

    const imageFiles = images.map((img) => img.file);
    const compressedFiles = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          return await compressImage(file);
        } catch {
          return file;
        }
      })
    );

    compressedFiles.forEach((file) => fd.append("images", file));

    const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // 🔧 8. Improved error handling
      throw new Error(
        data.message ||
        data.error ||
        "Failed to save product draft"
      );
    }

    return (await res.json()).product;
  };

  const startPayment = async (productId, plan) => {
    const res = await fetch("https://minimart-ivrm.onrender.com/api/payment/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.contact.email,
        amount: Number(plan.price),
        planId: plan.id,
        productId,
      }),
    });

    const data = await res.json();
    if (!data.success || !data.authorization_url) {
      throw new Error(data.message || "Payment initialization failed");
    }
    return data.authorization_url;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
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
        // 🔧 5. Fixed payment persistence
        localStorage.removeItem(STORAGE_PAYMENT);
        setPaymentData(null);
        showSuccess("✅ Product created and activated successfully!");
        return;
      }

      setPaymentData({
        email: form.contact.email,
        amount: Number(finalPlan.price),
        planId: finalPlan.id,
        productId,
      });

      const authUrl = await startPayment(productId, finalPlan);
      window.location.href = authUrl;
    } catch (err) {
      showError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async () => {
    if (!paymentData) {
      showError("No pending payment found");
      return;
    }
    setLoading(true);
    try {
      const plan = { id: paymentData.planId, price: paymentData.amount };
      const authUrl = await startPayment(paymentData.productId, plan);
      window.location.href = authUrl;
    } catch (err) {
      showError(`Payment retry failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ================= EFFECTS ================= */
  useEffect(() => {
    loadDraft();
  }, []);

  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(saveDraft, 800);
      return () => clearTimeout(timeout);
    }
  }, [form, state, city, selectedPlan, loading]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) {
      try {
        setPaymentData(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_PAYMENT);
      }
    }
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
    }
  }, [paymentData]);

  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!options.fields?.length) return;
    setForm((prev) => {
      const newAttrs = { ...prev.attributes };
      options.fields.forEach((f) => {
        if (newAttrs[f] === undefined) {
          newAttrs[f] = f === "features" ? [] : "";
        }
      });
      return { ...prev, attributes: newAttrs };
    });
  }, [form.category_id, options.fields]);

  // 🔧 10. Fixed memory leak cleanup
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, []);

  /* ================= RENDER ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* BASIC INFO */}
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
            value={form.price} // 🔧 7. Fixed cursor jumping
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
            onBlur={() => updateForm("price", onlyNumbers(form.price))} // 🔧 7. Added
          />
        </div>
      </section>

      {/* PRODUCT DETAILS */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>
        <div className="form-group">
          <label>Category <span className="required">*</span></label>
          <DropdownModal
            value={form.category_id}
            onChange={(v) => updateForm("category_id", v)}
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>

        {fields.map((field) => {
          if (!optionsMap[field] && field !== "features") return null;
          if (field === "used_detail" && attributes.condition !== "Used") return null;

          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={attributes[field] || ""}
                onChange={(v) => updateAttribute(field, v)}
                options={optionsMap[field]}
              />
            </div>
          );
        })}

        {sortedFeatures.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline">
              {sortedFeatures.map((feature) => (
                <label key={feature} className="checkbox-inline">
                  <span>{formatLabel(feature)}</span>
                  <input
                    type="checkbox"
                    checked={attributes.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CONTACT */}
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
      </section>

      {/* LOCATION & DELIVERY */}
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
            onChange={(v) => updateDelivery("type", v)}
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
                value={form.delivery.fee} // 🔧 7. Fixed cursor jumping
                onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
                onBlur={() => updateDelivery("fee", onlyNumbers(form.delivery.fee))} // 🔧 7. Added
              />
            </div>
          </div>
        )}
      </section>

      {/* IMAGES */}
      <section className="section form-card">
        <h3 className="section-title">Product Images</h3>
        <label className="form-group-label">
          Product Images (max 6, 3MB each) <span className="required">*</span>
        </label>
        <div className="preview-grid-modern image-upload-box">
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`preview-thumb ${isDragging ? "dragging" : ""}`}
              draggable
              onClick={() => setActiveImage(img.preview)}
              onDragStart={() => setDragIndex(i)} // 🔧 6. Fixed
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDragIndex(null);
                setIsDragging(false);
              }}
              onDrop={(e) => handleDrop(e, i)}
              onTouchStart={(e) => handleTouchStart(e, i)}
              onTouchEnd={handleLongPressEnd}
              onMouseDown={(e) => handleTouchStart(e, i)}
              onMouseUp={handleLongPressEnd}
            >
              <img src={img.preview} alt="" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
              >
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
        {images.length > 0 && <small className="price-preview">{images.length}/6 images</small>}
      </section>

      {/* PROMOTION */}
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
                {plan.features.map((feat, i) => (
                  <li key={i}>{feat}</li>
                ))}
              </ul>
              {plan.description && <p className="plan-desc">{plan.description}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <div className="button-section section form-card">
        <button className="primary-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Processing..." : "Create Product"}
        </button>
        {paymentData && (
          <button className="retry-btn" onClick={retryPayment} disabled={loading}>
            {loading ? "Retrying..." : "Retry Payment"}
          </button>
        )}
      </div>

      {/* MESSAGES */}
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

      {/* MODALS */}
      {activeImage && (
        <div className="image-modal" onClick={() => setActiveImage(null)}>
          <img src={activeImage} alt="Full preview" />
        </div>
      )}
      {loading && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <div className="loading-text">
            {paymentData ? "Finalizing payment..." : "Creating your product..."}
          </div>
        </div>
      )}
    </div>
  );
}