import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

function Register() {
  const { loginWithRedirect, isLoading } = useAuth0();

  const handleSignUp = () => {
    loginWithRedirect({
      screen_hint: "signup", // tells Auth0 to show the signup form
    });
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Create an Account</h1>
      <p>Sign up to access MiniMart and Marketplace features.</p>
      <button
        onClick={handleSignUp}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
          borderRadius: "8px",
          backgroundColor: "#0077FF",
          color: "white",
          border: "none",
        }}
      >
        Sign Up
      </button>
    </div>
  );
}

export default Register;