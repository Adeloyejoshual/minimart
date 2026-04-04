import { useEffect, useMemo, useState, useCallback } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "../styles/AddProduct.css";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";
const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  attributes: {
    brand: "", model: "", color: "", condition: "", used_detail: "",
    ram: "", storage: "", sim: "", year: "", engine: "", fuel_type: "",
    features: [],
  },
  delivery: {
    available: true,
    duration: { from: "", to: "" },
    fee: "", note: "",
  },
  contact: {
    phone: "", whatsapp: "", email: "", preferred: "chat",
  },
};

export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  /* ================= DRAFT SYSTEM ================= */
  const saveDraft = useCallback(() => {
    const draft = { form, state, city, selectedPlan: selectedPlan?.id || null };
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [form, state, city, selectedPlan]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(draft.form || INITIAL_FORM);
        setState(draft.state || "");
        setCity(draft.city || "");
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
    setPreviews([]);
    setState(""); setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    setError("");
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  /* ================= EFFECTS ================= */
  useEffect(() => {
    loadDraft();
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [loadDraft]);

  useEffect(() => {
    if (!loading) saveDraft();
  }, [saveDraft, loading]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PAYMENT);
      if (saved) setPaymentData(JSON.parse(saved));
    } catch {}
  }, []);

  /* ================= UTILITIES ================= */
  const selectedCategory = useMemo(() => 
    categories.find(c => String(c.id) === String(form.category_id)), 
  [categories, form.category_id]);

  const options = selectedCategory?.dynamicOptions || {};
  const attrs = form.attributes;
  const brand = attrs.brand;

  const normalizeOptions = (list = []) => 
    Array.isArray(list) ? list.map(x => 
      typeof x === "string" ? { id: x, name: x } : x
    ) : [];

  const onlyNumbers = (v = "") => v.replace(/D/g, "");
  const formatPrice = (v) => {
    const num = onlyNumbers(v);
    return num ? new Intl.NumberFormat("en-NG").format(Number(num)) : "";
  };
  const formatLabel = (t) => 
    t.replace(/_/g, " ").replace(/\bw/g, w => w.toUpperCase());

  const optionsMap = useMemo(() => {
    const modelsForBrand = brand && options.models?.[brand] ? options.models[brand] : [];
    return {
      brand: normalizeOptions(options.brands),
      model: normalizeOptions(modelsForBrand),
      color: normalizeOptions(options.colors),
      condition: normalizeOptions(options.conditions),
      used_detail: normalizeOptions(options.usedDetails),
      ram: normalizeOptions(options.ram),
      storage: normalizeOptions(options.storage),
      sim: normalizeOptions(options.sims),
      year: normalizeOptions(options.years),
      engine: normalizeOptions(options.engines),
      fuel_type: normalizeOptions(options.fuel_types),
    };
  }, [options, brand]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") 
      ? dynamic 
      : ["condition", ...dynamic];
  }, [options]);

  /* ================= UPDATERS ================= */
  const update = (key, value) => setForm(p => ({ ...p, [key]: value }));
  const updateAttr = (key, value) => setForm(p => ({
    ...p,
    attributes: {
      ...p.attributes,
      [key]: value,
      ...(key === "brand" && { model: "" })
    }
  }));
  const updateContact = (key, value) => setForm(p => ({
    ...p, contact: { ...p.contact, [key]: value }
  }));
  const updateDelivery = (key, value) => setForm(p => ({
    ...p, delivery: { ...p.delivery, [key]: value }
  }));
  const updateDeliveryDuration = (key, value) => setForm(p => ({
    ...p,
    delivery: {
      ...p.delivery,
      duration: { ...p.delivery.duration, [key]: value }
    }
  }));
  const toggleFeature = (feature) => {
    setForm(p => {
      const list = p.attributes.features || [];
      const exists = list.includes(feature);
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists 
            ? list.filter(f => f !== feature)
            : [...list, feature]
        }
      };
    });
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (form.title.length < 10) return "Title too short (min 10 chars)";
    if (form.description.length < 20) return "Description too short (min 20 chars)";
    if (!form.price || Number(onlyNumbers(form.price)) <= 0) return "Valid price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Valid phone required (10+ digits)";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Valid email required";
    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Delivery range required";
      if (to < from) return "Delivery: to must be > from";
    }
    if (!state || !city) return "Select state and city";
    if (images.length === 0) return "Add at least 1 image";
    return null;
  };

  /* ================= IMAGE HANDLING ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);
    previews.forEach(URL.revokeObjectURL);
    setImages(list);
    setPreviews(list.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages(p => p.filter((_, x) => x !== i));
    setPreviews(p => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, x) => x !== i);
    });
  };

  /* ================= MAIN SUBMIT ================= */
  const handleSubmit = async () => {
    if (loading) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const finalPlan = selectedPlan || promotionPlans.find(p => p.price === 0);
    setLoading(true);
    setError("");

    // Step 1: Create product draft
    const formData = new FormData();
    formData.append("title", form.title.trim());
    formData.append("description", form.description);
    formData.append("price", onlyNumbers(form.price));
    formData.append("category_id", form.category_id);
    formData.append("user_id", `user_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    formData.append("location_state", state);
    formData.append("location_city", city);
    formData.append("attributes", JSON.stringify(form.attributes));
    formData.append("delivery", JSON.stringify(form.delivery));
    formData.append("contact", JSON.stringify(form.contact));
    images.forEach(img => formData.append("images", img));

    try {
      const createRes = await fetch(`${API_BASE}/products`, {
        method: "POST",
        body: formData,
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${createRes.status}`);
      }

      const createResult = await createRes.json();
      const productId = createResult.product?.id || createResult.id;

      // Free plan: auto-activate
      if (finalPlan.price === 0) {
        await fetch(`${API_BASE}/products/${productId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: finalPlan.id }),
        });
        alert("✅ Product created and published!");
        clearDraft();
        return;
      }

      // Paid plan: initialize payment
      const payRes = await fetch(`${API_BASE}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          productId,
          planId: finalPlan.id,
        }),
      });

      const payResult = await payRes.json();
      if (!payResult.success || !payResult.authorization_url) {
        setPaymentData({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          productId,
          planId: finalPlan.id,
        });
        throw new Error(payResult.error || "Payment init failed");
      }

      // Save for retry & redirect
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(payResult));
      window.location.href = payResult.authorization_url;

    } catch (err) {
      setError(err.message);
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= RETRY PAYMENT ================= */
  const retryPayment = async () => {
    if (!paymentData) {
      setError("No payment data found");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      const data = await res.json();
      if (data.success && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error(data.error || "Retry failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {error && (
        <div className="error-banner" style={{
          background: "#fee2e2", color: "#dc2626", padding: "1rem", 
          borderRadius: "8px", marginBottom: "1rem", border: "1px solid #fecaca"
        }}>
          {error}
        </div>
      )}

      {/* TITLE */}
      <div className="form-section-round">
        <label>Product Title *</label>
        <input
          placeholder="Enter product title (min 10 chars)"
          value={form.title}
          onChange={e => update("title", e.target.value)}
        />
      </div>

      {/* DESCRIPTION */}
      <div className="form-section-round">
        <label>Description *</label>
        <textarea
          placeholder="Detailed description (min 20 chars)"
          value={form.description}
          onChange={e => update("description", e.target.value)}
          rows="4"
        />
      </div>

      {/* PRICE */}
      <div className="form-section-round">
        <label>Price (₦) *</label>
        <input
          placeholder="Enter price"
          value={formatPrice(form.price)}
          onChange={e => update("price", onlyNumbers(e.target.value))}
        />
      </div>

      {/* EMAIL */}
      <div className="form-section-round">
        <label>Email *</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={form.contact.email}
          onChange={e => updateContact("email", e.target.value)}
        />
      </div>

      {/* CATEGORY */}
      <div className="form-section-round">
        <label>Category *</label>
        <DropdownModal
          label=""
          value={form.category_id}
          onChange={v => {
            setForm(prev => ({
              ...prev,
              category_id: v,
              attributes: INITIAL_FORM.attributes,
            }));
          }}
          options={categories.map(c => ({ id: c.id, name: c.name }))}
        />
      </div>

      {/* DYNAMIC FIELDS */}
      {fields.map(field => {
        if (!optionsMap[field]) return null;
        if (field === "used_detail" && attrs.condition !== "used") return null;
        return (
          <div key={field} className="form-section-round">
            <label>{formatLabel(field)}</label>
            <DropdownModal
              label=""
              value={attrs[field] || ""}
              onChange={v => updateAttr(field, v)}
              options={optionsMap[field]}
            />
          </div>
        );
      })}

      {/* FEATURES */}
      {Array.isArray(options.features) && options.features.length > 0 && (
        <div className="form-section-round">
          <label>Features</label>
          <div className="checkbox-grid-inline">
            {options.features.map(feat => (
              <label key={feat} className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={attrs.features.includes(feat)}
                  onChange={() => toggleFeature(feat)}
                />
                <span>{formatLabel(feat)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* DELIVERY */}
      <div className="form-section-round">
        <label>
          <input
            type="checkbox"
            checked={form.delivery.available}
            onChange={e => updateDelivery("available", e.target.checked)}
          />
          Delivery Available
        </label>
        {form.delivery.available && (
          <div className="sub-grid">
            <div className="form-section-round-small">
              <label>From (days)</label>
              <input
                value={form.delivery.duration.from}
                onChange={e => updateDeliveryDuration("from", e.target.value)}
              />
            </div>
            <div className="form-section-round-small">
              <label>To (days)</label>
              <input
                value={form.delivery.duration.to}
                onChange={e => updateDeliveryDuration("to", e.target.value)}
              />
            </div>
            <div className="form-section-round-small">
              <label>Fee (₦)</label>
              <input
                value={formatPrice(form.delivery.fee)}
                onChange={e => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* LOCATION */}
      <div className="form-section-round">
        <label>State *</label>
        <DropdownModal
          label=""
          value={state}
          onChange={setState}
          options={states.map(s => ({ id: s, name: s }))}
        />
      </div>
      {state && (
        <div className="form-section-round">
          <label>City *</label>
          <DropdownModal
            label=""
            value={city}
            onChange={setCity}
            options={cities.map(c => ({ id: c, name: c }))}
          />
        </div>
      )}

      {/* PHONE */}
      <div className="form-section-round">
        <label>Phone *</label>
        <input
          placeholder="08012345678"
          value={form.contact.phone}
          onChange={e => updateContact("phone", onlyNumbers(e.target.value))}
        />
      </div>

      {/* IMAGES */}
      <div className="form-section-round">
        <label>Images * (max 8)</label>
        <input
          type="file"
          multiple accept="image/*"
          onChange={e => handleImages(e.target.files)}
        />
        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i} className="preview-item">
              <img src={src} alt={`Preview ${i + 1}`} />
              <button type="button" onClick={() => removeImage(i)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* PROMOTION PLANS */}
      <div className="form-section-round">
        <label>Promotion Plan</label>
        <div className="plans-grid">
          {promotionPlans.map(plan => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="plan-header">
                <strong>{plan.name}</strong>
                <span className="plan-price">₦{formatPrice(plan.price.toString())}</span>
              </div>
              <div className="plan-duration">{plan.duration}</div>
              <ul className="plan-features">
                {plan.features.map((feat, i) => <li key={i}>{feat}</li>)}
              </ul>
              {plan.description && <p className="plan-desc">{plan.description}</p>}
            </div>
          ))}
        </div>
        {selectedPlan && (
          <div style={{ fontSize: "0.9em", opacity: 0.8, marginTop: "0.5rem" }}>
            Selected: <strong>{selectedPlan.name}</strong> - ₦{formatPrice(selectedPlan.price.toString())}
          </div>
        )}
      </div>

      {/* BUTTONS */}
      <div className="form-section-round button-section">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="primary-btn"
          style={{ width: "100%", padding: "1.2rem", fontSize: "1.1em" }}
        >
          {loading ? "⏳ Processing..." : 
           (selectedPlan?.price === 0 || !selectedPlan) 
            ? "✅ Create Free Product" 
            : `💳 Pay ₦${formatPrice(selectedPlan.price.toString())} & Publish`}
        </button>

        {paymentData && (
          <button
            onClick={retryPayment}
            disabled={loading}
            className="retry-btn"
            style={{ width: "100%", padding: "1rem", marginTop: "0.5rem" }}
          >
            🔄 Retry Payment
          </button>
        )}
      </div>
    </div>
  );
}