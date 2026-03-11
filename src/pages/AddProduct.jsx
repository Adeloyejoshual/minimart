// src/pages/AddProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price) {
      alert("Title and Price are required!");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("price", price);
    formData.append("description", description);
    if (imageFile) formData.append("image", imageFile);

    try {
      setLoading(true);
      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to add product");
        setLoading(false);
        return;
      }

      alert("Product added successfully!");
      navigate("/minimart"); // redirect to marketplace or home
    } catch (err) {
      console.error("Error adding product:", err);
      alert("Error adding product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
      <h2>Add a New Product</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 16px",
            backgroundColor: "#0D6EFD",
            color: "#fff",
            fontWeight: 600,
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}