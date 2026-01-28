// src/components/admin/PrivateAdminRoute.jsx
import { Navigate } from "react-router-dom";

export default function PrivateAdminRoute({ children, allowedRoles = ["SuperAdmin", "Admin"] }) {
  const token = localStorage.getItem("adminToken");
  const role = localStorage.getItem("adminRole");

  if (!token || !role || !allowedRoles.includes(role)) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}