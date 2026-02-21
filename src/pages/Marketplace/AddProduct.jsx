import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AddProduct() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: ""
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Product Submitted:", formData);

    alert("Product added successfully!");

    // Redirect back to home
    navigate("/");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Add Product</h2>

      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: 10 }}>
          <label>Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Price</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <button type="submit" style={{ padding: 10, width: "100%" }}>
          Submit Product
        </button>
      </form>
    </div>
  );
}