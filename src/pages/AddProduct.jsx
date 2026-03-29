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
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setError("Failed to load categories"));
  }, []);

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (!form.title) return "Title required";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Category required";
    if (!form.contact.phone) return "Phone required";
    if (!state || !city) return "Location required";

    if (form.delivery.available) {
      if (form.delivery.from > form.delivery.to) {
        return "Invalid delivery range";
      }
    }

    return null;
  };

  /* ================= PAYSTACK ================= */
  const startPayment = async () => {
    const selectedPlan = promotionPlans.find(
      (p) => p.id == form.promotion_id
    );

    if (!selectedPlan) return null;

    try {
      const res = await fetch(`${API_BASE}/payment/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: selectedPlan.price,
          email: "user@email.com", // replace with real user email
        }),
      });

      const data = await res.json();

      if (!data.authorization_url) {
        throw new Error("Payment initialization failed");
      }

      // redirect to Paystack
      window.location.href = data.authorization_url;

      return new Promise((resolve) => {
        const interval = setInterval(async () => {
          if (window.location.href.includes("payment-success")) {
            clearInterval(interval);

            const ref = new URL(window.location.href).searchParams.get(
              "reference"
            );

            const verifyRes = await fetch(
              `${API_BASE}/payment/verify/${ref}`
            );

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              resolve({
                reference: ref,
                plan_id: selectedPlan.id,
              });
            } else {
              resolve(null);
            }
          }
        }, 2000);
      });
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return setError(err);

    setLoading(true);
    setError(null);

    try {
      let promotionData = null;

      /* 🔥 HANDLE PAYMENT IF PLAN SELECTED */
      if (form.promotion_id) {
        promotionData = await startPayment();

        if (!promotionData) {
          throw new Error("Payment not completed");
        }
      }

      const payload = {
        ...form,
        price: onlyNumbers(form.price),
        location_state: state,
        location_city: city,
        promotion: promotionData, // send to backend
      };

      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create product");

      alert("✅ Product created successfully");
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
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setCity("");
          }}
        >
          <option value="">State</option>
          {Object.keys(locationsByState).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {state && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">City</option>
            {locationsByState[state].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}

        {/* CONTACT */}
        <input
          placeholder="Phone"
          value={form.contact.phone}
          onChange={(e) =>
            setForm({
              ...form,
              contact: {
                ...form.contact,
                phone: e.target.value,
              },
            })
          }
        />

        {/* ================= PROMOTION ================= */}
        <div className="section">
          <h3>Boost Listing</h3>

          <select
            value={form.promotion_id || ""}
            onChange={(e) =>
              setForm({
                ...form,
                promotion_id: e.target.value || null,
              })
            }
          >
            <option value="">No Promotion</option>
            {promotionPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - ₦{p.price}
              </option>
            ))}
          </select>
        </div>

        {/* ERROR */}
        {error && <div className="error">{error}</div>}

        {/* SUBMIT */}
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Processing..." : "Create Product"}
        </button>
      </div>
    </div>
  );
}