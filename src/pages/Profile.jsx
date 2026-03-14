// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchProducts();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/users/${user.id}`);
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products?sellerId=${user.id}`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch user products", err);
    }
  };

  if (!profile) return <p>Loading profile...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div>
          <img
            src={profile.avatar || "https://via.placeholder.com/150"}
            alt={profile.name}
            style={{ width: 150, borderRadius: "50%" }}
          />
        </div>
        <div>
          <h1>{profile.name}</h1>
          <p>Email: {profile.email}</p>
          <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
          <p>Total Products: {products.length}</p>
        </div>
      </div>

      {products.length > 0 && (
        <>
          <h2>Your Products</h2>
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
        </>
      )}
    </div>
  );
}