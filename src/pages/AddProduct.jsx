// src/pages/AddProduct.jsx
import React, { useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../App";

export default function AddProduct() {
  const { user } = useContext(AuthContext);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Check if user is allowed to sell
  if (!user || user.role !== "seller") {
    return <p>You must be logged in as a seller to add products.</p>;
  }

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price) {
      setMessage("Title and price are required.");
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;

      // Upload image to S3 if selected
      if (image) {
        const formData = new FormData();
        formData.append("image", image);

        const s3Res = await axios.post("/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        imageUrl = s3Res.data.url;
      }

      // Send product to backend
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "/api/marketplace",
        { title, description, price, image_url: imageUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage("Product added successfully!");
      setTitle("");
      setDescription("");
      setPrice("");
      setImage(null);
    } catch (err) {
      console.error(err);
      setMessage("Failed to add product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <h2>Add a New Product</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
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
        <input type="file" accept="image/*" onChange={handleImageChange} />
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}