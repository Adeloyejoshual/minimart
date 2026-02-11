import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMartProducts, setMiniMartProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);

  useEffect(() => {
    fetchMiniMart();
    fetchMarketplace();
  }, []);

  const fetchMiniMart = async () => {
    const res = await axios.get("/api/minimart/products");
    setMiniMartProducts(res.data);
  };

  const fetchMarketplace = async () => {
    const res = await axios.get("/api/marketplace/products");
    setMarketplaceProducts(res.data);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart + Marketplace</h1>
      <h2>MiniMart Products (Private)</h2>
      <ul>{miniMartProducts.map(p => <li key={p.id}>{p.title} - ${p.price}</li>)}</ul>

      <h2>Marketplace Products (Public)</h2>
      <ul>{marketplaceProducts.map(p => <li key={p._id}>{p.title} - ${p.price}</li>)}</ul>
    </div>
  );
}