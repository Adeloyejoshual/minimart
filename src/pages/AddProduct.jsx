import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",

  /* NEW */
  promotion_id: 0,

  attributes: {
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

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const brand = form.attributes?.brand;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((item) =>
          typeof item === "string"
            ? { id: item, name: item }
            : item
        )
      : [];

  const fields = useMemo(() => {
    const dynamic = selectedCategory?.dynamicOptions?.fields || [];
    return ["condition", ...dynamic];
  }, [selectedCategory]);

  const optionsMap = useMemo(() => {
    const modelsForBrand = options.models?.[brand] || [];

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
      const updated = {
        ...p.attributes,
        [key]: value,
      };

      if (key === "brand") updated.model = "";

      return { ...p, attributes: updated };
    });

  const onlyNumbers = (v) => v.replace(/[^\d]/g, "");

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const toggleFeature = (feature) => {
    setForm((p) => {
      const current = p.attributes.features || [];
      const exists = current.includes(feature);

      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
            ? current.filter((f) => f !== feature)
            : [...current, feature],
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
    return null;
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);

    previews.forEach((p) => URL.revokeObjectURL(p));

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
  const handleSubmit = () => {
    const err = validate();
    if (err) return alert(err);

    setLoading(true);
    setProgress(0);

    const fd = new FormData();

    const payload = {
      ...form,
      price: form.price.replace(/[^\d]/g, ""),
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
    };

    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    images.forEach((img) => fd.append("images", img));

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      "https://minimart-ivrm.onrender.com/api/marketplace/products"
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setLoading(false);

      if (xhr.status >= 200 && xhr.status < 300) {
        alert("Product created successfully");

        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setProgress(0);
      } else {
        alert("Upload failed");
      }
    };

    xhr.onerror = () => {
      setLoading(false);
      alert("Network error");
    };

    xhr.send(fd);
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      {/* ================= PROMOTION PLANS (NEW) ================= */}
      <div className="form-section">
        <h3>Promotion Plan</h3>

        <div className="plan-grid">
          {promotionPlans.map((plan) => (
            <label key={plan.id} className="plan-card">
              <input
                type="radio"
                name="promotion"
                checked={form.promotion_id === plan.id}
                onChange={() =>
                  update("promotion_id", plan.id)
                }
              />

              <div>
                <strong>{plan.name}</strong>
                <p>{plan.description}</p>
                <small>
                  ₦{plan.price} • {plan.duration}
                </small>
              </div>
            </label>
          ))}
        </div>
      </div>

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
        onChange={(e) =>
          update("price", e.target.value.replace(/[^\d]/g, ""))
        }
      />

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) =>
          setForm((p) => ({
            ...p,
            category_id: v,
            attributes: { features: [] },
          }))
        }
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

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

      {/* IMAGES */}
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

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}