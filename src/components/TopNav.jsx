// src/components/TopNav.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function TopNav({ user }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.reload(); // refresh to update user state
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid #ddd",
        marginBottom: 20,
        position: "sticky",
        top: 0,
        backgroundColor: "#fff",
        zIndex: 1000,
      }}
    >
      {/* Logo */}
      <div
        style={{ fontWeight: "bold", fontSize: 20, cursor: "pointer" }}
        onClick={() => navigate("/")}
      >
        MiniMart
      </div>

      {/* Right-side menu */}
      <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
        {!user ? (
          <>
            <button
              onClick={() => navigate("/auth")}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #007bff",
                background: "#007bff",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Login
            </button>
            <button
              onClick={() => navigate("/auth")}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #28a745",
                background: "#28a745",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Register
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate("/profile")}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #ccc",
                background: "#f5f5f5",
                cursor: "pointer",
              }}
            >
              Profile
            </button>
            <button
              onClick={() => navigate("/minimart/add")}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #007bff",
                background: "#007bff",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Add Product
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #dc3545",
                background: "#dc3545",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}