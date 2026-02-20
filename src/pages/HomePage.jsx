// src/pages/HomePage.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function HomePage() {
  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Welcome to MiniMart Marketplace</h1>

      {isAuthenticated ? (
        <div>
          <p>Hello, {user.name} ({user.email})</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>
            Logout
          </button>
        </div>
      ) : (
        <div>
          <p>You are not logged in.</p>
          <button
            onClick={() => loginWithRedirect({ screen_hint: "login" })}
            style={{ marginRight: "10px" }}
          >
            Login
          </button>
          <button
            onClick={() => loginWithRedirect({ screen_hint: "signup" })}
          >
            Register
          </button>
        </div>
      )}
    </div>
  );
}