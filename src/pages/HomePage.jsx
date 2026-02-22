// src/pages/HomePage.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const { isAuthenticated, user, logout, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome to MiniMart Marketplace</h1>

      {isAuthenticated ? (
        <div>
          <p>Hello, {user?.name || user?.email}</p>

          <div style={{ marginBottom: 20 }}>
            <Link to="/add-product">
              <button>Add Product</button>
            </Link>

            <button
              style={{ marginLeft: 8 }}
              onClick={() => logout({ returnTo: window.location.origin })}
            >
              Logout
            </button>
          </div>

          <nav>
            <Link to="/">Dashboard</Link> |{" "}
            <Link to="/products">Products</Link>
          </nav>
        </div>
      ) : (
        <div>
          <p>You are not logged in.</p>

          <button onClick={() => loginWithRedirect()}>Login</button>
          <button
            style={{ marginLeft: 8 }}
            onClick={() => loginWithRedirect({ screen_hint: "signup" })}
          >
            Register
          </button>
        </div>
      )}
    </div>
  );
}