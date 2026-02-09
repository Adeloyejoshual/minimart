import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function MarketplaceAddProductPage() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    images: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({ ...prev, images: Array.from(e.target.files) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // For now, we just log data. Later, connect to backend.
    console.log("Product submitted:", formData);
    alert("Product submitted! Check console for data.");
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Marketplace - Add Product</h1>
        <p>You must be logged in to add a product.</p>
        <button onClick={() => loginWithRedirect()}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Marketplace - Add Product</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", maxWidth: "400px" }}>
        <label>
          Title:
          <input type="text" name="title" value={formData.title} onChange={handleChange} required />
        </label>

        <label>
          Description:
          <textarea name="description" value={formData.description} onChange={handleChange} required />
        </label>

        <label>
          Price:
          <input type="number" name="price" value={formData.price} onChange={handleChange} required />
        </label>

        <label>
          Images:
          <input type="file" multiple accept="image/*" onChange={handleFileChange} />
        </label>

        <button type="submit" style={{ marginTop: "1rem" }}>Submit Product</button>
      </form>
    </div>
  );
}