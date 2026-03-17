// src/pages/AddProduct.js
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { uploadToCloudinary } from "../cloudinary";
import Toast from "../components/Toast";

const API_URL = process.env.REACT_APP_API_URL; // your backend endpoint

export default function AddProduct() {
  const navigate = useNavigate();
  const scrollPos = useRef(0);

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    category_id: "",
    subcategory_id: "",
    price: "",
    phone: "",
    images: [],
    previews: [],
    dynamicFields: {},
    isPromoted: false,
  });
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [loading, setLoading] = useState(false);

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Fetch Categories ----------------
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${API_URL}/categories`);
        const mainCats = res.data.filter(cat => !cat.parent_id);
        setCategories(mainCats);
      } catch (err) {
        showToast("Failed to load categories", "❌");
      }
    };
    fetchCategories();
  }, []);

  // ---------------- Subcategories ----------------
  useEffect(() => {
    if (!form.category_id) return setSubcategories([]);
    const fetchSubs = async () => {
      try {
        const res = await axios.get(`${API_URL}/categories?parent_id=${form.category_id}`);
        setSubcategories(res.data);
      } catch {
        setSubcategories([]);
      }
    };
    fetchSubs();
  }, [form.category_id]);

  // ---------------- Helpers ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") update("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
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
    setForm(prev => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [field]: value }
    }));
  };

  // ---------------- Validation ----------------
  const validate = () => {
    if (!form.title) return "Enter a title";
    if (!form.category_id) return "Select a category";
    if (!form.price) return "Enter a price";
    if (!form.phone) return "Enter a valid phone number";
    if (!form.images.length) return "Upload at least one image";
    return null;
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    const error = validate();
    if (error) return showToast(error, "⚠️");

    try {
      setLoading(true);
      const uploadedImages = await Promise.all(form.images.map(img => uploadToCloudinary(img)));
      await axios.post(`${API_URL}/products`, {
        ...form,
        images: uploadedImages,
      });
      showToast("Product posted successfully!", "✅");
      navigate("/");
    } catch (err) {
      showToast(err.message || "Failed to post product", "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Render ----------------
  const selectedCategory = categories.find(c => c.id === form.category_id);
  const dynamicFields = selectedCategory?.fields || [];

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <label>Title</label>
      <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="Product title" />

      <label>Category</label>
      <select value={form.category_id} onChange={e => update("category_id", e.target.value)}>
        <option value="">Select category</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {subcategories.length > 0 && (
        <>
          <label>Subcategory</label>
          <select value={form.subcategory_id} onChange={e => update("subcategory_id", e.target.value)}>
            <option value="">Select subcategory</option>
            {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </>
      )}

      {dynamicFields.map(field => (
        <div key={field}>
          <label>{field.replace(/_/g, " ").toUpperCase()}</label>
          <input
            value={form.dynamicFields[field] || ""}
            onChange={e => handleDynamicFieldChange(field, e.target.value)}
            placeholder={field}
          />
        </div>
      ))}

      <label>Price (₦)</label>
      <input value={form.price} onChange={handlePriceChange} placeholder="₦0" />

      <label>Phone</label>
      <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />

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

      <label>
        <input
          type="checkbox"
          checked={form.isPromoted}
          onChange={e => update("isPromoted", e.target.checked)}
        />
        Promote this product
      </label>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}