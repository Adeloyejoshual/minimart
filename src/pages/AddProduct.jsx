import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

/* ================= ENV ================= */
const API = import.meta.env.VITE_API_URL;
const PAYMENT_API = import.meta.env.VITE_PAYMENT_URL;

/* ================= STORAGE ================= */
const PAYMENT_RETRY_KEY = "pending_payment";

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

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [retryPayment, setRetryPayment] = useState(null);

  /* ================= LOAD RETRY PAYMENT ================= */
  useEffect(() => {
    const saved = localStorage.getItem(PAYMENT_RETRY_KEY);
    if (saved) {
      setRetryPayment(JSON.parse(saved));
    }
  }, []);

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch(`${API}/api/marketplace/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;

  /* ================= HELPERS ================= */
  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  const onlyNumbers = (v = "") => v.replace(/\D/g, "");

  const update = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

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

  /* ================= FEATURES ================= */
  const toggleFeature = (f) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: list.includes(f)
            ? list.filter((x) => x !== f)
            : [...list, f],
        },
      };
    });
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (!form.contact.email) return "Email required";
    if (!form.contact.phone) return "Phone required";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";
    return null;
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);

    previews.forEach(URL.revokeObjectURL);

    setImages(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  /* ================= PAYMENT ================= */
  const initializePayment = async ({ productId, plan }) => {
    try {
      const res = await fetch(`${PAYMENT_API}/api/payment/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.contact.email,
          planId: plan.id,
          productId,
        }),
      });

      const data = await res.json();

      if (!data.success) throw new Error("Payment failed");

      // Save retry info
      localStorage.setItem(
        PAYMENT_RETRY_KEY,
        JSON.stringify({ productId, plan })
      );

      window.location.href = data.authorization_url;
    } catch (err) {
      alert("Payment failed. You can retry.");
      setRetryPayment({ productId, plan });
      setLoading(false);
    }
  };

  /* ================= RETRY PAYMENT ================= */
  const handleRetryPayment = async () => {
    if (!retryPayment) return;

    setLoading(true);
    await initializePayment(retryPayment);
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
      price: form.price.replace(/\D/g, ""),
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
      const res = await fetch(`${API}/api/marketplace/products`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Product failed");

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (!productId) throw new Error("No product ID");

      /* FREE PLAN */
      if (finalPlan.price === 0) {
        alert("✅ Product created");
        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setLoading(false);
        return;
      }

      /* PAID PLAN */
      await initializePayment({ productId, plan: finalPlan });

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
      setLoading(false);
    }
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      {retryPayment && (
        <div className="retry-box">
          <p>⚠️ Payment not completed</p>
          <button onClick={handleRetryPayment}>
            Retry Payment
          </button>
        </div>
      )}

      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) => update("price", onlyNumbers(e.target.value))}
      />

      <input
        placeholder="Email"
        value={form.contact.email}
        onChange={(e) => updateContact("email", e.target.value)}
      />

      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) =>
          setForm((p) => ({
            ...p,
            category_id: v,
            attributes: INITIAL_FORM.attributes,
          }))
        }
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {/* DELIVERY */}
      <div className="form-section">
        <h3>Delivery</h3>

        <label>
          <input
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) =>
              updateDelivery("available", e.target.checked)
            }
          />
          Available
        </label>
      </div>

      {/* LOCATION */}
      <DropdownModal label="State" value={state} onChange={setState} options={states} />
      {state && (
        <DropdownModal label="City" value={city} onChange={setCity} options={cities} />
      )}

      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          updateContact("phone", onlyNumbers(e.target.value))
        }
      />

      <input type="file" multiple onChange={(e) => handleImages(e.target.files)} />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>

      {/* PLANS */}
      <div className="form-section">
        <h3>Promotion Plans</h3>
        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            className={selectedPlan?.id === plan.id ? "active" : ""}
          >
            <strong>{plan.name}</strong>
            <p>₦{plan.price}</p>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Create Product"}
      </button>
    </div>
  );
}