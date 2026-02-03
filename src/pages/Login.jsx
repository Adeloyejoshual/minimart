import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function Login() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Login</h1>
      <p>Click below to log in using Auth0</p>
      <button onClick={() => loginWithRedirect()}>Login</button>
    </div>
  );
}