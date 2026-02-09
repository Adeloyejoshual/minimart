import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [miniMartProducts, setMiniMartProducts] = useState([]);

  const [newMarketplaceProduct, setNewMarketplaceProduct] = useState({ title: "", price: 0 });
  const [newMiniMartProduct, setNewMiniMartProduct] = useState({ title: "", price: 0 });

  useEffect(() => {
    fetchMarketplaceProducts();
    fetchMiniMartProducts();
  }, []);

  const fetchMarketplaceProducts = async () => {
    try {
      const res = await axios.get("/api/marketplace/products");
      setMarketplaceProducts(res.data);
    } catch {}
  };

  const fetchMiniMartProducts = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setMiniMartProducts(res.data);
    } catch {}
  };

  const addMarketplaceProduct = async () => {
    try {
      await axios.post("/api/marketplace/products", newMarketplaceProduct);
      setNewMarketplaceProduct({ title: "", price: 0 });
      fetchMarketplaceProducts();
    } catch {}
  };

  const addMiniMartProduct = async () => {
    try {
      await axios.post("/api/minimart/products", newMiniMartProduct);
      setNewMiniMartProduct({ title: "", price: 0 });
      fetchMiniMartProducts();
    } catch {}
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Marketplace</h1>

      <h2>Marketplace Products (Public)</h2>
      <ul>{marketplaceProducts.map(p => <li key={p._id}>{p.title} - ${p.price}</li>)}</ul>
      <input placeholder="Title" value={newMarketplaceProduct.title} onChange={e => setNewMarketplaceProduct({ ...newMarketplaceProduct, title: e.target.value })} />
      <input placeholder="Price" type="number" value={newMarketplaceProduct.price} onChange={e => setNewMarketplaceProduct({ ...newMarketplaceProduct, price: parseFloat(e.target.value) })} />
      <button onClick={addMarketplaceProduct}>Add Marketplace Product</button>

      <h2>MiniMart Products (Private)</h2>
      <ul>{miniMartProducts.map(p => <li key={p.id}>{p.title} - ${p.price}</li>)}</ul>
      <input placeholder="Title" value={newMiniMartProduct.title} onChange={e => setNewMiniMartProduct({ ...newMiniMartProduct, title: e.target.value })} />
      <input placeholder="Price" type="number" value={newMiniMartProduct.price} onChange={e => setNewMiniMartProduct({ ...newMiniMartProduct, price: parseFloat(e.target.value) })} />
      <button onClick={addMiniMartProduct}>Add MiniMart Product</button>
    </div>
  );
}