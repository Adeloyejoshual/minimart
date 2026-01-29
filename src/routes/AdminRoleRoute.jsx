// src/routes/AdminRoleRoute.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Wrapper for role-based Admin routes
export default function AdminRoleRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // Fetch user role from Firestore (Admin collection)
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        const adminData = adminDoc.data();

        if (adminData && ["Admin", "Moderator", "Finance", "Support"].includes(adminData.role)) {
          setRole(adminData.role);
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      } catch (err) {
        console.error("Admin role check failed", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  if (loading) return <p>Loading Admin...</p>;
  if (!authorized) return <Navigate to="/" replace />;

  return children;
}