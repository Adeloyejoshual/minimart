// src/utils/getAdminPerformance.js
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export const getAdminPerformance = async (actionType = "Resolved Dispute") => {
  const q = query(collection(db, "adminLogs"), where("action", "==", actionType));
  const snapshot = await getDocs(q);

  const counts = {};
  snapshot.forEach(doc => {
    const { adminEmail } = doc.data();
    counts[adminEmail] = (counts[adminEmail] || 0) + 1;
  });

  // Convert to array for charting
  return Object.entries(counts).map(([adminEmail, count]) => ({ adminEmail, count }));
};