// src/pages/Profile.jsx
import React from "react";

export default function Profile({ user }) {
  if (!user) return <p>No user logged in. Please login first.</p>;

  // Sample placeholder data for testing
  const profile = {
    name: user.name || "John Doe",
    email: user.email || "johndoe@example.com",
    phone_number: "08123456789",
    country: "Nigeria",
    state: "Lagos",
    city: "Ikeja",
    created_at: new Date(),
    profile_image: "https://via.placeholder.com/150",
    products: [
      { id: 1, title: "Product 1", price: 1000, stock: 5, image: "https://via.placeholder.com/200" },
      { id: 2, title: "Product 2", price: 2500, stock: 10, image: "https://via.placeholder.com/200" },
    ],
  };

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <img
          src={profile.profile_image}
          alt={profile.name}
          style={{ width: 150, height: 150, borderRadius: "50%", objectFit: "cover" }}
        />
        <div>
          <h1>{profile.name}</h1>
          <p>Email: {profile.email}</p>
          <p>Phone: {profile.phone_number}</p>
          <p>Location: {profile.city}, {profile.state}, {profile.country}</p>
          <p>Joined: {profile.created_at.toLocaleDateString()}</p>
          <p>Total Products: {profile.products.length}</p>
        </div>
      </div>

      <h2>Your Products</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 20 }}>
        {profile.products.map((p) => (
          <div key={p.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 6 }}>
            <img src={p.image} alt={p.title} style={{ width: "100%", height: 140, objectFit: "cover" }} />
            <h4>{p.title}</h4>
            <p>₦{p.price}</p>
            <p>Stock: {p.stock}</p>
          </div>
        ))}
      </div>
    </div>
  );
}