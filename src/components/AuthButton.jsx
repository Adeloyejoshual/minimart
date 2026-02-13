// src/components/AuthButton.jsx
import { useAuth0 } from "@auth0/auth0-react";

export default function AuthButton() {
  const { loginWithRedirect, logout, isAuthenticated } = useAuth0();

  return isAuthenticated ? (
    <button
      className="chat-btn"
      onClick={() => logout({ returnTo: window.location.origin })}
    >
      Logout
    </button>
  ) : (
    <button className="chat-btn" onClick={() => loginWithRedirect()}>
      Login
    </button>
  );
}