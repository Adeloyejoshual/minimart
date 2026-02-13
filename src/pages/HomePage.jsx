import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

// Cloudinary helper
const getCloudinaryUrl = (url) => url || null;

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
    <div className="scrollable-content">
      {/* ---------------- MiniMart ---------------- */}
      <div className="sticky-header">
        <h2 className="header-title">MiniMart Store</h2>
        <Link to="/minimart/add" className="btn">Add Product</Link>
      </div>
      {miniMart.length === 0 && <p>No products yet.</p>}
      {miniMart.map((p) => (
        <div key={p.id} className="product-card">
          {p.image_url && (
            <div className="product-images">
              <img src={getCloudinaryUrl(p.image_url)} alt={p.title} />
            </div>
          )}
          <h3 className="product-title">{p.title}</h3>
          <p className="product-price">₦{p.price}</p>
        </div>
      ))}

      {/* ---------------- Marketplace ---------------- */}
      <div className="sticky-header" style={{ marginTop: "24px" }}>
        <h2 className="header-title">Marketplace</h2>
        <Link to="/marketplace/add" className="btn">Add Product</Link>
      </div>
      {marketplace.length === 0 && <p>No products yet.</p>}
      {marketplace.map((p) => (
        <div key={p._id} className="product-card">
          {p.image && (
            <div className="product-images">
              <img src={getCloudinaryUrl(p.image)} alt={p.title} />
            </div>
          )}
          <h3 className="product-title">{p.title}</h3>
          <p className="product-price">₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}