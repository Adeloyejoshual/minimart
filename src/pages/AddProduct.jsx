import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import "./AddProduct.css";

/* ================= INITIAL STATE ================= */
const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: {},

  /* ================= PROFESSIONAL DELIVERY TIERS ================= */
  delivery: {
    available: true,
    tier: "0-7", // default fast delivery
    note: "",
  },

  contact: {
    phone: "",
    whatsapp: "",
    preferred: "chat",
  },
};

/* ================= DELIVERY OPTIONS ================= */
const deliveryOptions = [
  { id: "0-7", name: "0–7 Days (Fast Delivery)" },
  { id: "7-14", name: "7–14 Days (Standard Delivery)" },
  { id: "14-30", name: "14–30 Days (Extended Delivery)" },
];

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

  /* ================= SELECT CATEGORY ================= */
  const selectedCategory = useMemo(() => {
    if (!form.category_id) return null;
    return categories.find((c) => String(c.id) === String(form.category_id));
  }, [categories, form.category_id]);

  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};
  const brand = form.attributes?.brand;

  const optionsMap = useMemo(() => {
    return {
      brand: options.brands || [],
      model: options.models?.[brand] || [],
      color: options.colors || [],
      condition: options.conditions || [],
      used_detail: options.used_details || [],
    };
  }, [options, brand]);

  const isUsed = form.attributes?.condition === "used";

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

  /* ================= IMAGES ================= */
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

  /* ================= SHARE (WHATSAPP-FIRST + DELIVERY) ================= */
  const productUrl = (id) =>
    `${window.location.origin}/product/${id}`;

  const shareWhatsApp = (product) => {
    const url = productUrl(product.id);

    const deliveryText =
      product.delivery?.tier === "0-7"
        ? "⚡ Fast Delivery (0–7 days)"
        : product.delivery?.tier === "7-14"
        ? "🚚 Standard Delivery (7–14 days)"
        : "📦 Extended Delivery (14–30 days)";

    const message =
      `🔥 *New Listing*\n\n` +
      `${product.title}\n` +
      `₦${product.price}\n` +
      `${deliveryText}\n\n` +
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

  /* ================= LOCATION ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] || [] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">

      {/* HEADER */}
      <div className="glass-header">
        <button onClick={() => navigate(-1)}>← Back</button>
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

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) => {
          setForm((p) => ({
            ...p,
            category_id: v,
            attributes: {}, // FIX: prevents dual-condition bug
          }));
        }}
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
        options={optionsMap.condition}
      />

      {/* USED DETAIL */}
      {isUsed && (
        <DropdownModal
          label="Used Condition Detail"
          value={form.attributes.used_detail || ""}
          onChange={(v) => updateAttr("used_detail", v)}
          options={optionsMap.used_detail}
        />
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map((f) => (
        <DropdownModal
          key={f}
          label={formatLabel(f)}
          value={form.attributes[f] || ""}
          onChange={(v) => updateAttr(f, v)}
          options={optionsMap[f] || []}
        />
      ))}

      {/* DELIVERY (PROFESSIONAL) */}
      <DropdownModal
        label="Delivery Time"
        value={form.delivery.tier}
        onChange={(v) =>
          setForm((p) => ({
            ...p,
            delivery: {
              ...p.delivery,
              tier: v,
            },
          }))
        }
        options={deliveryOptions}
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

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
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

            <h2>🎉 Product Live</h2>

            <button onClick={() => shareWhatsApp(createdProduct)}>
              📲 Share on WhatsApp
            </button>

            <button onClick={() => copyLink(createdProduct)}>
              Copy Link
            </button>

            <button
              onClick={() =>
                navigate(`/product/${createdProduct.id}`)
              }
            >
              View Product
            </button>

            <button onClick={() => setShowShare(false)}>
              Done
            </button>

          </div>
        </div>
      )}
    </div>
  );
}