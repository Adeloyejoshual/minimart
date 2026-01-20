// src/components/Toast.jsx
import React, { useEffect } from "react";
import "./Toast.css"; // We'll style it next

export default function Toast({ message, duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="toast">
      {message}
    </div>
  );
}