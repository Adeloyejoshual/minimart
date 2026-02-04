import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function AddProduct() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const categories = ["Electronics", "Fashion", "Home", "Phones", "Beauty"];

  const handleImageChange = (e) => {
    setImages([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price || images.length === 0) {
      alert("Title, price, and at least one image are required");
      return;
    }

    setLoading(true);

    try {
      // Upload images to Cloudinary
      const uploadedImages = [];
      for (const img of images) {
        const formData = new FormData();
        formData.append("file", img);
        formData.append(
          "upload_preset",
          import.meta.env.VITE_REACT_APP_CLOUDINARY_UPLOAD_PRESET
        );

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );
        const data = await res.json();
        uploadedImages.push(data.secure_url);
      }

      // Save product to API
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/marketplace/listings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            price: Number(price),
            location,
            category,
            images: uploadedImages,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to add product");

      alert("Product added successfully!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Something went wrong while adding your product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section" style={{ maxWidth: "600px", margin: "50px auto" }}>
      <h2 className="section-title">Add New Product</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Product Description"
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
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <input type="file" multiple onChange={handleImageChange} />
        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}

export default AddProduct;