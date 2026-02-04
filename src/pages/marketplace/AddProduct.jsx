// src/pages/marketplace/AddProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL;

function AddProduct() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const categories = ["Electronics", "Fashion", "Home", "Phones", "Beauty"];

  const handleFileChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("price", price);
      formData.append("category", category);
      formData.append("location", location);
      images.forEach(file => formData.append("images", file));

      const res = await fetch(`${BACKEND_URL}/api/marketplace/addproduct`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        navigate("/marketplace"); // redirect to marketplace homepage
      } else {
        alert(data.error || "Failed to add product.");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding product. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingTop: 40 }}>
      <h2>Add Product</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
          required
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map(cat => <option key={cat}>{cat}</option>)}
        </select>
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={e => setLocation(e.target.value)}
          required
        />
        <input type="file" multiple onChange={handleFileChange} />
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}

export default AddProduct;