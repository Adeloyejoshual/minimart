import React from "react";
import { Link } from "react-router-dom";

export default function Chat() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Marketplace Chat</h1>
      <p>Chat functionality will go here.</p>
      <Link to="/">Back to Home</Link>
    </div>
  );
}