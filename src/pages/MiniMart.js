import React from "react";
import { useNavigate } from "react-router-dom";

export default function MiniMart() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 20 }}>
      <h1>MiniMart</h1>
      <p>Welcome to MiniMart marketplace.</p>

      <button
        onClick={() => navigate("/mart-product")}
        style={{
          marginTop: 20,
          padding: "10px 16px",
          background: "#4da6ff",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer"
        }}
      >
        ➕ Add Product
      </button>
    </div>
  );
}