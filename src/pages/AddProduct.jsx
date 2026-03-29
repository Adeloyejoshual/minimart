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
  const [previews, setPreviews] = useState([]);
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

/* ================= CATEGORY ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};

/* ================= DROPDOWN MAP ================= */
  const optionsMap = useMemo(() => ({
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
  }), [options, form.attributes.brand]);

/* ================= FEATURE TOGGLE ================= */
  const toggleFeature = useCallback((feature) => {
    setForm((prev) => {
      const exists = prev.attributes.features.includes(feature);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: exists
            ? prev.attributes.features.filter((f) => f !== feature)
            : [...prev.attributes.features, feature],
        },
      };
    });
  }, []);

/* ================= GENERIC UPDATE ================= */
  const updateAttr = (key, value) => {
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [key]: value },
    }));
  };

/* ================= VALIDATION ================= */
  const validate = () => {
    if (!form.title) return "Title required";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Category required";
    if (!form.contact.phone) return "Phone required";
    if (!state || !city) return "Location required";

    if (form.delivery.available) {
      if (form.delivery.from > form.delivery.to)
        return "Invalid delivery range";
    }

    return null;
  };

/* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return setError(err);

    setLoading(true);

    try {
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

      alert("Product created");
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

        {/* ================= FEATURES (CHECKBOX MULTI) ================= */}
        {options.features?.length > 0 && (
          <div className="section">
            <h3>Features</h3>
            <div className="checkbox-grid">
              {options.features.map((f) => (
                <label key={f}>
                  <input
                    type="checkbox"
                    checked={form.attributes.features.includes(f)}
                    onChange={() => toggleFeature(f)}
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ================= DROPDOWNS ================= */}
        {Object.entries(optionsMap).map(([key, values]) =>
          values.length ? (
            <select
              key={key}
              value={form.attributes[key] || ""}
              onChange={(e) => updateAttr(key, e.target.value)}
            >
              <option value="">{key}</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : null
        )}

        {/* ================= CONTACT ================= */}
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

        {/* ================= DELIVERY ================= */}
        <div className="section">
          <h3>Delivery</h3>

          <label>
            <input
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery: {
                    ...form.delivery,
                    available: e.target.checked,
                  },
                })
              }
            />
            Available
          </label>

          {form.delivery.available && (
            <>
              <div className="row">
                <input
                  type="number"
                  placeholder="From"
                  value={form.delivery.from}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      delivery: {
                        ...form.delivery,
                        from: +e.target.value,
                      },
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="To"
                  value={form.delivery.to}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      delivery: {
                        ...form.delivery,
                        to: +e.target.value,
                      },
                    })
                  }
                />
              </div>

              <label>
                <input
                  type="checkbox"
                  checked={form.delivery.fee_required}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      delivery: {
                        ...form.delivery,
                        fee_required: e.target.checked,
                      },
                    })
                  }
                />
                Fee required
              </label>

              {form.delivery.fee_required && (
                <input
                  placeholder="Fee"
                  value={form.delivery.fee}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      delivery: {
                        ...form.delivery,
                        fee: onlyNumbers(e.target.value),
                      },
                    })
                  }
                />
              )}
            </>
          )}
        </div>

        {/* ERROR */}
        {error && <div className="error">{error}</div>}

        {/* SUBMIT */}
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Posting..." : "Create Product"}
        </button>

      </div>
    </div>
  );
}