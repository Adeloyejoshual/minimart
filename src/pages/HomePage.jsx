import { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/minimart");
        console.log("MiniMart Data:", res.data); // Debug
        setProducts(res.data);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>🛒 MiniMart Store</h1>

      {loading && <p>Loading products...</p>}

      {!loading && products.length === 0 && (
        <p>No products available yet.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
              backgroundColor: "#fff",
            }}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.title}
                style={{
                  width: "100%",
                  height: "200px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginBottom: "10px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "200px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "10px",
                }}
              >
                No Image
              </div>
            )}

            <h3 style={{ margin: "10px 0 5px" }}>{product.title}</h3>
            <p style={{ color: "#555", fontSize: "14px" }}>
              {product.description}
            </p>
            <h4 style={{ marginTop: "10px", color: "#111" }}>
              ₦{Number(product.price).toLocaleString()}
            </h4>
          </div>
        ))}
      </div>
    </div>
  );
}