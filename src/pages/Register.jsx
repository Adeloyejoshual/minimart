import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const RegisterPage = () => {
  const { loginWithRedirect, isLoading, error } = useAuth0();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Create an Account</h1>
      <p>Register to start using MiniMart Marketplace</p>
      <button
        onClick={() => loginWithRedirect({ screen_hint: "signup" })}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        Register
      </button>
    </div>
  );
};

export default RegisterPage;