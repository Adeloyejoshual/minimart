import { useEffect, useState } from "react";
import axios from "axios";

function HomePage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await axios.get("/api/marketplace/products");
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to fetch products", err);
      }
    }

    fetchProducts();
  }, []);

  return (
    <div>
      <h1>MiniMart Marketplace</h1>
      {products.length === 0 && <p>No products yet.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
        {products.map((product) => (
          <div
            key={product._id}
            style={{
              border: "1px solid #ccc",
              padding: "8px",
              width: "200px",
            }}
          >
            {product.images[0] && (
              <img
                src={product.images[0]}
                alt={product.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
            )}
            <h3>{product.title}</h3>
            <p>${product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HomePage;