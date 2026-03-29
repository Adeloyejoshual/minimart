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

  attributes: {
    features: [],
    condition: "",
    brand: "",
    model: "",
    color: "",
  },

  delivery: {
    available: true,
    from: 0,
    to: 0,
    fee_required: false,
    fee: "",
    note: "",
  },

  contact: {
    phone: "",
    whatsapp: "",
  },

  promotion_id: null,
};

/* ================= HELPERS ================= */
const onlyNumbers = (v = "") => v.toString().replace(/\D/g, "");
const formatPrice = (v = "") => {
  const num = onlyNumbers(v);
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/* ================= COMPONENT ================= */
export default function AddProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [payLoading, setPayLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setError("Failed to load categories"));
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = useMemo(
    () => ({
      brand: options.brands || [],
      model: options.models?.[form.attributes.brand] || [],
      color: options.colors || [],
      condition: options.conditions || [],
      ram: options.ram || [],
      storage: options.storage || [],
      sim: options.sims || [],
      year: options.years || [],
      engine: options.engines || [],
      fuel_type: options.fuel_types || [],
    }),
    [options, form.attributes.brand]
  );

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (!form.title) return "Title required";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Category required";
    if (!form.contact.phone) return "Phone required";
    if (!state || !city) return "Location required";
    return null;
  };

  /* ================= PAYSTACK INIT ================= */
  const startPayment = async (plan) => {
    try {
      setPayLoading(true);

      const res = await fetch(
        `${API_BASE}/payments/initiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_id: plan.id,
            product_id: "TEMP",
            email: form.contact.whatsapp || form.contact.phone,
          }),
        }
      );

      const data = await res.json();

      if (!data?.data?.authorization_url) {
        throw new Error("Payment initialization failed");
      }

      // Store selected plan in memory
      setSelectedPlan(plan);

      // Redirect to Paystack
      window.location.href = data.data.authorization_url;
    } catch (err) {
      setError(err.message);
    } finally {
      setPayLoading(false);
    }
  };

  /* ================= FINAL PRODUCT CREATE ================= */
  const createProduct = async (promotionRef = null) => {
    const payload = {
      ...form,
      price: onlyNumbers(form.price),
      location_state: state,
      location_city: city,
      promotion: promotionRef
        ? { reference: promotionRef, plan_id: selectedPlan?.id }
        : null,
    };

    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed to create product");

    return res.json();
  };

  /* ================= SUBMIT FLOW ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return setError(err);

    setLoading(true);

    try {
      // If user selected promotion → start payment first
      if (selectedPlan) {
        await startPayment(selectedPlan);
        return;
      }

      // Normal product creation
      await createProduct();
      alert("Product created successfully");
      navigate("/marketplace");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">

      <AddProductHeader title="Add Product" />

      <div className="form-grid">

        {/* TITLE */}
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            setForm({ ...form, title: e.target.value })
          }
        />

        {/* DESCRIPTION */}
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
        />

        {/* PRICE */}
        <input
          placeholder="Price"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: formatPrice(e.target.value) })
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

        {/* ================= PROMOTION PLAN ================= */}
        <div className="section">
          <h3>Promotion (Optional)</h3>

          {promotionPlans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlan(p)}
              className={selectedPlan?.id === p.id ? "active" : ""}
            >
              {p.name} - ₦{p.price}
            </button>
          ))}
        </div>

        {/* CONTACT */}
        <div className="section">
          <h3>Contact</h3>

          <input
            placeholder="Phone"
            value={form.contact.phone}
            onChange={(e) =>
              setForm({
                ...form,
                contact: { ...form.contact, phone: e.target.value },
              })
            }
          />

          <input
            placeholder="WhatsApp"
            value={form.contact.whatsapp}
            onChange={(e) =>
              setForm({
                ...form,
                contact: { ...form.contact, whatsapp: e.target.value },
              })
            }
          />
        </div>

        {/* ERROR */}
        {error && <div className="error">{error}</div>}

        {/* SUBMIT */}
        <button onClick={handleSubmit} disabled={loading || payLoading}>
          {loading || payLoading
            ? "Processing..."
            : selectedPlan
            ? "Pay & Publish"
            : "Create Product"}
        </button>

      </div>
    </div>
  );
}