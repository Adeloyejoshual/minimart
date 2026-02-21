// src/App.jsx
import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import api from "./api.js";
import HomePage from "./pages/HomePage.jsx";

function App() {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const res = await api.get("/api/marketplace", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProducts(res.data.products || []);
    } catch (err) {
      console.error("API fetch error:", err);
      alert("Failed to fetch products. See console for details.");
    }
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart Marketplace</h1>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>Log in</button>
      ) : (
        <>
          <button onClick={() => logout({ returnTo: window.location.origin })}>Log out</button>
          <HomePage user={user} products={products} fetchProducts={fetchProducts} />
        </>
      )}
    </div>
  );
}

export default App;