// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

// Cloudinary helper
const getCloudinaryUrl = (publicId) => {
  if (!publicId) return null;
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}.jpg`;
};

export default function HomePage() {
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0();
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
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>MiniMart & Marketplace</h1>
        <div>
          {!isAuthenticated && (
            <button onClick={() => loginWithRedirect()} style={{ marginRight: "8px" }}>
              Login / Register
            </button>
          )}
          {isAuthenticated && (
            <button onClick={() => logout({ returnTo: window.location.origin })}>
              Logout
            </button>
          )}
        </div>
      </header>

      {/* MiniMart Section */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>MiniMart Store</h2>
        <Link to="/minimart/add">Add MiniMart Product</Link>
        {miniMart.length === 0 && <p>No products yet.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
          {miniMart.map((p) => (
            <div
              key={p.id}
              style={{
                width: "150px",
                border: "1px solid #ccc",
                borderRadius: "12px",
                padding: "8px",
              }}
            >
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt={p.title}
                  style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                />
              )}
              <h4 style={{ margin: "6px 0 2px" }}>{p.title}</h4>
              <p>₦{p.price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Marketplace Section */}
      <section>
        <h2>Marketplace</h2>
        <Link to="/marketplace/add">Add Marketplace Product</Link>
        {marketplace.length === 0 && <p>No products yet.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
          {marketplace.map((p) => (
            <div
              key={p._id}
              style={{
                width: "150px",
                border: "1px solid #ccc",
                borderRadius: "12px",
                padding: "8px",
              }}
            >
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt={p.title}
                  style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                />
              )}
              <h4 style={{ margin: "6px 0 2px" }}>{p.title}</h4>
              <p>₦{p.price}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}