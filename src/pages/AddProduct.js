// src/pages/TestAddProduct.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";

const TestAddProduct = () => {
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Handle image selection
  const handleFiles = e => {
    const files = Array.from(e.target.files);
    setImages(files);
    setPreviewImages(files.map(f => URL.createObjectURL(f)));
  };

  // Submit
  const handleAdd = async e => {
    e.preventDefault();
    if (!auth.currentUser) {
      setMessage("Login required.");
      return;
    }
    if (!price || images.length === 0) {
      setMessage("Enter price and select at least one image.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      // Upload images to Cloudinary
      const uploadedUrls = await Promise.all(images.map(f => uploadToCloudinary(f)));

      // Add minimal product to Firestore
      const docRef = await addDoc(collection(db, "products"), {
        price: parseFloat(price.replace(/,/g, "")),
        images: uploadedUrls,
        coverImage: uploadedUrls[0],
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      setMessage(`Product added! ID: ${docRef.id}`);
      setPrice("");
      setImages([]);
      setPreviewImages([]);
    } catch (err) {
      console.error(err);
      setMessage("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: 20, padding: 20, borderRadius: 10, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <h2>Test Add Product (Price + Images)</h2>
      {message && <div style={{ marginBottom: 10, color: message.includes("Error") ? "red" : "green" }}>{message}</div>}
      
      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <input
          type="text"
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />

        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFiles}
        />

        {previewImages.length > 0 && (
          <div style={{ display: "flex", gap: 10 }}>
            {previewImages.map((src, i) => (
              <img key={i} src={src} alt={`preview-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 5 }} />
            ))}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ padding: 10, background: "#0d6efd", color: "#fff", border: "none", borderRadius: 5 }}>
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default TestAddProduct;