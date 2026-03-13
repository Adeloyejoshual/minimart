// src/pages/AddProduct.jsx
import React, { useState } from "react";
import axios from "axios";

export default function AddProduct({ user }) {
  const [product, setProduct] = useState({
    title: "",
    description: "",
    price: "",
    stock: "",
    image: "",
  });
  const [message, setMessage] = useState("");

  const API = process.env.REACT_APP_API_URL || "https://minimart-ivrm.onrender.com/api";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProduct({ ...product, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return setMessage("You must be logged in to add products");

    try {
      const token = localStorage.getItem("token"); // Optional if using JWT auth
      const res = await axios.post(
        `${API}/marketplace/products`,
        {
          ...product,
          seller_id: user.id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setMessage(`Product "${res.data.title}" added successfully!`);
      setProduct({ title: "", description: "", price: "", stock: "", image: "" });
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Failed to add product");
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h2>Add Product</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          name="title"
          placeholder="Product Title"
          value={product.title}
          onChange={handleChange}
          required
        />
        <textarea
          name="description"
          placeholder="Description"
          value={product.description}
          onChange={handleChange}
        />
        <input
          type="number"
          step="0.01"
          name="price"
          placeholder="Price"
          value={product.price}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="stock"
          placeholder="Stock Quantity"
          value={product.stock}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="image"
          placeholder="Image URL (optional)"
          value={product.image}
          onChange={handleChange}
        />
        <button type="submit">Add Product</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}