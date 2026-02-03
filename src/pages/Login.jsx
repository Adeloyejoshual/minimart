// src/pages/LoginPage.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LoginPage = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      {!isAuthenticated ? (
        <>
          <button onClick={() => loginWithRedirect()}>Login</button>
          <button onClick={() => loginWithRedirect({ screen_hint: "signup" })}>
            Register
          </button>
        </>
      ) : (
        <div>
          <p>Welcome, {user.name || user.email}</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginPage;