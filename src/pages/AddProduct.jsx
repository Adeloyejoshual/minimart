import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { categoryRules } from "../config/categoryRules.js";
import { locationsByState } from "../config/locationsByState.js";
import "./AddProduct.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

/* ================= INITIAL STATE ================= */
const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: { features: [], condition: "" },
  delivery: {
    available: true,
    duration: { from: 0, to: 0 },
    fee: "",
    type: "optional",
    note: "",
  },
  contact: { phone: "", whatsapp: "", preferred: "chat" },
};

/* ================= HELPERS ================= */
const onlyNumbers = (v) => v.replace(/\D/g, "");
const formatPrice = (v) =>
  onlyNumbers(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function AddProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [categories, setCategories] = useState([]);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isValid, setIsValid] = useState(false);

  /* ================= PROMOTION STATE ================= */
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [createdProductId, setCreatedProductId] = useState(null);

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setError("Failed to load categories"));

    fetch(`${API_BASE}/promotions`)
      .then((r) => r.json())
      .then(setPromotions)
      .catch(() => console.log("No promotions"));
  }, []);

  /* ================= CATEGORY RULE ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const activeRule =
    categoryRules[selectedCategory?.name] || categoryRules.default;

  /* ================= IMAGE ================= */
  const handleImages = async (files) => {
    const raw = Array.from(files);

    if (images.length + raw.length > (activeRule.maxImages || 10)) {
      return setError(`Max ${activeRule.maxImages} images`);
    }

    setImages((p) => [...p, ...raw]);
    setPreviews((p) => [
      ...p,
      ...raw.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => p.filter((_, x) => x !== i));
  };

  /* ================= VALIDATION ================= */
  const validate = useCallback(() => {
    if (!form.title) return "Title required";
    if (!form.description) return "Description required";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone) return "Phone required";
    if (!state || !city) return "Location required";
    if (!images.length) return "Upload image";

    return null;
  }, [form, images.length, state, city]);

  useEffect(() => {
    const err = validate();
    setError(err);
    setIsValid(!err);
  }, [validate]);

  /* ================= CREATE PRODUCT ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return setError(err);

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: onlyNumbers(form.price),
          location_state: state,
          location_city: city,
          image_urls: images.map((_, i) => ({
            url: previews[i],
            position: i,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setCreatedProductId(data.id);

      // 👉 Ask for promotion after success
      setShowPromotion(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= PAYSTACK PROMOTION ================= */
  const handlePromote = async () => {
    try {
      const res = await fetch(`${API_BASE}/promotions/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: createdProductId,
          plan_id: selectedPlan.id,
        }),
      });

      const data = await res.json();

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch {
      alert("Payment failed");
    }
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      <div className="form-grid">
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            setForm({ ...form, title: e.target.value })
          }
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
        />

        <input
          placeholder="Price"
          value={form.price}
          onChange={(e) =>
            setForm({
              ...form,
              price: formatPrice(e.target.value),
            })
          }
        />

        {/* CATEGORY */}
        <select
          value={form.category_id}
          onChange={(e) =>
            setForm({ ...form, category_id: e.target.value })
          }
        >
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* LOCATION */}
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">State</option>
          {Object.keys(locationsByState).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {state && (
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">City</option>
            {locationsByState[state].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}

        {/* IMAGES */}
        <input type="file" multiple onChange={(e) => handleImages(e.target.files)} />

        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i}>
              <img src={src} alt="" />
              <button onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>

        {/* ERROR */}
        {error && <div className="error-box">{error}</div>}

        {/* SUBMIT */}
        <button disabled={!isValid || loading} onClick={handleSubmit}>
          {loading ? "Creating..." : "Create Product"}
        </button>
      </div>

      {/* ================= PROMOTION MODAL ================= */}
      {showPromotion && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>🚀 Boost Your Listing</h2>

            <div className="plans-grid">
              {promotions.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card ${
                    selectedPlan?.id === plan.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <h3>{plan.name}</h3>
                  <p>{plan.duration_days} days</p>
                  <strong>₦{plan.price.toLocaleString()}</strong>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button onClick={() => navigate("/marketplace")}>
                Skip
              </button>

              {selectedPlan && (
                <button onClick={handlePromote}>
                  Pay ₦{selectedPlan.price.toLocaleString()}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}