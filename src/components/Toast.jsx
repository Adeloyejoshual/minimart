// src/components/Toast.jsx
import React, { useEffect } from "react";
import "./Toast.css";

export default function Toast({ message, type = "success", duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast ${type}`}>
      {message}
    </div>
  );
}