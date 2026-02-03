import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function Register() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Register</h1>
      <p>Click below to register a new account</p>
      <button onClick={() => loginWithRedirect({ screen_hint: "signup" })}>
        Register
      </button>
    </div>
  );
}