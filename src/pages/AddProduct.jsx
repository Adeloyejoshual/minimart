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

  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");

  const API = "https://minimart-ivrm.onrender.com/api";

  // -------------------
  // Check login
  // -------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/"); // redirect if not logged in
    }
  }, [navigate]);

  // -------------------
  // Handle form input
  // -------------------
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setImages(Array.from(e.target.files)); // store selected files
  };

  // -------------------
  // Submit product
  // -------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title || !form.price) {
      setMessage("❌ Title and price are required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("stock", form.stock);

      images.forEach((file) => {
        formData.append("images", file);
      });

      const res = await axios.post(`${API}/marketplace/products`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setMessage("✅ Product and images added successfully");

      // Reset form
      setForm({ title: "", description: "", price: "", stock: 0 });
      setImages([]);

    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to add product");
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
          multiple
          accept="image/*"
          onChange={handleFileChange}
        />

        <button type="submit">Add Product</button>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}