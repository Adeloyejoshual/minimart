import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isAuthenticated, user, logout, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  if (isAuthenticated) {
    return (
      <div style={{ padding: "16px" }}>
        <h2>Welcome, {user.name || user.email}</h2>
        <button
          style={{ padding: "12px", borderRadius: "8px", cursor: "pointer" }}
          onClick={() => logout({ returnTo: window.location.origin })}
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <h2>Sign In</h2>
      <button
        style={{ padding: "12px", borderRadius: "8px", cursor: "pointer" }}
        onClick={() => loginWithRedirect()}
      >
        Login with Auth0
      </button>
    </div>
  );
}