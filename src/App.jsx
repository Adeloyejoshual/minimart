import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function App() {
  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>MiniMart Auth0 Test</h1>

      {isAuthenticated ? (
        <div>
          <p>Hello, {user.name}</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>
            Logout
          </button>
        </div>
      ) : (
        <div>
          <button onClick={() => loginWithRedirect({ authorizationParams: { prompt: "login" } })}>
            Login
          </button>
        </div>
      )}
    </div>
  );
}