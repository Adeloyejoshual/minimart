// src/components/TopNav.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function TopNav({ user }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid #ddd",
        marginBottom: 20,
      }}
    >
      <h2 style={{ margin: 0, cursor: "pointer" }} onClick={() => navigate("/")}>
        MiniMart
      </h2>

      {user ? (
        <button
          onClick={() => navigate("/profile")}
          style={{
            padding: "8px 15px",
            border: "none",
            background: "black",
            color: "white",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Profile
        </button>
      ) : (
        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "8px 15px",
            border: "none",
            background: "black",
            color: "white",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Login
        </button>
      )}
    </div>
  );
}