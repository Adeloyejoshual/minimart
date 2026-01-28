// components/admin/Header.jsx
import React from "react";
import { FaBell, FaSearch } from "react-icons/fa";

export default function Header({ adminName }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 20px",
      background: "#fff",
      borderBottom: "1px solid #ddd"
    }}>
      <div style={{ fontWeight: 700, fontSize: 20 }}>Marketplace Admin</div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <FaBell size={20} />
          <span style={{
            position: "absolute",
            top: -4,
            right: -4,
            background: "red",
            color: "#fff",
            borderRadius: "50%",
            fontSize: 10,
            padding: "2px 5px"
          }}>3</span>
        </div>
        <div>
          <input type="text" placeholder="Search users or complaints..." style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc" }} />
        </div>
        <div>{adminName}</div>
      </div>
    </div>
  );
}