// src/pages/AddMiniMartProduct.jsx
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMiniMartProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price);
      formData.append("category", category);
      if (image) formData.append("image", image);

      await axios.post("/api/minimart", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("MiniMart product added!");
      navigate("/"); // Redirect to homepage
    } catch (err) {
      console.error("Failed to add MiniMart product:", err);
      alert("Failed to add MiniMart product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add MiniMart Product</h1>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
        />
        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}