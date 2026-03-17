// src/pages/AddProduct.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryFields from "../config/categoryFields";
import Toast from "../components/Toast";

const API_URL = import.meta.env.VITE_API_URL; // e.g. https://your-backend.com

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const scrollPos = useRef(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    phone: "",
    mainCategory: "",
    subCategory: "",
    images: [],
    previews: [],
    dynamicFields: {},
    isPromoted: false,
  });

  // ---------------- Helpers ----------------
  const showToast = (message, icon = "⚡") => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      update("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  const handleImages = files => {
    const list = Array.from(files);
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = index => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  const handleDynamicFieldChange = (field, value) => {
    update("dynamicFields", { ...form.dynamicFields, [field]: value });
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return showToast("Title, price, and category are required", "⚠️");
    }

    try {
      setLoading(true);

      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("price", form.price.replace(/,/g, ""));
      data.append("phone", form.phone || "");
      data.append("category_id", form.mainCategory);
      data.append("subcategory_id", form.subCategory || "");
      data.append("dynamicFields", JSON.stringify(form.dynamicFields));
      data.append("isPromoted", form.isPromoted);

      form.images.forEach(file => data.append("images", file));

      const res = await fetch(`${API_URL}/products`, {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add product");
      }

      const product = await res.json();
      showToast("Product added successfully! ✅");
      navigate(`/${marketType}`);
    } catch (err) {
      console.error("AddProduct error:", err);
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Category/Subcategory ----------------
  const mainCategories = categories;
  const subCategories = form.mainCategory
    ? categories.find(c => c.id === form.mainCategory)?.subcategories || []
    : [];

  const dynamicFieldKeys = form.mainCategory
    ? categoryFields[categories.find(c => c.id === form.mainCategory)?.name] || []
    : [];

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </Field>

      <Field label="Category">
        <select value={form.mainCategory} onChange={e => update("mainCategory", e.target.value)}>
          <option value="">Select Category</option>
          {mainCategories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </Field>

      {subCategories.length > 0 && (
        <Field label="Subcategory">
          <select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Select Subcategory</option>
            {subCategories.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </Field>
      )}

      {dynamicFieldKeys.map(field => (
        <Field key={field} label={field}>
          <input
            value={form.dynamicFields[field] || ""}
            onChange={e => handleDynamicFieldChange(field, e.target.value)}
            placeholder={`Enter ${field}`}
          />
        </Field>
      ))}

      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      <Field label="Phone">
        <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />
      </Field>

      <Field label="Images">
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
        <div className="previews">
          {form.previews.map((p, i) => (
            <div key={i} className="preview-wrap">
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Promote Product">
        <input
          type="checkbox"
          checked={form.isPromoted}
          onChange={e => update("isPromoted", e.target.checked)}
        />
      </Field>

      <button type="button" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}

// ---------------- Field Component ----------------
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);