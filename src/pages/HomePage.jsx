import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [newMiniMart, setNewMiniMart] = useState({ title: "", price: 0 });
  const [newMarket, setNewMarket] = useState({ title: "", price: 0 });

  useEffect(() => {
    fetchMiniMart();
    fetchMarketplace();
  }, []);

  const fetchMiniMart = async () => {
    const res = await axios.get("/api/minimart/products");
    setMiniMart(res.data);
  };

  const fetchMarketplace = async () => {
    const res = await axios.get("/api/marketplace/products");
    setMarketplace(res.data);
  };

  const addMiniMart = async () => {
    await axios.post("/api/minimart/products", newMiniMart);
    setNewMiniMart({ title: "", price: 0 });
    fetchMiniMart();
  };

  const addMarketplace = async () => {
    await axios.post("/api/marketplace/products", newMarket);
    setNewMarket({ title: "", price: 0 });
    fetchMarketplace();
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart + Marketplace</h1>

      <section>
        <h2>MiniMart (Private)</h2>
        <ul>{miniMart.map(p => <li key={p.id}>{p.title} - ${p.price}</li>)}</ul>
        <input placeholder="Title" value={newMiniMart.title} onChange={e => setNewMiniMart({ ...newMiniMart, title: e.target.value })} />
        <input placeholder="Price" type="number" value={newMiniMart.price} onChange={e => setNewMiniMart({ ...newMiniMart, price: parseFloat(e.target.value) })} />
        <button onClick={addMiniMart}>Add MiniMart Product</button>
      </section>

      <section>
        <h2>Marketplace (Public)</h2>
        <ul>{marketplace.map(p => <li key={p._id}>{p.title} - ${p.price}</li>)}</ul>
        <input placeholder="Title" value={newMarket.title} onChange={e => setNewMarket({ ...newMarket, title: e.target.value })} />
        <input placeholder="Price" type="number" value={newMarket.price} onChange={e => setNewMarket({ ...newMarket, price: parseFloat(e.target.value) })} />
        <button onClick={addMarketplace}>Add Marketplace Product</button>
      </section>
    </div>
  );
}