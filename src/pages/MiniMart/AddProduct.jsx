import React, { useState } from "react";
import axios from "axios";

export default function AddMiniMartProduct() {
  const [product, setProduct] = useState({ title: "", price: 0 });
  const [message, setMessage] = useState("");

  const handleAddProduct = async () => {
    try {
      await axios.post("/api/minimart/products", product);
      setMessage("Product added successfully!");
      setProduct({ title: "", price: 0 });
    } catch (err) {
      console.error(err);
      setMessage("Failed to add product.");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Add MiniMart Product</h1>

      <input
        type="text"
        placeholder="Product Title"
        value={product.title}
        onChange={(e) => setProduct({ ...product, title: e.target.value })}
        style={{ display: "block", marginBottom: "1rem" }}
      />

      <input
        type="number"
        placeholder="Price"
        value={product.price}
        onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })}
        style={{ display: "block", marginBottom: "1rem" }}
      />

      <button onClick={handleAddProduct}>Add Product</button>

      {message && <p>{message}</p>}
    </div>
  );
}