// src/pages/AddProductTest.js
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate } from "react-router-dom";

export default function AddProductTest() {
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      alert("Login required");
      return;
    }

    if (!price || images.length === 0) {
      alert("Price and images are required");
      return;
    }

    try {
      setLoading(true);

      // Upload images to Cloudinary
      const imageUrls = await Promise.all(
        images.map((file) => uploadToCloudinary(file))
      );

      // Save to Firestore
      const docRef = await addDoc(collection(db, "products"), {
        title: "Test Product",
        price: Number(price),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType: "marketplace", // IMPORTANT
        isPromoted: false,
        createdAt: serverTimestamp(),
      });

      alert("Product added! ID: " + docRef.id);
      navigate("/marketplace");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 400,
        margin: "40px auto",
        padding: 20,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: 15,
      }}
    >
      <h3 style={{ textAlign: "center" }}>Test Add Product</h3>

      <input
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />

      <input type="file" multiple accept="image/*" onChange={handleFileChange} />

      <button disabled={loading}>
        {loading ? "Uploading..." : "Add Product"}
      </button>
    </form>
  );
}