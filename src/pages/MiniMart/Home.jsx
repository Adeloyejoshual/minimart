import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/marketplace");
      setProducts(res.data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load products");
      setLoading(false);
    }
  };

  if (loading) return <h2 style={{ textAlign: "center" }}>Loading products...</h2>;
  if (error) return <h2 style={{ textAlign: "center" }}>{error}</h2>;

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>MiniMart Marketplace</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "20px"
        }}
      >
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.id}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #eee",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#fff"
            }}
          >
            <div>
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover"
                  }}
                />
              ) : (
                <div
                  style={{
                    height: "180px",
                    background: "#f5f5f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  No Image
                </div>
              )}
            </div>

            <div style={{ padding: "10px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "5px" }}>
                {product.title}
              </h3>

              <p style={{ color: "#777", fontSize: "14px" }}>
                ₦{product.price}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}