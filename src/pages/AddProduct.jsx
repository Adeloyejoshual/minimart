import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
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
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [createdProduct, setCreatedProduct] = useState(null);
  const [showShare, setShowShare] = useState(false);

  /* ================= FETCH CATEGORIES ================= */
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

  /* ================= HELPERS ================= */
  const updateForm = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [key]: value },
    }));

  const onlyNumbers = (v) => v.replace(/[^\d]/g, "");

  const formatPrice = (v) => {
    const n = v.replace(/,/g, "").replace(/[^\d]/g, "");
    return n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

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

    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone number required";

    if (!form.attributes.condition)
      return "Select product condition";

    return null;
  };

  /* ================= IMAGE HANDLING ================= */
  const handleImages = (files) => {
    const raw = Array.from(files).slice(0, 8);

    previews.forEach((p) => URL.revokeObjectURL(p));

    const newPreviews = raw.map((f) => URL.createObjectURL(f));

    setImages(raw);
    setPreviews(newPreviews);
  };

  const removeImage = (index) => {
    setImages((p) => p.filter((_, i) => i !== index));

    setPreviews((p) => {
      URL.revokeObjectURL(p[index]);
      return p.filter((_, i) => i !== index);
    });
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);

    setLoading(true);
    setProgress(0);

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
        const res = JSON.parse(xhr.response || "{}");
        const product = res?.product;

        setCreatedProduct(product);
        setShowShare(true);

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

  /* ================= SHARE ACTIONS ================= */
  const productUrl = (id) =>
    `${window.location.origin}/product/${id}`;

  const shareWhatsApp = (product) => {
    const url = productUrl(product.id);

    const message =
      `🔥 New Product\n\n` +
      `${product.title}\n` +
      `₦${product.price}\n\n` +
      `${url}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const copyLink = async (product) => {
    await navigator.clipboard.writeText(productUrl(product.id));
    alert("Link copied!");
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] || [] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">

      {/* GLASS HEADER */}
      <div className="glass-header">
        <button className="glass-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2>Add Product</h2>
      </div>

      {/* PROGRESS */}
      {loading && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* FORM */}
      <input
        placeholder="Title (min 15 chars)"
        value={form.title}
        onChange={(e) => updateForm("title", e.target.value)}
      />

      <textarea
        placeholder="Description (min 30 chars)"
        value={form.description}
        onChange={(e) => updateForm("description", e.target.value)}
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) =>
          updateForm("price", formatPrice(e.target.value))
        }
      />

      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) => updateForm("category_id", v)}
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      <DropdownModal
        label="Condition"
        value={form.attributes.condition || ""}
        onChange={(v) => updateAttr("condition", v)}
        options={optionsMap.condition}
      />

      {form.attributes.condition === "used" && (
        <DropdownModal
          label="Used Condition Detail"
          value={form.attributes.used_detail || ""}
          onChange={(v) => updateAttr("used_detail", v)}
          options={optionsMap.used_detail}
        />
      )}

      {dynamicFields.map((f) => (
        <DropdownModal
          key={f}
          label={formatLabel(f)}
          value={form.attributes[f] || ""}
          onChange={(v) => updateAttr(f, v)}
          options={optionsMap[f] || []}
        />
      ))}

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
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleImages(e.target.files)}
      />

      {/* PREVIEW */}
      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i} className="preview-item">
            <img src={src} alt="preview" />
            <button onClick={() => removeImage(i)}>×</button>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>

      {/* SHARE MODAL */}
      {showShare && createdProduct && (
        <div className="share-overlay">
          <div className="share-modal">

            <h2>🎉 Product Created</h2>

            <div className="share-preview">
              <h3>{createdProduct.title}</h3>
              <p>₦{createdProduct.price}</p>
            </div>

            <button onClick={() => shareWhatsApp(createdProduct)}>
              Share on WhatsApp
            </button>

            <button onClick={() => copyLink(createdProduct)}>
              Copy Link
            </button>

            <button
              onClick={() =>
                (window.location.href = `/product/${createdProduct.id}`)
              }
            >
              View Product
            </button>

            <button
              className="cancel-btn"
              onClick={() => setShowShare(false)}
            >
              Cancel
            </button>

          </div>
        </div>
      )}
    </div>
  );
}