import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const miniRes = await axios.get("/api/minimart");
      setMiniMart(miniRes.data);

      const marketRes = await axios.get("/api/marketplace");
      setMarketplace(marketRes.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Store</h1>
      <Link to="/minimart/add">Add MiniMart Product</Link>
      {miniMart.length === 0 && <p>No products yet.</p>}
      {miniMart.map((p) => (
        <div key={p.id} style={{ border: "1px solid #ccc", margin: "1rem 0", padding: "1rem" }}>
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              style={{ width: "200px", objectFit: "cover", marginBottom: "0.5rem" }}
            />
          )}
          <h3>{p.title}</h3>
          {p.category && <p>Category: {p.category}</p>}
          {p.stock !== undefined && <p>Stock: {p.stock}</p>}
          <p>₦{p.price}</p>
        </div>
      ))}

      <h1>Marketplace</h1>
      <Link to="/marketplace/add">Add Marketplace Product</Link>
      {marketplace.length === 0 && <p>No products yet.</p>}
      {marketplace.map((p) => (
        <div key={p._id} style={{ border: "1px solid #ccc", margin: "1rem 0", padding: "1rem" }}>
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              style={{ width: "200px", objectFit: "cover", marginBottom: "0.5rem" }}
            />
          )}
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}