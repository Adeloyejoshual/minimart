import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function useAdminStats() {
  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    complaints: 0,
    pendingVerifications: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      const productsSnap = await getDocs(collection(db, "products"));
      const complaintsSnap = await getDocs(collection(db, "complaints"));
      const verifySnap = await getDocs(collection(db, "verifications"));

      const pending = verifySnap.docs.filter(d => d.data().status === "pending").length;

      setStats({
        users: usersSnap.size,
        products: productsSnap.size,
        complaints: complaintsSnap.size,
        pendingVerifications: pending,
      });
    };

    fetchStats();
  }, []);

  return stats;
}