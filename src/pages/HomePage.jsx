// src/pages/HomePage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMartProducts, setMiniMartProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);

  const [newMiniMartProduct, setNewMiniMartProduct] = useState({ title: "", price: 0 });
  const [miniMartError, setMiniMartError] = useState(""); // NEW: track errors

  const [newMarketplaceProduct, setNewMarketplaceProduct] = useState({ title: "", price: 0 });
  const [marketplaceError, setMarketplaceError] = useState("");

  // ------------------ Fetch products ------------------
  useEffect(() => {
    fetchMiniMartProducts();
    fetchMarketplaceProducts();
  }, []);

  const fetchMiniMartProducts = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setMiniMartProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMarketplaceProducts = async () => {
    try {
      const res = await axios.get("/api/marketplace/products");
      setMarketplaceProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------ Add MiniMart product ------------------
  const addMiniMartProduct = async () => {
    try {
      setMiniMartError(""); // reset error
      const res = await axios.post("/api/minimart/products", newMiniMartProduct);
      setNewMiniMartProduct({ title: "", price: 0 });
      fetchMiniMartProducts();
    } catch (err) {
      console.error("MiniMart error:", err.response?.data?.error || err.message);
      setMiniMartError(err.response?.data?.error || "Failed to add MiniMart product");
    }
  };

  // ------------------ Add Marketplace product ------------------
  const addMarketplaceProduct = async () => {
    try {
      setMarketplaceError("");
      await axios.post("/api/marketplace/products", newMarketplaceProduct);
      setNewMarketplaceProduct({ title: "", price: 0 });
      fetchMarketplaceProducts();
    } catch (err) {
      console.error("Marketplace error:", err.response?.data?.error || err.message);
      setMarketplaceError(err.response?.data?.error || "Failed to add Marketplace product");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart Marketplace</h1>

      {/* ------------------ MiniMart ------------------ */}
      <section style={{ marginTop: "2rem" }}>
        <h2>MiniMart Products (Private)</h2>
        <ul>
          {miniMartProducts.map((p) => (
            <li key={p.id}>{p.title} - ${p.price}</li>
          ))}
        </ul>

        <h3>Add MiniMart Product</h3>
        <input
          type="text"
          placeholder="Title"
          value={newMiniMartProduct.title}
          onChange={(e) => setNewMiniMartProduct({ ...newMiniMartProduct, title: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newMiniMartProduct.price}
          onChange={(e) => setNewMiniMartProduct({ ...newMiniMartProduct, price: parseFloat(e.target.value) })}
        />
        <button onClick={addMiniMartProduct}>Add MiniMart Product</button>

        {miniMartError && <p style={{ color: "red", marginTop: "0.5rem" }}>{miniMartError}</p>}
      </section>

      {/* ------------------ Marketplace ------------------ */}
      <section style={{ marginTop: "3rem" }}>
        <h2>Marketplace Products (Public)</h2>
        <ul>
          {marketplaceProducts.map((p) => (
            <li key={p._id}>{p.title} - ${p.price}</li>
          ))}
        </ul>

        <h3>Add Marketplace Product</h3>
        <input
          type="text"
          placeholder="Title"
          value={newMarketplaceProduct.title}
          onChange={(e) => setNewMarketplaceProduct({ ...newMarketplaceProduct, title: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newMarketplaceProduct.price}
          onChange={(e) => setNewMarketplaceProduct({ ...newMarketplaceProduct, price: parseFloat(e.target.value) })}
        />
        <button onClick={addMarketplaceProduct}>Add Marketplace Product</button>

        {marketplaceError && <p style={{ color: "red", marginTop: "0.5rem" }}>{marketplaceError}</p>}
      </section>
    </div>
  );
}