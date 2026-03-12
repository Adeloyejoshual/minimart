// src/pages/HomePage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null); // store logged-in user info
  const [loading, setLoading] = useState(true);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/marketplace");
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Check if user is logged in (JWT stored in localStorage)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({ id: payload.id, name: payload.name, email: payload.email, role: payload.role });
      } catch {
        setUser(null);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <div style={{ padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h1>MiniMart</h1>
        <div>
          {!user ? (
            <>
              <button onClick={() => window.location.href = "/register"}>Register</button>
              <button onClick={() => window.location.href = "/login"} style={{ marginLeft: 10 }}>Login</button>
            </>
          ) : (
            <>
              <span>Hi, {user.name}</span>
              <button onClick={handleLogout} style={{ marginLeft: 10 }}>Logout</button>
            </>
          )}
        </div>
      </header>

      {loading ? (
        <p>Loading products...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            products.map(p => (
              <div key={p.id} style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "8px" }}>
                <img src={p.image_url || "/placeholder.png"} alt={p.title} style={{ width: "100%", height: "150px", objectFit: "cover" }} />
                <h3>{p.title}</h3>
                <p>₦{p.price}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}