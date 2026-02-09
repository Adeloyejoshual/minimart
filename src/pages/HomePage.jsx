import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Welcome to MiniMart Marketplace</h1>
      <p>This is a simple homepage to test routing and rendering.</p>

      <div style={{ marginTop: "1.5rem" }}>
        <h2>Navigation</h2>
        <ul>
          <li>
            <Link to="/login">Login</Link>
          </li>
          <li>
            <Link to="/register">Register</Link>
          </li>
          <li>
            <Link to="/marketplace/add-product">Add Marketplace Product</Link>
          </li>
          <li>
            <Link to="/marketplace/listing/1">Sample Listing Details</Link>
          </li>
          <li>
            <Link to="/marketplace/chat">Marketplace Chat</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}