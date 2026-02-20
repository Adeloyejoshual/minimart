import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isLoading } = useAuth0();
  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <button
        onClick={() =>
          loginWithRedirect({ authorizationParams: { prompt: "login" } })
        }
      >
        Log In
      </button>
    </div>
  );
}