import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isLoading, isAuthenticated, user, logout } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  if (isAuthenticated) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Logged In</h1>
        <p>{user.email}</p>
        <button onClick={() => logout({ returnTo: window.location.origin })}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Login Page</h1>
      <button onClick={() => loginWithRedirect()}>Login / Sign Up</button>
    </div>
  );
}