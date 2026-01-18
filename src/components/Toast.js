// src/components/Toast.js
import React from "react";
import "./Toast.css";

export default function Toast({ message, icon, visible }) {
  if (!visible) return null;

  return (
    <div className="toast-container">
      <div className="toast-icon">{icon}</div>
      <div className="toast-message">{message}</div>
    </div>
  );
}