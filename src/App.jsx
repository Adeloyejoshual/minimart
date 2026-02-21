// App.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import api from "./api.js";

function App() {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  const [products, setProducts] = React.useState([]);

  const fetchProducts = async () => {
    try {
      const res = await api.get("/api/marketplace");
      setProducts(res.data.products);
    } catch (err) {
      console.error("API error:", err);
    }
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>React + Auth0 + Axios Test</h1>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>Log In</button>
      ) : (
        <>
          <p>Welcome, {user.name}</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>Log Out</button>
        </>
      )}

      <hr />

      <button onClick={fetchProducts}>Fetch Products</button>

      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.name} (ID: {p.id})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;