import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Welcome to MiniMart Marketplace</h1>
      <p>This is the public homepage. Anyone can see this.</p>

      <div style={{ marginTop: "2rem" }}>
        <Link to="/login" style={{ marginRight: "1rem" }}>Login</Link>
        <Link to="/register">Register</Link>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <Link to="/minimart/cart">Go to MiniMart Cart (Protected)</Link>
      </div>
    </div>
  );
}