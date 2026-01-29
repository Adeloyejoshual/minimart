// src/routes/SuperAdminRoute.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

// Wrapper for SuperAdmin routes
export default function SuperAdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const token = localStorage.getItem("superadmin-token"); // Example: store SuperAdmin JWT after login
        if (!token) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const res = await axios.get("/api/superadmin/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.role === "SuperAdmin") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      } catch (err) {
        console.error("SuperAdmin auth failed", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkSuperAdmin();
  }, []);

  if (loading) return <p>Loading SuperAdmin...</p>;
  if (!authorized) return <Navigate to="/superadmin-login" replace />;

  return children;
}