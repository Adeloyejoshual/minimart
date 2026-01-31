// src/pages/MartProduct.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import axios from "axios";

export default function MartProduct() {
  const [user, setUser] = useState(null); // logged-in user
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // ✅ Check logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login"); // redirect if not logged in
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // ✅ Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title || !description || !price) {
      setError("Please fill all fields");
      return;
    }

    if (!user) {
      setError("User not logged in");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/mart-products`, {
        name: title,
        description,
        price: Number(price),
        userId: user.uid,      // <-- sellerId from Firebase
        userEmail: user.email  // optional
      });

      alert("✅ Product added successfully!");
      setTitle("");
      setDescription("");
      setPrice("");
      navigate("/minimart"); // redirect to MiniMart page
    } catch (err) {
      console.error(err);
      setError("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <h2>Add New Product</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, height: 100 }}
          required
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={inputStyle}
          required
        />
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}

const containerStyle = {
  maxWidth: 500,
  margin: "50px auto",
  padding: 20,
  fontFamily: "Segoe UI, sans-serif",
  background: "#f9f9f9",
  borderRadius: 10,
  boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const inputStyle = {
  padding: 10,
  borderRadius: 6,
  border: "1px solid #ccc",
  width: "100%",
  fontSize: 14
};

const buttonStyle = {
  padding: 12,
  background: "#4da6ff",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600
};