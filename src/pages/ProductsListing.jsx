import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function ProductsListing() {
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [miniMartProducts, setMiniMartProducts] = useState([]);

  /* ================= Fetch Products ================= */
  useEffect(() => {
    fetchMarketplaceProducts();
    fetchMiniMartProducts();
  }, []);

  const fetchMarketplaceProducts = async () => {
    try {
      const res = await axios.get("/api/marketplace/products");
      setMarketplaceProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch marketplace products:", err);
    }
  };

  const fetchMiniMartProducts = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setMiniMartProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch MiniMart products:", err);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>All Products</h1>

      {/* ================= Marketplace Products ================= */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Marketplace (Public)</h2>
        <ul>
          {marketplaceProducts.length === 0 && <li>No products yet.</li>}
          {marketplaceProducts.map((p) => (
            <li key={p._id}>
              <Link to={`/marketplace/listing/${p._id}`}>{p.title}</Link> - ${p.price}
            </li>
          ))}
        </ul>
      </section>

      {/* ================= MiniMart Products ================= */}
      <section style={{ marginTop: "2rem" }}>
        <h2>MiniMart (Private)</h2>
        <ul>
          {miniMartProducts.length === 0 && <li>No products yet.</li>}
          {miniMartProducts.map((p) => (
            <li key={p.id}>
              <Link to={`/minimart/listing/${p.id}`}>{p.title}</Link> - ${p.price}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}