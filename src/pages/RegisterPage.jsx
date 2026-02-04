import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function RegisterPage() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div>
      <h2>Sign Up</h2>
      <button onClick={() => loginWithRedirect({ screen_hint: "signup" })}>
        Sign Up with Auth0
      </button>
    </div>
  );
}