// src/components/Toast.jsx
import React from "react";
import { Toaster } from "react-hot-toast";

export default function Toast() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        className: "",
        duration: 4000,
        style: {
          background: "#fff",
          color: "#333",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          padding: "10px 14px",
          borderRadius: "8px",
        },
        success: {
          style: {
            background: "#28a745",
            color: "#fff",
          },
        },
        error: {
          style: {
            background: "#dc3545",
            color: "#fff",
          },
        },
      }}
    />
  );
}