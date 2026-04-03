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
  // ================= ALL STATE =================
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
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFreePlanSelected, setIsFreePlanSelected] = useState(true);
  const imageTimersRef = useRef(new Map());

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;
  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  // ================= CORE UTILITIES =================
  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }, []);

  const onlyNumbers = useCallback(
  (v) => v.replace(/[^0-9.]/g, ""),
  []
);

const onlyDigits = useCallback(
  (v) => v.replace(/\D/g, ""),
  []
);
  const displayPrice = useCallback((v) => {
    const num = Number(v);
    return isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  }, []);

  const formatLabel = useCallback((t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase())
  , []);

  const normalizeOptions = useCallback((list) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : []
  , []);

  // ================= CATEGORY & OPTIONS =================
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const optionsMap = useMemo(() => {
    const map = {};
    const dynamicOptions = selectedCategory?.dynamicOptions || {};

    Object.keys(dynamicOptions).forEach((key) => {
      if (key === "models") return;

      let options = [];
      if (key === "model") {
        const modelsForBrand =
          form.attributes.brand && dynamicOptions.models?.[form.attributes.brand];
        options = normalizeOptions(modelsForBrand || []);
      } else {
        options = normalizeOptions(dynamicOptions[key] || []);
      }

      map[key] = options.length ? options : [{ id: "", name: "No options" }];
    });

    return map;
  }, [selectedCategory?.dynamicOptions, form.attributes.brand, normalizeOptions]);

  const sortedFeatures = useMemo(
    () =>
      [...(selectedCategory?.dynamicOptions?.features || [])].sort((a, b) =>
        a.localeCompare(b)
      ),
    [selectedCategory?.dynamicOptions?.features]
  );

  const fields = useMemo(() => {
    const dynamic = selectedCategory?.dynamicOptions?.fields || [];
    return dynamic.includes("condition")
      ? dynamic
      : ["condition", ...dynamic];
  }, [selectedCategory?.dynamicOptions?.fields]);

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  // ================= FORM UPDATERS =================
  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value, ...(key === "brand" && { model: "" }) },
    }));
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

  // ================= VALIDATION =================
  const validateForm = useCallback(() => {
    if (form.title.length < 10) return "Title must be at least 10 characters";
    if (form.description.length < 20)
      return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Valid price required";
    if (!form.category_id) return "Please select a category";
    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone number required";
    if (!form.contact.email || !form.contact.email.includes("@"))
      return "Valid email required";
    if (images.length === 0) return "Upload at least 1 image";
    if (!state || !city) return "Select state and city";
    if (
      form.delivery.type !== "none" &&
      form.delivery.type !== "pickup" &&
      (isNaN(Number(form.delivery.duration.from)) ||
        isNaN(Number(form.delivery.duration.to)) ||
        Number(form.delivery.duration.to) < Number(form.delivery.duration.from) ||
        !form.delivery.fee ||
        Number(form.delivery.fee) <= 0)
    ) {
      return "Complete delivery details";
    }
    return null;
  }, [form, images.length, state, city]);

  // ================= DRAFT SYSTEM =================
  const saveDraft = useCallback(() => {
    if (loading) return;
    localStorage.setItem(
      STORAGE_DRAFT,
      JSON.stringify({ form, state, city, selectedPlan: selectedPlan?.id || null })
    );
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
    setIsFreePlanSelected(true);
    setPaymentData(null);
    setError("");
    setSuccess("");
    setPaymentSuccess(false);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  // ================= IMAGE HANDLING =================
  const handleImages = useCallback(
    (files) => {
      if (images.length >= MAX_IMAGES) {
        showError("Maximum 6 images");
        return;
      }
      const validFiles = Array.from(files)
        .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
        .slice(0, MAX_IMAGES - images.length);
      const newImages = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newImages]);
    },
    [images.length, showError]
  );

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  // ================= PLAN HANDLER =================
  const handlePlanSelect = useCallback((plan) => {
    const isFree = plan.price === 0 || plan.id === 0;
    setSelectedPlan(plan);
    setIsFreePlanSelected(isFree);
    
    // Clear payment data when switching to free
    if (isFree && paymentData) {
      setPaymentData(null);
      localStorage.removeItem(STORAGE_PAYMENT);
    }
  }, [paymentData]);

  // ================= BUTTON LOGIC =================
  const showRetryButton = useCallback(() => {
    return paymentData && !paymentSuccess && !isFreePlanSelected;
  }, [paymentData, paymentSuccess, isFreePlanSelected]);

  const getButtonText = useCallback(() => {
    if (loading) return "Processing...";
    if (showRetryButton()) return "Retry Payment";
    return isFreePlanSelected ? "Create Product (Free)" : "Create & Pay";
  }, [loading, showRetryButton, isFreePlanSelected]);

  // ================= API FUNCTIONS =================
  const compressImage = useCallback(async (file) => {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    });
  }, []);

  const createProductDraft = async () => {
    const fd = new FormData();
    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      category_id: form.category_id,
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
    };

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        fd.append(key, String(value));
      }
    });

    const imageFiles = images.map((img) => img.file).filter(Boolean);
    const compressedFiles = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const compressed = await compressImage(file);
          return new File([compressed], file.name, { type: compressed.type });
        } catch {
          return file;
        }
      })
    );

    compressedFiles.forEach((file) => fd.append("images", file));

    const res = await fetch(`${API_BASE}/marketplace/products`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      const data = JSON.parse(text || "{}").catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return (await res.json()).product;
  };

  const startPayment = async (productId, planId, amount, email) => {
    const res = await fetch(`${API_BASE}/payments/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount, productId, planId }),
    });

    const data = await res.json();
    if (!data.success || !data.authorization_url) {
      throw new Error(data.error || "Payment failed");
    }
    return {
      url: data.authorization_url,
      reference: data.reference,
      idempotency_key: data.idempotency_key,
    };
  };

  // ================= MAIN HANDLERS =================
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    const finalPlan = isFreePlanSelected
      ? promotionPlans.find((p) => p.price === 0 || p.id === 0)
      : selectedPlan;

    setLoading(true);
    setError("");

    try {
      const product = await createProductDraft();
      const productId = product.id;

      if (isFreePlanSelected || finalPlan.price === 0) {
        const res = await fetch(`${API_BASE}/payments/free-plan/${productId}`, {
          method: "POST",
        });
        const data = await res.json();
        if (data.success) {
          clearDraft();
          showSuccess("✅ Product activated FREE!");
          setTimeout(() => (window.location.href = "/"), 2000);
        } else {
          throw new Error(data.error || "Activation failed");
        }
        return;
      }

      const payment = await startPayment(
        productId,
        finalPlan.id,
        Number(finalPlan.price),
        form.contact.email
      );

      setPaymentData({
        productId,
        planId: finalPlan.id,
        amount: Number(finalPlan.price),
        email: form.contact.email,
      });

      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify({
        productId,
        planId: finalPlan.id,
        amount: Number(finalPlan.price),
        email: form.contact.email,
        reference: payment.reference,
        idempotency_key: payment.idempotency_key,
      }));

      window.location.href = payment.url;
    } catch (err) {
      showError(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async () => {
    if (!paymentData || isFreePlanSelected) {
      showError("Select paid plan first");
      return;
    }
    setLoading(true);
    try {
      const payment = await startPayment(
        paymentData.productId,
        paymentData.planId,
        paymentData.amount,
        paymentData.email
      );
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify({
        ...paymentData,
        reference: payment.reference,
        idempotency_key: payment.idempotency_key,
      }));
      window.location.href = payment.url;
    } catch (err) {
      showError(`Retry failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ================= EFFECTS =================
  useEffect(() => {
    loadDraft();
    fetch(`${API_BASE}/marketplace/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(saveDraft, 1000);
      return () => clearTimeout(timeout);
    }
  }, [form, state, city, selectedPlan, loading, saveDraft]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    setIsFreePlanSelected(!selectedPlan || selectedPlan.price === 0 || selectedPlan.id === 0);
  }, [selectedPlan]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const reference = params.get("reference");
    if (status === "success" && reference && paymentData) {
      // Payment success handled by webhook
      showSuccess("✅ Product activated! Redirecting...");
      setTimeout(() => (window.location.href = "/"), 2000);
    } else if (status === "cancel" && paymentData) {
      showError("Payment cancelled");
    }
  }, []);

  useEffect(() => {
    return () => images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
  }, [images]);

  // ================= JSX =================
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

            {/* FORM SECTIONS */}
      <section className="section form-card">
        <h3>Basic Information</h3>
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
            placeholder="Detailed description"
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
            value={displayPrice(form.price)}
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          />
        </div>
      </section>

      <section className="section form-card">
        <h3>Product Details</h3>
        <div className="form-group">
          <label>Category <span className="required">*</span></label>
          <DropdownModal
            value={form.category_id}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                category_id: v,
                attributes: INITIAL_FORM.attributes,
              }))
            }
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            placeholder="Select category"
          />
        </div>

        {fields.map((field) => {
          const fieldOptions = optionsMap[field] || [];
          if (
            field === "used_detail" &&
            form.attributes.condition !== "Used"
          )
            return null;
          if (field === "features") return null;

          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={form.attributes[field] || ""}
                onChange={(v) => updateAttribute(field, v)}
                options={fieldOptions}
                placeholder={`Select ${formatLabel(field)}`}
              />
            </div>
          );
        })}

        {sortedFeatures.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid">
              {sortedFeatures.map((feature) => (
                <label key={feature} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={form.attributes.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{formatLabel(feature)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="section form-card">
        <h3>Contact Information</h3>
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
            type="tel"
            placeholder="08012345678"
            value={form.contact.phone}
            onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
          />
        </div>
      </section>

      <section className="section form-card">
        <h3>Location & Delivery</h3>
        <div className="form-row">
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
        </div>

        <div className="form-group">
          <label>Delivery</label>
          <DropdownModal
            value={form.delivery.type}
            onChange={updateDelivery}
            options={[
              { id: "none", name: "No delivery" },
              { id: "standard", name: "Standard (1-3 days)" },
              { id: "express", name: "Express (same day)" },
              { id: "pickup", name: "Pickup only" },
            ]}
          />
        </div>

        {form.delivery.type !== "none" && form.delivery.type !== "pickup" && (
          <div className="delivery-grid">
            <div className="form-group">
              <label>Delivery (days)</label>
              <div className="input-row">
                <input
                  type="number"
                  placeholder="1"
                  value={form.delivery.duration.from}
                  onChange={(e) =>
                    updateDeliveryDuration("from", onlyDigits(e.target.value))
                  }
                  min="1"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="3"
                  value={form.delivery.duration.to}
                  onChange={(e) =>
                    updateDeliveryDuration("to", onlyDigits(e.target.value))
                  }
                  min="1"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Fee (₦) <span className="required">*</span></label>
              <input
                type="text"
                value={displayPrice(form.delivery.fee)}
                onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      <section className="section form-card">
        <h3>Product Images <span className="required">*</span></h3>
        <div className="image-upload-grid">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="image-preview"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("index", i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("index"));
                setImages((prev) => {
                  const copy = [...prev];
                  const [moved] = copy.splice(from, 1);
                  copy.splice(i, 0, moved);
                  return copy;
                });
              }}
            >
              <img src={img.preview} alt="Preview" />
              <button
                onClick={() => removeImage(img.id)}
                className="remove-image"
              >
                ×
              </button>
            </div>
          ))}
          
          {images.length < MAX_IMAGES && (
            <label className="image-upload-btn">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  handleImages(e.target.files);
                  e.target.value = "";
                }}
              />
              + Add Image
            </label>
          )}
        </div>
        <small>{images.length}/{MAX_IMAGES} images</small>
      </section>

      <section className="section form-card">
        <h3>Promotion Plan</h3>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${
                selectedPlan?.id === plan.id ? "selected" : ""
              } ${plan.price === 0 ? "free" : ""}`}
              onClick={() => handlePlanSelect(plan)}
            >
              <div className="plan-price-tag">
                ₦{displayPrice(plan.price)}
                {plan.price === 0 && <span className="free-badge">FREE</span>}
              </div>
              <h4>{plan.name}</h4>
              <p className="plan-duration">{plan.duration}</p>
              <ul>
                {plan.features.map((feat, i) => (
                  <li key={i}>{feat}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <small>
          {selectedPlan
            ? `Selected: ${selectedPlan.name}`
            : "Free plan selected"}
        </small>
      </section>

      {/* ACTION BUTTONS */}
      <div className="action-buttons">
        {showRetryButton() ? (
          <div className="button-group">
            <button
              className="btn btn-secondary"
              onClick={retryPayment}
              disabled={loading}
            >
              Retry Payment
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              Use Free Plan
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary full-width"
            onClick={handleSubmit}
            disabled={loading || images.length === 0}
          >
            {getButtonText()}
          </button>
        )}
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span>✅</span> {success}
        </div>
      )}

      {/* MODALS */}
      {activeImage && (
        <div
          className="modal-overlay"
          onClick={() => setActiveImage(null)}
        >
          <img src={activeImage} alt="Full size" />
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>{paymentData ? "Finalizing..." : "Creating product..."}</p>
        </div>
      )}
    </div>
  );
}