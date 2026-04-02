import { useEffect, useMemo, useState, useCallback } from "react";
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

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  const isSlowDevice = () =>
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4 ||
    /Android|iPhone|iPad/i.test(navigator.userAgent);

  const compressImage = async (file) => {
    return await imageCompression(file, {
      maxSizeMB: isSlowDevice() ? 0.4 : 0.8,
      maxWidthOrHeight: isSlowDevice() ? 900 : 1280,
      useWebWorker: true,
    });
  };

  /* ================= CORE UTILITIES ================= */
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
  const displayPrice = (v) =>
    v ? new Intl.NumberFormat("en-NG").format(Number(v)) : "";

  const formatLabel = (t) =>
    t
      .replace(/_/g, " ")
      .replace(/\bw/g, (l) => l.toUpperCase());

  /* ================= DYNAMIC OPTIONS MAP ================= */
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
  }, [options, brand]);

  const sortedFeatures = useMemo(() => {
    return [...(options.features || [])].sort((a, b) => a.localeCompare(b));
  }, [options.features]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [options]);

  /* ================= DRAFT MANAGEMENT ================= */
  const saveDraft = useCallback(() => {
    if (loading) return;
    const draft = {
      form,
      state,
      city,
      selectedPlan: selectedPlan?.id || null,
    };
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
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    // activeImage auto‑cleared on unmount
  }, []);

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
    if (form.title.length < 10) return "Title too short (min 10 chars)";
    if (form.description.length < 20) return "Description too short (min 20 chars)";
    if (!form.price || Number(form.price) <= 0) return "Valid price required";
    if (!form.category_id) return "Select a category";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Valid phone required";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Valid email required";
    if (images.length === 0) return "Add at least 1 image";
    if (!state || !city) return "Select state and city";

    if (form.delivery.type !== "none" && form.delivery.type !== "pickup") {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Delivery range required";
      if (to < from) return "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) return "Delivery fee required";
    }

    return null;
  };

  /* ================= IMAGE HANDLING ================= */
  const handleImages = (files) => {
    const fileArray = Array.from(files);

    if (images.length >= MAX_IMAGES) return;

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
  };

  const removeImage = (id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  /* ================= EFFECTS ================= */
  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Autosave draft (debounced)
  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(saveDraft, 800);
      return () => clearTimeout(timeout);
    }
  }, [form, state, city, selectedPlan, loading, saveDraft]);

  // Load payment retry data
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

  // Save payment data
  useEffect(() => {
    if (paymentData) {
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
    }
  }, [paymentData]);

  // Fetch categories
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Initialize attributes when category changes
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

  // Cleanup image URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, [images]);

  /* ================= API FUNCTIONS ================= */
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

    const compressedFiles = await Promise.all(
      images.map((img) => compressImage(img.file))
    );

    compressedFiles.forEach((file) => {
      fd.append("images", file);
    });

    const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to save product draft");
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

  /* ================= SUBMIT HANDLERS ================= */
  const handleSubmit = async () => {
    if (loading) return;

    const error = validate();
    if (error) {
      alert(error);
      return;
    }

    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    setLoading(true);

    try {
      const product = await createProductDraft();
      const productId = product?.id;

      if (!productId) throw new Error("Failed to create product draft");

      if (finalPlan.price === 0) {
        await fetch(`https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`, {
          method: "POST",
        });
        clearDraft();
        alert("✅ Product created and activated successfully!");
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
      alert(`Error: ${err.message || "Something went wrong"}`);
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async () => {
    if (!paymentData) return alert("No pending payment found");

    setLoading(true);
    try {
      const plan = { id: paymentData.planId, price: paymentData.amount };
      const authUrl = await startPayment(paymentData.productId, plan);
      window.location.href = authUrl;
    } catch (err) {
      alert(`Payment retry failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ================= RENDER ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* BASIC INFO */}
      <div className="form-section-round">
        <label>Product Title <span className="required">*</span></label>
        <input
          placeholder="Enter product title (min 10 chars)"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Description <span className="required">*</span></label>
        <textarea
          placeholder="Detailed description (min 20 chars)"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          rows="4"
        />
      </div>

      <div className="form-section-round">
        <label>Price (₦) <span className="required">*</span></label>
        <input
          placeholder="0"
          value={displayPrice(form.price)}
          onChange={(e) => update("price", onlyNumbers(e.target.value))}
        />
        {form.price && <small>₦{displayPrice(form.price)}</small>}
      </div>

      {/* CATEGORY & DYNAMIC FIELDS */}
      <div className="form-section-round">
        <label>Category <span className="required">*</span></label>
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

      {fields.map((f) => {
        if (!optionsMap[f] && f !== "features") return null;
        if (f === "used_detail" && attributes.condition !== "Used") return null;

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

      {/* FEATURES - RIGHT-ALIGNED CHECKBOXES */}
      {sortedFeatures.length > 0 && (
        <div className="form-section-round">
          <label>Features</label>
          <div className="checkbox-grid-inline">
            {sortedFeatures.map((f) => (
              <label key={f} className="checkbox-inline right-check">
                <span>{formatLabel(f)}</span>
                <input
                  type="checkbox"
                  checked={(attributes.features || []).includes(f)}
                  onChange={() => toggleFeature(f)}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* CONTACT */}
      <div className="form-section-round">
        <label>Email <span className="required">*</span></label>
        <input
          type="email"
          placeholder="your@email.com"
          value={form.contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Phone <span className="required">*</span></label>
        <input
          placeholder="08012345678"
          value={form.contact.phone}
          onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))}
        />
      </div>

      {/* LOCATION */}
      <div className="form-section-round">
        <label>State <span className="required">*</span></label>
        <DropdownModal label="" value={state} onChange={setState} options={states} />
      </div>

      {state && (
        <div className="form-section-round">
          <label>City <span className="required">*</span></label>
          <DropdownModal label="" value={city} onChange={setCity} options={cities} />
        </div>
      )}

            {/* DELIVERY */}
      <div className="form-section-round">
        <label>Delivery Type</label>
        <select
          value={form.delivery.type}
          onChange={(e) => updateDelivery("type", e.target.value)}
        >
          <option value="none">No delivery</option>
          <option value="standard">Standard delivery</option>
          <option value="express">Express delivery</option>
          <option value="pickup">Pickup only</option>
        </select>
      </div>

      {form.delivery.type !== "none" && form.delivery.type !== "pickup" && (
        <div className="sub-grid">
          <div className="form-section-round-small">
            <label>From (days) <span className="required">*</span></label>
            <input
              type="number"
              min="1"
              value={form.delivery.duration.from}
              onChange={(e) => updateDeliveryDuration("from", onlyNumbers(e.target.value))}
            />
          </div>
          <div className="form-section-round-small">
            <label>To (days) <span className="required">*</span></label>
            <input
              type="number"
              min="1"
              value={form.delivery.duration.to}
              onChange={(e) => updateDeliveryDuration("to", onlyNumbers(e.target.value))}
            />
          </div>
          <div className="form-section-round-small">
            <label>Fee (₦) <span className="required">*</span></label>
            <input
              type="number"
              min="0"
              value={form.delivery.fee}
              onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* IMAGES */}
      <div className="form-section-round">
        <label>
          Product Images (max 6, 3MB each) <span className="required">*</span>
        </label>

        {images.length > 0 && (
          <div className="preview-grid-modern">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="preview-thumb"
                draggable
                onClick={() => setActiveImage(img.preview)}
                onDragStart={(e) => e.dataTransfer.setData("index", i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = Number(e.dataTransfer.getData("index"));

                  setImages((prev) => {
                    const copy = [...prev];
                    const [moved] = copy.splice(from, 1);
                    copy.splice(i, 0, moved);
                    return copy;
                  });
                }}
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
              <label className="add-image-box">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImages(e.target.files)}
                />
                + Add
              </label>
            )}
          </div>
        )}
      </div>

      {/* PROMOTION PLANS */}
      <div className="form-section-round">
        <label>Promotion Plan (Optional)</label>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="plan-header">
                <strong>{plan.name}</strong>
                <span className="plan-price">₦{displayPrice(plan.price.toString())}</span>
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

      {/* ACTION BUTTONS */}
      <div className="form-section-round button-section">
        <button 
          onClick={handleSubmit} 
          disabled={loading}
          className="primary-btn"
        >
          {loading ? "Processing..." : "Create Product"}
        </button>
        {paymentData && (
          <button 
            onClick={retryPayment} 
            disabled={loading}
            className="retry-btn"
          >
            {loading ? "Retrying..." : "Retry Payment"}
          </button>
        )}
      </div>

      {/* FULLSCREEN IMAGE PREVIEW */}
      {activeImage && (
        <div
          className="image-modal"
          onClick={() => setActiveImage(null)}
        >
          <img src={activeImage} alt="preview" />
        </div>
      )}
    </div>
  );
}