import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart Marketplace</h1>
      <p>Welcome! Use the links below to navigate:</p>
      <ul>
        <li><Link to="/login">Login</Link></li>
        <li><Link to="/register">Register</Link></li>
        <li><Link to="/marketplace/add-product">Add Product</Link></li>
        <li><Link to="/marketplace/listing/1">Listing Details</Link></li>
        <li><Link to="/marketplace/chat">Marketplace Chat</Link></li>
      </ul>
    </div>
  );
}