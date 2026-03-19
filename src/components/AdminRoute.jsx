import { Navigate } from "react-router-dom";
import { getToken } from "../utils/adminAuth";

export default function AdminRoute({ children }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}