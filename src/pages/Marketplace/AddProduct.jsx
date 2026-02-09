import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    images: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        ...form,
        price: Number(form.price),
        images: form.images.split(",").map((url) => url.trim()),
      };

      await axios.post("/api/products", productData);
      setLoading(false);
      navigate("/"); // redirect to home
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("Failed to add product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add Marketplace Product</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", maxWidth: "400px" }}>
        <label>
          Name:
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          Description:
          <textarea name="description" value={form.description} onChange={handleChange} />
        </label>
        <label>
          Price:
          <input name="price" type="number" value={form.price} onChange={handleChange} required />
        </label>
        <label>
          Images (comma separated URLs):
          <input name="images" value={form.images} onChange={handleChange} />
        </label>
        <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}