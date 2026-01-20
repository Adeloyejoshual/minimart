// src/components/Toast.js
import React, { useEffect, useState } from "react";

export default function Toast({ message, icon = "⚡", visible, duration = 3000 }) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
    if (visible) {
      const timer = setTimeout(() => setShow(false), duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#0d6efd",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "8px",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      zIndex: 5000,
      opacity: 1,
      pointerEvents: "auto",
      transition: "opacity 0.3s ease, transform 0.3s ease",
    }}>
      <span style={{ fontSize: "18px" }}>{icon}</span>
      <span>{message}</span>
    </div>
  );
}