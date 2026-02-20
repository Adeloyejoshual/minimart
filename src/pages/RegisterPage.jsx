import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function RegisterPage() {
  const { loginWithRedirect, isLoading } = useAuth0();
  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Register</h2>
      <button
        onClick={() =>
          loginWithRedirect({ screen_hint: "signup" }) // forces signup
        }
      >
        Sign Up
      </button>
    </div>
  );
}