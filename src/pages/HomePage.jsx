import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const { user, logout } = useAuth0();
  const navigate = useNavigate();

  return (
    <div>
      <h1>Welcome to MiniMart Marketplace</h1>

      {user ? (
        <>
          <p>Hello, {user.name || user.email}!</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>Log Out</button>
        </>
      ) : (
        <>
          <button onClick={() => navigate("/login")}>Log In</button>
          <button onClick={() => navigate("/register")}>Sign Up</button>
        </>
      )}
    </div>
  );
}