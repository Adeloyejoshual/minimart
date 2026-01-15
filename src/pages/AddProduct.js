import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";

const AddProduct = () => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Determine marketType from URL query
  const params = new URLSearchParams(location.search);
  const marketType = params.get("market") || "marketplace"; // default to marketplace

  // Handle file selection
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

  // Add product
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !price || !file) return alert("All fields are required");

    try {
      setLoading(true);

      // Upload image to Cloudinary
      const imageUrl = await uploadToCloudinary(file);
      if (!imageUrl) throw new Error("Image upload failed");

      // Add product to Firestore
      await addDoc(collection(db, "products"), {
        name,
        price: parseFloat(price),
        description,
        imageUrl,
        ownerId: auth.currentUser.uid,
        marketType, // "minimart" or "marketplace"
        createdAt: serverTimestamp(),
      });

      alert(`Product added successfully to ${marketType}!`);
      navigate(`/${marketType}`); // Redirect back to respective market
    } catch (err) {
      console.error(err);
      alert("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleAdd}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        padding: "20px",
        maxWidth: "400px",
        margin: "0 auto",
      }}
    >
      <h2>Add New Product ({marketType})</h2>

      <input
        type="text"
        placeholder="Product Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <input
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        required
      />

      {/* Image Preview */}
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{
            width: "100%",
            height: "200px",
            objectFit: "cover",
            border: "1px solid #ccc",
          }}
        />
      )}

      <button type="submit" disabled={loading}>
        {loading ? "Uploading..." : `Add to ${marketType}`}
      </button>
    </form>
  );
};

export default AddProduct;