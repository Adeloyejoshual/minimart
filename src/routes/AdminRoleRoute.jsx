// src/routes/AdminRoleRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function AdminRoleRoute({ children, allowedRoles }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, "admins", auth.currentUser.uid));
        if (adminDoc.exists()) {
          setRole(adminDoc.data().role);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Failed to fetch admin role", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  if (loading) return <p>Loading admin info...</p>;
  if (!role || !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
}