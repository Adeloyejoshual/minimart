import { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);

  const [newMiniMart, setNewMiniMart] = useState({ title: "", price: 0 });
  const [newMarketplace, setNewMarketplace] = useState({ title: "", price: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios.get("/api/minimart").then(res => setMiniMart(res.data));
    axios.get("/api/marketplace").then(res => setMarketplace(res.data));
  };

  const addMiniMart = async () => {
    try {
      await axios.post("/api/minimart", newMiniMart);
      setNewMiniMart({ title: "", price: 0 });
      fetchData();
    } catch {
      alert("Failed to add MiniMart product");
    }
  };

  const addMarketplace = async () => {
    try {
      await axios.post("/api/marketplace", newMarketplace);
      setNewMarketplace({ title: "", price: 0 });
      fetchData();
    } catch {
      alert("Failed to add Marketplace product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Store</h1>
      {miniMart.map(p => (
        <div key={p.id}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}

      <input placeholder="Title" value={newMiniMart.title} onChange={e => setNewMiniMart({...newMiniMart, title: e.target.value})} />
      <input placeholder="Price" type="number" value={newMiniMart.price} onChange={e => setNewMiniMart({...newMiniMart, price: e.target.value})} />
      <button onClick={addMiniMart}>Add MiniMart Product</button>

      <h1>Marketplace</h1>
      {marketplace.map(p => (
        <div key={p._id}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}

      <input placeholder="Title" value={newMarketplace.title} onChange={e => setNewMarketplace({...newMarketplace, title: e.target.value})} />
      <input placeholder="Price" type="number" value={newMarketplace.price} onChange={e => setNewMarketplace({...newMarketplace, price: e.target.value})} />
      <button onClick={addMarketplace}>Add Marketplace Product</button>
    </div>
  );
}