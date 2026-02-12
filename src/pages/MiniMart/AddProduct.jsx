// src/pages/MiniMart/AddProduct.jsx

import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMiniMartProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !price) {
      alert("Title and price are required");
      return;
    }

    try {
      await axios.post("/api/minimart", {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
      });

      alert("Product added successfully!");
      navigate("/");
    } catch (err) {
      console.error("Failed to add MiniMart product:", err.response?.data || err.message);
      alert("Failed to add MiniMart product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add MiniMart Product</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}