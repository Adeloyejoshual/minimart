import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
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
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= GLOBAL ERROR GUARD ================= */
  useEffect(() => {
    const handler = (event) => {
      console.error("Global error:", event.error);
      setError("Something went wrong. Please refresh.");
    };

    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(data || []))
      .catch(() => setError("Failed to load categories"));
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(() => {
    return categories.find(
      (c) => String(c.id) === String(form.category_id)
    );
  }, [categories, form.category_id]);

  const options = selectedCategory?.dynamicOptions || {};

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

      const url = data?.data?.authorization_url;

      if (!url) {
        throw new Error("Payment link not received");
      }

      window.location.href = url;
    } catch (err) {
      setError(err.message || "Payment failed");
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return setError(err);

    setLoading(true);

    try {
      // If promotion selected → start payment first
      if (selectedPlan) {
        await startPayment(selectedPlan);
        return;
      }

      // Normal product creation
      const payload = {
        ...form,
        price: onlyNumbers(form.price),
        location_state: state,
        location_city: city,
      };

      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create product");

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

        {/* PROMOTION */}
        <div className="section">
          <h3>Promotion (Optional)</h3>

          {(promotionPlans || []).map((p) => (
            <button
              key={p.id}
              type="button"
              className={selectedPlan?.id === p.id ? "active" : ""}
              onClick={() => setSelectedPlan(p)}
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
        <button onClick={handleSubmit} disabled={loading}>
          {loading
            ? "Processing..."
            : selectedPlan
            ? "Pay & Publish"
            : "Create Product"}
        </button>

      </div>
    </div>
  );
}