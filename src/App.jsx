// src/App.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import AddProduct from "./pages/Marketplace/AddProduct.jsx";

function App() {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <Router>
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>MiniMart Marketplace</h1>

        {!isAuthenticated ? (
          <button onClick={() => loginWithRedirect()}>
            Log in
          </button>
        ) : (
          <>
            <button onClick={() => logout({ returnTo: window.location.origin })}>
              Log out
            </button>

            <Routes>
              <Route path="/" element={<HomePage user={user} />} />
              <Route path="/add-product" element={<AddProduct />} />
            </Routes>
          </>
        )}
      </div>
    </Router>
  );
}

export default App;