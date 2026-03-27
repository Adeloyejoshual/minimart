import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import imageCompression from "browser-image-compression";
import "./AddProduct.css";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: {},
  delivery: {
    available: true,
    type: "fixed",
    fee: 0,
    radius_km: 0,
    estimated_days: "1-3",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* ================= CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d || []))
      .catch(console.error);
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};
  const brand = form.attributes?.brand;

  const optionsMap = useMemo(
    () => ({
      brand: options.brands || [],
      model: options.models?.[brand] || [],
      color: options.colors || [],
      condition: ["new", "used"],
      used_detail: ["like new", "excellent", "good", "fair", "repair needed"],
    }),
    [options, brand]
  );

  const updateForm = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const updateAttr = (k, v) =>
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [k]: v },
    }));

  /* ================= FORMATTERS ================= */
  const formatPrice = (value) => {
    const num = value.replace(/,/g, "").replace(/[^\d]/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const onlyNumbers = (value) => value.replace(/[^\d]/g, "");

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (form.title.trim().length < 15)
      return "Title must be at least 15 characters";

    if (form.description.trim().length < 30)
      return "Description must be at least 30 characters";

    if (!form.price) return "Price is required";
    if (!form.category_id) return "Category is required";

    const phone = form.contact.phone;
    if (!phone || phone.length < 10)
      return "Valid phone number required";

    if (!form.attributes.condition)
      return "Select product condition";

    return null;
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const raw = Array.from(files).slice(0, 8);

    setPreviews(raw.map((f) => URL.createObjectURL(f)));
    setImages(raw);
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
    const error = validate();
    if (error) return alert(error);

    const fd = new FormData();

    const payload = {
      ...form,
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
    };

    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    images.forEach((img) => fd.append("images", img));

    setLoading(true);
    setProgress(0);

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
        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setProgress(0);
        alert("Product created 🚀");
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
  const cities = state ? locationsByState[state] || [] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product">
      <h2>Add Product</h2>

      {loading && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* TITLE */}
      <input
        placeholder="Title (min 15 characters)"
        value={form.title}
        onChange={(e) => updateForm("title", e.target.value)}
      />

      {/* DESCRIPTION */}
      <textarea
        placeholder="Description (min 30 characters)"
        value={form.description}
        onChange={(e) => updateForm("description", e.target.value)}
      />

      {/* PRICE */}
      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) =>
          updateForm("price", formatPrice(e.target.value))
        }
      />

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) => updateForm("category_id", v)}
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {/* CONDITION */}
      <DropdownModal
        label="Condition"
        value={form.attributes.condition || ""}
        onChange={(v) => updateAttr("condition", v)}
        options={["new", "used"]}
      />

      {/* USED DETAIL */}
      {form.attributes.condition === "used" && (
        <DropdownModal
          label="Used Detail"
          value={form.attributes.used_detail || ""}
          onChange={(v) => updateAttr("used_detail", v)}
          options={optionsMap.used_detail}
        />
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map((field) => (
        <DropdownModal
          key={field}
          label={formatLabel(field)}
          value={form.attributes[field] || ""}
          onChange={(v) => updateAttr(field, v)}
          options={optionsMap[field] || []}
        />
      ))}

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
        placeholder="Phone number"
        value={form.contact.phone}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            contact: {
              ...p.contact,
              phone: onlyNumbers(e.target.value),
            },
          }))
        }
      />

      <input
        placeholder="WhatsApp number"
        value={form.contact.whatsapp}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            contact: {
              ...p.contact,
              whatsapp: onlyNumbers(e.target.value),
            },
          }))
        }
      />

      {/* IMAGES */}
      <input type="file" multiple onChange={(e) => handleImages(e.target.files)} />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i} className="preview-item">
            <img src={src} alt="preview" />
            <button onClick={() => removeImage(i)}>✕</button>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}