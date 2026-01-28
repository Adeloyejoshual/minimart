import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export const getAdminRole = async (email) => {
  const q = query(collection(db, "admins"), where("email", "==", email));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].data().role;
  }
  return null;
};