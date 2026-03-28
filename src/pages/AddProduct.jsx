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

  delivery: {
    available: true,
    from_days: "",
    to_days: "",
    fee_required: false,
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

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d || []))
      .catch(console.error);
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(() => {
    return categories.find(
      (c) => String(c.id) === String(form.category_id)
    );
  }, [categories, form.category_id]);

  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};
  const brand = form.attributes?.brand;

  const optionsMap = useMemo(() => ({
    brand: options.brands || [],
    model: options.models?.[brand] || [],
    color: options.colors || [],
    condition: options.conditions || [],
    used_detail: options.usedDetails || [],
  }), [options, brand]);

  const isUsed = form.attributes?.condition === "used";

  /* ================= HELPERS ================= */
  const updateForm = (k, v) =>
    setForm((p) => ({ ...p, [k]: v }));

  const updateAttr = (k, v) =>
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [k]: v },
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
    if (form.title.trim().length < 15) return "Title too short";
    if (form.description.trim().length < 30) return "Description too short";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";

    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone required";

    if (!form.attributes.condition)
      return "Select condition";

    if (form.delivery.available) {
      if (!form.delivery.from_days || !form.delivery.to_days)
        return "Enter delivery range";

      if (+form.delivery.from_days > +form.delivery.to_days)
        return "Invalid delivery range";

      if (form.delivery.fee_required && !form.delivery.fee)
        return "Enter delivery fee";
    }

    return null;
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const raw = Array.from(files).slice(0, 8);

    previews.forEach((p) => URL.revokeObjectURL(p));

    setImages(raw);
    setPreviews(raw.map((f) => URL.createObjectURL(f)));
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
        const product = JSON.parse(xhr.response).product;

        setCreatedProduct(product);
        setShowShare(true);

        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
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

  /* ================= SHARE ================= */
  const productUrl = (id) =>
    `${window.location.origin}/product/${id}`;

  const shareWhatsApp = (p) => {
    const deliveryText = p.delivery?.available
      ? `🚚 ${p.delivery.from_days}-${p.delivery.to_days} days` +
        (p.delivery.fee_required
          ? ` | Fee ₦${p.delivery.fee}`
          : " | Free delivery")
      : "No delivery";

    const msg =
      `🔥 *New Product*\n\n${p.title}\n₦${p.price}\n${deliveryText}\n\n${productUrl(p.id)}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };

  /* ================= LOCATION ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">

      <div className="glass-header">
        <button onClick={() => navigate(-1)}>←</button>
        <h2>Add Product</h2>
      </div>

      {loading && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* BASIC */}
      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => updateForm("title", e.target.value)}
      />

      <textarea
        placeholder="Description"
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
        onChange={(v) =>
          setForm((p) => ({
            ...p,
            category_id: v,
            attributes: {},
          }))
        }
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {/* ATTRIBUTES */}
      <DropdownModal
        label="Condition"
        value={form.attributes.condition || ""}
        onChange={(v) => updateAttr("condition", v)}
        options={optionsMap.condition}
      />

      {isUsed && (
        <DropdownModal
          label="Used Detail"
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

      {/* DELIVERY */}
      <div className="form-section">
        <h3>Delivery</h3>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) =>
              updateForm("delivery", {
                ...form.delivery,
                available: e.target.checked,
              })
            }
          />
          Available
        </label>

        {form.delivery.available && (
          <>
            <div className="delivery-row">
              <input
                placeholder="From days"
                value={form.delivery.from_days}
                onChange={(e) =>
                  updateForm("delivery", {
                    ...form.delivery,
                    from_days: e.target.value,
                  })
                }
              />
              <input
                placeholder="To days"
                value={form.delivery.to_days}
                onChange={(e) =>
                  updateForm("delivery", {
                    ...form.delivery,
                    to_days: e.target.value,
                  })
                }
              />
            </div>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.delivery.fee_required}
                onChange={(e) =>
                  updateForm("delivery", {
                    ...form.delivery,
                    fee_required: e.target.checked,
                  })
                }
              />
              Delivery Fee Required
            </label>

            {form.delivery.fee_required && (
              <input
                placeholder="Fee ₦"
                value={form.delivery.fee}
                onChange={(e) =>
                  updateForm("delivery", {
                    ...form.delivery,
                    fee: onlyNumbers(e.target.value),
                  })
                }
              />
            )}
          </>
        )}
      </div>

      {/* LOCATION */}
      <DropdownModal label="State" value={state} onChange={setState} options={states} />
      {state && (
        <DropdownModal label="City" value={city} onChange={setCity} options={cities} />
      )}

      {/* CONTACT */}
      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          updateForm("contact", {
            ...form.contact,
            phone: onlyNumbers(e.target.value),
          })
        }
      />

      <input
        placeholder="WhatsApp"
        value={form.contact.whatsapp}
        onChange={(e) =>
          updateForm("contact", {
            ...form.contact,
            whatsapp: onlyNumbers(e.target.value),
          })
        }
      />

      {/* IMAGES */}
      <input type="file" multiple onChange={(e) => handleImages(e.target.files)} />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i} className="preview-item">
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>×</button>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>

      {/* SHARE */}
      {showShare && createdProduct && (
        <div className="share-overlay">
          <div className="share-modal">
            <h2>🎉 Product Live</h2>

            <button onClick={() => shareWhatsApp(createdProduct)}>
              Share WhatsApp
            </button>

            <button onClick={() =>
              navigator.clipboard.writeText(productUrl(createdProduct.id))
            }>
              Copy Link
            </button>

            <button onClick={() =>
              navigate(`/product/${createdProduct.id}`)
            }>
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