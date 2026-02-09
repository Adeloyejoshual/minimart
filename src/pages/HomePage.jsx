import React from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function HomePage() {
  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>MiniMart</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart - Home</h1>

      {isAuthenticated ? (
        <>
          <p>Welcome, {user.name || user.email}!</p>
          <p>Email: {user.email}</p>
          <button
            onClick={() => logout({ returnTo: window.location.origin })}
            style={{ marginRight: "1rem" }}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <p>You are not logged in.</p>
          <button
            onClick={() => loginWithRedirect()}
            style={{ marginRight: "1rem" }}
          >
            Login
          </button>
          <Link to="/register">
            <button>Register</button>
          </Link>
        </>
      )}

      <hr style={{ margin: "2rem 0" }} />

      <nav>
        <Link to="/" style={{ marginRight: "1rem" }}>Home</Link>
        <Link to="/login" style={{ marginRight: "1rem" }}>Login</Link>
        <Link to="/register">Register</Link>
      </nav>
    </div>
  );
}