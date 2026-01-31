// src/pages/MartProduct.jsx
import React, { useState } from "react";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function MartProduct() {
  const [user] = useAuthState(auth);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) return setMessage("❌ You must be logged in to add a product");
    if (!title || !price) return setMessage("❌ Title and Price are required");

    setLoading(true);
    setMessage("");

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/mart-products`, {
        name: title,
        description,
        price,
        userId: user.uid,
        userEmail: user.email
      });

      setMessage("✅ Product added successfully!");
      setTitle("");
      setDescription("");
      setPrice("");

      // Redirect to MiniMart page after 1.5s
      setTimeout(() => {
        navigate("/minimart");
      }, 1500);

    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
      <h1>Add Product</h1>

      {message && <p style={{ color: message.startsWith("❌") ? "red" : "green" }}>{message}</p>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={inputStyle}
        />

        <textarea
          placeholder="Product Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={inputStyle}
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
  boxSizing: "border-box"
};

const buttonStyle = {
  padding: 12,
  borderRadius: 6,
  border: "none",
  background: "#4da6ff",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 16
};