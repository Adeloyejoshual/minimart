import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

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

  /* ================= FETCH ================= */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Category fetch failed", err);
      }
    };
    load();
  }, []);

  /* ================= HELPERS ================= */
  const onlyNumbers = (v = "") => v.replace(/\D/g, "");
  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  /* ================= OPTIONS ================= */
  const optionsMap = useMemo(() => {
    const modelsForBrand =
      brand && options.models?.[brand] ? options.models[brand] : [];

    return {
      brand: normalizeOptions(options.brands),
      model: normalizeOptions(modelsForBrand),
      color: normalizeOptions(options.colors),
      condition: normalizeOptions(options.conditions),
      used_detail: normalizeOptions(options.usedDetails),
      ram: normalizeOptions(options.ram),
      storage: normalizeOptions(options.storage),
      sim: normalizeOptions(options.sims),
      year: normalizeOptions(options.years),
      engine: normalizeOptions(options.engines),
      fuel_type: normalizeOptions(options.fuel_types),
    };
  }, [options, brand]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition")
      ? dynamic
      : ["condition", ...dynamic];
  }, [options]);

  /* ================= STATE ================= */
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

  /* ================= FEATURES ================= */
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
    if (form.title.trim().length < 10) return "Title too short";
    if (form.description.trim().length < 20) return "Description too short";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";

    if (!/^\S+@\S+\.\S+$/.test(form.contact.email))
      return "Invalid email";

    if (!/^(?:0|\+234)?[7-9]\d{9}$/.test(form.contact.phone))
      return "Invalid phone number";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);

      if (!from || !to) return "Delivery duration required";
      if (to < from) return "Invalid delivery range";
    }

    return null;
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);

    previews.forEach(URL.revokeObjectURL);

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

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: fd }
      );

      if (!res.ok) throw new Error("Upload failed");

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (finalPlan.price === 0) {
        alert("✅ Product created");
        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setSelectedPlan(null);
        setLoading(false);
        return;
      }

      /* PAYMENT */
      const payRes = await fetch(
        "https://minimart-ivrm.onrender.com/api/payment/initialize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.contact.email,
            planId: finalPlan.id,
            productId,
          }),
        }
      );

      const payData = await payRes.json();
      if (!payData.success) throw new Error("Payment init failed");

      window.location.href = payData.authorization_url;
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

      <input placeholder="Title" value={form.title} onChange={(e) => update("title", e.target.value)} />
      <textarea placeholder="Description" value={form.description} onChange={(e) => update("description", e.target.value)} />
      <input placeholder="Price" value={form.price} onChange={(e) => update("price", onlyNumbers(e.target.value))} />

      <input placeholder="Email" value={form.contact.email} onChange={(e) => updateContact("email", e.target.value)} />

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
        options={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      {fields.map((f) =>
        optionsMap[f] ? (
          <DropdownModal
            key={f}
            label={formatLabel(f)}
            value={attributes[f] || ""}
            onChange={(v) => updateAttr(f, v)}
            options={optionsMap[f]}
          />
        ) : null
      )}

      {/* DELIVERY */}
      <div className="form-section">
        <h3>Delivery</h3>

        <label>
          <input
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) => updateDelivery("available", e.target.checked)}
          />
          Delivery Available
        </label>

        {form.delivery.available && (
          <>
            <input placeholder="From days" value={form.delivery.duration.from} onChange={(e) => updateDeliveryDuration("from", onlyNumbers(e.target.value))} />
            <input placeholder="To days" value={form.delivery.duration.to} onChange={(e) => updateDeliveryDuration("to", onlyNumbers(e.target.value))} />
            <input placeholder="Fee (₦)" value={form.delivery.fee} onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))} />
            <textarea placeholder="Delivery Note" value={form.delivery.note} onChange={(e) => updateDelivery("note", e.target.value)} />
          </>
        )}
      </div>

      <DropdownModal label="State" value={state} onChange={setState} options={states} />
      {state && <DropdownModal label="City" value={city} onChange={setCity} options={cities} />}

      <input placeholder="Phone" value={form.contact.phone} onChange={(e) => updateContact("phone", onlyNumbers(e.target.value))} />

      <input type="file" multiple onChange={(e) => handleImages(e.target.files)} />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}