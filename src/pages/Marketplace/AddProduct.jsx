// src/pages/AddMarketplaceProduct.jsx

import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMarketplaceProduct() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); // 🚨 VERY IMPORTANT
    console.log("Form submitted");

    try {
      setLoading(true);

      let imageUrl = "";

      // ================= Upload to Cloudinary =================
      if (file) {
        console.log("Uploading image...");

        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "upload_preset",
          import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        );

        const cloudRes = await axios.post(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
          formData
        );

        imageUrl = cloudRes.data.secure_url;
        console.log("Cloudinary success:", imageUrl);
      }

      // ================= Send to Backend =================
      console.log("Sending product to backend...");

      const response = await axios.post("/api/marketplace", {
        title: title.trim(),
        price: Number(price),
        image: imageUrl,
      });

      console.log("Saved product:", response.data);

      alert("Marketplace product added successfully!");
      navigate("/");
    } catch (error) {
      console.error("ERROR:", error.response?.data || error.message);
      alert("Something went wrong. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add Marketplace Product</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Product Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            style={{ width: "100%", padding: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: "black",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}