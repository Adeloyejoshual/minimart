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
  const [progress, setProgress] = useState(0);

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
  const attributes = form.attributes || {};
  const brand = attributes.brand || "";

  /* ================= NORMALIZE ================= */
  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  /* ================= FIELDS (FIXED) ================= */
  const fields = useMemo(() => {
    const dynamic = selectedCategory?.dynamicOptions?.fields || [];

    // prevent duplicate condition
    return dynamic.includes("condition")
      ? dynamic
      : ["condition", ...dynamic];
  }, [selectedCategory]);

  /* ================= OPTIONS MAP ================= */
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
      features: normalizeOptions(options.features),
    };
  }, [options, brand]);

  /* ================= HELPERS ================= */
  const update = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttr = (key, value) =>
    setForm((p) => {
      const next = { ...p.attributes, [key]: value };

      // reset dependent field
      if (key === "brand") next.model = "";

      return { ...p, attributes: next };
    });

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

  const onlyNumbers = (v = "") => v.replace(/\D/g, "")

  const formatLabel = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const toggleFeature = (f) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      const exists = list.includes(f);

      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
            ? list.filter((x) => x !== f)
            : [...list, f],
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

    previews.forEach((url) => URL.revokeObjectURL(url));

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
      selectedPlan || promotionPlans.find((p) => p.price === 0); // ✅ allow free fallback

    setLoading(true);
    setProgress(0); // Note: fetch has no progress → UI only

    /* ================= STEP 1: CREATE PRODUCT ================= */
    const fd = new FormData();

    const payload = {
      ...form,
      price: form.price.replace(/[^d]/g, ""), // ✅ correct number
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
      promotion_plan: finalPlan.id, // ✅ ID only
      status: finalPlan.price === 0 ? "active" : "pending", // 🔥
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

      if (!res.ok) {
        setLoading(false);
        return alert("Product creation failed");
      }

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (!productId) {
        setLoading(false);
        return alert("No product ID returned");
      }

      /* ================= FREE PLAN ================= */
      if (finalPlan.price === 0) {
        alert("✅ Product created successfully");

        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setSelectedPlan(null);

        setLoading(false);
        return;
      }

      /* ================= STEP 2: INIT PAYMENT ================= */
      const payRes = await fetch(
        "https://minimart-ivrm.onrender.com/api/payment/initialize", // ✅ full backend URL
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email:
              form.contact.whatsapp || `${form.contact.phone}@temp.com`, // ✅ safer email
            amount: finalPlan.price,
            planId: finalPlan.id,
            productId, // 🔥 VERY IMPORTANT
          }),
        }
      );

      const payData = await payRes.json();

      if (!payData.success) {
        setLoading(false);
        return alert("Payment initialization failed");
      }

      /* ================= STEP 3: REDIRECT ================= */
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

      {loading && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

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

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) =>
          setForm({
            ...INITIAL_FORM,
            category_id: v,
          })
        }
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {/* DYNAMIC FIELDS */}
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

      {/* FEATURES */}
      {options.features?.length > 0 && (
        <div className="form-section">
          <h3>Features</h3>
          <div className="checkbox-grid">
            {options.features.map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  checked={(attributes.features || []).includes(f)}
                  onChange={() => toggleFeature(f)}
                />
                {f}
              </label>
            ))}
          </div>
        </div>
      )}

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

        {form.delivery.available && (
          <>
            <input
              type="number"
              placeholder="From days"
              value={form.delivery.duration.from}
              onChange={(e) =>
                updateDeliveryDuration("from", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="To days"
              value={form.delivery.duration.to}
              onChange={(e) =>
                updateDeliveryDuration("to", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Delivery fee"
              value={form.delivery.fee}
              onChange={(e) =>
                updateDelivery("fee", onlyNumbers(e.target.value))
              }
            />
          </>
        )}
      </div>

      {/* LOCATION */}
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

      {/* CONTACT */}
      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          update("contact", {
            ...form.contact,
            phone: onlyNumbers(e.target.value),
          })
        }
      />

      <input
        placeholder="WhatsApp"
        value={form.contact.whatsapp}
        onChange={(e) =>
          update("contact", {
            ...form.contact,
            whatsapp: onlyNumbers(e.target.value),
          })
        }
      />

      {/* IMAGES */}
      <input type="file" multiple onChange={(e) => handleImages(e.target.files)} />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      {/* PROMOTION */}
      <div className="form-section">
        <h3>Promotion Plans</h3>

        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            style={{
              border:
                selectedPlan?.id === plan.id
                  ? "2px solid green"
                  : "1px solid #ccc",
              padding: "10px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
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