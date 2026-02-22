// src/pages/Marketplace/Message.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

export default function Message() {
  const { isAuthenticated, user, isLoading, loginWithRedirect, logout } = useAuth0();

  if (isLoading) return <p>Loading messages...</p>;

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 20 }}>
        <p>You must be logged in to view messages.</p>
        <button onClick={() => loginWithRedirect()}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Messages</h1>
      <p>Welcome, {user?.name || user?.email}</p>

      <div style={{
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}>
        {/* Example message list */}
        {["John Doe", "Jane Smith", "Marketplace Support"].map((sender, i) => (
          <div key={i} style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 10,
            backgroundColor: "#f9f9f9",
            cursor: "pointer"
          }}>
            <strong>{sender}</strong>
            <p style={{ margin: 0 }}>This is a sample message preview...</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Link to="/">
          <button style={{ marginRight: 8 }}>Dashboard</button>
        </Link>
        <Link to="/add-product">
          <button style={{ marginRight: 8 }}>Add Product</button>
        </Link>
        <Link to="/profile">
          <button style={{ marginRight: 8 }}>Profile</button>
        </Link>
        <button onClick={() => logout({ returnTo: window.location.origin })}>
          Logout
        </button>
      </div>
    </div>
  );
}