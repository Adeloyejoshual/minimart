import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function HomePage() {
  const { isAuthenticated, logout, user, isLoading } = useAuth0();

  if (isLoading) return <p>Loading authentication...</p>; // wait for Auth0 to initialize

  return (
    <div style={{ padding: "16px" }}>
      <h1>Welcome to MiniMart Marketplace</h1>

      {isAuthenticated ? (
        <div>
          <p>
            Hello, {user.name || user.email}
          </p>
          <button
            style={{ padding: "12px", borderRadius: "8px", cursor: "pointer" }}
            onClick={() => logout({ returnTo: window.location.origin })}
          >
            Logout
          </button>
        </div>
      ) : (
        <div>
          <p>You are not logged in.</p>
          <a href="/login">
            <button style={{ padding: "12px", borderRadius: "8px", cursor: "pointer" }}>
              Login
            </button>
          </a>
          <a href="/register">
            <button
              style={{
                padding: "12px",
                borderRadius: "8px",
                cursor: "pointer",
                marginLeft: "8px",
              }}
            >
              Register
            </button>
          </a>
        </div>
      )}
    </div>
  );
}