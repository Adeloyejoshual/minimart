// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";

const AddProduct = () => {
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  // Handle price input
  const handlePriceChange = e => {
    let val = e.target.value.replace(/,/g, "");
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      const formatted = val === "." ? "0." : Number(val).toLocaleString("en-US", { maximumFractionDigits: 2 });
      setPrice(formatted);
      setError("");
    }
  };

  // Handle image files
  const handleFileChange = e => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
    setPreviewImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = idx => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviewImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit product
  const handleAddProduct = async e => {
    e.preventDefault();
    setError("");

    if (!auth.currentUser) {
      setError("You must be logged in to post.");
      return;
    }

    if (!price || images.length === 0) {
      setError("Please add price and at least one image.");
      return;
    }

    try {
      setLoading(true);
      // Upload images to Cloudinary
      const imageUrls = await Promise.all(images.map(f => uploadToCloudinary(f)));

      // Save to Firestore
      const docRef = await addDoc(collection(db, "products"), {
        price: parseFloat(price.replace(/,/g, "")),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType,
        createdAt: serverTimestamp(),
      });

      alert(`Product added! ID: ${docRef.id}`);
      setPrice("");
      setImages([]);
      setPreviewImages([]);
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      setError("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup preview URLs
  useEffect(() => () => previewImages.forEach(url => URL.revokeObjectURL(url)), [previewImages]);

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 25, borderRadius: 12, background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", color: "#0D6EFD", marginBottom: 20 }}>Post Product</h2>

      {error && <div style={{ background: "#ffe6e6", color: "red", padding: 10, borderRadius: 6, marginBottom: 15 }}>{error}</div>}

      <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: 15 }}>

        {/* Price */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontWeight: 500, marginBottom: 5 }}>Price*</label>
          <input
            type="text"
            value={price}
            onChange={handlePriceChange}
            placeholder="₦0.00"
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
          />
        </div>

        {/* Images */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontWeight: 500, marginBottom: 5 }}>Images*</label>
          <input type="file" multiple accept="image/*" onChange={handleFileChange} />
          {previewImages.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {previewImages.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={src} alt={`preview-${i}`} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid #ccc" }} />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      background: "red",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      cursor: "pointer"
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 20px",
            background: "#0D6EFD",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 500,
            marginTop: 10
          }}
        >
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default AddProduct;