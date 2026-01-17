// src/pages/TestAddProduct.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";

const TestAddProduct = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleAdd = async () => {
    if (!auth.currentUser) {
      setMessage("Login required!");
      return;
    }

    try {
      setLoading(true);

      // Minimal test image upload
      const testFile = new File(["test"], "test.png", { type: "image/png" });
      const imageUrl = await uploadToCloudinary(testFile);

      if (!imageUrl) {
        setMessage("Cloudinary upload failed");
        setLoading(false);
        return;
      }

      const docRef = await addDoc(collection(db, "products"), {
        title: "Test Product",
        ownerId: auth.currentUser.uid,
        images: [imageUrl],
        coverImage: imageUrl,
        createdAt: serverTimestamp(),
      });

      setMessage("Product added successfully! ID: " + docRef.id);
    } catch (err) {
      console.error(err);
      setMessage("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Test Add Product</h2>
      <button onClick={handleAdd} disabled={loading}>
        {loading ? "Adding..." : "Add Test Product"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default TestAddProduct;