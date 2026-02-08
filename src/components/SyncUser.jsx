import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (roles && !roles.includes(user?.role)) {
    return <p>Unauthorized</p>;
  }

  return children;
}