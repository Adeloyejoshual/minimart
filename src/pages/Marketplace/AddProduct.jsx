import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMarketplaceProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let imageUrl = "";

      // 1️⃣ Upload to Cloudinary
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "upload_preset",
          import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        );

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
          formData
        );

        imageUrl = res.data.secure_url;
      }

      // 2️⃣ Send to backend (IMPORTANT PART)
      await axios.post("/api/marketplace", {
        title: title,
        price: Number(price),
        image: imageUrl, // 👈 THIS WAS MISSING
      });

      alert("Product added!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add Marketplace Product</h1>

      <form onSubmit={handleSubmit}>
        <input
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

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}