import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LoginPage = () => {
  const { loginWithRedirect, isLoading, error } = useAuth0();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Welcome Back!</h1>
      <p>Login to continue to MiniMart Marketplace</p>
      <button
        onClick={() => loginWithRedirect({ screen_hint: "login" })}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        Login
      </button>
    </div>
  );
};

export default LoginPage;