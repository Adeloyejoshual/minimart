import { useEffect, useMemo, useState, useCallback } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

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
    available: true,
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
  // Core state
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  // Computed values
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  // Utilities
  const normalizeOptions = useCallback((list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : []
  , []);

  const onlyNumbers = useCallback((v = "") => v.replace(/D/g, ""), []);
  const formatPrice = useCallback((v) => {
    const num = v.replace(/D/g, "");
    return num ? new Intl.NumberFormat("en-NG").format(Number(num)) : "";
  }, []);

  const formatLabel = useCallback((t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase())
  , []);

  const optionsMap = useMemo(() => ({
    brand: normalizeOptions(options.brands),
    model: normalizeOptions(brand && options.models?.[brand] ? options.models[brand] : []),
    color: normalizeOptions(options.colors),
    condition: normalizeOptions(options.conditions),
    used_detail: normalizeOptions(options.usedDetails),
    ram: normalizeOptions(options.ram),
    storage: normalizeOptions(options.storage),
    sim: normalizeOptions(options.sims),
    year: normalizeOptions(options.years),
    engine: normalizeOptions(options.engines),
    fuel_type: normalizeOptions(options.fuel_types),
  }), [options, brand, normalizeOptions]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [options]);

  // Form update helpers
  const updateFormField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }),
      },
    }));
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

  // Draft management
  const saveDraft = useCallback(() => {
    const draft = {
      form,
      state,
      city,
      selectedPlan: selectedPlan?.id || null,
    };
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [form, state, city, selectedPlan]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(draft.form);
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
    setPreviews([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  // Validation
  const validate = useCallback(() => {
    if (form.title.length < 10) return "Title too short (min 10 chars)";
    if (form.description.length < 20) return "Description too short (min 20 chars)";
    if (!form.price) return "Price is required";
    if (!form.category_id) return "Please select a category";
    if (!form.contact.phone) return "Phone number is required";
    if (!form.contact.email) return "Email is required";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Delivery duration required";
      if (to < from) return "To date must be after From date";
    }
    return null;
  }, [form]);

  // Image handlers
  const handleImages = useCallback((files) => {
    const list = Array.from(files).slice(0, 8);
    previews.forEach(URL.revokeObjectURL);
    setImages(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  }, [previews]);

  const removeImage = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Effects
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (!loading) saveDraft();
  }, [saveDraft, loading]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
    }
  }, [paymentData]);

  // Payment handlers
  const retryPayment = useCallback(async () => {
    if (!paymentData) return alert("No payment data found to retry");

    try {
      setLoading(true);
      const res = await fetch("https://minimart-ivrm.onrender.com/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      const data = await res.json();
      if (!data.success || !data.authorization_url) {
        setLoading(false);
        return alert(data.message || "Payment initialization failed");
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      alert("Payment retry failed. Please try again.");
      setLoading(false);
    }
  }, [paymentData]);

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    const error = validate();
    if (error) return alert(error);

    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    setLoading(true);

    const fd = new FormData();
    const payload = {
      ...form,
      price: form.price.replace(/D/g, ""),
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
      promotion_plan: finalPlan.id,
      status: finalPlan.price === 0 ? "active" : "pending",
    };

    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    images.forEach((img) => fd.append("images", img));

    try {
      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Product creation failed");

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (finalPlan.price === 0) {
        alert("✅ Product created successfully!");
        clearDraft();
        setLoading(false);
        return;
      }

      // Initialize payment
      const payRes = await fetch("https://minimart-ivrm.onrender.com/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          planId: finalPlan.id,
          productId,
        }),
      });

      const payData = await payRes.json();

      if (!payData.success || !payData.authorization_url) {
        setPaymentData({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          planId: finalPlan.id,
          productId,
        });
        setLoading(false);
        return alert(payData.message || "Payment initialization failed - retry available below");
      }

      window.location.href = payData.authorization_url;
    } catch (err) {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [form, state, city, images, selectedPlan, loading, validate, clearDraft]);

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* Basic Info */}
      <div className="form-section-round">
        <label>Product Title</label>
        <input
          placeholder="Enter product title (min 10 chars)"
          value={form.title}
          onChange={(e) => updateFormField("title", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Description</label>
        <textarea
          placeholder="Detailed description (min 20 chars)"
          value={form.description}
          onChange={(e) => updateFormField("description", e.target.value)}
          rows="4"
        />
      </div>

      <div className="form-section-round">
        <label>Price (₦)</label>
        <input
          placeholder="0"
          value={formatPrice(form.price)}
          onChange={(e) => updateFormField("price", onlyNumbers(e.target.value))}
        />
      </div>

      {/* Category & Dynamic Fields */}
      <div className="form-section-round">
        <label>Category</label>
        <DropdownModal
          label=""
          value={form.category_id}
          onChange={(v) =>
            setForm((prev) => ({
              ...prev,
              category_id: v,
              attributes: INITIAL_FORM.attributes,
            }))
          }
          options={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      {fields.map((field) => {
        if (!optionsMap[field]) return null;
        if (field === "used_detail" && attributes.condition !== "used") return null;

        return (
          <div key={field} className="form-section-round">
            <label>{formatLabel(field)}</label>
            <DropdownModal
              label=""
              value={attributes[field] || ""}
              onChange={(v) => updateAttribute(field, v)}
              options={optionsMap[field]}
            />
          </div>
        );
      })}

      {/* Features */}
      {Array.isArray(options.features) && options.features.length > 0 && (
        <div className="form-section-round">
          <label>Features</label>
          <div className="checkbox-grid-inline">
            {options.features.map((feature) => (
              <label key={feature} className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={attributes.features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                />
                <span>{formatLabel(feature)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Contact Info */}
      <div className="form-section-round">
        <label>Email</label>
        <input
          placeholder="your@email.com"
          type="email"
          value={form.contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Phone</label>
        <input
          placeholder="08012345678"
          value={form.contact.phone}
          onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))}
        />
      </div>

      {/* Location */}
      <div className="form-section-round">
        <label>State</label>
        <DropdownModal label="" value={state} onChange={setState} options={states} />
      </div>

      {state && (
        <div className="form-section-round">
          <label>City</label>
          <DropdownModal label="" value={city} onChange={setCity} options={cities} />
        </div>
      )}

      {/* Delivery */}
      <div className="form-section-round">
        <label>
          <input
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) => updateDelivery("available", e.target.checked)}
          />
          Delivery Available
        </label>
        {form.delivery.available && (
          <div className="sub-grid">
            <div className="form-section-round-small">
              <label>From (days)</label>
              <input
                value={form.delivery.duration.from}
                onChange={(e) => updateDeliveryDuration("from", e.target.value)}
              />
            </div>
            <div className="form-section-round-small">
              <label>To (days)</label>
              <input
                value={form.delivery.duration.to}
                onChange={(e) => updateDeliveryDuration("to", e.target.value)}
              />
            </div>
            <div className="form-section-round-small">
              <label>Fee (₦)</label>
              <input
                value={formatPrice(form.delivery.fee)}
                onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Images */}
      <div className="form-section-round">
        <label>Product Images (max 8)</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleImages(e.target.files)}
        />
        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i} className="preview-item">
              <img src={src} alt={`Preview ${i + 1}`} />
              <button type="button" onClick={() => removeImage(i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Promotion Plans */}
      <div className="form-section-round">
        <label>Promotion Plan</label>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
              onClick={() => setSelectedPlan(plan)}
              role="button"
              tabIndex={0}
            >
              <div className="plan-header">
                <strong>{plan.name}</strong>
                <span className="plan-price">₦{formatPrice(plan.price.toString())}</span>
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
      </div>

      {/* Actions */}
      <div className="form-section-round button-section">
        <button onClick={handleSubmit} disabled={loading} className="primary-btn">
          {loading ? "Uploading..." : "Create Product"}
        </button>
        {paymentData && (
          <button onClick={retryPayment} disabled={loading} className="retry-btn">
            {loading ? "Retrying..." : "Retry Payment"}
          </button>
        )}
      </div>
    </div>
  );
}