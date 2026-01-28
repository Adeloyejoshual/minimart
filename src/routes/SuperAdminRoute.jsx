import { Navigate } from "react-router-dom";

export default function SuperAdminRoute({ children }) {
  const isSuperAdmin = localStorage.getItem("superAdminLoggedIn") === "true";
  return isSuperAdmin ? children : <Navigate to="/superadmin-login" replace />;
}