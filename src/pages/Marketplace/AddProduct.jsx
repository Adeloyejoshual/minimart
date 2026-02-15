import { useState, useRef } from "react";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  // Handle image selection and preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !price) {
      alert("Title and price are required");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("price", price);
      if (image) formData.append("image", image);

      const response = await fetch("/api/marketplace", {
        method: "POST",
        body: formData, // Browser sets multipart/form-data automatically
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add product");
      }

      alert("✅ Product added successfully!");

      // Reset form
      setTitle("");
      setDescription("");
      setPrice("");
      setImage(null);
      setPreview(null);
      fileInputRef.current.value = null;
    } catch (error) {
      console.error("Add product error:", error);
      alert(error.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto" }}>
      <h2>Add Marketplace Product</h2>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: "10px" }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: "15px" }}>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%", padding: "10px" }}
          />
        </div>

        {/* Price */}
        <div style={{ marginBottom: "15px" }}>
          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ width: "100%", padding: "10px" }}
          />
        </div>

        {/* Image Upload */}
        <div style={{ marginBottom: "15px" }}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
          />
          {preview && (
            <img
              src={preview}
              alt="Preview"
              style={{ marginTop: "10px", maxWidth: "100%", borderRadius: "5px" }}
            />
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
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