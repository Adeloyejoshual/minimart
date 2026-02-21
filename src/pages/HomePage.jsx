import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const { isAuthenticated, user, logout, isLoading } = useAuth0();

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
          {/* Optional dashboard links */}
          <nav>
            <Link to="/">Dashboard</Link> |{" "}
            <Link to="/products">Products</Link>
          </nav>
        </div>
      ) : (
        <div>
          <p>You are not logged in.</p>
          <a href="/login">
            <button>Login</button>
          </a>
          <a href="/register">
            <button style={{ marginLeft: 8 }}>Register</button>
          </a>
        </div>
      )}
    </div>
  );
}