// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

export default function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchProducts();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await axios.get(`${API}/users/${user.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await axios.get(`${API}/products?sellerId=${user.id}`);
      setProducts(res.data.products || res.data); // handle API shape
    } catch (err) {
      console.error("Failed to fetch user products", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  if (loadingProfile) return <p>Loading profile...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      {/* Profile Header */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div>
          <img
            src={profile.profile_image || "https://via.placeholder.com/150"}
            alt={profile.name}
            style={{ width: 150, height: 150, borderRadius: "50%", objectFit: "cover" }}
          />
        </div>
        <div>
          <h1>{profile.name}</h1>
          <p>Email: {profile.email}</p>
          {profile.phone_number && <p>Phone: {profile.phone_number}</p>}
          {profile.country && <p>Location: {profile.city}, {profile.state}, {profile.country}</p>}
          <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
          <p>Total Products: {products.length}</p>
        </div>
      </div>

      {/* User Products */}
      {loadingProducts ? (
        <p>Loading your products...</p>
      ) : products.length > 0 ? (
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
      ) : (
        <p>You haven’t added any products yet.</p>
      )}
    </div>
  );
}