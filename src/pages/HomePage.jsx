import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function HomePage() {
  const navigate = useNavigate();

  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);

  useEffect(() => {
    axios.get("/api/minimart").then(res => setMiniMart(res.data));
    axios.get("/api/marketplace").then(res => setMarketplace(res.data));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      
      {/* ===== Header ===== */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>MiniMart</h1>
        <button onClick={() => navigate("/marketplace/add-product")}>
          Post Ad
        </button>
      </div>

      {/* ===== MiniMart Section ===== */}
      <h2>MiniMart Store</h2>
      {miniMart.map(p => (
        <div key={p.id} style={{ borderBottom: "1px solid #ddd", marginBottom: "10px" }}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}

      {/* ===== Marketplace Section ===== */}
      <h2>Marketplace</h2>
      {marketplace.map(p => (
        <div key={p._id} style={{ borderBottom: "1px solid #ddd", marginBottom: "10px" }}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}

    </div>
  );
}