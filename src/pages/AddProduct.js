// src/pages/TestAddProductSimple.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";

const TestAddProductSimple = () => {
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    setPreview(files.map(f => URL.createObjectURL(f)));
  };

  // Remove preview image
  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreview(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit
  const handleAdd = async () => {
    if (!auth.currentUser) {
      setMessage("Login required");
      return;
    }

    if (!price || images.length === 0) {
      setMessage("Price and at least one image required");
      return;
    }

    try {
      setLoading(true);

      // Upload images
      const imageUrls = await Promise.all(images.map(f => uploadToCloudinary(f)));
      if (imageUrls.some(url => !url)) {
        setMessage("Some images failed to upload");
        setLoading(false);
        return;
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, "products"), {
        ownerId: auth.currentUser.uid,
        price: parseFloat(price.replace(/,/g, "")),
        images: imageUrls,
        coverImage: imageUrls[0],
        createdAt: serverTimestamp(),
      });

      setMessage("Product added! ID: " + docRef.id);
      setPrice("");
      setImages([]);
      setPreview([]);
    } catch (err) {
      console.error(err);
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 500 }}>
      <h2>Test Add Product (Price + Images)</h2>

      <input
        type="text"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={{ width: "100%", marginBottom: 10, padding: 8 }}
      />

      <input type="file" multiple accept="image/*" onChange={handleFileChange} />
      {preview.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          {preview.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={src} alt={`preview-${i}`} style={{ width: 80, height: 80, objectFit: "cover" }} />
              <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -5, right: -5, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={loading}
        style={{ marginTop: 15, padding: "10px 15px", background: "#0d6efd", color: "#fff", border: "none", borderRadius: 5 }}
      >
        {loading ? "Uploading..." : "Add Product"}
      </button>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
};

export default TestAddProductSimple;