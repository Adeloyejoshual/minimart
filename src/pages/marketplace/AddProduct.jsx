import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "../styles/addProduct.css";

const socket = io(import.meta.env.VITE_API_BASE_URL || "http://localhost:3000");

function AddProduct() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState([]);
  const [isPromoted, setIsPromoted] = useState(false);
  const [isProSeller, setIsProSeller] = useState(false);
  const [loading, setLoading] = useState(false);

  const categories = ["Electronics", "Fashion", "Home", "Phones", "Beauty"];

  const handleFileChange = (e) => {
    setImages([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("category", category);
    formData.append("location", location);
    formData.append("isPromoted", isPromoted);
    formData.append("isProSeller", isProSeller);
    images.forEach((img) => formData.append("images", img));

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/marketplace/add`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to add product");

      const newProduct = await res.json();

      // Emit real-time event to homepage
      socket.emit("newListing", newProduct);

      // Redirect back to homepage
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Failed to add product. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-page">
      <div className="section">
        <h1 className="section-title">Add New Product</h1>
        <form className="add-product-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Product Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Price (₦)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />

          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />

          <input type="file" multiple accept="image/*" onChange={handleFileChange} />

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={isPromoted}
                onChange={() => setIsPromoted(!isPromoted)}
              />
              Promote Listing
            </label>

            <label>
              <input
                type="checkbox"
                checked={isProSeller}
                onChange={() => setIsProSeller(!isProSeller)}
              />
              Pro Seller
            </label>
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? "Adding..." : "Add Product"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddProduct;