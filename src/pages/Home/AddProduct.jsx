import React, { useState } from "react";
import axios from "axios";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [type, setType] = useState("marketplace");

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "upload_preset",
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    );

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async () => {
    if (!title || !price || !imageFile) {
      return alert("Title, price, and image are required");
    }

    const imageUrl = await uploadImage(imageFile);

    try {
      if (type === "marketplace") {
        await axios.post("/api/marketplace/products", {
          title,
          description,
          price,
          image: imageUrl,
        });
        alert("Marketplace product added!");
      } else {
        await axios.post("/api/products", {
          name: title,
          description,
          price,
          image: imageUrl,
        });
        alert("MiniMart product added!");
      }

      setTitle("");
      setDescription("");
      setPrice("");
      setImageFile(null);
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Add Product</h2>

      <label>
        Type:
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="marketplace">Marketplace</option>
          <option value="minimart">MiniMart</option>
        </select>
      </label>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        type="number"
        placeholder="Price (₦)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />

      <input type="file" onChange={(e) => setImageFile(e.target.files[0])} />

      <button onClick={handleSubmit}>Add Product</button>
    </div>
  );
}