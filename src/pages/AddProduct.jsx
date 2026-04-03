import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";
const API_BASE = import.meta.env.VITE_API_URL || "https://minimart-ivrm.onrender.com";

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
    email: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
  // ================= STATE =================
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
  const imageTimersRef = useRef(new Map());

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024; // 3MB

  // ================= UTILITIES =================
  const isSlowDevice = useCallback(() =>
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4 ||
    /Android|iPhone|iPad/i.test(navigator.userAgent)
  , []);

  const compressImage = useCallback(async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: isSlowDevice() ? 0.4 : 0.8,
        maxWidthOrHeight: isSlowDevice() ? 900 : 1280,
        useWebWorker: true,
      });
    } catch {
      return file;
    }
  }, [isSlowDevice]);

  const showError = useCallback((message) => {
    console.error("❌ ERROR:", message);
    setError(message);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((message) => {
    console.log("✅ SUCCESS:", message);
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  }, []);

  const selectedCategory = useMemo(() =>
    categories.find(c => String(c.id) === String(form.category_id)),
  [categories, form.category_id]);

  const normalizeOptions = useCallback((list = []) =>
    Array.isArray(list)
      ? list.map(x => typeof x === "string" ? { id: x, name: x } : x).filter(Boolean)
      : [],
  []);

  const onlyNumbers = useCallback((v = "") => v.replace(/[^0-9.]/g, ""), []);
  const onlyDigits = useCallback((v = "") => v.replace(/D/g, ""), []);

  const displayPrice = useCallback((v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  }, []);

  const formatLabel = useCallback((t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase()),
  []);

  // Dynamic options - FIXED
  const optionsMap = useMemo(() => {
    const map = {};
    const dynamic = selectedCategory?.dynamicOptions || {};
    
    Object.keys(dynamic).forEach(key => {
      if (key === "model" && form.attributes.brand) {
        // Model depends on brand
        const brandModels = dynamic.model?.[form.attributes.brand] || [];
        map.model = normalizeOptions(brandModels);
      } else if (key !== "model") {
        map[key] = normalizeOptions(dynamic[key]);
      }
    });
    
    // Always include condition first
    map.condition = map.condition || normalizeOptions(["New", "Used"]);
    return map;
  }, [selectedCategory?.dynamicOptions, form.attributes.brand, normalizeOptions]);

  const sortedFeatures = useMemo(() =>
    [...(selectedCategory?.dynamicOptions?.features || [])].sort((a, b) => a.localeCompare(b)),
  [selectedCategory?.dynamicOptions?.features]);

  const fields = useMemo(() => {
    const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
    return ["condition", ...dynamicFields.filter(f => f !== "condition")];
  }, [selectedCategory?.dynamicOptions?.fields]);

  // ================= FORM UPDATERS =================
  const updateForm = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
        model: key === "brand" ? "" : prev.attributes.model,
      },
    }));
  }, []);

  const updateContact = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }, []);

  const updateDelivery = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      delivery: { 
        ...prev.delivery, 
        [key]: key === "available" ? Boolean(value) : value 
      },
    }));
  }, []);

  const updateDeliveryDuration = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
    }));
  }, []);

  const toggleFeature = useCallback((feature) => {
    setForm(prev => {
      const features = prev.attributes.features || [];
      const exists = features.includes(feature);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: exists
            ? features.filter(f => f !== feature)
            : [...features, feature],
        },
      };
    });
  }, []);

  // ================= VALIDATION =================
  const validateForm = useCallback(() => {
    if (!images.length) return "Upload at least 1 image";
    if (form.title.trim().length < 10) return "Title must be at least 10 characters";
    if (form.description.trim().length < 20) return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Enter valid price";
    if (!form.category_id) return "Select category";
    if (!state || !city) return "Select state and city";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Valid phone required";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Valid email required";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to) || to < from) 
        return "Valid delivery duration required";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) 
        return "Delivery fee required";
    }
    return null;
  }, [form, images.length, state, city]);

  // ================= DRAFT MANAGEMENT =================
  const saveDraft = useCallback(() => {
    if (loading) return;
    const draft = { 
      form, 
      state, 
      city, 
      images: images.map(i => ({id: i.id})), 
      selectedPlan: selectedPlan?.id || null 
    };
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [form, state, city, images, selectedPlan, loading]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(draft.form || INITIAL_FORM);
        setState(draft.state || "");
        setCity(draft.city || "");
        if (draft.images?.length) 
          setImages(draft.images.map(id => ({id, file: null, preview: null})));
        if (draft.selectedPlan !== null) {
          const plan = promotionPlans.find(p => p.id === draft.selectedPlan);
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
    setPaymentSuccess(false);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  // ================= IMAGE HANDLING =================
  const handleImages = useCallback((files) => {
    if (images.length >= MAX_IMAGES) {
      showError("Maximum 6 images");
      return;
    }
    
    const fileArray = Array.from(files)
      .filter(f => f.type.startsWith("image/") && f.size <= MAX_SIZE)
      .slice(0, MAX_IMAGES - images.length);

    if (!fileArray.length) return;

    Promise.all(fileArray.map(compressImage))
      .then(compressed => {
        const newImages = compressed.map(file => ({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        }));
        setImages(prev => [...prev, ...newImages]);
        showSuccess(`${newImages.length} image(s) added`);
      })
      .catch(err => showError("Image processing failed"));
  }, [images.length, compressImage, showError, showSuccess]);

  const removeImage = useCallback((id) => {
    setImages(prev => {
      const img = prev.find(x => x.id === id);
      if (img?.preview) URL.revokeObjectURL(img.preview);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("index"));
    setImages(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(index, 0, moved);
      return copy;
    });
    setIsDragging(false);
  }, []);

  // ================= API FUNCTIONS =================
  const createProductDraft = async () => {
    if (!images.some(img => img.file)) 
      throw new Error("All images must have files attached");

    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("price", Number(form.price).toString());
    fd.append("category_id", form.category_id);
    fd.append("attributes", JSON.stringify(form.attributes));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact", JSON.stringify(form.contact));
    fd.append("location_state", state);
    fd.append("location_city", city);

    images.forEach(img => {
      if (img.file) fd.append("images", img.file);
    });

    console.log("📤 Creating product with", images.length, "images");

    const res = await fetch(`${API_BASE}/api/marketplace/products`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }

    const result = await res.json();
    return result.product_id || result.product?.id;
  };

  const startPayment = async (productId, plan) => {
    const res = await fetch(`${API_BASE}/api/marketplace/payment/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.contact.email,
        amount: Number(plan.price),
        productId,
        planId: plan.id,
      }),
    });

    const data = await res.json();
    if (!data.success || !data.authorization_url) {
      throw new Error(data.error || "Payment initialization failed");
    }
    
    return data.authorization_url;
  };

  const verifyPayment = async (reference) => {
    if (!paymentData?.productId) {
      showError("No product ID for verification");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/marketplace/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          reference, 
          productId: paymentData.productId 
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPaymentSuccess(true);
        clearDraft();
        showSuccess("Product is now live! 🎉");
        setTimeout(() => window.location.href = "/products", 2000);
      } else {
        throw new Error(data.error || data.message || "Verification failed");
      }
    } catch (err) {
      showError(err.message);
    }
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    const validationError = validateForm();
    if (validationError) return showError(validationError);

    setLoading(true);
    setError("");

    try {
      // 1. Create product draft
      const productId = await createProductDraft();
      console.log("✅ Product created:", productId);

      // 2. Handle free vs paid plans
      const finalPlan = selectedPlan || promotionPlans.find(p => p.price === 0);
      
      if (!finalPlan) throw new Error("No valid plan selected");

      if (finalPlan.price === 0) {
        // Free plan - activate immediately
        const res = await fetch(`${API_BASE}/api/marketplace/products/${productId}/activate`, {
          method: "POST",
        });
        
        if (res.ok) {
          clearDraft();
          showSuccess("Product created & published successfully! 🎉");
          setTimeout(() => window.location.href = "/products", 1500);
        } else {
          throw new Error("Activation failed");
        }
      } else {
        // Paid plan - start payment
        const paymentInfo = {
          email: form.contact.email,
          amount: finalPlan.price,
          planId: finalPlan.id,
          productId
        };
        
        setPaymentData(paymentInfo);
        localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentInfo));
        
        const authUrl = await startPayment(productId, finalPlan);
        window.location.href = authUrl;
      }
    } catch (err) {
      console.error("Submit error:", err);
      showError(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async () => {
    if (!paymentData) return showError("No payment data found");
    
    setLoading(true);
    try {
      const plan = { 
        id: paymentData.planId, 
        price: paymentData.amount 
      };
      const authUrl = await startPayment(paymentData.productId, plan);
      window.location.href = authUrl;
    } catch (err) {
      showError(err.message || "Payment retry failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= EFFECTS =================
  useEffect(() => loadDraft(), []);

  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(saveDraft, 1000);
      return () => clearTimeout(timeout);
    }
  }, [form, state, city, images, selectedPlan]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
    }
  }, [paymentData]);

  // Payment callback handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const reference = urlParams.get('reference');
    
    if (status === 'success' && reference && paymentData) {
      verifyPayment(reference);
    } else if (status === 'cancel' && paymentData) {
      showError("Payment cancelled. Use retry button below.");
    }
  }, [paymentData]);

  // Load categories
  useEffect(() => {
    fetch(`${API_BASE}/api/marketplace/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(e => {
        console.error("Categories load failed:", e);
        showError("Failed to load categories");
      });
  }, []);

  // Auto-init form fields based on category
  useEffect(() => {
    if (selectedCategory?.dynamicOptions?.fields?.length) {
      setForm(prev => {
        const newAttrs = { ...prev.attributes };
        selectedCategory.dynamicOptions.fields.forEach(field => {
          if (newAttrs[field] === undefined || newAttrs[field] === "") {
            newAttrs[field] = field === "features" ? [] : "";
          }
        });
        return { ...prev, attributes: newAttrs };
      });
    }
  }, [selectedCategory?.dynamicOptions?.fields]);

  // Cleanup images
  useEffect(() => () => {
    images.forEach(img => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
  }, [images]);

  // ================= RENDER =================
  const showRetryButton = paymentData && paymentData.amount > 0;
  const states = Object.keys(locationsByState || {});
  const cities = state ? (locationsByState[state] || []) : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <section className="section form-card">
          <h3>📦 Basic Information</h3>
          <div className="form-group">
            <label>Product Title <span className="required">*</span></label>
            <input
              required
              placeholder="Enter catchy product title (min 10 chars)"
              value={form.title}
              onChange={e => updateForm("title", e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label>Description <span className="required">*</span></label>
            <textarea
              required
              rows="4"
              placeholder="Describe your product in detail (min 20 chars)..."
              value={form.description}
              onChange={e => updateForm("description", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Price (₦) <span className="required">*</span></label>
            <input
              required
              type="text"
              inputMode="numeric"
              placeholder="Enter price"
              value={displayPrice(form.price)}
              onChange={e => updateForm("price", onlyNumbers(e.target.value))}
            />
          </div>
        </section>

        {/* Category & Attributes */}
        <section className="section form-card">
          <h3>🏷️ Category & Details</h3>
          <div className="form-group">
            <label>Category <span className="required">*</span></label>
            <DropdownModal
              value={form.category_id}
              onChange={v => updateForm("category_id", v)}
              options={categories.map(c => ({ id: c.id, name: c.name }))}
              placeholder="Select category"
            />
          </div>

          {fields.map(field => {
            if (field === "used_detail" && form.attributes.condition !== "Used") return null;
            if (!optionsMap[field] && field !== "features") return null;

            return (
              <div key={field} className="form-group">
                <label>{formatLabel(field)}</label>
                {field === "features" ? (
                  <div className="checkbox-grid">
                    {sortedFeatures.map(feat => (
                      <label key={feat} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={form.attributes.features?.includes(feat) || false}
                          onChange={() => toggleFeature(feat)}
                        />
                        <span>{formatLabel(feat)}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <DropdownModal
                    value={form.attributes[field] || ""}
                    onChange={v => updateAttribute(field, v)}
                    options={optionsMap[field] || []}
                    placeholder={`Select ${formatLabel(field)}`}
                  />
                )}
              </div>
            );
          })}
        </section>

        {/* Contact */}
        <section className="section form-card">
          <h3>📱 Contact Information</h3>
          <div className="form-group">
            <label>Email <span className="required">*</span></label>
            <input
              required
              type="email"
              placeholder="your@email.com"
              value={form.contact.email}
              onChange={e => updateContact("email", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Phone <span className="required">*</span></label>
            <input
              required
              type="tel"
              inputMode="tel"
              placeholder="08012345678"
              value={form.contact.phone}
              onChange={e => updateContact("phone", onlyDigits(e.target.value))}
            />
          </div>
        </section>

        {/* Location & Delivery */}
        <section className="section form-card">
          <h3>📍 Location & Delivery</h3>
          <div className="form-group">
            <label>State <span className="required">*</span></label>
            <DropdownModal 
              value={state} 
              onChange={setState} 
              options={states.map(s => ({id: s, name: s}))}
              placeholder="Select state"
            />
          </div>
          {state && (
            <div className="form-group">
              <label>City <span className="required">*</span></label>
              <DropdownModal 
                value={city} 
                onChange={setCity} 
                options={cities.map(c => ({id: c, name: c}))}
                placeholder="Select city"
              />
            </div>
          )}
          
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.delivery.available}
                onChange={e => updateDelivery("available", e.target.checked)}
              />
              Offer delivery
            </label>
          </div>

          {form.delivery.available && (
            <div className="delivery-details">
              <div className="delivery-grid">
                <div className="form-group">
                  <label>Delivery time (from)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={form.delivery.duration.from} 
                    onChange={e => updateDeliveryDuration("from", e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="form-group">
                  <label>Delivery time (to)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={form.delivery.duration.to} 
                    onChange={e => updateDeliveryDuration("to", e.target.value)}
                    placeholder="3"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Delivery Fee (₦)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1000"
                  value={displayPrice(form.delivery.fee)}
                  onChange={e => updateDelivery("fee", onlyNumbers(e.target.value))}
                />
              </div>
            </div>
          )}
        </section>

        {/* Images */}
        <section className="section form-card">
          <h3>🖼️ Product Images <span className="required">*</span></h3>
          <p className="help-text">Max 6 images, 3MB each. First image is cover.</p>
          <div className="image-upload-area">
            <div className="preview-grid">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className={`image-preview ${isDragging ? "dragging" : ""}`}
                  draggable
                  onDragStart={e => e.dataTransfer.setData("index", i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, i)}
                  onClick={() => setActiveImage(img.preview)}
                >
                  <img src={img.preview || ''} alt="" />
                  <button 
                    type="button" 
                    className="remove-btn"
                    onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                  >
                    ✕
                  </button>
                  {i === 0 && <div className="cover-badge">Cover</div>}
                </div>
              ))}
              
              {images.length < MAX_IMAGES && (
                <label className="upload-zone">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={e => {
                      handleImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="upload-icon">+</div>
                  <div className="upload-text">
                    {images.length === 0 ? "Click or drag images" : `Add ${MAX_IMAGES - images.length} more`}
                  </div>
                </label>
              )}
            </div>
            {images.length > 0 && (
              <div className="image-count">{images.length}/6 images</div>
            )}
          </div>
        </section>

        {/* Promotion Plans */}
        <section className="section form-card">
          <h3>🚀 Promotion Plan</h3>
          <p className="help-text">Choose a plan to boost visibility (optional)</p>
          <div className="plans-grid">
            {promotionPlans.map(plan => (
              <div
                key={plan.id}
                className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="plan-price">₦{displayPrice(plan.price)}</div>
                <h4>{plan.name}</h4>
                <div className="plan-duration">{plan.duration}</div>
                <ul className="plan-features">
                  {plan.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
                {plan.description && <p>{plan.description}</p>}
              </div>
            ))}
          </div>
          {selectedPlan && (
            <div className="plan-selected">
              Selected: <strong>{selectedPlan.name}</strong> (₦{displayPrice(selectedPlan.price)})
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div className="action-buttons">
          {showRetryButton ? (
            <button 
              type="button" 
              className="btn-retry" 
              onClick={retryPayment} 
              disabled={loading}
            >
              {loading ? "🔄 Retrying..." : "🔄 Retry Payment"}
            </button>
          ) : (
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !images.length}
            >
              {loading ? "⏳ Creating Product..." : "🚀 Create & Publish Product"}
            </button>
          )}
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={clearDraft}
            disabled={loading}
          >
            Clear Draft
          </button>
        </div>
      </form>

      {/* Messages */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")}>&times;</button>
        </div>
      )}
      {success && (
        <div className="success-banner">
          <span>✅ {success}</span>
        </div>
      )}

      {/* Image Modal */}
      {activeImage && (
        <div className="image-modal-overlay" onClick={() => setActiveImage(null)}>
          <div className="image-modal-content">
            <img src={activeImage} alt="Full preview" />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div>{paymentData ? "Finalizing payment..." : "Creating your product..."}</div>
        </div>
      )}

      {/* Success Modal */}
      {paymentSuccess && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="success-icon">🎉</div>
            <h2>Your product is live!</h2>
            <p>It's now visible to all buyers and promoted.</p>
            <div className="spinner small"></div>
          </div>
        </div>
      )}
    </div>
  );
}