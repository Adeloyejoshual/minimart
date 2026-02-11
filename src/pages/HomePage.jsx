import React, { useState, useEffect } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMartProducts, setMiniMartProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);

  const [newMiniMart, setNewMiniMart] = useState({ name: "", price: 0 });
  const [newMarketplace, setNewMarketplace] = useState({ title: "", price: 0 });

  useEffect(() => {
    fetchMiniMart();
    fetchMarketplace();
  }, []);

  // ---------------- MiniMart ----------------
  const fetchMiniMart = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setMiniMartProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch MiniMart:", err);
    }
  };

  const addMiniMart = async () => {
    try {
      await axios.post("/api/minimart/products", newMiniMart);
      setNewMiniMart({ name: "", price: 0 });
      fetchMiniMart();
    } catch (err) {
      console.error("Failed to add MiniMart product:", err);
      alert("Failed to add MiniMart product");
    }
  };

  // ---------------- Marketplace ----------------
  const fetchMarketplace = async () => {
    try {
      const res = await axios.get("/api/marketplace/products");
      setMarketplaceProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch Marketplace:", err);
    }
  };

  const addMarketplace = async () => {
    try {
      await axios.post("/api/marketplace/products", newMarketplace);
      setNewMarketplace({ title: "", price: 0 });
      fetchMarketplace();
    } catch (err) {
      console.error("Failed to add Marketplace product:", err);
      alert("Failed to add Marketplace product");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart + Marketplace</h1>

      {/* ---------- MiniMart ---------- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>MiniMart Products (Private)</h2>
        <ul>
          {miniMartProducts.map(p => (
            <li key={p.id}>{p.title || p.name} - ${p.price}</li>
          ))}
        </ul>

        <h3>Add MiniMart Product</h3>
        <input
          type="text"
          placeholder="Name"
          value={newMiniMart.name}
          onChange={e => setNewMiniMart({ ...newMiniMart, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newMiniMart.price}
          onChange={e => setNewMiniMart({ ...newMiniMart, price: parseFloat(e.target.value) })}
        />
        <button onClick={addMiniMart}>Add MiniMart Product</button>
      </section>

      {/* ---------- Marketplace ---------- */}
      <section style={{ marginTop: "3rem" }}>
        <h2>Marketplace Products (Public)</h2>
        <ul>
          {marketplaceProducts.map(p => (
            <li key={p._id}>{p.title} - ${p.price}</li>
          ))}
        </ul>

        <h3>Add Marketplace Product</h3>
        <input
          type="text"
          placeholder="Title"
          value={newMarketplace.title}
          onChange={e => setNewMarketplace({ ...newMarketplace, title: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newMarketplace.price}
          onChange={e => setNewMarketplace({ ...newMarketplace, price: parseFloat(e.target.value) })}
        />
        <button onClick={addMarketplace}>Add Marketplace Product</button>
      </section>
    </div>
  );
}