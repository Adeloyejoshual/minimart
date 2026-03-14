import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function SellerProfile({ user }) {
  const { id } = useParams(); // seller id
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchSeller();
    fetchProducts();
  }, [id]);

  const fetchSeller = async () => {
    try {
      const res = await axios.get(`${API}/sellers/${id}`);
      setSeller(res.data);
    } catch (err) {
      console.error("Failed to load seller profile", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products?sellerId=${id}`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products", err);
    }
  };

  if (!seller) return <p>Loading profile...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div>
          <img
            src={seller.avatar || "https://via.placeholder.com/150"}
            alt={seller.name}
            style={{ width: 150, borderRadius: "50%" }}
          />
        </div>
        <div>
          <h1>{seller.name}</h1>
          <p>Email: {seller.email}</p>
          <p>Joined: {new Date(seller.created_at).toLocaleDateString()}</p>
          <p>Total Products: {products.length}</p>
        </div>
      </div>

      <h2>Products by {seller.name}</h2>
      {products.length === 0 ? (
        <p>No products listed yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
            gap: 20,
          }}
        >
          {products.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ddd", padding: 10 }}>
              {p.image && (
                <img
                  src={p.image}
                  alt={p.title}
                  style={{ width: "100%", height: 140, objectFit: "cover" }}
                />
              )}
              <h4>{p.title}</h4>
              <p>₦{p.price}</p>
              <p>Stock: {p.stock}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}