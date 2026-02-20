import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function HomePage() {
  const { isAuthenticated, logout, user } = useAuth0();

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome to MiniMart Marketplace</h1>

      {isAuthenticated ? (
        <div>
          <p>Hello, {user.name}</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>
            Logout
          </button>
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