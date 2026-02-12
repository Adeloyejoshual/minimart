// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);

  useEffect(() => {
    // Fetch MiniMart products
    axios.get("/api/minimart/products").then(res => setMiniMart(res.data));
    // Fetch Marketplace products
    axios.get("/api/marketplace/products").then(res => setMarketplace(res.data));
  }, []);

  return (
    <div>
      <h1>MiniMart Store</h1>
      <Link to="/minimart/add-product">
        <button>Add MiniMart Product</button>
      </Link>
      {miniMart.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        miniMart.map(p => (
          <div key={p.id}>
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))
      )}

      <h1>Marketplace</h1>
      <Link to="/marketplace/add-product">
        <button>Add Marketplace Product</button>
      </Link>
      {marketplace.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        marketplace.map(p => (
          <div key={p._id}>
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))
      )}
    </div>
  );
}