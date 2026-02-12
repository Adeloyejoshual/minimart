// src/pages/Marketplace/AddProduct.jsx
import { useState } from "react";
import axios from "axios";

export default function AddMarketplaceProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/marketplace/products", {
        title,
        price,
        description,
      });
      setMessage("Product added successfully!");
      setTitle("");
      setPrice("");
      setDescription("");
    } catch (err) {
      setMessage("Failed to add Marketplace product");
    }
  };

  return (
    <div>
      <h1>Add Marketplace Product</h1>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit}>
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
        <textarea
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}