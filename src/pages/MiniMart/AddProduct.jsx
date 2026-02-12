import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMiniMartProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/minimart/products", {
        title: title.trim(),
        price: parseFloat(price),
      });
      alert("Product added!");
      navigate("/"); // Redirect to homepage
    } catch (err) {
      console.error("Failed to add MiniMart product:", err);
      alert("Failed to add MiniMart product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add MiniMart Product</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}