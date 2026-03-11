// src/pages/Home.jsx
import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../App";

export default function Home() {
  const [products, setProducts] = useState([]);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    axios
      .get("/api/marketplace")
      .then((res) => setProducts(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ paddingBottom: "70px" }}>
      <h1>Welcome {user ? user.name : "Guest"}</h1>
      <h2>MiniMart Products</h2>
      {products.length === 0 && <p>No products found.</p>}
      <div style={{ display: "grid", gap: 16 }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
            <p>{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}