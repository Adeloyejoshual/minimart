// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().blocked) {
          auth.signOut();
          alert("Your MiniMart account has been blocked.");
          setUser(null);
        } else {
          setUser(u);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/auth" replace />; // redirect to landing page

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page with Login + Register */}
        <Route path="/auth" element={
          <div style={{ display: "flex", gap: "50px", justifyContent: "center", marginTop: "50px" }}>
            <Login />
            <Register />
          </div>
        } />

        {/* Protected Home / Product Feed */}
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />

        {/* Catch-all redirects */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Router>
  );
}

export default App;