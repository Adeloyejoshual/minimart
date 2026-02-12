// src/pages/AddMarketplaceProduct.jsx
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function AddMarketplaceProduct() {
  const [product, setProduct] = useState({
    title: "",
    price: 0,
    image_url: "",
  });
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const uploadToCloudinary = async () => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      return res.data.public_id; // store only public_id in DB
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return null;
    }
  };

  const addProduct = async () => {
    try {
      let imageId = product.image_url;
      if (file) {
        imageId = await uploadToCloudinary();
      }

      await axios.post("/api/marketplace", {
        ...product,
        image_url: imageId,
      });

      alert("Marketplace product added!");
      navigate("/"); // Go back to homepage
    } catch (err) {
      console.error("Failed to add product:", err);
      alert("Failed to add product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add Marketplace Product</h1>

      <input
        placeholder="Title"
        value={product.title}
        onChange={(e) => setProduct({ ...product, title: e.target.value })}
      />
      <input
        placeholder="Price"
        type="number"
        value={product.price}
        onChange={(e) => setProduct({ ...product, price: e.target.value })}
      />
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={addProduct}>Add Product</button>
    </div>
  );
}