// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

// Cloudinary helper
const getCloudinaryUrl = (publicId) => {
  if (!publicId) return null;
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}.jpg`;
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

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Store</h1>
      <Link to="/minimart/add">Add MiniMart Product</Link>
      {miniMart.length === 0 && <p>No products yet.</p>}
      {miniMart.map((p) => (
        <div key={p.id} style={{ margin: "1rem 0", border: "1px solid #ccc", padding: "1rem" }}>
          {p.image_url && (
            <img
              src={getCloudinaryUrl(p.image_url)}
              alt={p.title}
              style={{ width: "150px", height: "150px", objectFit: "cover" }}
            />
          )}
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}

      <h1>Marketplace</h1>
      <Link to="/marketplace/add">Add Marketplace Product</Link>
      {marketplace.length === 0 && <p>No products yet.</p>}
      {marketplace.map((p) => (
        <div key={p._id} style={{ margin: "1rem 0", border: "1px solid #ccc", padding: "1rem" }}>
          {p.image_url && (
            <img
              src={getCloudinaryUrl(p.image_url)}
              alt={p.title}
              style={{ width: "150px", height: "150px", objectFit: "cover" }}
            />
          )}
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}