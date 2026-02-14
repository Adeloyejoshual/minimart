// src/pages/AddProduct.jsx
import { useState } from "react";
import axios from "axios";

function AddProduct() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    subcategory: "",
    price: "",
    country: "Nigeria",
    state: "",
    city: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post(
        "https://minimart-8k9g.onrender.com/api/products",
        form
      );

      alert("Product added successfully!");

      setForm({
        title: "",
        description: "",
        category: "",
        subcategory: "",
        price: "",
        country: "Nigeria",
        state: "",
        city: "",
      });
    } catch (error) {
      console.error(error.response?.data || error.message);
      alert("Failed to add product.");
    }
  };

  return (
    <div>
      <h2>Add Marketplace Product</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="title"
          placeholder="Title"
          value={form.title}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="subcategory"
          placeholder="Subcategory"
          value={form.subcategory}
          onChange={handleChange}
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />

        <input
          type="number"
          name="price"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="state"
          placeholder="State"
          value={form.state}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="city"
          placeholder="City / LGA"
          value={form.city}
          onChange={handleChange}
          required
        />

        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}

export default AddProduct;