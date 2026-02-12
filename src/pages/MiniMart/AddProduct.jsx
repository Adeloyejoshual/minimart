import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMiniMartProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    if (e.target.files[0]) setImageFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price) return alert("Title and price are required");
    setLoading(true);

    try {
      let image_url = null;

      // Upload image to Cloudinary if exists
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
          formData
        );
        image_url = res.data.secure_url;
      }

      // Send product to your server (CockroachDB)
      await axios.post("/api/minimart", {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        category: category.trim() || null,
        stock: parseInt(stock) || 0,
        image_url,
      });

      alert("Product added successfully!");
      navigate("/"); // redirect to homepage
    } catch (err) {
      console.error("Failed to add MiniMart product:", err);
      alert("Failed to add MiniMart product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add MiniMart Product</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ display: "block", width: "100%", margin: "0.5rem 0" }}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{ display: "block", width: "100%", margin: "0.5rem 0" }}
        />
        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          style={{ display: "block", width: "100%", margin: "0.5rem 0" }}
        />
        <input
          type="text"
          placeholder="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ display: "block", width: "100%", margin: "0.5rem 0" }}
        />
        <input
          type="number"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          style={{ display: "block", width: "100%", margin: "0.5rem 0" }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: "block", margin: "0.5rem 0" }}
        />
        <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem" }}>
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}