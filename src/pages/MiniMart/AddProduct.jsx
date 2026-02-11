import React, { useState } from "react";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async () => {
    if (!title || !price || !imageFile) return alert("Title, price & image required");

    const imageUrl = await uploadImageToCloudinary(imageFile);

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: title, description, price, image: imageUrl }),
    });

    const data = await res.json();
    if (res.ok) alert("Product added!");
    else alert("Failed to add product: " + data.error);
  };

  return (
    <div>
      <h2>Add MiniMart Product</h2>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
      <input type="file" onChange={(e) => setImageFile(e.target.files[0])} />
      <button onClick={handleSubmit}>Add Product</button>
    </div>
  );
}