// src/pages/AddProduct.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const AddProduct = () => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const navigate = useNavigate();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !price || !imageUrl) return alert("All fields are required");

    try {
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
    <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
      <h2>Add New Product</h2>
      <input type="text" placeholder="Product Name" value={name} onChange={e => setName(e.target.value)} required />
      <input type="number" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} required />
      <input type="text" placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} required />
      <button type="submit">Add Product</button>
    </form>
  );
};

export default AddProduct;