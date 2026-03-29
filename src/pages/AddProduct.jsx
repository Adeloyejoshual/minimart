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
  promotion_id: "",
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

const calculateDiscountedPrice = (price, discount) => {
  if (!price) return 0;
  return price - (price * discount) / 100;
};

/* ================= COMPONENT ================= */
export default function AddProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [progress, setProgress] = useState(0);

  const [error, setError] = useState(null);
  const [isValid, setIsValid] = useState(false);

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setError("Failed to load categories"));

    fetch(`${API_BASE}/promotion-plans`)
      .then((r) => r.json())
      .then(setPromotions)
      .catch(() => {});
  }, []);

  const selectedPromotion = useMemo(
    () =>
      promotions.find((p) => String(p.id) === String(form.promotion_id)),
    [promotions, form.promotion_id]
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const activeRule = useMemo(() => {
    return categoryRules[selectedCategory?.name] || categoryRules.default;
  }, [selectedCategory]);

  /* ================= IMAGE ================= */
  const handleImages = async (files) => {
    const raw = Array.from(files);

    if (images.length + raw.length > (activeRule.maxImages || 10))
      return setError(`Max ${activeRule.maxImages || 10} images`);

    setImages((p) => [...p, ...raw]);
    setPreviews((p) => [...p, ...raw.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => p.filter((_, x) => x !== i));
  };

  /* ================= VALIDATION ================= */
  const validate = useCallback(() => {
    if (!form.title.trim()) return "Title required";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";
    if (!state || !city) return "Select location";
    if (images.length < 1) return "At least 1 image required";
    return null;
  }, [form, state, city, images.length]);

  useEffect(() => {
    const err = validate();
    setError(err);
    setIsValid(!err);
  }, [validate]);

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return setError(err);

    setLoading(true);

    try {
      const price = Number(onlyNumbers(form.price));
      const discount = selectedPromotion?.discount || 0;

      const finalPrice = calculateDiscountedPrice(price, discount);

      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: finalPrice,
          original_price: price,
          promotion_id: form.promotion_id || null,
          promotion_expires_at: selectedPromotion
            ? new Date(
                Date.now() + selectedPromotion.duration * 86400000
              )
            : null,
          location_state: state,
          location_city: city,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      alert("✅ Product created!");
      navigate("/marketplace");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* LOCATION */}
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option>Select State</option>
          {Object.keys(locationsByState).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {state && (
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option>Select City</option>
            {locationsByState[state].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}

        {/* PROMOTIONS */}
        <div className="form-section">
          <h3>Boost Listing 🚀</h3>

          <select
            value={form.promotion_id}
            onChange={(e) =>
              setForm({ ...form, promotion_id: e.target.value })
            }
          >
            <option value="">No Promotion</option>
            {promotions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - ₦{p.price}
              </option>
            ))}
          </select>

          {selectedPromotion && (
            <div className="promo-preview">
              <p>🔥 {selectedPromotion.discount}% discount applied</p>
              <p>
                ₦{form.price} → ₦
                {formatPrice(
                  calculateDiscountedPrice(
                    Number(onlyNumbers(form.price)),
                    selectedPromotion.discount
                  ).toString()
                )}
              </p>
            </div>
          )}
        </div>

        {/* IMAGES */}
        <input
          type="file"
          multiple
          onChange={(e) => handleImages(e.target.files)}
        />

        <div className="preview-grid">
          {previews.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>

        {/* ERROR */}
        {error && <div className="error-box">{error}</div>}

        <button disabled={!isValid || loading} onClick={handleSubmit}>
          {loading ? "Creating..." : "Create Product"}
        </button>
      </div>
    </div>
  );
}