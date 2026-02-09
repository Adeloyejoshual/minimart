// src/pages/HomePage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  // State for Marketplace (MongoDB)
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [newMarketplaceProduct, setNewMarketplaceProduct] = useState({ title: "", price: 0 });

  // State for MiniMart (CockroachDB)
  const [miniMartProducts, setMiniMartProducts] = useState([]);
  const [newMiniMartProduct, setNewMiniMartProduct] = useState({ title: "", price: 0 });

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
      console.error("Failed to fetch Marketplace products:", err);
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

  /* ================= Add Products ================= */
  const addMarketplaceProduct = async () => {
    if (!newMarketplaceProduct.title || newMarketplaceProduct.price <= 0) return alert("Title and price required!");
    try {
      await axios.post("/api/marketplace/products", newMarketplaceProduct);
      setNewMarketplaceProduct({ title: "", price: 0 });
      fetchMarketplaceProducts(); // Refresh list
    } catch (err) {
      console.error("Failed to add Marketplace product:", err);
    }
  };

  const addMiniMartProduct = async () => {
    if (!newMiniMartProduct.title || newMiniMartProduct.price <= 0) return alert("Title and price required!");
    try {
      await axios.post("/api/minimart/products", newMiniMartProduct);
      setNewMiniMartProduct({ title: "", price: 0 });
      fetchMiniMartProducts(); // Refresh list
    } catch (err) {
      console.error("Failed to add MiniMart product:", err);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart Marketplace</h1>

      {/* ================= Marketplace ================= */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Marketplace Products (Public)</h2>
        <ul>
          {marketplaceProducts.map((p) => (
            <li key={p._id}>
              {p.title} - ${p.price}
            </li>
          ))}
        </ul>

        <h3>Add Marketplace Product</h3>
        <input
          type="text"
          placeholder="Title"
          value={newMarketplaceProduct.title}
          onChange={(e) =>
            setNewMarketplaceProduct({ ...newMarketplaceProduct, title: e.target.value })
          }
        />
        <input
          type="number"
          placeholder="Price"
          value={newMarketplaceProduct.price}
          onChange={(e) =>
            setNewMarketplaceProduct({ ...newMarketplaceProduct, price: parseFloat(e.target.value) })
          }
        />
        <button onClick={addMarketplaceProduct}>Add Marketplace Product</button>
      </section>

      {/* ================= MiniMart ================= */}
      <section style={{ marginTop: "3rem" }}>
        <h2>MiniMart Products (Private)</h2>
        <ul>
          {miniMartProducts.map((p) => (
            <li key={p.id}>
              {p.title} - ${p.price}
            </li>
          ))}
        </ul>

        <h3>Add MiniMart Product</h3>
        <input
          type="text"
          placeholder="Title"
          value={newMiniMartProduct.title}
          onChange={(e) =>
            setNewMiniMartProduct({ ...newMiniMartProduct, title: e.target.value })
          }
        />
        <input
          type="number"
          placeholder="Price"
          value={newMiniMartProduct.price}
          onChange={(e) =>
            setNewMiniMartProduct({ ...newMiniMartProduct, price: parseFloat(e.target.value) })
          }
        />
        <button onClick={addMiniMartProduct}>Add MiniMart Product</button>
      </section>
    </div>
  );
}