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
    email: "", // ✅ added
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
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
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
  const brand = attributes.brand;

  /* ================= HELPERS ================= */
  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  const onlyNumbers = (v = "") => v.replace(/\D/g, "");

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

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

  /* ================= STATE UPDATES ================= */
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

  /* ================= MULTI FEATURES ================= */
  const toggleFeature = (feature) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      const exists = list.includes(feature);

      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
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

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);

      if (Number.isNaN(from) || Number.isNaN(to))
        return "Delivery range required";

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
      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) throw new Error();

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

      if (!payData.success) throw new Error();

      window.location.href = payData.authorization_url;
    } catch (err) {
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

    {/* ================= BASIC INFO ================= */}
    <div className="form-section">
      <h3>Basic Information</h3>

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

      <input
        placeholder="Email"
        value={form.contact.email}
        onChange={(e) => updateContact("email", e.target.value)}
      />
    </div>

    {/* ================= CATEGORY ================= */}
    <div className="form-section">
      <h3>Category</h3>

      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) =>
          setForm((prev) => ({
            ...prev,
            category_id: v,
            attributes: INITIAL_FORM.attributes,
          }))
        }
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </div>

    {/* ================= ATTRIBUTES ================= */}
    <div className="form-section">
      <h3>Product Details</h3>

      {fields.map((f) => {
        if (!optionsMap[f]) return null;
        if (f === "used_detail" && attributes.condition !== "used")
          return null;

        return (
          <DropdownModal
            key={f}
            label={formatLabel(f)}
            value={attributes[f] || ""}
            onChange={(v) => updateAttr(f, v)}
            options={optionsMap[f]}
          />
        );
      })}
    </div>

    {/* ================= FEATURES ================= */}
    {Array.isArray(options.features) && options.features.length > 0 && (
      <div className="form-section">
        <h3>Features</h3>

        <div className="features-grid">
          {options.features.map((f) => (
            <div
              key={f}
              className={`feature-tag ${
                attributes.features.includes(f) ? "active" : ""
              }`}
              onClick={() => toggleFeature(f)}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    )}

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
        Available
      </label>

      {form.delivery.available && (
        <div className="delivery-grid">
          <input
            placeholder="From days"
            value={form.delivery.duration.from}
            onChange={(e) =>
              updateDeliveryDuration("from", e.target.value)
            }
          />

          <input
            placeholder="To days"
            value={form.delivery.duration.to}
            onChange={(e) =>
              updateDeliveryDuration("to", e.target.value)
            }
          />

          <input
            placeholder="Fee"
            value={form.delivery.fee}
            onChange={(e) =>
              updateDelivery("fee", onlyNumbers(e.target.value))
            }
          />
        </div>
      )}
    </div>

    {/* ================= LOCATION ================= */}
    <div className="form-section">
      <h3>Location</h3>

      <DropdownModal
        label="State"
        value={state}
        onChange={setState}
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
    </div>

    {/* ================= MEDIA ================= */}
    <div className="form-section">
      <h3>Product Images</h3>

      <input
        type="file"
        multiple
        onChange={(e) => handleImages(e.target.files)}
      />

      <div className="images">
        {previews.map((src, i) => (
          <div key={i} className="img-wrap">
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>×</button>
          </div>
        ))}
      </div>
    </div>

    {/* ================= PROMOTION ================= */}
    <div className="form-section">
      <h3>Promotion Plans</h3>

      <div className="plan-grid">
        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card ${
              selectedPlan?.id === plan.id ? "active" : ""
            }`}
            onClick={() => setSelectedPlan(plan)}
          >
            <strong>{plan.name}</strong>
            <p>{plan.duration}</p>
            <p>₦{plan.price}</p>
          </div>
        ))}
      </div>
    </div>

    {/* ================= ACTIONS ================= */}
    <div className="form-section">
      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  </div>
);