// src/pages/marketplace/AddProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function MarketplaceAddProductPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle image selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);

    const previews = files.map((file) => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  // Remove image
  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    setPreviewImages(previewImages.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description || !category) {
      setError("Title, description, and category are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      if (price) formData.append("price", price);
      images.forEach((img) => formData.append("images", img));

      const token = localStorage.getItem("auth_token"); // Assume you store Auth0 token
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/marketplace/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to create listing");

      const data = await res.json();
      navigate(`/marketplace/listing/${data._id}`); // Redirect to new listing
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="homepage section">
      <h2 className="section-title">Add Marketplace Listing</h2>

      <form className="search-area" onSubmit={handleSubmit}>
        {error && <p style={{ color: "red" }}>{error}</p>}

        <input
          className="search-input"
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="search-input"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />

        <input
          className="search-input"
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />

        <input
          className="search-input"
          type="number"
          placeholder="Price (optional)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
        />

        <div className="product-grid">
          {previewImages.map((img, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={img}
                alt="Preview"
                className="product-img"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "red",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button type="submit" className="load-more-btn" disabled={loading}>
          {loading ? "Posting..." : "Post Listing"}
        </button>
      </form>
    </div>
  );
}