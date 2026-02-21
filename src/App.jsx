// src/App.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import api from "./api.js";

function App() {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Auth0 Test App</h1>

      {!isAuthenticated && (
        <button onClick={() => loginWithRedirect()}>Log in</button>
      )}

      {isAuthenticated && (
        <div>
          <p>Welcome, {user.name}!</p>
          <p>Email: {user.email}</p>
          <button onClick={() => logout({ returnTo: window.location.origin })}>
            Log out
          </button>

          <hr />
          <h2>Test API Call</h2>
          <button
            onClick={async () => {
              try {
                const res = await api.get("/api/test");
                alert(JSON.stringify(res.data));
              } catch (err) {
                alert("API error: " + err.message);
              }
            }}
          >
            Call API
          </button>
        </div>
      )}
    </div>
  );
}

export default App;