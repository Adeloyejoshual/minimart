import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function MartProductPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("token"); // JWT token stored in localStorage

  // ✅ Check logged-in user via JWT
  useEffect(() => {
    const checkUser = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch {
        navigate("/login");
      } finally {
        setAuthChecked(true);
      }
    };
    checkUser();
  }, [navigate, token]);

  // ✅ Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setImages(urls);
  };

  // ✅ Submit product
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!title || !price) {
      alert("Title and price are required.");
      return;
    }

    setLoading(true);
    try {
      const newProduct = {
        sellerId: user.id,
        sellerName: user.name || "Unknown Seller",
        userEmail: user.email,
        title,
        description,
        category,
        price: Number(price),
        images,
      };

      await axios.post(`${process.env.REACT_APP_API_URL}/api/mart-products`, newProduct, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert("Product added successfully!");
      navigate("/minimart", { state: { refresh: true } });
    } catch (err) {
      console.error("Failed to add product:", err);
      alert("Failed to add product. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) return <p>Checking authentication...</p>;

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", fontFamily: "Segoe UI, sans-serif" }}>
      <h1>Add MiniMart Product</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <textarea
          placeholder="Product Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, height: 100 }}
        />
        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle}
        />
        <input type="file" multiple accept="image/*" onChange={handleFileChange} style={inputStyle} />

        {images.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {images.map((img, i) => (
              <img key={i} src={img} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }} />
            ))}
          </div>
        )}

        <button type="submit" style={buttonStyle} disabled={loading}>
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
  fontSize: 14,
};

const buttonStyle = {
  padding: "10px 15px",
  background: "#4da6ff",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};