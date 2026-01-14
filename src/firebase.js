// Import the functions you need from the SDKs
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNkENjrUMZQ8Qtt6h3qa1CQPP1vXvMZ9g",
  authDomain: "minimart-6bc70.firebaseapp.com",
  projectId: "minimart-6bc70",
  storageBucket: "minimart-6bc70.firebasestorage.app",
  messagingSenderId: "454404376757",
  appId: "1:454404376757:web:e78ed2d388e1be2cdfd6fc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);