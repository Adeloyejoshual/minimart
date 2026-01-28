// src/utils/getAdminRole.js
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Returns the admin role for a given email.
 * - Checks .env for SuperAdmin first
 * - Then checks Firestore 'admins' collection
 * @param {string} email
 * @returns {string|null} role name or null if not an admin
 */
export async function getAdminRole(email) {
  // ---------------- SuperAdmin from .env ----------------
  const SUPERADMIN_EMAIL = process.env.REACT_APP_SUPERADMIN_EMAIL;

  if (email === SUPERADMIN_EMAIL) {
    return "SuperAdmin"; // redirect to /superadmin/dashboard
  }

  // ---------------- Firestore Admin Lookup ----------------
  try {
    const q = query(collection(db, "admins"), where("email", "==", email));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const admin = snap.docs[0].data();
      return admin.role || null; // e.g., "AdminManager", "Moderator"
    }
    return null;
  } catch (err) {
    console.error("Failed to get admin role:", err.message);
    return null;
  }
}