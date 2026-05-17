// LoginPage.jsx
import React from "react";
import "./login.css";

export default function LoginPage() {
  return (
    <div className="login-container">
      <div className="login-left">
        <h1 className="brand">MyApp</h1>
        <p>
          Connect with friends and the world around you on MyApp.
        </p>
      </div>

      <div className="login-right">
        <div className="login-card">
          <input type="text" placeholder="Email or Phone Number" />
          <input type="password" placeholder="Password" />

          <button className="login-btn">Log In</button>

          <a href="#" className="forgot">
            Forgotten password?
          </a>

          <hr />

          <button className="create-btn">
            Create New Account
          </button>
        </div>
      </div>
    </div>
  );
}