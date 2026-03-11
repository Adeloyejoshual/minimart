import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

export default function SellerProfile() {
  const { id } = useParams();
  const [sellerProducts, setSellerProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellerProducts = async () => {
      try {
        const { data } = await axios.get(`/api/marketplace/seller/${id}`);
        setSellerProducts(data);
      } catch (err) {
        console.error("Failed to fetch seller products:", err);
        alert("Failed to load seller products");
      } finally {
        setLoading(false);
      }
    };

    fetchSellerProducts();
  }, [id]);

  return (
    <div style={{ padding: "16px" }}>
      <h2>Seller Products</h2>

      {loading ? (
        <p>Loading products...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
          {sellerProducts.map((p) => (
            <Link
              key={p.id}
              to={`/minimart/${p.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#f8fafd",
                borderRadius: "12px",
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                padding: "8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              <img
                src={p.image_url || "/placeholder.png"}
                alt={p.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "8px 0" }}>{p.title}</h3>
              <p style={{ fontWeight: 700, color: "#0D6EFD" }}>₦{p.price}</p>
            </Link>
          ))}
          {sellerProducts.length === 0 && <p>No products found for this seller.</p>}
        </div>
      )}
    </div>
  );
}