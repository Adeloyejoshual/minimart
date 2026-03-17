// src/pages/AddProduct.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { categoryFields } from "../config/categoryFields";
import Toast from "../components/Toast";
import "./../styles/AddProduct.css";
import { uploadToCloudinary } from "../cloudinary";

export default function AddProduct({ categories }) {
  const navigate = useNavigate();
  const scrollPos = useRef(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    phone: "",
    mainCategory: "",
    mainCategoryId: "",
    subCategory: "",
    subCategoryId: "",
    images: [],
    previews: [],
    dynamicFields: {},
    isPromoted: false,
  });

  const [selectionStep, setSelectionStep] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [loading, setLoading] = useState(false);

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Helpers ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

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
    setForm(prev => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [field]: value }
    }));
  };

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      update("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  // ---------------- Validation ----------------
  const validate = () => {
    if (!form.title) return "Title is required";
    if (!form.price) return "Price is required";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (!form.mainCategory) return "Select a category";
    return null;
  };

  // ---------------- Submit / Publish ----------------
  const handleSubmit = async () => {
    const error = validate();
    if (error) return showToast(error, "⚠️");

    setLoading(true);

    try {
      // Upload images
      const uploadedImages = await Promise.all(form.images.map(uploadToCloudinary));

      const payload = {
        title: form.title,
        description: form.description,
        price: form.price.replace(/,/g, ""),
        phone: form.phone,
        category_id: form.mainCategoryId,
        subcategory_id: form.subCategoryId || null,
        dynamicFields: form.dynamicFields,
        isPromoted: form.isPromoted,
        images: uploadedImages
      };

      const res = await fetch("/api/marketplace/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to publish product");

      showToast("Product published successfully! 🎉", "✅");
      navigate("/marketplace");
    } catch (err) {
      console.error("Publish error:", err);
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Derived Options ----------------
  const getSubcategories = () => categories.find(c => c.id === form.mainCategoryId)?.subcategories || [];

  // ---------------- Render ----------------
  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </div>

      <div className="field">
        <label>Description</label>
        <textarea value={form.description} onChange={e => update("description", e.target.value)} />
      </div>

      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategoryId}
          onChange={e => {
            const selected = categories.find(c => c.id === e.target.value);
            update("mainCategory", selected?.name || "");
            update("mainCategoryId", selected?.id || "");
            update("subCategory", "");
            update("subCategoryId", "");
            update("dynamicFields", {});
          }}
        >
          <option value="">Select category</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
      </div>

      {form.mainCategoryId && (
        <div className="field">
          <label>Subcategory</label>
          <select
            value={form.subCategoryId}
            onChange={e => {
              const sub = getSubcategories().find(s => s.id === e.target.value);
              update("subCategory", sub?.name || "");
              update("subCategoryId", sub?.id || "");
            }}
          >
            <option value="">Select subcategory</option>
            {getSubcategories().map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
          </select>
        </div>
      )}

      {/* Dynamic fields */}
      {form.mainCategory && categoryFields[form.mainCategory]?.map(field => (
        <div className="field" key={field}>
          <label>{field.replace("_", " ")}</label>
          <input
            value={form.dynamicFields[field] || ""}
            onChange={e => handleDynamicFieldChange(field, e.target.value)}
          />
        </div>
      ))}

      <div className="field">
        <label>Price (₦)</label>
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </div>

      <div className="field">
        <label>Phone</label>
        <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />
      </div>

      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
        <div className="images-preview">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={form.isPromoted}
            onChange={e => update("isPromoted", e.target.checked)}
          />
          Promote product
        </label>
      </div>

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Publishing..." : "Publish"}
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}