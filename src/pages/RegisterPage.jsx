import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function RegisterPage() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Register Page</h1>
      <button
        onClick={() =>
          loginWithRedirect({ screen_hint: "signup" })
        }
      >
        Sign Up
      </button>
    </div>
  );
}