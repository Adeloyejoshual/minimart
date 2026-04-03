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
      return file; // fallback to original
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

  const onlyNumbers = useCallback((v = "") => v.replace(/[^d.]/g, ""), []);
  const onlyDigits = useCallback((v = "") => v.replace(/D/g, ""), []);

  const displayPrice = useCallback((v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  }, []);

  const formatLabel = useCallback((t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase()),
  []);

  // Dynamic options
  const optionsMap = useMemo(() => {
    const map = {};
    const dynamic = selectedCategory?.dynamicOptions || {};
    Object.keys(dynamic).forEach(key => {
      if (key === "models") return;
      if (key === "model" && form.attributes.brand) {
        map.model = normalizeOptions(dynamic.model?.[form.attributes.brand]);
        return;
      }
      map[key] = normalizeOptions(dynamic[key]);
    });
    return map;
  }, [selectedCategory?.dynamicOptions, form.attributes.brand, normalizeOptions]);

  const sortedFeatures = useMemo(() =>
    [...(selectedCategory?.dynamicOptions?.features || [])].sort((a, b) => a.localeCompare(b)),
  [selectedCategory?.dynamicOptions?.features]);

  const fields = useMemo(() => {
    const dynamic = selectedCategory?.dynamicOptions?.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
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
        ...(key === "brand" && { model: "" }),
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
      delivery: { ...prev.delivery, [key]: value },
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
    if (form.title.length < 10) return "Title must be at least 10 characters";
    if (form.description.length < 20) return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Enter valid price";
    if (!form.category_id) return "Select category";
    if (!state || !city) return "Select state and city";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Valid phone required";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Valid email required";

    if (form.delivery.type !== "none" && form.delivery.type !== "pickup") {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to) || to < from) return "Valid delivery duration required";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) return "Delivery fee required";
    }
    return null;
  }, [form, images.length, state, city]);

  // ================= DRAFT MANAGEMENT =================
  const saveDraft = useCallback(() => {
    if (loading) return;
    const draft = { form, state, city, images: images.map(i => ({id: i.id})), selectedPlan: selectedPlan?.id || null };
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
        // Rebuild images from IDs (previews lost)
        if (draft.images?.length) setImages(draft.images.map(id => ({id, file: null, preview: null})));
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
    setState(""); setCity("");
    setSelectedPlan(null); setPaymentData(null);
    setError(""); setSuccess("");
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
    const fileArray = Array.from(files).filter(f => 
      f.type.startsWith("image/") && f.size <= MAX_SIZE
    ).slice(0, MAX_IMAGES - images.length);

    Promise.all(fileArray.map(compressImage)).then(compressed => {
      const newImages = compressed.map(file => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages(prev => [...prev, ...newImages]);
      showSuccess(`${newImages.length} image(s) added`);
    }).catch(showError);
  }, [images.length, showError, compressImage]);

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
    console.log("🚀 Creating product draft. Images:", images.length);
    if (!images.some(img => img.file)) throw new Error("All images must have files");

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
      promotion_plan: selectedPlan?.id || null,
    };

    Object.entries(payload).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") fd.append(k, String(v));
    });

    images.forEach(img => {
      if (img.file) fd.append("images", img.file);
    });

    console.log("📤 FormData keys:", Array.from(fd.keys()));
    
    const res = await fetch(`${API_BASE}/api/marketplace/products`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("API ERROR:", res.status, text);
      const data = JSON.parse(text || "{}").catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return (await res.json()).product;
  };

  const startPayment = async (productId, plan) => {
    const res = await fetch(`${API_BASE}/api/payment/initialize`, {
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
      throw new Error(data.message || "Payment init failed");
    }
    return data.authorization_url;
  };

  const handlePaymentSuccess = async (reference) => {
    if (!paymentData?.productId) {
      showError("No product ID for verification");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, productId: paymentData.productId }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentSuccess(true);
        clearDraft();
        showSuccess("Product live! 🎉");
        setTimeout(() => window.location.href = "/", 2000);
      } else {
        throw new Error(data.message || "Verification failed");
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e?.preventDefault();
    console.log("🎯 handleSubmit fired");
    
    const validationError = validateForm();
    if (validationError) return showError(validationError);

    const finalPlan = selectedPlan || promotionPlans.find(p => p.price === 0);
    setLoading(true);
    setError("");

    try {
      const product = await createProductDraft();
      const productId = product?.id;
      if (!productId) throw new Error("No product ID returned");

      if (finalPlan.price === 0) {
        // Free plan - direct activate
        await fetch(`${API_BASE}/api/marketplace/products/${productId}/activate`, { method: "POST" });
        clearDraft();
        showSuccess("Product created & live!");
        setTimeout(() => window.location.href = "/", 1500);
        return;
      }

      // Paid plan
      setPaymentData({ email: form.contact.email, amount: finalPlan.price, planId: finalPlan.id, productId });
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
      
      const authUrl = await startPayment(productId, finalPlan);
      window.location.href = authUrl;
    } catch (err) {
      showError(err.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async () => {
    if (!paymentData) return showError("No payment data");
    setLoading(true);
    try {
      const plan = { id: paymentData.planId, price: paymentData.amount };
      const authUrl = await startPayment(paymentData.productId, plan);
      window.location.href = authUrl;
    } catch (err) {
      showError(err.message);
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
  }, [form, state, city, images, selectedPlan, loading]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
  }, [paymentData]);

  // Paystack callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const reference = urlParams.get('reference');
    
    if (status === 'success' && reference && paymentData) {
      handlePaymentSuccess(reference);
    } else if (status === 'cancel' && paymentData) {
      showError("Payment cancelled - retry below");
      localStorage.removeItem(STORAGE_PAYMENT);
    }
  }, [paymentData]);

  // Categories
  useEffect(() => {
    fetch(`${API_BASE}/api/marketplace/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(e => console.error("Categories load failed:", e));
  }, []);

  // Auto-init attributes
  useEffect(() => {
    if (!selectedCategory?.dynamicOptions?.fields?.length) return;
    setForm(prev => {
      const newAttrs = { ...prev.attributes };
      selectedCategory.dynamicOptions.fields.forEach(f => {
        if (newAttrs[f] === undefined) newAttrs[f] = f === "features" ? [] : "";
      });
      return { ...prev, attributes: newAttrs };
    });
  }, [selectedCategory?.dynamicOptions?.fields]);

  // Cleanup
  useEffect(() => () => {
    images.forEach(img => img.preview && URL.revokeObjectURL(img.preview));
  }, [images]);

  // ================= BUTTON LOGIC =================
  const showRetryButton = paymentData && paymentData.amount > 0;
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <section className="section form-card">
          <h3>Basic Information</h3>
          <div className="form-group">
            <label>Product Title <span className="required">*</span></label>
            <input
              required
              placeholder="Enter product title"
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
              placeholder="Detailed description..."
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
              placeholder="10000"
              value={displayPrice(form.price)}
              onChange={e => updateForm("price", onlyNumbers(e.target.value))}
            />
          </div>
        </section>

        {/* Product Details */}
        <section className="section form-card">
          <h3>Product Details</h3>
          <div className="form-group">
            <label>Category <span className="required">*</span></label>
            <DropdownModal
              value={form.category_id}
              onChange={v => updateForm("category_id", v)}
              options={categories.map(c => ({ id: c.id, name: c.name }))}
            />
          </div>

          {fields.map(field => {
            if (field === "used_detail" && form.attributes.condition !== "Used") return null;
            if (!optionsMap[field] && field !== "features") return null;

            return (
              <div key={field} className="form-group">
                <label>{formatLabel(field)}</label>
                {field === "features" ? (
                  <div className="checkbox-grid-inline">
                    {sortedFeatures.map(feat => (
                      <label key={feat} className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={form.attributes.features.includes(feat)}
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
                    options={optionsMap[field]}
                  />
                )}
              </div>
            );
          })}
        </section>

        {/* Contact */}
        <section className="section form-card">
          <h3>Contact Information</h3>
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
          <h3>Location & Delivery</h3>
          <div className="form-group">
            <label>State <span className="required">*</span></label>
            <DropdownModal value={state} onChange={setState} options={states.map(s => ({id: s, name: s}))} />
          </div>
          {state && (
            <div className="form-group">
              <label>City <span className="required">*</span></label>
              <DropdownModal value={city} onChange={setCity} options={cities.map(c => ({id: c, name: c}))} />
            </div>
          )}
          <div className="form-group">
            <label>Delivery Type</label>
            <DropdownModal
              value={form.delivery.type}
              onChange={updateDelivery.bind(null, "type")}
              options={[
                { id: "none", name: "No delivery" },
                { id: "standard", name: "Standard" },
                { id: "express", name: "Express" },
                { id: "pickup", name: "Pickup only" },
              ]}
            />
          </div>
          {form.delivery.type !== "none" && form.delivery.type !== "pickup" && (
            <div className="delivery-grid">
              <div className="form-group">
                <label>From (days) <span className="required">*</span></label>
                <input type="number" min="1" value={form.delivery.duration.from} onChange={e => updateDeliveryDuration("from", e.target.value)} />
              </div>
              <div className="form-group">
                <label>To (days) <span className="required">*</span></label>
                <input type="number" min="1" value={form.delivery.duration.to} onChange={e => updateDeliveryDuration("to", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Fee (₦) <span className="required">*</span></label>
                <input type="text" inputMode="numeric" value={displayPrice(form.delivery.fee)} onChange={e => updateDelivery("fee", onlyNumbers(e.target.value))} />
              </div>
            </div>
          )}
        </section>

        {/* Images */}
        <section className="section form-card">
          <h3>Product Images <span className="required">*</span> (max 6, 3MB each)</h3>
          <div className="preview-grid-modern">
            {images.map((img, i) => (
              <div
                key={img.id}
                className={`preview-thumb ${isDragging ? "dragging" : ""}`}
                draggable
                onDragStart={e => e.dataTransfer.setData("index", i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, i)}
                onClick={() => setActiveImage(img.preview)}
              >
                <img src={img.preview || ''} alt="" />
                <button type="button" onClick={e => { e.stopPropagation(); removeImage(img.id); }}>✕</button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="add-image-box">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={e => {
                    handleImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div>+</div>
                <span>Add Images</span>
              </label>
            )}
          </div>
          {images.length > 0 && <small>{images.length}/6 images</small>}
        </section>

        {/* Promotions */}
        <section className="section form-card">
          <h3>Promotion (Optional)</h3>
          <div className="plans-grid">
            {promotionPlans.map(plan => (
              <div
                key={plan.id}
                className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="plan-header">
                  <strong>{plan.name}</strong>
                  <span>₦{displayPrice(plan.price)}</span>
                </div>
                <div>{plan.duration}</div>
                <ul>{plan.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                {plan.description && <p>{plan.description}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="button-section">
          {showRetryButton ? (
            <button type="button" className="retry-btn" onClick={retryPayment} disabled={loading}>
              {loading ? "Retrying..." : "🔄 Retry Payment"}
            </button>
          ) : (
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "⏳ Processing..." : "🚀 Create Product"}
            </button>
          )}
        </div>
      </form>

      {/* Messages */}
      {error && <div className="form-error">⚠️ {error}</div>}
      {success && <div className="form-success">✅ {success}</div>}

      {/* Modals */}
      {activeImage && (
        <div className="image-modal" onClick={() => setActiveImage(null)}>
          <img src={activeImage} alt="Preview" />
        </div>
      )}
      {loading && (
        <div className="loading-overlay">
          <div className="loader" />
          <div>{paymentData ? "Finalizing payment..." : "Creating product..."}</div>
        </div>
      )}
      {paymentSuccess && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div>🎉</div>
            <h3>Success!</h3>
            <p>Product is live and promoted.</p>
            <div className="loader small" />
          </div>
        </div>
      )}
    </div>
  );
}