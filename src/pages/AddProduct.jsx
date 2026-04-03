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
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

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
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  /* ================= DRAFT EFFECTS ================= */
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (!loading) saveDraft();
  }, [saveDraft, loading]);

  /* ================= PAYMENT PERSISTENCE ================= */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) {
      try {
        setPaymentData(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem(STORAGE_PAYMENT);
      }
    }
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
    }
  }, [paymentData]);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= UTILITY FUNCTIONS ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [];

  const onlyNumbers = (v = "") => v.replace(/D/g, "");

  const formatPrice = (v) => {
    const num = v.replace(/D/g, "");
    return num ? new Intl.NumberFormat("en-NG").format(Number(num)) : "";
  };

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase());

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

  const sortedFeatures = useMemo(() => {
    return [...(options.features || [])].sort((a, b) => a.localeCompare(b));
  }, [options.features]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [options]);

  /* ================= FORM UPDATERS ================= */
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
          features: exists ? list.filter((f) => f !== feature) : [...list, feature],
        },
      };
    });
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (form.title.length < 10) return "Title too short";
    if (form.description.length < 20) return "Description too short";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone) return "Phone required";
    if (!form.contact.email) return "Email required";
    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Delivery range required";
      if (to < from) return "Invalid delivery range";
    }
    return null;
  };

  /* ================= IMAGE HANDLING ================= */
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

  /* ================= NEW TRANSACTION FLOW ================= */
  const createProduct = async () => {
    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
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
    };

    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    images.forEach((img) => fd.append("images", img));

    const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Network error" }));
      throw new Error(error.message || "Product creation failed");
    }

    const data = await res.json();
    return data.product;
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

  const activateFreeProduct = async (productId) => {
    await fetch(`https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`, {
      method: "POST",
    });
  };

  const handleSubmit = async () => {
    if (loading) return;

    const err = validate();
    if (err) return alert(err);

    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    setLoading(true);

    try {
      // STEP 1: Create product (always "pending_payment" state)
      const product = await createProduct();
      const productId = product?.id;

      if (!productId) {
        throw new Error("Failed to create product");
      }

      // STEP 2: Free plan → activate immediately
      if (finalPlan.price === 0) {
        await activateFreeProduct(productId);
        clearDraft();
        alert("✅ Product created successfully!");
        setLoading(false);
        return;
      }

      // STEP 3: Paid plan → start payment
      const authUrl = await startPayment(productId, finalPlan);
      
      // Save payment data for retry
      setPaymentData({
        email: form.contact.email,
        amount: Number(finalPlan.price),
        planId: finalPlan.id,
        productId,
      });

      // Redirect to payment
      window.location.href = authUrl;
    } catch (err) {
      console.error("Submit error:", err);
      alert(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  const retryPayment = async () => {
    if (!paymentData) return alert("No payment data found");

    setLoading(true);

    try {
      const authUrl = await startPayment(paymentData.productId, {
        id: paymentData.planId,
        price: paymentData.amount,
      });
      window.location.href = authUrl;
    } catch (err) {
      alert(err.message || "Payment retry failed");
      setLoading(false);
    }
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= RENDER ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* BASIC FIELDS */}
      <div className="form-section-round">
        <label>Product Title</label>
        <input
          placeholder="Enter product title (min 10 chars)"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Description</label>
        <textarea
          placeholder="Detailed description (min 20 chars)"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          rows="4"
        />
      </div>

      <div className="form-section-round">
        <label>Price (₦)</label>
        <input
          placeholder="0"
          value={formatPrice(form.price)}
          onChange={(e) => update("price", onlyNumbers(e.target.value))}
        />
      </div>

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
      {sortedFeatures.length > 0 && (
        <div className="form-section-round">
          <label>Features</label>
          <div className="checkbox-grid-inline">
            {sortedFeatures.map((f) => (
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
        <label>State</label>
        <DropdownModal label="" value={state} onChange={setState} options={states} />
      </div>

      {state && (
        <div className="form-section-round">
          <label>City</label>
          <DropdownModal label="" value={city} onChange={setCity} options={cities} />
        </div>
      )}

      <div className="form-section-round">
        <label>Phone</label>
        <input
          placeholder="08012345678"
          value={form.contact.phone}
          onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))}
        />
      </div>

      {/* IMAGES */}
      <div className="form-section-round">
        <label>Product Images (max 8)</label>
        <input type="file" multiple accept="image/*" onChange={(e) => handleImages(e.target.files)} />
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
      </div>

      {/* SUBMIT BUTTONS */}
      <div className="form-section-round button-section">
        <button onClick={handleSubmit} disabled={loading} className="primary-btn">
          {loading ? "Processing..." : "Create Product"}
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