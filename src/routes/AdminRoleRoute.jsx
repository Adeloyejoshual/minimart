import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

export default function AdminRoleRoute({
  children,
  allowedRoles = ["Manager", "Admin", "Moderator", "Finance", "Support"]
}) {
  const [user, loadingUser] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (adminSnap.exists()) {
          setRole(adminSnap.data().role?.toLowerCase() || "manager");
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Failed to fetch admin role:", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  if (loadingUser || loading) return <p>Loading admin access...</p>;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (!role || !allowedRoles.map(r => r.toLowerCase()).includes(role)) return <Navigate to="/" replace />;

  // Redirect /admin to their role page automatically
  if (location.pathname === "/admin") {
    return <Navigate to={`/admin/${role}`} replace />;
  }

  return children;
}