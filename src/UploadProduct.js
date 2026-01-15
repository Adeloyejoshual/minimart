import React, { useState } from "react";
import axios from "axios";
import { db, auth } from "../firebase"; // make sure auth is imported
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";

export default function UploadProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Get marketType from query param (?market=minimart or ?market=marketplace)
  const params = new URLSearchParams(location.search);
  const marketType = params.get("market") || "marketplace";

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!title || !price || !file) {
      return alert("All fields are required!");
    }

    try {
      setLoading(true);

      // Upload image to Cloudinary
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/auto/upload`,
        form
      );

      const imageUrl = res.data.secure_url;
      if (!imageUrl) throw new Error("Image upload failed");

      // Save product to Firestore
      await addDoc(collection(db, "products"), {
        title,
        price: Number(price),
        imageUrl,
        ownerId: auth.currentUser.uid,
        marketType,
        status: "active",
        createdAt: serverTimestamp(),
      });

      alert("Product uploaded successfully!");
      setTitle("");
      setPrice("");
      setFile(null);
      setPreview(null);

      // Redirect to the correct market page
      navigate(marketType === "minimart" ? "/minimart" : "/marketplace");
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "20px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Add New Product ({marketType})</h2>

      <input
        type="text"
        placeholder="Product Title"
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
        onChange={handleFileChange}
        required
      />

      {/* Image preview */}
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{ width: "100%", height: 200, objectFit: "cover", marginTop: 10 }}
        />
      )}

      <button
        onClick={handleUpload}
        disabled={loading}
        style={{ marginTop: 15, padding: "10px 15px", cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Uploading..." : "Upload Product"}
      </button>
    </div>
  );
}