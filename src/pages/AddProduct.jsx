import { useEffect, useMemo, useState, useCallback } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

/* ================= INITIAL STATE ================= */
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

/* ================= HELPERS ================= */
const onlyNumbers = (v = "") => v.replace(/\D/g, "");

const formatPrice = (v = "") => {
  const num = v.replace(/\D/g, "");
  return num ? new Intl.NumberFormat("en-NG").format(Number(num)) : "";
};

const formatLabel = (t = "") =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  /* ================= DRAFT ================= */
  const saveDraft = useCallback(() => {
    localStorage.setItem(
      STORAGE_DRAFT,
      JSON.stringify({ form, state, city, selectedPlan })
    );
  }, [form, state, city, selectedPlan]);

  const loadDraft = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_DRAFT);
    if (!saved) return;

    const draft = JSON.parse(saved);

    setForm(draft.form || INITIAL_FORM);
    setState(draft.state || "");
    setCity(draft.city || "");

    setSelectedPlan(draft.selectedPlan || null);
  }, []);

  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setPreviews([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);

    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (!loading) saveDraft();
  }, [saveDraft, loading]);

  /* ================= PAYMENT CACHE ================= */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentData));
    }
  }, [paymentData]);

  /* ================= CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};

  /* ================= UPDATE HELPERS ================= */
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const updateAttr = (k, v) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [k]: v,
        ...(k === "brand" && { model: "" }),
      },
    }));

  const updateContact = (k, v) =>
    setForm((p) => ({
      ...p,
      contact: { ...p.contact, [k]: v },
    }));

  const updateDelivery = (k, v) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, [k]: v },
    }));

  const updateDeliveryDuration = (k, v) =>
    setForm((p) => ({
      ...p,
      delivery: {
        ...p.delivery,
        duration: { ...p.delivery.duration, [k]: v },
      },
    }));

  const toggleFeature = (feature) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: list.includes(feature)
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
    return null;
  };

  /* ================= IMAGE HANDLING ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);

    previews.forEach((u) => URL.revokeObjectURL(u));

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
      price: onlyNumbers(form.price),

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
        { method: "POST", body: fd }
      );

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (finalPlan.price === 0) {
        alert("Product created successfully");
        clearDraft();
        setLoading(false);
        return;
      }

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

      if (!payData.success) {
        setPaymentData({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          planId: finalPlan.id,
          productId,
        });

        setLoading(false);
        return alert("Payment failed. You can retry.");
      }

      window.location.href = payData.authorization_url;
    } catch (e) {
      alert("Something went wrong");
      setLoading(false);
    }
  };

  /* ================= UI DATA ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      <div className="form-section-round">
        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Price</label>
        <input
          value={formatPrice(form.price)}
          onChange={(e) => update("price", onlyNumbers(e.target.value))}
        />
      </div>

      <div className="form-section-round">
        <label>Email</label>
        <input
          value={form.contact.email}
          onChange={(e) => updateContact("email", e.target.value)}
        />
      </div>

      <div className="form-section-round">
        <label>Category</label>
        <DropdownModal
          value={form.category_id}
          options={categories.map((c) => ({ id: c.id, name: c.name }))}
          onChange={(v) =>
            setForm((p) => ({
              ...p,
              category_id: v,
              attributes: INITIAL_FORM.attributes,
            }))
          }
        />
      </div>

      <div className="form-section-round">
        <label>State</label>
        <DropdownModal value={state} onChange={setState} options={states} />
      </div>

      {state && (
        <div className="form-section-round">
          <label>City</label>
          <DropdownModal value={city} onChange={setCity} options={cities} />
        </div>
      )}

      <div className="form-section-round">
        <label>Phone</label>
        <input
          value={form.contact.phone}
          onChange={(e) =>
            updateContact("phone", onlyNumbers(e.target.value))
          }
        />
      </div>

      <div className="form-section-round">
        <label>Images</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleImages(e.target.files)}
        />

        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i}>
              <img src={src} />
              <button onClick={() => removeImage(i)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="form-section-round">
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Uploading..." : "Create Product"}
        </button>

        {paymentData && (
          <button onClick={() => window.location.reload()}>
            Retry Payment
          </button>
        )}
      </div>
    </div>
  );
}