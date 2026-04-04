// Frontend AddProduct.jsx - SIMPLIFIED & WORKING
import { useEffect, useMemo, useState, useCallback } from "react";
import { promotionPlans } from "../config/promotions.js";
import { locationsByState } from "../config/locationsByState.js";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

const INITIAL_FORM = {
  title: "", description: "", price: "", category_id: "",
  attributes: { brand: "", model: "", color: "", condition: "", features: [] },
  delivery: { available: false, duration: { from: "", to: "" }, fee: "" },
  contact: { phone: "", email: "", whatsapp: "" }
};

export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(promotionPlans[0]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then(setCategories);
  }, []);

  const update = (key, value) => 
    setForm(p => ({ ...p, [key]: value }));

  const updateAttr = (key, value) => 
    setForm(p => ({
      ...p, attributes: { ...p.attributes, [key]: value }
    }));

  const updateContact = (key, value) =>
    setForm(p => ({
      ...p, contact: { ...p.contact, [key]: value }
    }));

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 8);
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const validate = () => {
    if (form.title.length < 10) return "Title too short";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Valid email required";
    if (!state || !city) return "Select location";
    if (images.length === 0) return "Add images";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("description", form.description);
    formData.append("price", form.price.replace(/D/g, ""));
    formData.append("category_id", form.category_id);
    formData.append("user_id", `user_${Date.now()}`);
    formData.append("location_state", state);
    formData.append("location_city", city);
    formData.append("attributes", JSON.stringify(form.attributes));
    formData.append("delivery", JSON.stringify(form.delivery));
    formData.append("contact", JSON.stringify(form.contact));

    images.forEach(img => formData.append("images", img));

    try {
      // 1. Create draft
      const createRes = await fetch(`${API_BASE}/products`, {
        method: "POST",
        body: formData
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Create failed");
      }

      const createData = await createRes.json();
      const productId = createData.product.id;

      // 2. Free plan = auto activate
      if (selectedPlan.price === 0) {
        await fetch(`${API_BASE}/products/${productId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: selectedPlan.id })
        });
        alert("✅ Product live!");
        return;
      }

      // 3. Paid plan = Paystack
      const payRes = await fetch(`${API_BASE}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contact.email,
          amount: selectedPlan.price,
          productId,
          planId: selectedPlan.id
        })
      });

      const payData = await payRes.json();
      if (payData.success) {
        window.location.href = payData.authorization_url;
      } else {
        throw new Error(payData.error);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product">
      <h1>Add Product</h1>
      
      {error && <div className="error">{error}</div>}

      <input 
        placeholder="Title" 
        value={form.title}
        onChange={e => update("title", e.target.value)}
      />
      <input 
        placeholder="Price (₦)" 
        value={form.price}
        onChange={e => update("price", e.target.value.replace(/D/g, ""))}
      />
      
      <select 
        value={form.category_id} 
        onChange={e => update("category_id", e.target.value)}
      >
        <option value="">Select Category</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <input 
        placeholder="Email" 
        type="email"
        value={form.contact.email}
        onChange={e => updateContact("email", e.target.value)}
      />

      <select value={state} onChange={e => setState(e.target.value)}>
        <option value="">State</option>
        {Object.keys(locationsByState).map(s => 
          <option key={s} value={s}>{s}</option>
        )}
      </select>

      <input 
        type="file" 
        multiple 
        accept="image/*" 
        onChange={handleImages}
      />

      <div>
        {promotionPlans.map(plan => (
          <button 
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            style={{
              background: selectedPlan?.id === plan.id ? '#007bff' : '#f8f9fa',
              color: selectedPlan?.id === plan.id ? 'white' : 'black'
            }}
          >
            {plan.name} - ₦{plan.price} - {plan.duration}
          </button>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Creating..." : "Create Product"}
      </button>
    </div>
  );
}