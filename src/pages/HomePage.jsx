import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then(setProducts);
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Marketplace</h1>

      <Link to="/marketplace/add-product">➕ Add Product</Link>

      <hr />

      {products.length === 0 && <p>No products yet.</p>}

      {products.map((p) => (
        <div key={p._id} style={{ marginBottom: "1rem" }}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
          <small>{p.description}</small>
        </div>
      ))}
    </div>
  );
}