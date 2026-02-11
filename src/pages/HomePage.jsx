import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function HomePage() {
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [miniMartProducts, setMiniMartProducts] = useState([]);

  useEffect(() => {
    fetchMarketplace();
    fetchMiniMart();
  }, []);

  const fetchMarketplace = async () => {
    try {
      const res = await axios.get("/api/marketplace/products");
      setMarketplaceProducts(res.data);
    } catch (err) {
      console.error("Marketplace fetch error:", err);
    }
  };

  const fetchMiniMart = async () => {
    try {
      const res = await axios.get("/api/products");
      setMiniMartProducts(res.data);
    } catch (err) {
      console.error("MiniMart fetch error:", err);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart + Marketplace</h1>

      {/* Marketplace Section */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Marketplace (Public)</h2>
        <ul>
          {marketplaceProducts.map((p) => (
            <li key={p._id}>
              {p.title} - ₦{p.price}
            </li>
          ))}
        </ul>
        <Link to="/home/add-product">Add Marketplace Product</Link>
      </section>

      {/* MiniMart Section */}
      <section style={{ marginTop: "3rem" }}>
        <h2>MiniMart (Public)</h2>
        <ul>
          {miniMartProducts.map((p) => (
            <li key={p.id}>
              {p.title} - ₦{p.price}
            </li>
          ))}
        </ul>
        <Link to="/home/add-product">Add MiniMart Product</Link>
      </section>
    </div>
  );
}