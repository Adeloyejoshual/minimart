// /services/adsService.js

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";

export const checkAdLimit = async (userId, category, limit) => {
  const q = query(
    collection(db, "ads"),
    where("ownerId", "==", userId),
    where("category", "==", category),
    where("isPromoted", "==", false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size >= limit;
};

export const createAd = async (data) => {
  return addDoc(collection(db, "ads"), {
    ...data,
    createdAt: serverTimestamp()
  });
};