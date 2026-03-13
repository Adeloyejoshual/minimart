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
  });
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState("");

  const API = "https://minimart-ivrm.onrender.com/api";

  // -------------------
  // Redirect if not logged in
  // -------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  // -------------------
  // Handle input change
  // -------------------
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  // -------------------
  // Submit product
  // -------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description || "");
      formData.append("price", form.price);
      formData.append("stock", form.stock);
      if (imageFile) formData.append("image", imageFile);

      const res = await axios.post(`${API}/marketplace/products`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("✅ Product added successfully!");
      setForm({ title: "", description: "", price: "", stock: 0 });
      setImageFile(null);
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to add product: " + (err.response?.data?.message || err.message));
    }
  };

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

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />

        <button type="submit">Add Product</button>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}