import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

export default function AdminRoleRoute({ children, allowedRoles = ["Admin", "Moderator", "Finance", "Support"] }) {
  const [user, loadingUser] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setIsAllowed(false);
        setLoading(false);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (!adminSnap.exists()) {
          setIsAllowed(false);
        } else {
          const role = adminSnap.data().role;
          setIsAllowed(allowedRoles.includes(role));
        }
      } catch (err) {
        console.error("Failed to check admin role:", err);
        setIsAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user, allowedRoles]);

  if (loadingUser || loading) return <p>Loading admin access...</p>;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (!isAllowed) return <Navigate to="/" replace />;

  return children;
}