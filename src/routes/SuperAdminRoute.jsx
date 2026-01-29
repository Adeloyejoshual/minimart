import { Navigate } from "react-router-dom";

// Wrapper for SuperAdmin protected routes
export default function SuperAdminRoute({ children }) {
  const token = localStorage.getItem("superadmin-token");

  if (!token) {
    // Not logged in
    return <Navigate to="/superadmin-login" replace />;
  }

  return children;
}