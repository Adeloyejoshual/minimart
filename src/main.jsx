// main.jsx - Updated for production Render deployment
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";

// Load env vars with validation for Render production
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin + "/";

console.log('Auth0 Config:', { domain, clientId, redirectUri }); // Debug log

// Validate required config
if (!domain || !clientId) {
  throw new Error('Missing Auth0 config: Check VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in Render Environment Variables');
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{ 
      redirect_uri: redirectUri,
      audience: import.meta.env.VITE_AUTH0_AUDIENCE // Optional: for API calls
    }}
    useRefreshTokens={true}
    cacheLocation="localstorage"
  >
    <App />
  </Auth0Provider>
);