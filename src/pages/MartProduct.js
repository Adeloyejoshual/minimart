import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function MartProduct() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // ✅ Check logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else navigate("/login");
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!user) return alert("User not logged in");

    if (!name || !description || !price) return alert("All fields are required");

    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/mart-products`, {
        name,
        description,
        price,
        userId: user.uid,
        userEmail: user.email
      });

      alert("✅ Product added");
      navigate("/minimart", { state: { refresh: true } }); // refresh MiniMart
    } catch (err) {
      console.error(err);
      alert("❌ Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, sans-serif", maxWidth: 500, margin: "0 auto" }}>
      <h1>Add MiniMart Product</h1>
      <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          placeholder="Product Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={inputStyle}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          style={{ ...inputStyle, height: 80 }}
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
          required
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: 10,
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 16
};

const buttonStyle = {
  padding: 12,
  background: "#4da6ff",
  color: "#fff",
  fontWeight: 600,
  border: "none",
  borderRadius: 6,
  cursor: "pointer"
};