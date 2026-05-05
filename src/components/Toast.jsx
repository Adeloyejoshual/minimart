// src/components/Toast.jsx
import React from "react";
import { Toaster } from "react-hot-toast";

export default function Toast() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerStyle={{ top: 12 }}
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: "13.5px",
          fontWeight: 600,
          padding: "11px 16px",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          maxWidth: "340px",
          lineHeight: 1.4,
        },
        success: {
          style: {
            background: "#16a34a",
            color: "#fff",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#16a34a",
          },
        },
        error: {
          style: {
            background: "#dc2626",
            color: "#fff",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#dc2626",
          },
        },
        loading: {
          style: {
            background: "#141210",
            color: "#fff",
          },
          iconTheme: {
            primary: "#FF5C00",
            secondary: "rgba(255,255,255,0.2)",
          },
        },
      }}
    />
  );
}
