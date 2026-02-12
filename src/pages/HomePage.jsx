import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

// Helper to get Cloudinary image URL
const getCloudinaryUrl = (url) => {
  if (!url) return "https://via.placeholder.com/150"; // fallback image
  return url; // the full Cloudinary URL is already saved in DB
};

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

  const renderProductCard = (p, type) => (
    <div
      key={type === "mini" ? p.id : p._id}
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <img
        src={getCloudinaryUrl(p.image_url || p.image)}
        alt={p.title}
        style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "4px" }}
      />
      <div>
        <h3>{p.title}</h3>
        <p style={{ fontWeight: "bold" }}>₦{p.price}</p>
        <p style={{ fontSize: "0.8rem", color: "#666" }}>
          Added: {new Date(p.createdAt || p.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Store</h1>
      <Link to="/minimart/add">Add MiniMart Product</Link>
      {miniMart.length === 0 ? <p>No products yet.</p> : miniMart.map((p) => renderProductCard(p, "mini"))}

      <h1 style={{ marginTop: "2rem" }}>Marketplace</h1>
      <Link to="/marketplace/add">Add Marketplace Product</Link>
      {marketplace.length === 0
        ? <p>No products yet.</p>
        : marketplace.map((p) => renderProductCard(p, "market"))}
    </div>
  );
}