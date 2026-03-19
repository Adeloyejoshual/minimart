// src/components/AdminRoute.jsx
import { Navigate } from "react-router-dom";
import { getAdminToken } from "../utils/adminAuth";

export default function AdminRoute({ children }) {
  const token = getAdminToken();

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}