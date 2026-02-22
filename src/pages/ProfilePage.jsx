// src/pages/ProfilePage.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout, loginWithRedirect } = useAuth0();

  if (isLoading) return <p>Loading profile...</p>;

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 20 }}>
        <p>You are not logged in.</p>
        <button onClick={() => loginWithRedirect()}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Your Profile</h1>

      <div style={{ marginBottom: 20 }}>
        {user.picture && (
          <img
            src={user.picture}
            alt={user.name || "Profile"}
            style={{ width: 100, borderRadius: "50%", marginBottom: 10 }}
          />
        )}
        <p>
          <strong>Name:</strong> {user.name || "N/A"}
        </p>
        <p>
          <strong>Email:</strong> {user.email || "N/A"}
        </p>
        <p>
          <strong>Nickname:</strong> {user.nickname || "N/A"}
        </p>
        <p>
          <strong>Last Login:</strong> {user.updated_at ? new Date(user.updated_at).toLocaleString() : "N/A"}
        </p>
      </div>

      <div>
        <Link to="/">
          <button style={{ marginRight: 8 }}>Dashboard</button>
        </Link>
        <Link to="/add-product">
          <button style={{ marginRight: 8 }}>Add Product</button>
        </Link>
        <button onClick={() => logout({ returnTo: window.location.origin })}>
          Logout
        </button>
      </div>
    </div>
  );
}