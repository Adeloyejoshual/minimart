// src/pages/Marketplace/Home.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketplaceProducts } from "../../helpers/marketplace";

export default function MarketplaceHome() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await getMarketplaceProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Loading marketplace...</p>;

  return (
    <div style={{ padding: "16px" }}>
      <h2>Global Marketplace</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: "16px" }}>
        {products.map(p => (
          <Link key={p._id} to={`/marketplace/${p._id}`} style={{ border: "1px solid #ccc", borderRadius: "12px", overflow: "hidden", textDecoration: "none", color: "#000" }}>
            {p.images[0] && <img src={p.images[0]} alt={p.title} style={{ width: "100%", height: "150px", objectFit: "cover" }} />}
            <div style={{ padding: "8px" }}>
              <h3 style={{ fontSize: "16px" }}>{p.title}</h3>
              <p style={{ color: "#0D6EFD", fontWeight: "bold" }}>₦{p.price}</p>
              <p style={{ fontSize: "12px", color: "#555" }}>{p.city}, {p.state}, {p.country}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}