import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

/* ================= ENV ================= */
const API = import.meta.env.VITE_API_URL;

/* ================= STORAGE ================= */
const STORAGE_KEY = "add_product_draft";

/* ================= INITIAL ================= */
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

  /* ================= LOAD DRAFT ================= */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;

      setForm(saved.form || INITIAL_FORM);
      setState(saved.state || "");
      setCity(saved.city || "");
      setSelectedPlan(saved.selectedPlan || null);
    } catch (err) {
      console.error("Draft load failed", err);
    }
  }, []);

  /* ================= SAVE DRAFT ================= */
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ form, state, city, selectedPlan })
    );
  }, [form, state, city, selectedPlan]);

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch(`${API}/api/marketplace/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= CLEANUP ================= */
  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;

  const normalize = (list = []) =>
    list.map((x) => (typeof x === "string" ? { id: x, name: x } : x));

  const fields = useMemo(() => {
    const f = selectedCategory?.dynamicOptions?.fields || [];
    return f.includes("condition") ? f : ["condition", ...f];
  }, [selectedCategory]);

  const optionsMap = useMemo(() => {
    const brand = attributes.brand;
    return {
      brand: normalize(options.brands),
      model: normalize(options.models?.[brand] || []),
      color: normalize(options.colors),
      condition: normalize(options.conditions),
      used_detail: normalize(options.usedDetails),
      ram: normalize(options.ram),
      storage: normalize(options.storage),
      sim: normalize(options.sims),
      year: normalize(options.years),
      engine: normalize(options.engines),
      fuel_type: normalize(options.fuel_types),
      features: normalize(options.features),
    };
  }, [options, attributes.brand]);

  /* ================= HELPERS ================= */
  const update = (k, v) =>
    setForm((p) => ({ ...p, [k]: v }));

  const updateAttr = (k, v) =>
    setForm((p) => {
      const next = { ...p.attributes, [k]: v };
      if (k === "brand") next.model = "";
      return { ...p, attributes: next };
    });

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

  const onlyNumbers = (v = "") => v.replace(/\D/g, "");

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

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const selected = Array.from(files);
    const merged = [...images, ...selected].slice(0, 8);

    setImages(merged);
    setPreviews((prev) => {
      prev.forEach(URL.revokeObjectURL);
      return merged.map((f) => URL.createObjectURL(f));
    });
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, x) => x !== i);
    });
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (form.title.trim().length < 10) return "Title too short";
    if (form.description.trim().length < 20) return "Description too short";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";

    if (!/^\d{10,15}$/.test(form.contact.phone))
      return "Invalid phone number";

    for (const f of fields) {
      if (!attributes[f]) return `${f} required`;
    }

    if (!images.length) return "Add at least one image";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);

      if (!from || !to) return "Delivery duration required";
      if (to < from) return "Invalid delivery range";
    }

    return null;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (loading) return;

    const err = validate();
    if (err) return alert(err);

    const finalPlan =
      selectedPlan || promotionPlans.find((p) => p.price === 0);

    setLoading(true);

    try {
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

      const res = await fetch(`${API}/api/marketplace/products`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Create failed");

      const data = await res.json();
      const productId = data?.product?.id || data?.id;

      if (!productId) throw new Error("No product ID");

      /* ===== FREE PLAN ===== */
      if (finalPlan.price === 0) {
        alert("✅ Product created");

        localStorage.removeItem(STORAGE_KEY);
        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setSelectedPlan(null);
        return;
      }

      /* ===== PAYMENT ===== */
      const payRes = await fetch(`${API}/api/payment/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:
            form.contact.email ||
            `${form.contact.phone}@mail.local`,
          amount: finalPlan.price,
          planId: finalPlan.id,
          productId,
        }),
      });

      const payData = await payRes.json();

      if (!payData.success) throw new Error("Payment failed");

      window.location.href = payData.authorization_url;
    } catch (err) {
      console.error(err);
      alert(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOCATION ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) => update("price", onlyNumbers(e.target.value))}
      />

      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) => update("category_id", v)}
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {fields.map((f) => {
        if (!optionsMap[f]) return null;
        if (f === "used_detail" && attributes.condition !== "used")
          return null;

        return (
          <DropdownModal
            key={f}
            label={f}
            value={attributes[f] || ""}
            onChange={(v) => updateAttr(f, v)}
            options={optionsMap[f]}
          />
        );
      })}

      {/* ================= DELIVERY ================= */}
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
          Delivery Available
        </label>

        {form.delivery.available && (
          <>
            <input
              placeholder="From (days)"
              value={form.delivery.duration.from}
              onChange={(e) =>
                updateDeliveryDuration(
                  "from",
                  onlyNumbers(e.target.value)
                )
              }
            />

            <input
              placeholder="To (days)"
              value={form.delivery.duration.to}
              onChange={(e) =>
                updateDeliveryDuration(
                  "to",
                  onlyNumbers(e.target.value)
                )
              }
            />

            <input
              placeholder="Delivery Fee"
              value={form.delivery.fee}
              onChange={(e) =>
                updateDelivery("fee", onlyNumbers(e.target.value))
              }
            />

            <textarea
              placeholder="Delivery Note"
              value={form.delivery.note}
              onChange={(e) =>
                updateDelivery("note", e.target.value)
              }
            />
          </>
        )}
      </div>

      <DropdownModal
        label="State"
        value={state}
        onChange={(s) => {
          setState(s);
          setCity("");
        }}
        options={states}
      />

      {state && (
        <DropdownModal
          label="City"
          value={city}
          onChange={setCity}
          options={cities}
        />
      )}

      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          updateContact("phone", onlyNumbers(e.target.value))
        }
      />

      <input
        placeholder="WhatsApp"
        value={form.contact.whatsapp}
        onChange={(e) =>
          updateContact("whatsapp", onlyNumbers(e.target.value))
        }
      />

      <input
        placeholder="Email"
        value={form.contact.email}
        onChange={(e) =>
          updateContact("email", e.target.value)
        }
      />

      <input
        type="file"
        multiple
        onChange={(e) => handleImages(e.target.files)}
      />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      <div className="form-section">
        <h3>Promotion Plans</h3>
        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            className={
              selectedPlan?.id === plan.id ? "selected-plan" : ""
            }
          >
            <strong>{plan.name}</strong>
            <p>{plan.duration}</p>
            <p>₦{plan.price}</p>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}