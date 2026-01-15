// src/pages/AddProduct.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate } from "react-router-dom";

const AddProduct = () => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const navigate = useNavigate();

  // When user selects a file, set state and show preview
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile)); // preview image
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !price || !file) return alert("All fields are required");

    try {
      // Upload to Cloudinary
      const imageUrl = await uploadToCloudinary(file);

      // Add product to Firestore
      await addDoc(collection(db, "products"), {
        name,
        price: parseFloat(price),
        imageUrl,
        createdAt: serverTimestamp(),
      });

      alert("Product added successfully!");
      navigate("/"); // back to Home
    } catch (err) {
      alert("Error adding product: " + err.message);
    }
  };

  return (
    <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "15px", padding: "20px", maxWidth: "400px" }}>
      <h2>Add New Product</h2>

      <input
        type="text"
        placeholder="Product Name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />

      <input
        type="number"
        placeholder="Price"
        value={price}
        onChange={e => setPrice(e.target.value)}
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
          style={{ width: "100%", height: "200px", objectFit: "cover", border: "1px solid #ccc" }}
        />
      )}

      <button type="submit">Add Product</button>
    </form>
  );
};

export default AddProduct;