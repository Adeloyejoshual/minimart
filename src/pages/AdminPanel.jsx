// src/pages/AdminPanel.jsx
import React from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { Navigate } from "react-router-dom";

export default function AdminPanel() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading admin panel...</p>;
  if (!user) return <Navigate to="/admin-login" replace />;

  return (
    <div style={{ padding: 40, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h1>Admin Panel</h1>
      <p>Welcome, {user.email}</p>
      <p>Select a section from the sidebar or navigate to your role dashboard.</p>
    </div>
  );
}