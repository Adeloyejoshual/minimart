import React, { useState } from "react";

const categories = ["Electronics", "Fashion", "Home", "Phones", "Beauty"];

function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [images, setImages] = useState([]);
  const [isPromoted, setIsPromoted] = useState(false);
  const [isProSeller, setIsProSeller] = useState(false);
  const [loading, setLoading] = useState(false);

  // Upload images to Cloudinary
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const uploadedUrls = [];

    setLoading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      uploadedUrls.push(data.secure_url);
    }

    setImages(uploadedUrls);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !price) {
      alert("Title and price are required!");
      return;
    }

    const newProduct = {
      title,
      description,
      price: parseFloat(price),
      location,
      category,
      images,
      isPromoted,
      isProSeller,
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/marketplace/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });

      if (!res.ok) throw new Error("Failed to add product");

      const data = await res.json();
      alert("Product added successfully!");
      // Reset form
      setTitle("");
      setDescription("");
      setPrice("");
      setLocation("");
      setCategory(categories[0]);
      setImages([]);
      setIsPromoted(false);
      setIsProSeller(false);
    } catch (err) {
      console.error(err);
      alert("Error adding product");
    }
  };

  return (
    <div className="homepage" style={{ padding: "2rem" }}>
      <h2 className="section-title">Add a New Product</h2>
      <form onSubmit={handleSubmit} className="section" style={{ maxWidth: "600px" }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="search-input"
        />
        <textarea
          placeholder="Product Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="search-input"
          rows={4}
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="search-input"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="search-input"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleImageUpload}
          className="search-input"
        />
        {images.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            {images.map((img, i) => (
              <img key={i} src={img} alt={`upload-${i}`} width={100} style={{ borderRadius: "8px" }} />
            ))}
          </div>
        )}
        <label style={{ display: "block", marginBottom: "8px" }}>
          <input
            type="checkbox"
            checked={isPromoted}
            onChange={() => setIsPromoted(!isPromoted)}
          />{" "}
          Promote Listing
        </label>
        <label style={{ display: "block", marginBottom: "16px" }}>
          <input
            type="checkbox"
            checked={isProSeller}
            onChange={() => setIsProSeller(!isProSeller)}
          />{" "}
          Pro Seller
        </label>

        <button type="submit" className="load-more-btn" disabled={loading}>
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}

export default AddProduct;