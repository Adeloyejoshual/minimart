// src/pages/AddProduct.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { categoryFields } from "../config/categoryFields";

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    stock: 0,
    category_id: "",
    subcategory_id: "",
  });
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [dynamicFields, setDynamicFields] = useState({});
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

  // Update subcategories and reset dynamic fields when category changes
  useEffect(() => {
    const selectedCategory = categories.find(c => c.id === form.category_id);
    setSubcategories(selectedCategory?.subcategories || []);
    setForm(prev => ({ ...prev, subcategory_id: "" }));
    setDynamicFields({});
  }, [form.category_id, categories]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDynamicFieldChange = (e) => {
    setDynamicFields({ ...dynamicFields, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImages([...e.target.files]);
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
      if (form.subcategory_id) formData.append("subcategory_id", form.subcategory_id);
      if (images.length) {
        images.forEach(img => formData.append("images", img));
      }
      if (Object.keys(dynamicFields).length) {
        formData.append("dynamicFields", JSON.stringify(dynamicFields));
      }

      const res = await axios.post(`${API}/marketplace/products`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setMessage("✅ Product added successfully");
      setForm({ title: "", description: "", price: "", stock: 0, category_id: "", subcategory_id: "" });
      setImages([]);
      setDynamicFields({});
    } catch (err) {
      console.error(err.response || err);
      setMessage("❌ Failed to add product");
    }
  };

  // Get dynamic field names for selected category
  const currentCategoryName = categories.find(c => c.id === form.category_id)?.name;
  const currentFields = categoryFields[currentCategoryName] || [];

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>Add Product</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          name="title"
          placeholder="Product title"
          value={form.title}
          onChange={handleChange}
          required
        />
        <textarea
          name="description"
          placeholder="Product description"
          value={form.description}
          onChange={handleChange}
        />
        <input
          type="number"
          name="price"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="stock"
          placeholder="Stock"
          value={form.stock}
          onChange={handleChange}
        />

        {/* Category dropdown */}
        <select name="category_id" value={form.category_id} onChange={handleChange} required>
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Subcategory dropdown */}
        {subcategories.length > 0 && (
          <select name="subcategory_id" value={form.subcategory_id} onChange={handleChange}>
            <option value="">Select Subcategory</option>
            {subcategories.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        )}

        {/* Dynamic fields */}
        {currentFields.map(field => (
          <input
            key={field}
            type="text"
            name={field}
            placeholder={field}
            value={dynamicFields[field] || ""}
            onChange={handleDynamicFieldChange}
          />
        ))}

        <input type="file" accept="image/*" multiple onChange={handleImageChange} />
        <button type="submit">Add Product</button>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}