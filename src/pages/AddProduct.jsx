// src/pages/AddProduct.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    stock: 0,
    category_id: "",
    subcategory_id: "",
    dynamicFields: {},
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [message, setMessage] = useState("");

  const API = "https://minimart-ivrm.onrender.com/api";

  // Redirect if not logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, [navigate]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${API}/marketplace/categories`);
        setCategories(res.data);
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    fetchCategories();
  }, []);

  // Update subcategories when category changes
  useEffect(() => {
    const selected = categories.find(cat => cat.id === form.category_id);
    setSubcategories(selected?.children || []);
    setForm(prev => ({ ...prev, subcategory_id: "", dynamicFields: {} }));
  }, [form.category_id, categories]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDynamicFieldChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [field]: value }
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("stock", form.stock);
      formData.append("category_id", form.category_id);
      formData.append("subcategory_id", form.subcategory_id || "");
      formData.append("dynamicFields", JSON.stringify(form.dynamicFields));

      images.forEach(img => formData.append("images", img));

      const res = await axios.post(`${API}/marketplace/products`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setMessage("✅ Product added successfully");
      setForm({ title: "", description: "", price: "", stock: 0, category_id: "", subcategory_id: "", dynamicFields: {} });
      setImages([]);
      setImagePreviews([]);
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to add product");
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>Add Product</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="text" name="title" placeholder="Product title" value={form.title} onChange={handleChange} required />
        <textarea name="description" placeholder="Product description" value={form.description} onChange={handleChange} />

        <input type="number" name="price" placeholder="Price" value={form.price} onChange={handleChange} required />
        <input type="number" name="stock" placeholder="Stock" value={form.stock} onChange={handleChange} />

        {/* Category */}
        <select name="category_id" value={form.category_id} onChange={handleChange} required>
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Subcategory */}
        {subcategories.length > 0 && (
          <select name="subcategory_id" value={form.subcategory_id} onChange={handleChange}>
            <option value="">Select Subcategory</option>
            {subcategories.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        )}

        {/* Dynamic fields */}
        {Object.entries(form.dynamicFields).map(([field, value]) => (
          <input key={field} type="text" placeholder={field} value={value} onChange={e => handleDynamicFieldChange(field, e.target.value)} />
        ))}

        {/* Image Upload */}
        <input type="file" accept="image/*" multiple onChange={handleImageChange} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {imagePreviews.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={p} alt={`preview-${i}`} width={100} height={100} style={{ objectFit: "cover" }} />
              <button type="button" onClick={() => removeImage(i)} style={{ position: "absolute", top: 0, right: 0 }}>×</button>
            </div>
          ))}
        </div>

        <button type="submit">Add Product</button>
      </form>
      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}