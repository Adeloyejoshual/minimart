// hooks/useAdLimits.js
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export const useAdLimitCheck = () => {

  const checkLimit = async (uid, category) => {
    // Your logic to check ad limits
    const q = query(collection(db, "ads"), where("ownerId", "==", uid), where("category", "==", category));
    const snapshot = await getDocs(q);
    return snapshot.size >= 1; // Or your free ad limit
  };

  return { checkLimit };
};