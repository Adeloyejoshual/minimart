import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const logAdminAction = async ({ adminEmail, role, action, target }) => {
  try {
    await addDoc(collection(db, "adminLogs"), {
      adminEmail,
      role,
      action,          // e.g. "Approved Seller"
      target,          // e.g. sellerId or productId
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Logging failed:", error);
  }
};