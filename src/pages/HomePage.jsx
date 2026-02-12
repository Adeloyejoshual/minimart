// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const miniRes = await axios.get("/api/minimart");
      setMiniMart(miniRes.data);

      const marketRes = await axios.get("/api/marketplace");
      setMarketplace(marketRes.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  // Helper: construct Cloudinary URL if only public_id is provided
  const getCloudinaryUrl = (imageUrlOrId) => {
    if (!imageUrlOrId) return null;
    if (imageUrlOrId.startsWith("http")) return imageUrlOrId; // full URL from backend
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${imageUrlOrId}`;
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* ================= MiniMart ================= */}
      <h1>MiniMart Store</h1>
      <Link to="/minimart/add">Add MiniMart Product</Link>
      {miniMart.length === 0 && <p>No products yet.</p>}
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {miniMart.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              margin: "1rem",
              padding: "1rem",
              width: "220px",
              textAlign: "center",
            }}
          >
            {p.image_url && (
              <img
                src={getCloudinaryUrl(p.image_url)}
                alt={p.title}
                style={{ width: "200px", height: "200px", objectFit: "cover", marginBottom: "0.5rem" }}
              />
            )}
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))}
      </div>

      {/* ================= Marketplace ================= */}
      <h1>Marketplace</h1>
      <Link to="/marketplace/add">Add Marketplace Product</Link>
      {marketplace.length === 0 && <p>No products yet.</p>}
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {marketplace.map((p) => (
          <div
            key={p._id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              margin: "1rem",
              padding: "1rem",
              width: "220px",
              textAlign: "center",
            }}
          >
            {p.image_url && (
              <img
                src={getCloudinaryUrl(p.image_url)}
                alt={p.title}
                style={{ width: "200px", height: "200px", objectFit: "cover", marginBottom: "0.5rem" }}
              />
            )}
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}