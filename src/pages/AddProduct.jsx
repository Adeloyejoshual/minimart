import { useEffect, useMemo, useState, useCallback } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

/* ================= INITIAL FORM ================= */
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

  const [images, setImages] = useState([]); // hold File objects
  const [previews, setPreviews] = useState([]); // hold URLs

  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  /* ================= LOAD DRAFT ON MOUNT ================= */
  useEffect(() => {
    const saved = localStorage.getItem("product_draft");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setForm(data.form);
        setState(data.state || "");
        setCity(data.city || "");
        setSelectedPlan(data.selectedPlan || null);

        // Note: images can’t be restored from FileList, but we can keep the draft shape
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  }, []);

  /* ================= AUTO‑SAVE DRAFT ================= */
  useEffect(() => {
    const timeout = setTimeout(() => {
      const draft = {
        form,
        state,
        city,
        selectedPlan,
      };
      localStorage.setItem("product_draft", JSON.stringify(draft));
    }, 3000);

    return () => clearTimeout(timeout);
  }, [form, state, city, selectedPlan]);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= PERSIST PAYMENT DATA ================= */
  useEffect(() => {
    const saved = localStorage.getItem("payment_retry");
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem("payment_retry", JSON.stringify(paymentData));
    }
  }, [paymentData]);

  /* ================= CATEGORY & OPTIONS ================= */
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

  /* ================= PRICE FORMATTER ================= */
  const formatPrice = (value) => {
    const num = value.replace(/D/g, "");
    return num.replace(/B(?=(d{3})+(?!d))/g, ",");
  };

  /* ================= STATE UPDATERS ================= */
  const update = useCallback((key, value) =>
    setForm((p) => ({ ...p, [key]: value })), []);

  const updateAttr = useCallback((key, value) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }),
      },
    })), []);

  const updateContact = useCallback((key, value) =>
    setForm((p) => ({
      ...p,
      contact: { ...p.contact, [key]: value },
    })), []);

  const updateDelivery = useCallback((key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, [key]: value },
    })), []);

  const updateDeliveryDuration = useCallback((key, value) =>
    setForm((p) => ({
      ...p,
      delivery: {
        ...p.delivery,
        duration: { ...p.delivery.duration, [key]: value },
      },
    })), []);

  /* ================= MULTI FEATURES ================= */
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

      if (Number.isNaN(from) || Number.isNaN(to))
        return "Delivery range required";

      if (to < from) return "Invalid delivery range";
    }

    return null;
  };

  /* ================= IMAGES HANDLING (max 7) ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 7); // enforce max 7

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

  /* ================= RETRY PAYMENT ================= */
  const retryPayment = async () => {
    if (!paymentData) return alert("No payment to retry");

    try {
      setLoading(true);

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/payment/initialize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentData),
        }
      );

      const data = await res.json();

      if (!data.success || !data.authorization_url) {
        setLoading(false);
        return alert(data.message || "Payment failed");
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      alert("Retry failed. Try again.");
      setLoading(false);
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (loading) return;

    const err = validate();
    if (err) return alert(err);

    const finalPlan =
      selectedPlan || promotionPlans.find((p) => p.price === 0);

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
      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) throw new Error();

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (finalPlan.price === 0) {
        alert("✅ Product created");
        localStorage.removeItem("product_draft");
        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setSelectedPlan(null);
        setPaymentData(null);
        localStorage.removeItem("payment_retry");
        setLoading(false);
        return;
      }

      /* 🔥 FIXED PAYMENT INIT */
      const payRes = await fetch(
        "https://minimart-ivrm.onrender.com/api/payment/initialize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.contact.email,
            amount: Number(finalPlan.price),
            planId: finalPlan.id,
            productId,
          }),
        }
      );

      const payData = await payRes.json();

      if (!payData.success || !payData.authorization_url) {
        setPaymentData({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          planId: finalPlan.id,
          productId,
        });
        setLoading(false);
        return alert(payData.message || "Payment init failed - retry below");
      }

      window.location.href = payData.authorization_url;
    } catch (err) {
      alert("Something went wrong");
      setLoading(false);
    }
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      {/* BASIC INFO */}
      <div className="form-section rounded">
        <h3>📝 Basic Information</h3>
        <input
          className="rounded-input"
          placeholder="Product Title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
        <textarea
          className="rounded-textarea"
          placeholder="Product Description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
        <input
          className="rounded-input"
          placeholder="Price (₦)"
          value={formatPrice(form.price)}
          onChange={(e) => update("price", onlyNumbers(e.target.value))}
        />
      </div>

      {/* CONTACT */}
      <div className="form-section rounded">
        <h3>✉️ Contact Information</h3>
        <input
          className="rounded-input"
          placeholder="Email"
          value={form.contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />
        <input
          className="rounded-input"
          placeholder="Phone Number"
          value={form.contact.phone}
          onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))}
        />
      </div>

      {/* CATEGORY + ATTRIBUTES */}
      <div className="form-section rounded">
        <h3>🏷️ Category & Attributes</h3>
        <DropdownModal
          label="Category"
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

        {fields.map((f) => {
          if (!optionsMap[f]) return null;
          if (f === "used_detail" && attributes.condition !== "used") return null;

          return (
            <DropdownModal
              key={f}
              label={formatLabel(f)}
              value={attributes[f] || ""}
              onChange={(v) => updateAttr(f, v)}
              options={optionsMap[f]}
            />
          );
        })}

        {/* FEATURES CHECKBOXES */}
        {Array.isArray(options.features) && options.features.length > 0 && (
          <div className="features-section">
            <h4>Features</h4>
            <div className="checkbox-grid improved">
              {options.features.map((f) => (
                <label key={f} className="checkbox-label">
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={attributes.features.includes(f)}
                      onChange={() => toggleFeature(f)}
                    />
                    <span className="checkmark"></span>
                  </div>
                  <span>{formatLabel(f)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LOCATION */}
      <div className="form-section rounded">
        <h3>📍 Location</h3>
        <DropdownModal
          label="State"
          value={state}
          onChange={setState}
          options={states}
        />
        {state && (
          <DropdownModal
            label="City"
            value={city}
            onChange={setCity}
            options={cities}
          />
        )}
      </div>

      {/* DELIVERY */}
      <div className="form-section rounded">
        <h3>🚚 Delivery</h3>
        <label className="checkbox-label">
          <div className="checkbox-container">
            <input
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) => updateDelivery("available", e.target.checked)}
            />
            <span className="checkmark"></span>
          </div>
          <span>Delivery Available</span>
        </label>

        {form.delivery.available && (
          <div className="delivery-grid">
            <input
              className="rounded-input"
              placeholder="From days"
              value={form.delivery.duration.from}
              onChange={(e) => updateDeliveryDuration("from", e.target.value)}
            />
            <input
              className="rounded-input"
              placeholder="To days"
              value={form.delivery.duration.to}
              onChange={(e) => updateDeliveryDuration("to", e.target.value)}
            />
            <input
              className="rounded-input"
              placeholder="Delivery Fee (₦)"
              value={formatPrice(form.delivery.fee)}
              onChange={(e) =>
                updateDelivery("fee", onlyNumbers(e.target.value))
              }
            />
          </div>
        )}
      </div>

      {/* IMAGES (max 7, small thumbnails) */}
      <div className="form-section rounded">
        <h3>🖼️ Product Images (max 7)</h3>
        <div className="image-preview-grid">
          {previews.map((src, i) => (
            <div key={i} className="preview-item">
              <img src={src} alt={`Preview ${i}`} className="preview-thumb" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="remove-preview"
              >
                ✕
              </button>
            </div>
          ))}

          {images.length < 7 && (
            <label className="add-image-btn">
              +
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  const remaining = 7 - images.length;
                  handleImages(files.slice(0, remaining));
                }}
              />
            </label>
          )}
        </div>

        <p className="image-hint">
          {images.length}/7 images (max 7)
        </p>
      </div>

      {/* PROMOTION PLANS */}
      <div className="form-section rounded">
        <h3>🎯 Promotion Plans</h3>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="plan-header">
                <h4>{plan.name}</h4>
                <div className="plan-price">
                  ₦{formatPrice(plan.price.toString())}
                </div>
              </div>
              <div className="plan-duration">{plan.duration}</div>
              <ul className="plan-features">
                {plan.features.map((feature, i) => (
                  <li key={i}>✅ {feature}</li>
                ))}
              </ul>
              <p className="plan-description">{plan.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMIT & RETRY BUTTONS */}
      <div className="action-buttons">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="primary-btn rounded"
        >
          {loading ? "⏳ Creating Product..." : "🚀 Create Product"}
        </button>

        {paymentData && (
          <button
            onClick={retryPayment}
            className="retry-btn rounded"
            disabled={loading}
          >
            {loading ? "🔄 Retrying..." : "🔄 Retry Payment"}
          </button>
        )}
      </div>

      {/* DRAFT INDICATOR */}
            {(form.title || form.description) && (
        <div className="draft-indicator">
          💾 Auto-saving draft...
        </div>
      )}
    </div>
  );
}