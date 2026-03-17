// src/pages/AddProduct.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import { categoryFields } from "../config/categoryFields";
import { uploadToCloudinary } from "../cloudinary";
import Toast from "../components/Toast";
import "./AddProduct.css";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const scrollPos = useRef(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    phone: "",
    mainCategory: "",
    subCategory: "",
    dynamicFields: {},
    images: [],
    previews: [],
    isPromoted: false,
  });

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

  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Validation ----------------
  const validate = () => {
    if (!form.title || !form.price) return "Title and price are required";
    if (!form.mainCategory) return "Select a category";
    return null;
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    const error = validate();
    if (error) return showToast(error, "⚠️");

    try {
      setLoading(true);

      // Upload images
      const uploadedImages = [];
      for (const img of form.images) {
        const url = await uploadToCloudinary(img);
        uploadedImages.push(url);
      }

      // Prepare dynamic fields
      const dynamicFields = form.dynamicFields;

      const body = {
        title: form.title,
        description: form.description,
        price: form.price,
        phone: form.phone,
        category_id: form.mainCategory,
        subcategory_id: form.subCategory,
        dynamicFields,
        images: uploadedImages,
        isPromoted: form.isPromoted,
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to post product");

      showToast("Product posted successfully!", "✅");
      navigate(`/${marketType}`);
    } catch (err) {
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Dynamic Fields ----------------
  const renderDynamicFields = () => {
    if (!form.mainCategory) return null;
    const fields = categoryFields[form.mainCategory] || [];
    return fields.map(f => (
      <Field key={f} label={f.replace("_", " ")}>
        <input
          value={form.dynamicFields[f] || ""}
          onChange={e =>
            setForm(prev => ({
              ...prev,
              dynamicFields: { ...prev.dynamicFields, [f]: e.target.value },
            }))
          }
        />
      </Field>
    ));
  };

  // ---------------- Category Select ----------------
  const handleCategoryChange = category => {
    update("mainCategory", category);
    update("subCategory", "");
    update("dynamicFields", {});
  };

  const getSubcategories = () => categories.find(c => c.name === form.mainCategory)?.subcategories || [];

  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <button className="back-btn" onClick={() => navigate(`/${marketType}`)}>←</button>
        <span className="page-title">Add Product</span>
      </div>

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="Product title" />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Product description" />
      </Field>

      <Field label="Price">
        <input value={form.price} onChange={e => update("price", e.target.value)} placeholder="₦ 0" />
      </Field>

      <Field label="Phone">
        <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />
      </Field>

      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`category-item ${form.mainCategory === cat.id ? "active" : ""}`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              {cat.name}
            </div>
          ))}
        </div>
      </Field>

      {form.mainCategory && getSubcategories().length > 0 && (
        <Field label="Subcategory">
          <select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Select subcategory</option>
            {getSubcategories().map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      )}

      {renderDynamicFields()}

      <Field label="Images">
        <label className="image-upload">
          <input type="file" multiple onChange={e => handleImages(e.target.files)} hidden />
          + Add Images
        </label>
        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Promotion">
        <label>
          <input type="checkbox" checked={form.isPromoted} onChange={e => update("isPromoted", e.target.checked)} /> Promote this product
        </label>
      </Field>

      <button className="btn" onClick={handleSubmit} disabled={loading}>
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