import { useEffect, useMemo, useState, useCallback } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "../styles/AddProduct.css";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

/* ================= INITIAL FORM ================= */
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
    available: true,
    duration: { from: "", to: "" },
    fee: "",
    type: "optional",
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
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [productId, setProductId] = useState(null);
  const [error, setError] = useState("");

  /* ================= AUTO-SAVE DRAFT ================= */
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
        setState(draft.state);
        setCity(draft.city);
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
    setProductId(null);
    setError("");
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  /* ================= EFFECTS ================= */
  useEffect(() => {
    loadDraft();
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, [loadDraft]);

  useEffect(() => {
    if (!loading) saveDraft();
  }, [saveDraft, loading]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  /* ================= UTILITIES ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  const onlyNumbers = (v = "") => v.replace(/D/g, "");
  const formatPrice = (v) =>
    v ? new Intl.NumberFormat("en-NG").format(Number(v.replace(/D/g, ""))) : "";
  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase());

  const optionsMap = useMemo(() => {
    const modelsForBrand =
      brand && options.models?.[brand] ? options.models[brand] : [];
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
  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }),
      },
    }));
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
  const toggleFeature = (feature) => {
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
  };

  /* ================= VALIDATION & SUBMIT ================= */
  const validate = () => {
    if (form.title.length < 10) return "Title too short (min 10 chars)";
    if (form.description.length < 20)
      return "Description too short (min 20 chars)";
    if (!form.price || Number(form.price.replace(/D/g, "")) <= 0)
      return "Valid price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone required";
    if (!form.contact.email || !form.contact.email.includes("@"))
      return "Valid email required";
    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to))
        return "Delivery range required";
      if (to < from) return "Invalid delivery range (to > from)";
    }
    if (!state || !city) return "Select state and city";
    if (images.length === 0) return "Add at least 1 image";
    return null;
  };

  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);
    previews.forEach(URL.revokeObjectURL);
    setImages(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, x) => x !== i);
    });
  };

  const createProductDraft = async () => {
    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    const err = validate();
    if (err) {
      setError(err);
      return null;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("title", form.title.trim());
    formData.append("description", form.description);
    formData.append("price", form.price.replace(/D/g, ""));
    formData.append("category_id", form.category_id);
    if (form.subcategory_id) formData.append("subcategory_id", form.subcategory_id);
    formData.append("attributes", JSON.stringify(form.attributes));
    formData.append("delivery", JSON.stringify(form.delivery));
    formData.append("contact", JSON.stringify(form.contact));
    formData.append("location_state", state);
    formData.append("location_city", city);
    formData.append("user_id", "current_user_uuid"); // Replace with real user ID
    images.forEach((img) => formData.append("images", img));

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create product");
      }

      const result = await res.json();
      return result.product?.id || result.id;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async (productId) => {
    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    const email = form.contact.email;

    try {
      const res = await fetch(`${API_BASE}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: finalPlan.price,
          productId,
          planId: finalPlan.id,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.authorization_url) {
        throw new Error(data.error || "Payment initialization failed");
      }
      return data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;

    // Free plan - direct activation
    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    if (finalPlan.price === 0) {
      const productId = await createProductDraft();
      if (productId) {
        await fetch(`${API_BASE}/products/${productId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: finalPlan.id }),
        });
        alert("✅ Product created and activated successfully!");
        clearDraft();
      }
      return;
    }

    // Paid plan flow
    const productId = await createProductDraft();
    if (!productId) return;

    try {
      const payment = await initiatePayment(productId);
      
      // Save for retry
      setPaymentData({
        email: form.contact.email,
        amount: finalPlan.price,
        productId,
        planId: finalPlan.id,
      });
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));

      // Redirect to Paystack
      window.location.href = payment.authorization_url;
    } catch (err) {
      setError(err.message);
      setPaymentData({
        email: form.contact.email,
        amount: finalPlan.price,
        productId,
        planId: finalPlan.id,
      });
    }
  };

  const retryPayment = async () => {
    if (!paymentData?.productId) return alert("No payment data found");

    try {
      setLoading(true);
      const payment = await initiatePayment(paymentData.productId);
      window.location.href = payment.authorization_url;
    } catch (err) {
      alert("Retry failed: " + err.message);
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
        <div className="error-banner" style={{ color: 'red', padding: '1rem', background: '#fee' }}>
          {error}
        </div>
      )}

      {/* FORM SECTIONS */}
      <div className="form-section-round">
        <label>Product Title *</label>
        <input
          placeholder="Enter product title (min 10 chars)"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Description *</label>
        <textarea
          placeholder="Detailed description (min 20 chars)"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          rows="4"
        />
      </div>

      <div className="form-section-round">
        <label>Price (₦) *</label>
        <input
          placeholder="0"
          value={formatPrice(form.price)}
          onChange={(e) => update("price", onlyNumbers(e.target.value))}
        />
      </div>

      <div className="form-section-round">
        <label>Email *</label>
        <input
          placeholder="your@email.com"
          type="email"
          value={form.contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Category *</label>
        <DropdownModal
          label=""
          value={form.category_id}
          onChange={(v) => {
            setForm((prev) => ({
              ...prev,
              category_id: v,
              attributes: INITIAL_FORM.attributes,
            }));
          }}
          options={categories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
        />
      </div>

      {/* DYNAMIC FIELDS */}
      {fields.map((f) => {
        if (!optionsMap[f]) return null;
        if (f === "used_detail" && attributes.condition !== "used") return null;

        return (
          <div key={f} className="form-section-round">
            <label>{formatLabel(f)}</label>
            <DropdownModal
              label=""
              value={attributes[f] || ""}
              onChange={(v) => updateAttr(f, v)}
              options={optionsMap[f]}
            />
          </div>
        );
      })}

      {/* FEATURES */}
      {Array.isArray(options.features) && options.features.length > 0 && (
        <div className="form-section-round">
          <label>Features</label>
          <div className="checkbox-grid-inline">
            {options.features.map((f) => (
              <label key={f} className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={attributes.features.includes(f)}
                  onChange={() => toggleFeature(f)}
                />
                <span>{formatLabel(f)}</span>
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

      {/* LOCATION */}
      <div className="form-section-round">
        <label>State *</label>
        <DropdownModal
          label=""
          value={state}
          onChange={setState}
          options={states.map((s) => ({ id: s, name: s }))}
        />
      </div>

      {state && (
        <div className="form-section-round">
          <label>City *</label>
          <DropdownModal
            label=""
            value={city}
            onChange={setCity}
            options={cities.map((c) => ({ id: c, name: c }))}
          />
        </div>
      )}

      <div className="form-section-round">
        <label>Phone *</label>
        <input
          placeholder="08012345678"
          value={form.contact.phone}
          onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))}
        />
      </div>

      <div className="form-section-round">
        <label>Product Images * (max 8)</label>
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
              <button type="button" onClick={() => removeImage(i)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* PROMOTION PLANS */}
      <div className="form-section-round">
        <label>Promotion Plan</label>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
              onClick={() => setSelectedPlan(plan)}
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
        {selectedPlan && (
          <div style={{ fontSize: "0.9em", opacity: 0.7 }}>
            Selected: {selectedPlan.name} - ₦{formatPrice(selectedPlan.price.toString())}
          </div>
        )}
      </div>

      {/* SUBMIT BUTTONS */}
      <div className="form-section-round button-section">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="primary-btn"
          style={{ width: "100%", padding: "1rem" }}
        >
          {loading
            ? "Processing..."
            : selectedPlan?.price === 0 || !selectedPlan
            ? "Create Product (Free)"
            : "Pay & Create"}
        </button>

        {paymentData && (
          <button
            onClick={retryPayment}
            disabled={loading}
            className="retry-btn"
            style={{ width: "100%", padding: "1rem", marginTop: "0.5rem" }}
          >
            {loading ? "Retrying..." : "Retry Payment"}
          </button>
        )}
      </div>
    </div>
  );
}