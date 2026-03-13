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
  const [loading, setLoading] = useState(false);

  const API = "https://minimart-ivrm.onrender.com/api";

  // -------------------
  // Check login
  // -------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/"); // redirect if not logged in
  }, [navigate]);

  // -------------------
  // Handle input changes
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
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      // Prepare form data for S3 upload
      const data = new FormData();
      data.append("title", form.title.trim());
      data.append("description", form.description?.trim() || "");
      data.append("price", parseFloat(form.price));
      data.append("stock", parseInt(form.stock, 10));
      if (imageFile) data.append("image", imageFile);

      const res = await axios.post(`${API}/marketplace/products`, data, {
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
      setMessage(err.response?.data?.message || "❌ Failed to add product");
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>Add Product</h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
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

        <input type="file" accept="image/*" onChange={handleFileChange} />

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}